import { useEffect, useLayoutEffect } from 'react';
import { Linking } from 'react-native';
import { t } from 'i18next';
import { keyringService } from '@/core/services/keyringRuntime';
import { urlUtils } from '@rabby-wallet/base-utils';
import useMount from 'react-use/lib/useMount';
import { toastWithIcon } from '@/components2024/Toast';
import { RcIconInfoForToast } from '@/screens/Unlock/icons';
import { getPwdStatus } from './useLock';
import {
  ALLOWED_UL_DOMAINS,
  UL_MATCH_PREFIX,
  WALLETCONNECT_REDIRECT_PATH,
} from '@/constant/universalLink';
import { RefLikeObject } from '@/utils/type';
import { markWalletConnectDappRedirectPending } from '@/core/walletconnect/redirectState';
import { parseWalletConnectUriFromLink } from '@/core/walletconnect/uri';
import { startStartupTraceSpan, traceStartup } from '@/core/utils/startupTrace';

const nextAppLinkRef = {
  current: '' as string,
};

const enum PasswordStatus {
  UseBuiltIn = 1,
}

function getNextAppLink() {
  return nextAppLinkRef.current;
}

function setNextAppLink(linkOrSetter: string | ((prev: string) => string)) {
  if (typeof linkOrSetter === 'function') {
    nextAppLinkRef.current = linkOrSetter(nextAppLinkRef.current);
  } else {
    nextAppLinkRef.current = linkOrSetter || '';
  }
}

type OnParseUrlAndProcessAction = (payload: {
  type: 'open-dapp' | 'walletconnect-uri' | 'walletconnect-redirect';
  dappUrl?: string;
  uri?: string;
}) => void;

function isWalletConnectRedirectLink(appLink: string) {
  const urlInfo = urlUtils.safeParseURL(appLink);
  if (!urlInfo) {
    return false;
  }

  if (urlInfo.protocol === 'rabby:') {
    const target = urlInfo.hostname || urlInfo.pathname.replace(/^\/+/, '');
    return target === WALLETCONNECT_REDIRECT_PATH || target === 'wc';
  }

  if (!ALLOWED_UL_DOMAINS.some(domain => appLink.startsWith(domain))) {
    return false;
  }

  if (!urlInfo.pathname.startsWith(UL_MATCH_PREFIX)) {
    return false;
  }

  const target = urlInfo.pathname
    .slice(UL_MATCH_PREFIX.length)
    .replace(/^\/+/, '')
    .split('/')[0];
  return target === WALLETCONNECT_REDIRECT_PATH || target === 'wc';
}

function parseActionAndProcessLink(
  appLink: string,
  onActions?: OnParseUrlAndProcessAction,
) {
  const walletConnectUri = parseWalletConnectUriFromLink(appLink);
  if (walletConnectUri) {
    onActions?.({
      type: 'walletconnect-uri',
      uri: walletConnectUri,
    });
    return;
  }

  if (isWalletConnectRedirectLink(appLink)) {
    onActions?.({
      type: 'walletconnect-redirect',
    });
    return;
  }

  if (!ALLOWED_UL_DOMAINS.some(domain => appLink.startsWith(domain))) return;

  const urlInfo = urlUtils.safeParseURL(appLink);
  if (!urlInfo) return;
  const rabbyGoCmd = urlInfo.searchParams.get('_cmd');
  if (!rabbyGoCmd) return;

  if (rabbyGoCmd === 'open-dapp') {
    const dappUrlRaw = urlInfo.searchParams.get('dapp');
    const dappUrl = dappUrlRaw ? decodeURIComponent(dappUrlRaw) : '';
    if (!dappUrl) {
      console.warn(
        '[useUniversalLinkOnTop] No dapp URL found in link:',
        appLink,
      );
      return;
    }

    console.debug('[useUniversalLinkOnTop] Opening dapp URL:', dappUrl);
    onActions?.({
      type: 'open-dapp',
      dappUrl,
    });
    return;
  }
}

const toastTip = toastWithIcon(RcIconInfoForToast);

const handleActions: OnParseUrlAndProcessAction = payload => {
  switch (payload.type) {
    case 'open-dapp':
      if (!payload.dappUrl) {
        return;
      }
      import('./browser/useBrowser')
        .then(({ browserApis }) => {
          browserApis.openTab(payload.dappUrl!, {
            isNewTab: true,
          });
        })
        .catch(error => {
          console.error('universalLink open dapp::error', error);
        });
      break;
    case 'walletconnect-uri':
      if (!payload.uri) {
        return;
      }
      import('@/core/walletconnect/pairing')
        .then(({ pairWalletConnectUri }) =>
          pairWalletConnectUri({
            uri: payload.uri!,
            source: 'deeplink',
          }),
        )
        .catch(() => {
          // WalletConnectModalHost consumes the pairing error event once.
        });
      break;
    case 'walletconnect-redirect':
      markWalletConnectDappRedirectPending('metadata_redirect');
      break;
  }
};

const hideToastRef: RefLikeObject<() => void | null> = { current: () => null };
const handleAppLink = async (url: string, isInit = false) => {
  const { getRabbyLockInfo, isUnlockSessionValid } = await import(
    '@/core/apis/lock'
  );
  if (keyringService.isUnlocked() || isUnlockSessionValid()) {
    // Parse the link when the wallet is fully unlocked or in a valid post-unlock session.
    parseActionAndProcessLink(url, handleActions);
    setNextAppLink('');
  } else if (
    getPwdStatus() === PasswordStatus.UseBuiltIn ||
    (await getRabbyLockInfo()).isUseBuiltInPwd
  ) {
    hideToastRef.current = toastTip(
      t('page.universalLink.error.setupWalletFirst'),
      {
        duration: 3000,
        hideOnPress: true,
      },
    );
    setNextAppLink('');
  } else {
    if (isInit) {
      setNextAppLink(prev => prev || url);
    } else {
      setNextAppLink(url);
    }
  }
};

export function useUniversalLinkOnTop() {
  useMount(() => {
    const endTrace = startStartupTraceSpan('universal_link_initial_url_effect');
    Linking.getInitialURL().then(url => {
      if (url) {
        console.debug('[useUniversalLinkOnTop] Initial URL:', url);
        handleAppLink(url, true);
      }
    });
    endTrace('scheduled');
  });

  useEffect(() => {
    const endTrace = startStartupTraceSpan('universal_link_listener_effect');
    const subscription = Linking.addEventListener('url', event => {
      console.debug('[useUniversalLinkOnTop] App Link:', event.url);
      handleAppLink(event.url);
    });
    endTrace('end');

    return () => {
      subscription.remove();
    };
  }, []);

  useLayoutEffect(() => {
    traceStartup('universal_link_unlock_listener_layout_effect_start');
    const onUnlock = () => {
      hideToastRef.current?.();
      const nextAppLink = getNextAppLink();
      if (nextAppLink) {
        setNextAppLink(''); // Clear the link after handling
        parseActionAndProcessLink(nextAppLink, handleActions);
      }
    };
    keyringService.on('unlock', onUnlock);
    traceStartup('universal_link_unlock_listener_layout_effect_end');

    return () => {
      keyringService.off('unlock', onUnlock);
    };
  }, []);
}
