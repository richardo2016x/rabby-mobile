import { Platform } from 'react-native';

import { APP_RUNTIME_ENV, BUILD_CHANNEL } from '@/constant/env';
import { logger } from '@/utils/logger';

const isAndroid = Platform.OS === 'android';
const isStartupTraceEnabled =
  isAndroid &&
  (APP_RUNTIME_ENV !== 'production' || BUILD_CHANNEL !== 'appstore');
const isStartupTraceToastEnabled = false;
const startupTraceStartedAt =
  (
    globalThis as typeof globalThis & {
      __RABBY_STARTUP_EARLY_TRACE__?: { startedAt: number };
    }
  ).__RABBY_STARTUP_EARLY_TRACE__?.startedAt ?? Date.now();
const startupMarks: Record<string, number> = {};
const startupOnceEvents = new Set<string>();
const activeFrameTraceKeys = new Set<string>();
let startupToastSeq = 0;
let startupToastQueue = Promise.resolve();

const STARTUP_TOAST_EVENTS = new Set([
  'app_navigation_ready',
  'home_mount',
  'home_startup_ready',
  'home_post_startup_ready',
  'setup_before_render_deferred_call_start',
  'setup_before_render_deferred_call_end',
  'setup_runtime_import_start',
  'setup_runtime_import_end',
  'readable_account_bootstrap_import_start',
  'readable_account_bootstrap_import_end',
  'readable_stores_import_start',
  'readable_stores_import_end',
  'bootstrap_initial_lock_state_end',
  'bootstrap_post_render_warmups_start',
  'bootstrap_post_render_warmups_end',
  'bootstrap_get_tried_unlock_end',
  'bootstrap_load_security_chain_end',
  'bootstrap_fetch_biometrics_end',
  'home_mount_readable_stores_start',
  'home_mount_readable_stores_end',
  'initReadableAccountStores_start',
  'initReadableAccountStores_end',
  'initPersistedStores_start',
  'initPersistedStores_end',
  'frame_gap',
]);

function getRelativeTime(now = Date.now()) {
  return now - startupTraceStartedAt;
}

function getSinceMark(mark: string, now = Date.now()) {
  const markedAt = startupMarks[mark];
  return markedAt ? now - markedAt : undefined;
}

export function traceStartup(
  event: string,
  data: Record<string, unknown> = {},
) {
  if (!isStartupTraceEnabled) {
    return;
  }

  const now = Date.now();
  const payload = {
    t: getRelativeTime(now),
    sinceAppNavigationReady: getSinceMark('app_navigation_ready', now),
    sinceHomeStartupReady: getSinceMark('home_startup_ready', now),
    sinceHomePostStartupReady: getSinceMark('home_post_startup_ready', now),
    ...data,
  };

  logger.info(`[RabbyStartupTrace] ${event}`, payload);
  console.info('[RabbyStartupTrace]', event, payload);
  showStartupTraceToast(event, payload);
}

export function markStartupTrace(
  mark: string,
  data: Record<string, unknown> = {},
) {
  startupMarks[mark] = Date.now();
  traceStartup(mark, data);
}

export function traceStartupOnce(
  event: string,
  data: Record<string, unknown> = {},
) {
  if (startupOnceEvents.has(event)) {
    return;
  }

  startupOnceEvents.add(event);
  traceStartup(event, data);
}

export function startStartupTraceSpan(
  event: string,
  data: Record<string, unknown> = {},
) {
  const startedAt = Date.now();
  traceStartup(`${event}_start`, data);

  return (status = 'end', extra: Record<string, unknown> = {}) => {
    traceStartup(`${event}_${status}`, {
      ...data,
      ...extra,
      elapsedMs: Date.now() - startedAt,
    });
  };
}

export function startStartupFrameTrace(
  reason: string,
  options: {
    durationMs?: number;
    longFrameThresholdMs?: number;
  } = {},
) {
  if (!isStartupTraceEnabled) {
    return;
  }

  const durationMs = options.durationMs ?? 5000;
  const longFrameThresholdMs = options.longFrameThresholdMs ?? 50;
  const key = `${reason}:${durationMs}:${longFrameThresholdMs}`;
  if (activeFrameTraceKeys.has(key)) {
    return;
  }

  activeFrameTraceKeys.add(key);

  const startedAt = Date.now();
  let lastFrameAt = startedAt;
  let frameCount = 0;
  let longFrameCount = 0;
  let maxGapMs = 0;
  const capturedLongFrames: Array<{ atMs: number; gapMs: number }> = [];

  traceStartup('frame_trace_start', {
    reason,
    durationMs,
    longFrameThresholdMs,
  });

  const tick = () => {
    const now = Date.now();
    const gapMs = now - lastFrameAt;
    const atMs = now - startedAt;

    frameCount += 1;
    lastFrameAt = now;
    maxGapMs = Math.max(maxGapMs, gapMs);

    if (gapMs >= longFrameThresholdMs) {
      longFrameCount += 1;
      const longFrame = { atMs, gapMs };
      if (capturedLongFrames.length < 20) {
        capturedLongFrames.push(longFrame);
      }
      traceStartup('frame_gap', {
        reason,
        ...longFrame,
      });
    }

    if (atMs >= durationMs) {
      activeFrameTraceKeys.delete(key);
      traceStartup('frame_trace_end', {
        reason,
        durationMs,
        frameCount,
        longFrameCount,
        maxGapMs,
        capturedLongFrames,
      });
      return;
    }

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

function showStartupTraceToast(
  event: string,
  data: Record<string, unknown> = {},
) {
  if (!isStartupTraceToastEnabled) {
    return;
  }

  if (!STARTUP_TOAST_EVENTS.has(event)) {
    return;
  }

  const seq = ++startupToastSeq;
  const shortEvent = event
    .replace('setup_before_render_deferred_call', 'setup_defer')
    .replace('setup_runtime_import', 'runtime_import')
    .replace('readable_account_bootstrap_import', 'warmup_import')
    .replace('home_mount_readable_stores', 'home_readable')
    .replace('initReadableAccountStores', 'readableStores')
    .replace('initPersistedStores', 'persistedStores')
    .replace('bootstrap_initial_lock_state', 'lock_state')
    .replace('bootstrap_post_render_warmups', 'post_bootstrap')
    .replace('bootstrap_get_tried_unlock', 'tried_unlock')
    .replace('bootstrap_load_security_chain', 'security_chain')
    .replace('bootstrap_fetch_biometrics', 'biometrics')
    .replace('home_startup_ready', 'home_ready')
    .replace('home_post_startup_ready', 'home_post_ready')
    .replace('app_navigation_ready', 'nav_ready');
  const gap = typeof data.gapMs === 'number' ? ` gap=${data.gapMs}ms` : '';
  const elapsed =
    typeof data.elapsedMs === 'number' ? ` cost=${data.elapsedMs}ms` : '';
  const message = `#${seq} ${shortEvent} +${data.t ?? '-'}ms${gap}${elapsed}`;

  startupToastQueue = startupToastQueue
    .catch(() => undefined)
    .then(
      () =>
        new Promise<void>(resolve => {
          setTimeout(() => {
            try {
              const { toast } =
                require('@/components2024/Toast') as typeof import('@/components2024/Toast');
              toast.info(message, {
                duration: 900,
              });
            } catch (error) {
              console.info('[RabbyStartupTrace:toast_error]', message, error);
            } finally {
              setTimeout(resolve, 950);
            }
          }, 0);
        }),
    );
}
