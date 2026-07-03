export const AUTO_LOCK_DEFERRED_SERVICE = 'autoLock';

export type AutoLockDeferredService = {
  getPersistedAutoLockTimes(): {
    minutes: number;
    timeoutMs: number;
  };
  setAutoLockTimeMs(ms: number): {
    minutes: number;
    timeoutMs: number;
  };
  refreshAutolockTimeout(): void;
  subscribeTriggerRefresh(listener: () => void): () => void;
  subscribeTimeout(listener: (ctx: { delayLock(): void }) => void): () => void;
  handleUnlock(): void;
  handleLock(): void;
  setupAutoLockChecker(): void;
};
