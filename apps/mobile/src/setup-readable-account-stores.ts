import nftListStore from './store/nfts';
import useProtocolListStore from './store/protocols';
import tokenListStore from './store/tokens';
import { startStartupTraceSpan } from './core/utils/startupTrace';

async function initReadableAccountStores() {
  const endTrace = startStartupTraceSpan('initReadableAccountStores');
  console.time('initReadableAccountStores');
  try {
    await tokenListStore.getState().initStore();
    await nftListStore.getState().initStore();
    await useProtocolListStore.getState().initStore();
    endTrace('end');
  } catch (error) {
    endTrace('error', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    console.timeEnd('initReadableAccountStores');
  }
}

const initReadableAccountStoresStateRef = {
  promise: null as Promise<void> | null,
};

export async function startInitReadableAccountStores() {
  if (initReadableAccountStoresStateRef.promise) {
    return initReadableAccountStoresStateRef.promise;
  }

  const promise = initReadableAccountStores().catch(error => {
    initReadableAccountStoresStateRef.promise = null;
    throw error;
  });
  initReadableAccountStoresStateRef.promise = promise;
  await promise;
}
