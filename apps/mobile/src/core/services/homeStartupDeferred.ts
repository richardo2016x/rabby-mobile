import type { Account } from '@/types/account';

export const HOME_STARTUP_DEFERRED_SERVICE = 'homeStartup';

export type HomeStartupDeferredService = {
  fetchAccounts(options?: { source?: string }): Promise<Account[]>;
  hasVisibleAccounts(): Promise<boolean>;
  initReadableAccountStores(): Promise<void>;
  startReadableAccountBootstrapWarmups(): Promise<void>;
  scheduleGasAccountSnapshotRefresh(options?: {
    reason?: string;
    delay?: number;
  }): void | Promise<void>;
  autoLoginGasAccountIfNeeded(): Promise<void>;
  trackGasAccountActiveStatusOncePerDay(): Promise<boolean>;
  deleteLongTimeHomeCache(): Promise<void>;
  runHomeDailyReport(): Promise<void>;
  setupBrowserServiceStubData(): Promise<void>;
  getTop10Addresses(): Promise<string[]>;
  syncCurrencyList(forceRefresh?: boolean): void | Promise<void>;
  getClosedOfflineChainTips(): string[] | Promise<string[]>;
  setClosedOfflineChainTips(chains: string[]): void | Promise<void>;
  clearClosedOfflineChainTips(): void | Promise<void>;
  refreshHomeSuccessAndFailList(): Promise<
    | {
        success: number;
        fail: number;
      }
    | undefined
  >;
  getHomePendingTxCount(addresses: string[]): number | Promise<number>;
  subscribeHomeHistoryUpserted(
    listener: () => void,
  ): (() => void) | Promise<() => void>;
  getBalanceHideType(): string | undefined | Promise<string | undefined>;
  setBalanceHideType(type: string): void | Promise<void>;
  subscribeHomeAccountsChanged(
    listener: () => void,
  ): (() => void) | Promise<() => void>;
};
