import '../../imports';
import { postMessageToRN } from '../../utils/webview-runtime';
// import './index.less';
// import './index.css';

const clearRef = { current: 0 };
const forceGlowRef = { current: 'auto' as 'auto' | 'off' | 'green' | 'red' };
const readyRef = { current: false, scheduled: false };

function setAnimationColor(isPositive: boolean) {
  const rootElement = document.documentElement;
  rootElement.style.setProperty(
    '--app-animation-color-rgb',
    isPositive ? '88, 198, 105' : '227, 73, 53',
  );
}

function clearAutoGlowTimer() {
  if (clearRef.current) {
    clearTimeout(clearRef.current);
    clearRef.current = 0;
  }
}

function hideGlow() {
  document.body.classList.remove('loading');
}

function showGlow(isPositive: boolean) {
  setAnimationColor(isPositive);
  document.body.classList.add('loading');
}

function applyForceGlowMode(mode: typeof forceGlowRef.current) {
  forceGlowRef.current = mode;
  clearAutoGlowTimer();

  if (mode === 'green') {
    showGlow(true);
    return;
  }
  if (mode === 'red') {
    showGlow(false);
    return;
  }

  hideGlow();
}

function postReadyAfterPaint() {
  if (readyRef.current || readyRef.scheduled) {
    return;
  }

  readyRef.scheduled = true;

  const complete = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        readyRef.current = true;
        postMessageToRN({
          type: 'GASKETVIEW:READY',
          timestamp: Date.now(),
        });
      });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', complete, { once: true });
  } else if (document.fonts?.ready) {
    document.fonts.ready.then(complete, complete);
  } else {
    complete();
  }
}

window.addEventListener('messageFromRN', function (event) {
  const message = (event as any as CustomEvent).detail as DuplexReceive;
  console.debug('[debug] onMessageFromRN event', message);

  switch (message.type) {
    case 'GOT_WINDOW_INFO': {
      const rootElement = document.documentElement;
      rootElement.style.setProperty(
        '--app-rect-width',
        `${message.info.width || rootElement.clientWidth}px`,
      );
      rootElement.style.setProperty(
        '--app-rect-height',
        `${message.info.height || rootElement.clientHeight}px`,
      );
      postReadyAfterPaint();
      break;
    }
    case 'GASKETVIEW:TOGGLE_LOADING': {
      if (forceGlowRef.current !== 'auto') {
        break;
      }

      if (message.info.loading) {
        const rootElement = document.documentElement;
        const durationMs = parseInt(
          `${message.animationDurationMs || ''}` || '2500',
        );
        const borderRadius = parseInt(
          `${message.animationGradientBorderRadius || ''}` || '20',
        );
        rootElement.style.setProperty(
          '--app-border-radius',
          `${borderRadius}px`,
        );

        rootElement.style.setProperty('--app-animation-ms', `${durationMs}`);
        showGlow(message.info.isPositive);
        clearAutoGlowTimer();

        clearRef.current = setTimeout(() => {
          clearRef.current = 0;
          hideGlow();
        }, durationMs);
      } else {
        // if there is a pending clear timeout, dont clear immediately
        if (!clearRef.current) {
          hideGlow();
        }
      }
      break;
    }
    case 'GASKETVIEW:SET_FORCE_GLOW': {
      applyForceGlowMode(message.info.mode);
      break;
    }
  }
});

postMessageToRN({ type: 'GET_WINDOW_INFO' });
