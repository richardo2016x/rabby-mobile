import { runAfterHomePostStartupReady } from '@/core/utils/homeStartupReady';
import {
  callDeferredService,
  registerDeferredServiceLoader,
  waitDeferredService,
} from './deferred';
import {
  AUTO_LOCK_DEFERRED_SERVICE,
  type AutoLockDeferredService,
} from './autoLockDeferred';

let autoLockDeferredServiceLoadPromise: Promise<void> | null = null;

function loadAutoLockDeferredService() {
  if (autoLockDeferredServiceLoadPromise) {
    return autoLockDeferredServiceLoadPromise;
  }

  autoLockDeferredServiceLoadPromise = new Promise<void>((resolve, reject) => {
    runAfterHomePostStartupReady(
      () => {
        import('@/core/apis/autoLock')
          .then(() => {
            resolve();
          })
          .catch(error => {
            autoLockDeferredServiceLoadPromise = null;
            reject(error);
          });
      },
      {
        fallbackMs: 5000,
        label: 'auto_lock_deferred_service_loader',
      },
    );
  });

  return autoLockDeferredServiceLoadPromise;
}

registerDeferredServiceLoader(
  AUTO_LOCK_DEFERRED_SERVICE,
  loadAutoLockDeferredService,
);

export function waitAutoLockService(options?: { timeoutMs?: number }) {
  return waitDeferredService<AutoLockDeferredService>(
    AUTO_LOCK_DEFERRED_SERVICE,
    options,
  );
}

export function callAutoLockService<
  TMethod extends keyof AutoLockDeferredService & string,
>(
  method: TMethod,
  args: Parameters<AutoLockDeferredService[TMethod]>,
  options?: { timeoutMs?: number },
) {
  return callDeferredService<AutoLockDeferredService, TMethod>(
    AUTO_LOCK_DEFERRED_SERVICE,
    method,
    args,
    options,
  );
}
