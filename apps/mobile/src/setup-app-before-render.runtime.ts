import {
  loadJavaScriptBeforeContentLoadedOnBoot,
  subscribeUnlockToFetchAccounts,
} from './hooks/useBootstrap';
import { InteractionManager } from 'react-native';

import { runIIFEFunc } from './core/utils/store';
import { startSubscribeLangChange } from './hooks/lang';
import { connectPushServerOnBootstrap } from './core/notifications';

import { startManageAccountStoreLifecycle } from './hooks/account';

import {
  loadLockInfoOnBootstrap,
  startSubscribeAppStateChange,
} from './hooks/useLock';
import { startSyncDefaultRPCs } from './hooks/defaultRPCs';
import { storeApiGasAccount } from './screens/GasAccount/hooks/atom';
import { startSubscribeOnekeyDevices } from './core/apis/onekey';
import { startSubscribeTrezorConnectOnUrl } from './hooks/trezor/useTrezor';
import { startFetchOnceTop5TokensForAllAccounts } from './components/AccountSwitcher/hooks';
import { startSyncOnlineConfig } from './core/config/online';
import { loadVersionInfoOnBootstrap } from './hooks/version';
import { autoGoogleSignIfPreviousSignedOnBoot } from './hooks/cloudStorage';
import {
  screenshotModalStartSyncNetworth,
  startSubscribeUserDidTakeScreenshot,
} from './components/Screenshot/hooks';
import {
  enableIOSAppSwitcherBlur,
  startSubscribeIOSAppSwitcherBlur,
  startSubscribeWhetherPreventScreenshot,
} from './hooks/native/security';
import {
  startSubscribeAtSensitiveScene,
  startSubscribeIOSJustScreenshotted,
  startSubscribeIOSScreenRecording,
  startSubscribeRemoteNotification,
} from './hooks/navigation';
import { startComputationThread } from './perfs/thread';
import { rateModalStartSyncNetworth } from './components/RateModal/hooks';
import { trimNoLongerSupportsOnUnlock } from './components2024/NoLongerSupports/useNoLongerSupports';
import { startCheckClearAction } from './utils/clipboard';
import { startSubscribeOpenApiHttpErrorDebugToast } from './utils/openapiDebugToast';
import {
  hydrateCachedHome24hBalanceScene,
  scene24hBalanceStore,
} from './store/balance24h';
import { startProcessMultiCurveEvents } from './store/curve24h';
import { startProcessAccountBalanceEvents } from './store/balanceAccountSelection';
import * as apisAutoLock from './core/apis/autoLock';
import { startWatchLayoutChange } from './hooks/useAppLayout';
import { startCareAppNotificationPermissions } from './hooks/appNotification';
import {
  keyringService,
  startServiceMaintenanceAfterStartup,
} from './core/services';
import { startStartupTraceSpan, traceStartup } from './core/utils/startupTrace';
import {
  startInitPersistedStores,
  startReadableAccountBootstrapWarmups,
} from './setup-readable-account-bootstrap-warmups';

const UNLOCKED_STORES_AFTER_UNLOCK_DELAY_MS = 800;
const PERPS_RUNTIME_STARTUP_DELAY_MS = 6000;

traceStartup('setup_runtime_module_evaluated');

startServiceMaintenanceAfterStartup();
startComputationThread();
startSubscribeLangChange();

connectPushServerOnBootstrap();

startManageAccountStoreLifecycle();
loadLockInfoOnBootstrap();
apisAutoLock.setupAutoLockChecker();
startFetchOnceTop5TokensForAllAccounts();
subscribeUnlockToFetchAccounts();
startSubscribeAppStateChange();

startSyncOnlineConfig();
loadVersionInfoOnBootstrap();

loadJavaScriptBeforeContentLoadedOnBoot();

startSubscribeOnekeyDevices();
startSubscribeTrezorConnectOnUrl();

autoGoogleSignIfPreviousSignedOnBoot();
startSyncDefaultRPCs();
runIIFEFunc(() => {
  storeApiGasAccount.fetchGasAccountInfo();
});
startPerpsRuntimeAfterStartup();
startWatchLayoutChange();

startSubscribeUserDidTakeScreenshot();
startSubscribeAtSensitiveScene();
startSubscribeIOSJustScreenshotted();
startSubscribeIOSAppSwitcherBlur();
enableIOSAppSwitcherBlur();
startSubscribeWhetherPreventScreenshot();
startSubscribeIOSScreenRecording();

rateModalStartSyncNetworth();
screenshotModalStartSyncNetworth();

startProcessAccountBalanceEvents();
scene24hBalanceStore.startProcessScene24hBalanceEvents();
hydrateCachedHome24hBalanceScene();
startProcessMultiCurveEvents();

trimNoLongerSupportsOnUnlock();

startCheckClearAction();
startSubscribeOpenApiHttpErrorDebugToast();

startCareAppNotificationPermissions();
startSubscribeRemoteNotification();

export async function initReadableAccountStores() {
  const { startInitReadableAccountStores } = await import(
    './setup-readable-account-stores'
  );
  await startInitReadableAccountStores();
}

export async function startUnlockScreenBootstrapWarmups() {
  return startReadableAccountBootstrapWarmups();
}

const startInitStores = async () => {
  await startInitPersistedStores();
};

function startPerpsRuntimeAfterStartup() {
  const reason = 'setup_runtime_after_startup';
  traceStartup('perps_runtime_schedule', {
    reason,
    delayMs: PERPS_RUNTIME_STARTUP_DELAY_MS,
  });

  InteractionManager.runAfterInteractions(() => {
    setTimeout(() => {
      const endTrace = startStartupTraceSpan('perps_runtime_import', {
        reason,
      });

      import('./hooks/perps/usePerpsStore')
        .then(runtime => {
          runtime.startSubscribePerpsOnAppState();
          runtime.startPerpsStartupWarmups({
            reason,
          });
          endTrace('end');
        })
        .catch(error => {
          endTrace('error', {
            error: error instanceof Error ? error.message : String(error),
          });
          console.error('startPerpsRuntimeAfterStartup::error', error);
        });
    }, PERPS_RUNTIME_STARTUP_DELAY_MS);
  });
}

function startInitStoresAfterUnlockInteractions(reason: string) {
  traceStartup('init_stores_after_unlock_schedule', {
    reason,
    delayMs: UNLOCKED_STORES_AFTER_UNLOCK_DELAY_MS,
  });
  const interactionHandle = InteractionManager.runAfterInteractions(() => {
    setTimeout(() => {
      const endTrace = startStartupTraceSpan('init_stores_after_unlock_run', {
        reason,
      });
      startInitStores()
        .then(() => {
          endTrace('end');
        })
        .catch(error => {
          endTrace('error', {
            error: error instanceof Error ? error.message : String(error),
          });
          console.error(`startInitStoresOnUnlock::${reason}::error`, error);
        });
    }, UNLOCKED_STORES_AFTER_UNLOCK_DELAY_MS);
  });

  return interactionHandle;
}

function startInitStoresOnUnlock() {
  if (keyringService.isUnlocked()) {
    startInitStoresAfterUnlockInteractions('already_unlocked');
    return;
  }

  keyringService.once('unlock', () => {
    startInitStoresAfterUnlockInteractions('unlock_event');
  });
}

startInitStoresOnUnlock();
