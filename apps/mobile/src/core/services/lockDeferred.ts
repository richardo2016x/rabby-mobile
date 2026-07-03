export const LOCK_DEFERRED_SERVICE = 'lock';

export type LockDeferredService = {
  safeVerifyPasswordAndUpdateUnlockTime(password: string): Promise<{
    success: boolean;
  }>;
  updateUnlockTime(): void;
  clearCustomPassword(password: string): Promise<{
    error?: string;
  }>;
};
