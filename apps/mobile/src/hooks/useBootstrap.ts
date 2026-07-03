import * as React from 'react';
import EntryScriptWeb3 from '@/core/bridges/EntryScriptWeb3';
import { EntryScriptVConsole } from '@/core/bridges/builtInScripts/loadVConsole';
import { JS_LOG_ON_MESSAGE } from '@/core/bridges/builtInScripts/onMessage';
import {
  BROWSER_SCRIPT_BASE,
  JS_GET_WINDOW_INFO_AFTER_LOAD,
  SPA_urlChangeListener,
  JSBridgeHarden,
} from '@rabby-wallet/rn-webview-bridge';
import { loadSecurityChain } from './global';
import SplashScreen from 'react-native-splash-screen';
// import { browserStateAtom } from './browser/useBrowser';
import { RefLikeObject } from '@/utils/type';
import { zCreate } from '@/core/utils/reexports';
import {
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import {
  markStartupTrace,
  startStartupTraceSpan,
  traceStartup,
} from '@/core/utils/startupTrace';
import { replace } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { perfEvents } from '@/core/utils/perf';
import { runAfterHomePostStartupReady } from '@/core/utils/homeStartupReady';

type ServicesModule = typeof import('@/core/services');
type LockHookModule = typeof import('./useLock');

const servicesModuleRef = {
  promise: null as Promise<ServicesModule> | null,
};
const lockHookModuleRef = {
  promise: null as Promise<LockHookModule> | null,
};

function loadServicesModule() {
  return (servicesModuleRef.promise ||= import('@/core/services'));
}

function loadLockHookModule() {
  return (lockHookModuleRef.promise ||= import('./useLock'));
}

const syncCustomTestChainList = async () => {
  try {
    const { customTestnetService } = await loadServicesModule();
    customTestnetService.syncChainList();
  } catch (e) {
    console.error(e);
  }
};

type BootStrapState = {
  couldRender: boolean;
};
const zBootstrapStore = zCreate<BootStrapState>(() => ({
  couldRender: false,
}));
function setBootstrap(valOrFunc: UpdaterOrPartials<BootStrapState>) {
  zBootstrapStore.setState(
    prev => resolveValFromUpdater(prev, valOrFunc).newVal,
  );
}

const DEBUG_IN_PAGE_SCRIPTS = {
  LOAD_BEFORE: __DEV__
    ? // leave here for debug
      `window.alert('DEBUG_IN_PAGE_LOAD_BEFORE')`
    : ``,
  LOAD_AFTER: __DEV__
    ? // leave here for debug
      `
;(function() {
    setTimeout(function () {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(
        {
          type: 'RabbyContentScript:Debug:LoadLastChunk',
          payload: {
            time: Date.now(),
          }
        }
      ));
    }, 20);
  })();
  `
    : ``,
};

const apiInitializedRef: RefLikeObject<boolean> = { current: false };
const doInitializeApis = async () => {
  if (apiInitializedRef.current) return;
  apiInitializedRef.current = true;

  try {
    const [{ initServices }, { initApis }] = await Promise.all([
      import('@/core/services/init'),
      import('@/core/apis/init'),
    ]);

    await initServices();
    await initApis();
    await syncCustomTestChainList();
  } catch (error) {
    console.error('useInitializeAppOnTop::error', error);
    apiInitializedRef.current = false;
  }
};

async function resetPerpsStateOnLock() {
  const endTrace = startStartupTraceSpan('bootstrap_reset_perps_on_lock');

  try {
    const [{ apisPerpsStore }, { apisPerps }] = await Promise.all([
      import('./perps/usePerpsStore'),
      import('@/core/apis/perps'),
    ]);

    apisPerpsStore.logout();
    apisPerps.destroyPerpsSDK();
    endTrace('end');
  } catch (error) {
    endTrace('error', {
      error: error instanceof Error ? error.message : String(error),
    });
    console.error('resetPerpsStateOnLock::error', error);
  }
}

async function getIsUnlockSessionValid() {
  const apisLock = await import('@/core/apis/lock');
  return apisLock.isUnlockSessionValid();
}

async function updateLockStateAfterAccounts(options: { appUnlocked: boolean }) {
  const [{ storeApiAccounts }, { storeApiLock }, { keyringService }] =
    await Promise.all([
      import('./account'),
      loadLockHookModule(),
      loadServicesModule(),
    ]);
  const [accounts, isUnlockSessionValid] = await Promise.all([
    storeApiAccounts.fetchAccounts(),
    getIsUnlockSessionValid(),
  ]);

  storeApiLock.setAppLock((prev: any) => ({
    ...prev,
    appUnlocked: options.appUnlocked,
    isUnlockSessionValid,
    hasVisibleAccounts: accounts.length > 0,
    hasStoredKeyrings:
      accounts.length > 0 ||
      keyringService.hasVault() ||
      keyringService.hasEncryptedKeyringData() ||
      keyringService.hasUnencryptedKeyringData(),
  }));
}

/**
 * @description only call this hook on the top level component
 */
export function useInitializeAppOnTop() {
  React.useEffect(() => {
    const onUnlock = async () => {
      console.debug('useBootstrap::onUnlock');
      const { storeApiLock } = await loadLockHookModule();
      const isUnlockSessionValid = await getIsUnlockSessionValid();
      storeApiLock.setAppLock(prev => ({
        ...prev,
        appUnlocked: true,
        isUnlockSessionValid,
      }));
    };
    const onUnlockUIReady = () => {
      import('@/core/apis/analytics')
        .then(({ sendUserAddressEvent }) => sendUserAddressEvent())
        .catch(error => {
          console.error('sendUserAddressEvent::error', error);
        });

      doInitializeApis();
      updateLockStateAfterAccounts({ appUnlocked: true }).catch(error => {
        console.error('updateLockStateAfterAccounts::unlock::error', error);
      });
      loadServicesModule()
        .then(({ perpsService }) => perpsService.unlockAgentWallets())
        .catch(error => {
          console.error('perpsService.unlockAgentWallets::error', error);
        });
    };
    const onLock = async () => {
      const { storeApiLock } = await loadLockHookModule();
      const isUnlockSessionValid = await getIsUnlockSessionValid();
      storeApiLock.setAppLock(prev => ({
        ...prev,
        appUnlocked: false,
        isUnlockSessionValid,
      }));
      updateLockStateAfterAccounts({ appUnlocked: false }).catch(error => {
        console.error('updateLockStateAfterAccounts::lock::error', error);
      });
      import('./browser/useBrowser')
        .then(({ setBrowserState }) => {
          setBrowserState({
            isShowBrowser: false,
            isShowSearch: false,
            isShowManage: false,
            searchText: '',
            searchTabId: '',
            trigger: '',
          });
        })
        .catch(error => {
          console.error('setBrowserState on lock::error', error);
        });
      loadServicesModule()
        .then(({ perpsService }) => perpsService.lockAgentWallets())
        .catch(error => {
          console.error('perpsService.lockAgentWallets::error', error);
        });
      void resetPerpsStateOnLock();
    };
    const sub = perfEvents.subscribe('USER_MANUALLY_UNLOCK', onUnlock);
    const subUIReady = perfEvents.subscribe(
      'USER_MANUALLY_UNLOCK_UI_READY',
      onUnlockUIReady,
    );
    let cleanupKeyringListener: (() => void) | null = null;
    let cancelled = false;
    const cancelHomeReadyWait = runAfterHomePostStartupReady(
      () => {
        loadServicesModule()
          .then(({ keyringService }) => {
            if (cancelled) {
              return;
            }
            keyringService.on('lock', onLock);
            cleanupKeyringListener = () => keyringService.off('lock', onLock);
          })
          .catch(error => {
            console.error('register keyring lock listener::error', error);
          });
      },
      {
        label: 'bootstrap_keyring_lock_listener',
        fallbackMs: 5000,
      },
    );

    return () => {
      cancelled = true;
      cancelHomeReadyWait();
      sub.remove();
      subUIReady.remove();
      cleanupKeyringListener?.();
    };
  }, []);

  React.useEffect(() => {
    const onUnlock = async () => {
      const { apisSafe } = await import('@/core/apis/safe');
      apisSafe.syncAllGnosisNetworks();
      doInitializeApis();
    };
    const sub = perfEvents.subscribe('USER_MANUALLY_UNLOCK_UI_READY', onUnlock);

    return () => {
      sub.remove();
    };
  }, []);
}

export function subscribeUnlockToFetchAccounts() {
  perfEvents.subscribe('USER_MANUALLY_UNLOCK_UI_READY', async () => {
    const { keyringService } = await loadServicesModule();
    const accounts = await keyringService.getAllVisibleAccountsArray();
    if (!accounts?.length) {
      replace(RootNames.StackGetStarted, {
        screen: RootNames.GetStarted,
      });
    }
  });
}

type LoadEntryScriptsState = {
  inPageWeb3: string;
  vConsole: string;
  fullScript: string;
};
const loadEntryScriptsStore = zCreate<LoadEntryScriptsState>(() => ({
  inPageWeb3: '',
  vConsole: '',
  fullScript: '',
}));
function setEntryScripts(valOrFunc: UpdaterOrPartials<LoadEntryScriptsState>) {
  loadEntryScriptsStore.setState(prev => ({
    ...prev,
    ...resolveValFromUpdater(prev, valOrFunc, { strict: false }).newVal,
  }));
}

export async function loadJavaScriptBeforeContentLoadedOnBoot() {
  return Promise.allSettled([
    EntryScriptWeb3.init(),
    __DEV__ ? EntryScriptVConsole.init() : Promise.resolve(''),
  ]).then(([reqInPageWeb3, reqVConsole]) => {
    const inPageWeb3 =
      reqInPageWeb3.status === 'fulfilled' ? reqInPageWeb3.value : '';
    const vConsole =
      reqVConsole.status === 'fulfilled' ? reqVConsole.value : '';

    setEntryScripts(prev => ({
      ...prev,
      inPageWeb3,
      vConsole,
      fullScript: getFullScript({ inPageWeb3, vConsole }),
    }));
  });
}

function getFullScript({
  inPageWeb3,
  vConsole,
}: {
  inPageWeb3: string;
  vConsole: string;
}) {
  return [
    // DEBUG_IN_PAGE_SCRIPTS.LOAD_BEFORE,
    JSBridgeHarden,
    inPageWeb3,
    BROWSER_SCRIPT_BASE,
    __DEV__ ? JS_GET_WINDOW_INFO_AFTER_LOAD : '',
    SPA_urlChangeListener,
    __DEV__ ? vConsole : '',
    JS_LOG_ON_MESSAGE,
    ';true;',
    // DEBUG_IN_PAGE_SCRIPTS.LOAD_AFTER,
  ]
    .filter(Boolean)
    .join('\n');
}

export function useJavaScriptBeforeContentLoaded() {
  const inPageWeb3 = loadEntryScriptsStore(s => s.inPageWeb3);
  const fullScript = loadEntryScriptsStore(s => s.fullScript);
  const entryScriptWeb3Loaded = zBootstrapStore(s =>
    [
      s.couldRender,
      !!inPageWeb3,
      // __DEV__ ? !!entryScripts.vConsole : true,
    ].every(x => !!x),
  );

  return {
    entryScriptWeb3Loaded,
    entryScripts: {
      inPageWeb3,
      // vConsole
    },
    fullScript: fullScript,
  };
}

const splashScreenVisibleRef = { current: true };
const hideSplashScreen = (forceHide = false) => {
  if (splashScreenVisibleRef.current || forceHide) {
    SplashScreen.hide();
    splashScreenVisibleRef.current = false;
  }
};

runIIFEFunc(() => {
  const sub = perfEvents.subscribe('APP_NAVIGATION_READY', () => {
    traceStartup('splash_hide_on_app_navigation_ready');
    hideSplashScreen(true);
    sub.remove();
  });
});

function traceBootstrapPromise<T>(
  event: string,
  promiseOrValue: Promise<T> | T,
) {
  const endTrace = startStartupTraceSpan(event);
  return Promise.resolve(promiseOrValue).then(
    value => {
      endTrace('end');
      return value;
    },
    error => {
      endTrace('error', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    },
  );
}

const postRenderBootstrapWarmupsStateRef = {
  started: false,
};
const POST_RENDER_BOOTSTRAP_WARMUPS_DELAY_MS = 6000;

function schedulePostRenderBootstrapWarmups(
  reason: string,
  options: {
    includeUnlock?: boolean;
  } = {},
) {
  if (postRenderBootstrapWarmupsStateRef.started) {
    traceStartup('bootstrap_post_render_warmups_skipped', {
      reason: 'already_started',
    });
    return;
  }

  postRenderBootstrapWarmupsStateRef.started = true;
  traceStartup('bootstrap_post_render_warmups_schedule', {
    reason,
    includeUnlock: options.includeUnlock ?? true,
    delayMs: POST_RENDER_BOOTSTRAP_WARMUPS_DELAY_MS,
  });

  requestAnimationFrame(() => {
    setTimeout(() => {
      runAfterHomePostStartupReady(
        () => {
          setTimeout(() => {
            const endTrace = startStartupTraceSpan(
              'bootstrap_post_render_warmups',
              {
                reason,
              },
            );

            const tasks = [
              options.includeUnlock === false
                ? Promise.resolve('skipped' as const)
                : traceBootstrapPromise(
                    'bootstrap_get_tried_unlock',
                    loadLockHookModule().then(({ getTriedUnlock }) =>
                      getTriedUnlock(),
                    ),
                  ),
              traceBootstrapPromise(
                'bootstrap_fetch_biometrics',
                import('./biometrics').then(({ storeApisBiometrics }) =>
                  storeApisBiometrics.fetchBiometrics(),
                ),
              ),
            ] as const;

            Promise.allSettled(tasks)
              .then(([unlockResult, biometricsResult]) => {
                endTrace('end', {
                  unlockStatus: unlockResult.status,
                  biometricsStatus: biometricsResult.status,
                });
              })
              .catch(error => {
                endTrace('error', {
                  error: error instanceof Error ? error.message : String(error),
                });
              });
          }, POST_RENDER_BOOTSTRAP_WARMUPS_DELAY_MS);
        },
        {
          label: 'bootstrap_post_render_warmups',
        },
      );
    }, 250);
  });
}

/**
 * @description only call this hook on the top level component
 */
export function useBootstrapApp({ rabbitCode }: { rabbitCode: string }) {
  const startedLoadRef = React.useRef(false);
  React.useEffect(() => {
    if (!rabbitCode) return;
    if (startedLoadRef.current) return;
    startedLoadRef.current = true;

    const endTrace = startStartupTraceSpan('bootstrap_app', {
      hasRabbitCode: !!rabbitCode,
    });
    Promise.allSettled([
      traceBootstrapPromise(
        'bootstrap_initial_lock_state',
        loadLockHookModule().then(({ loadBootstrapAppLockState }) =>
          loadBootstrapAppLockState(),
        ),
      ),
      traceBootstrapPromise(
        'bootstrap_load_security_chain',
        loadSecurityChain({ rabbitCode }),
      ),
    ])
      .then(async ([_initialLockResult, _securityChain]) => {
        const initialLockState =
          _initialLockResult.status === 'fulfilled'
            ? _initialLockResult.value
            : null;
        const shouldWaitAutoUnlock =
          _initialLockResult.status !== 'fulfilled' ||
          (!initialLockState?.appUnlocked &&
            !initialLockState?.isUnlockSessionValid);
        const unlockResult = shouldWaitAutoUnlock
          ? await Promise.allSettled([
              traceBootstrapPromise(
                'bootstrap_get_tried_unlock',
                loadLockHookModule().then(({ getTriedUnlock }) =>
                  getTriedUnlock(),
                ),
              ),
            ]).then(([result]) => result)
          : null;

        console.debug('useBootstrapApp::sucess', _initialLockResult);
        endTrace('ready_to_render', {
          initialLockStatus: _initialLockResult.status,
          securityChainStatus: _securityChain.status,
          unlockStatus: unlockResult?.status ?? 'deferred',
          biometricsStatus: 'deferred',
          waitAutoUnlockBeforeRender: shouldWaitAutoUnlock,
          initialAppUnlocked: initialLockState?.appUnlocked,
          initialUnlockSessionValid: initialLockState?.isUnlockSessionValid,
          initialHasVisibleAccounts: initialLockState?.hasVisibleAccounts,
          initialHasStoredKeyrings: initialLockState?.hasStoredKeyrings,
        });
        markStartupTrace('bootstrap_could_render');
        setBootstrap({ couldRender: true });

        if (!shouldWaitAutoUnlock) {
          schedulePostRenderBootstrapWarmups('bootstrap_could_render');
        } else {
          schedulePostRenderBootstrapWarmups(
            'bootstrap_after_pre_render_unlock',
            {
              includeUnlock: false,
            },
          );
        }
      })
      .catch(err => {
        startedLoadRef.current = false;
        endTrace('error', {
          error: err instanceof Error ? err.message : String(err),
        });
        console.error('useBootstrapApp::error', err);
        setBootstrap({ couldRender: false });
      })
      .finally(() => {
        setTimeout(() => {
          traceStartup('splash_hide_timeout');
          hideSplashScreen(false);
          console.debug(
            'useBootstrapApp:: splash screen hidden due to timeout',
          );
        }, 3e3);
      });
  }, [rabbitCode]);
}

export function useAppCouldRender() {
  const couldRender = zBootstrapStore(s => s.couldRender);

  return {
    couldRender,
  };
}
