import { callDeferredService, registerDeferredServiceLoader } from './deferred';
import {
  LOCK_DEFERRED_SERVICE,
  type LockDeferredService,
} from './lockDeferred';

let lockDeferredServiceLoadPromise: Promise<void> | null = null;

function loadLockDeferredService() {
  if (lockDeferredServiceLoadPromise) {
    return lockDeferredServiceLoadPromise;
  }

  lockDeferredServiceLoadPromise = import('@/core/apis/lock')
    .then(() => undefined)
    .catch(error => {
      lockDeferredServiceLoadPromise = null;
      throw error;
    });

  return lockDeferredServiceLoadPromise;
}

registerDeferredServiceLoader(LOCK_DEFERRED_SERVICE, loadLockDeferredService);

export function callLockDeferredService<
  TMethod extends keyof LockDeferredService & string,
>(
  method: TMethod,
  args: Parameters<LockDeferredService[TMethod]>,
  options?: { timeoutMs?: number },
) {
  return callDeferredService<LockDeferredService, TMethod>(
    LOCK_DEFERRED_SERVICE,
    method,
    args,
    options,
  );
}
