import type { BALANCE_HIDE_TYPE as BalanceHideType } from '@/constant/balanceHide';
import { startStartupTraceSpan } from '@/core/utils/startupTrace';
import { callDeferredService, registerDeferredService } from './deferred';
import {
  HOME_STARTUP_DEFERRED_SERVICE,
  type HomeStartupDeferredService,
} from './homeStartupDeferred';

function createHomeDeferredLoader<TModule>(
  event: string,
  importer: () => Promise<TModule>,
) {
  let promise: Promise<TModule> | null = null;

  return (reason: string) => {
    if (promise) {
      return promise;
    }

    const endTrace = startStartupTraceSpan(event, {
      reason,
    });

    promise = importer()
      .then(module => {
        endTrace('end');
        return module;
      })
      .catch(error => {
        promise = null;
        endTrace('error', {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      });

    return promise;
  };
}

const loadAccountStore = createHomeDeferredLoader(
  'home_deferred_account_store_import',
  () => import('@/store/account'),
);

const loadAccountApis = createHomeDeferredLoader(
  'home_deferred_account_apis_import',
  () => import('@/core/apis/account'),
);

const loadReadableAccountStores = createHomeDeferredLoader(
  'home_deferred_readable_stores_import',
  () => import('@/setup-readable-account-stores'),
);

const loadReadableAccountBootstrap = createHomeDeferredLoader(
  'home_deferred_readable_bootstrap_import',
  () => import('@/setup-readable-account-bootstrap-warmups'),
);

const loadGasAccountAtom = createHomeDeferredLoader(
  'home_deferred_gas_account_import',
  () => import('@/screens/GasAccount/hooks/atom'),
);

const loadAutoLoginGasAccount = createHomeDeferredLoader(
  'home_deferred_auto_login_gas_import',
  () => import('@/utils/autoLoginGasAccount'),
);

const loadGasAccountAnalytics = createHomeDeferredLoader(
  'home_deferred_gas_analytics_import',
  () => import('@/utils/gasAccountAnalytics'),
);

const loadCurveCache = createHomeDeferredLoader(
  'home_deferred_curve_cache_import',
  () => import('@/utils/24balanceCurveCache'),
);

const loadBalance24hCache = createHomeDeferredLoader(
  'home_deferred_balance24h_cache_import',
  () => import('@/utils/24hBalanceCache'),
);

const loadCoreServices = createHomeDeferredLoader(
  'home_deferred_core_services_import',
  () => import('@/core/services'),
);

const loadAnalytics = createHomeDeferredLoader(
  'home_deferred_analytics_import',
  () => import('@/utils/analytics'),
);

const loadDayjs = createHomeDeferredLoader(
  'home_deferred_dayjs_import',
  () => import('dayjs'),
);

const loadBrowserServiceStubRuntime = createHomeDeferredLoader(
  'home_deferred_browser_stub_import',
  () => import('@/core/storage/serviceStoreStubRuntime'),
);

const loadHistoryItemEntity = createHomeDeferredLoader(
  'home_deferred_history_entity_import',
  () => import('@/databases/entities/historyItem'),
);

const loadOrmSyncEvents = createHomeDeferredLoader(
  'home_deferred_orm_sync_events_import',
  () => import('@/databases/sync/_event'),
);

async function runHomeDailyReport() {
  const [
    dayjsModule,
    { browserService, preferenceService },
    { matomoRequestEvent },
  ] = await Promise.all([
    loadDayjs('runHomeDailyReport'),
    loadCoreServices('runHomeDailyReport'),
    loadAnalytics('runHomeDailyReport'),
  ]);
  const dayjs = dayjsModule.default;
  const lastReportTime = preferenceService.getPreference('lastReportTime') || 0;

  if (lastReportTime && dayjs(lastReportTime).isToday()) {
    return;
  }

  preferenceService.setPreference({
    lastReportTime: Date.now(),
  });

  matomoRequestEvent({
    category: 'Websites Usage',
    action: 'Website_LikeStatus',
    label: `LikeDapp:${browserService.bookmark.getState().ids?.length || 0}`,
  });

  matomoRequestEvent({
    category: 'Websites Usage',
    action: 'Website_TabStatus',
    label: `TabNumber:${browserService.getBrowserTabs()?.tabs?.length || 0}`,
  });

  matomoRequestEvent({
    category: 'Watchlist Usage',
    action: 'Watchlist_LikeStatus',
    label: `LikeToken:${
      preferenceService.getPreference('pinedQueue')?.length || 0
    }`,
  });
}

const homeStartupDeferredService: HomeStartupDeferredService = {
  async fetchAccounts(options) {
    const { accountStore } = await loadAccountStore('fetchAccounts');
    return accountStore.fetchAccounts({
      ...options,
      source: options?.source ?? 'homeStartupDeferred.fetchAccounts',
    });
  },
  async hasVisibleAccounts() {
    const { hasVisibleAccounts } = await loadAccountApis('hasVisibleAccounts');
    return hasVisibleAccounts();
  },
  async initReadableAccountStores() {
    const { startInitReadableAccountStores } = await loadReadableAccountStores(
      'initReadableAccountStores',
    );
    return startInitReadableAccountStores();
  },
  async startReadableAccountBootstrapWarmups() {
    const { startReadableAccountBootstrapWarmups } =
      await loadReadableAccountBootstrap(
        'startReadableAccountBootstrapWarmups',
      );
    return startReadableAccountBootstrapWarmups();
  },
  async scheduleGasAccountSnapshotRefresh(options) {
    const { storeApiGasAccount } = await loadGasAccountAtom(
      'scheduleGasAccountSnapshotRefresh',
    );
    storeApiGasAccount.scheduleSnapshotRefresh(options);
  },
  async autoLoginGasAccountIfNeeded() {
    const { autoLoginGasAccountIfNeeded } = await loadAutoLoginGasAccount(
      'autoLoginGasAccountIfNeeded',
    );
    return autoLoginGasAccountIfNeeded();
  },
  async trackGasAccountActiveStatusOncePerDay() {
    const { trackGasAccountActiveStatusOncePerDay } =
      await loadGasAccountAnalytics('trackGasAccountActiveStatusOncePerDay');
    return trackGasAccountActiveStatusOncePerDay();
  },
  async deleteLongTimeHomeCache() {
    const [{ deleteLongTimeCurveCache }, { deleteLongTime24hBalanceCache }] =
      await Promise.all([
        loadCurveCache('deleteLongTimeHomeCache'),
        loadBalance24hCache('deleteLongTimeHomeCache'),
      ]);

    deleteLongTimeCurveCache();
    deleteLongTime24hBalanceCache();
  },
  async runHomeDailyReport() {
    return runHomeDailyReport();
  },
  async setupBrowserServiceStubData() {
    const { setupBrowserServiceStubData } = await loadBrowserServiceStubRuntime(
      'setupBrowserServiceStubData',
    );
    return setupBrowserServiceStubData();
  },
  async getTop10Addresses() {
    const { getTop10MyAccounts } = await loadAccountApis('getTop10Addresses');
    const { top10Addresses } = await getTop10MyAccounts();
    return top10Addresses;
  },
  async syncCurrencyList(forceRefresh) {
    const { currencyService } = await loadCoreServices('syncCurrencyList');
    currencyService.syncCurrencyList(forceRefresh);
  },
  async getClosedOfflineChainTips() {
    const { offlineChainService } = await loadCoreServices(
      'getClosedOfflineChainTips',
    );
    return offlineChainService.getCloseTipsChains();
  },
  async setClosedOfflineChainTips(chains) {
    const { offlineChainService } = await loadCoreServices(
      'setClosedOfflineChainTips',
    );
    offlineChainService.setCloseTipsChains(chains);
  },
  async clearClosedOfflineChainTips() {
    const { offlineChainService } = await loadCoreServices(
      'clearClosedOfflineChainTips',
    );
    offlineChainService.mockClearCloseTipsChains();
  },
  async refreshHomeSuccessAndFailList() {
    const [
      { transactionHistoryService },
      { HistoryItemEntity },
      { getTop10MyAccounts },
    ] = await Promise.all([
      loadCoreServices('refreshHomeSuccessAndFailList'),
      loadHistoryItemEntity('refreshHomeSuccessAndFailList'),
      loadAccountApis('refreshHomeSuccessAndFailList'),
    ]);
    const { top10Addresses } = await getTop10MyAccounts();

    if (!top10Addresses.length) {
      return undefined;
    }

    const timestamp = transactionHistoryService.getClearSuccessAndFailListTs();
    const list = await HistoryItemEntity.getUnreadHistoryCount(
      top10Addresses,
      timestamp / 1000,
    );

    list.forEach(item => {
      const status = item.status ?? 1;
      const id = `${item.owner_addr.toLowerCase()}-${item.txHash}`;
      if (status === 1) {
        transactionHistoryService.setSucceedList(id);
      } else {
        transactionHistoryService.setFailedList(id);
      }
    });

    return {
      success: transactionHistoryService.getSucceedCount(),
      fail: transactionHistoryService.getFailedCount(),
    };
  },
  async getHomePendingTxCount(addresses) {
    const { transactionHistoryService } = await loadCoreServices(
      'getHomePendingTxCount',
    );
    return transactionHistoryService.getPendingsAddresses(addresses)
      .pendingsLength;
  },
  async subscribeHomeHistoryUpserted(listener) {
    const { onAppOrmSyncEvents } = await loadOrmSyncEvents(
      'subscribeHomeHistoryUpserted',
    );
    const subscription = onAppOrmSyncEvents({
      taskFor: ['all-history'],
      onRemoteDataUpserted: ctx => {
        if (ctx.taskFor === 'all-history') {
          listener();
        }
      },
    });

    return () => {
      subscription.remove();
    };
  },
  async getBalanceHideType() {
    const { preferenceService } = await loadCoreServices('getBalanceHideType');
    return preferenceService.getPreference('balanceHideType');
  },
  async setBalanceHideType(type) {
    const { preferenceService } = await loadCoreServices('setBalanceHideType');
    preferenceService.setPreference({
      balanceHideType: type as BalanceHideType,
    });
  },
  async subscribeHomeAccountsChanged(listener) {
    const { accountEvents } = await loadAccountApis(
      'subscribeHomeAccountsChanged',
    );
    const subAdd = accountEvents.subscribe('ACCOUNT_ADDED', listener);
    const subRemove = accountEvents.subscribe('ACCOUNT_REMOVED', listener);

    return () => {
      subAdd.remove();
      subRemove.remove();
    };
  },
};

registerDeferredService(
  HOME_STARTUP_DEFERRED_SERVICE,
  homeStartupDeferredService,
);

export function callHomeStartupService<
  TMethod extends keyof HomeStartupDeferredService & string,
>(
  method: TMethod,
  args: Parameters<HomeStartupDeferredService[TMethod]>,
  options?: { timeoutMs?: number },
) {
  return callDeferredService<HomeStartupDeferredService, TMethod>(
    HOME_STARTUP_DEFERRED_SERVICE,
    method,
    args,
    options,
  );
}
