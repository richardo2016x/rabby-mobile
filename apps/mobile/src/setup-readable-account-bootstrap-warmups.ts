import {
  hydrateCachedHome24hBalanceScene,
  balance24hStore,
} from './store/balance24h';
import { hydrateCachedHomeDayCurve, initCurve24hStore } from './store/curve24h';
import { useAppChainStore } from './store/appchain';
import addressBalanceStore from './store/balance';
import { ensureAccountBalanceSelectionLifecycle } from './store/balanceAccountSelection';
import { startStartupTraceSpan } from './core/utils/startupTrace';

async function initPersistedStores() {
  const endTrace = startStartupTraceSpan('initPersistedStores');
  console.time('initPersistedStores');
  try {
    await useAppChainStore.getState().initStore();
    await Promise.all([
      addressBalanceStore.initStore(),
      balance24hStore.initStore(),
      initCurve24hStore(),
    ]);
    hydrateCachedHome24hBalanceScene();
    hydrateCachedHomeDayCurve();
    endTrace('end');
  } catch (error) {
    endTrace('error', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    console.timeEnd('initPersistedStores');
  }
}

const initPersistedStoresStateRef = {
  promise: null as Promise<void> | null,
};

export async function startInitPersistedStores() {
  if (initPersistedStoresStateRef.promise) {
    return initPersistedStoresStateRef.promise;
  }

  const promise = initPersistedStores().catch(error => {
    initPersistedStoresStateRef.promise = null;
    throw error;
  });
  initPersistedStoresStateRef.promise = promise;
  await promise;
}

export async function startReadableAccountBootstrapWarmups() {
  const endTrace = startStartupTraceSpan('readable_account_bootstrap_warmups');
  const results = await Promise.allSettled([
    startInitPersistedStores(),
    ensureAccountBalanceSelectionLifecycle(),
  ]);

  results.forEach(result => {
    if (result.status === 'rejected') {
      console.error(
        'startReadableAccountBootstrapWarmups::error',
        result.reason,
      );
    }
  });
  endTrace('end');
}

export async function startUnlockScreenBootstrapWarmups() {
  return startReadableAccountBootstrapWarmups();
}
