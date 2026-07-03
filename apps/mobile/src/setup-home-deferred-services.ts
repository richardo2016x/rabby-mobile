import dayjs from 'dayjs';

import * as apisAccount from '@/core/apis/account';
import {
  browserService,
  currencyService,
  offlineChainService,
  preferenceService,
  transactionHistoryService,
} from '@/core/services';
import { registerDeferredService } from '@/core/services/deferred';
import {
  HOME_STARTUP_DEFERRED_SERVICE,
  type HomeStartupDeferredService,
} from '@/core/services/homeStartupDeferred';
import { deleteLongTimeCurveCache } from '@/utils/24balanceCurveCache';
import { deleteLongTime24hBalanceCache } from '@/utils/24hBalanceCache';
import { autoLoginGasAccountIfNeeded } from '@/utils/autoLoginGasAccount';
import { trackGasAccountActiveStatusOncePerDay } from '@/utils/gasAccountAnalytics';
import { matomoRequestEvent } from '@/utils/analytics';
import { storeApiAccounts } from '@/hooks/account';
import { storeApiGasAccount } from '@/screens/GasAccount/hooks/atom';
import { startInitReadableAccountStores } from './setup-readable-account-stores';
import { startReadableAccountBootstrapWarmups } from './setup-readable-account-bootstrap-warmups';
import { setupBrowserServiceStubData } from '@/core/storage/serviceStoreStubRuntime';
import { HistoryItemEntity } from '@/databases/entities/historyItem';
import { onAppOrmSyncEvents } from '@/databases/sync/_event';
import type { BALANCE_HIDE_TYPE as BalanceHideType } from '@/constant/balanceHide';

function runHomeDailyReport() {
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
  fetchAccounts(options) {
    return storeApiAccounts.fetchAccounts({
      ...options,
      source: options?.source ?? 'homeStartupDeferred.fetchAccounts',
    });
  },
  hasVisibleAccounts() {
    return apisAccount.hasVisibleAccounts();
  },
  initReadableAccountStores() {
    return startInitReadableAccountStores();
  },
  startReadableAccountBootstrapWarmups() {
    return startReadableAccountBootstrapWarmups();
  },
  scheduleGasAccountSnapshotRefresh(options) {
    storeApiGasAccount.scheduleSnapshotRefresh(options);
  },
  autoLoginGasAccountIfNeeded() {
    return autoLoginGasAccountIfNeeded();
  },
  trackGasAccountActiveStatusOncePerDay() {
    return trackGasAccountActiveStatusOncePerDay();
  },
  async deleteLongTimeHomeCache() {
    deleteLongTimeCurveCache();
    deleteLongTime24hBalanceCache();
  },
  async runHomeDailyReport() {
    runHomeDailyReport();
  },
  setupBrowserServiceStubData() {
    return setupBrowserServiceStubData();
  },
  async getTop10Addresses() {
    const { top10Addresses } = await apisAccount.getTop10MyAccounts();
    return top10Addresses;
  },
  syncCurrencyList(forceRefresh) {
    currencyService.syncCurrencyList(forceRefresh);
  },
  getClosedOfflineChainTips() {
    return offlineChainService.getCloseTipsChains();
  },
  setClosedOfflineChainTips(chains) {
    offlineChainService.setCloseTipsChains(chains);
  },
  clearClosedOfflineChainTips() {
    offlineChainService.mockClearCloseTipsChains();
  },
  async refreshHomeSuccessAndFailList() {
    const { top10Addresses } = await apisAccount.getTop10MyAccounts();
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
  getHomePendingTxCount(addresses) {
    return transactionHistoryService.getPendingsAddresses(addresses)
      .pendingsLength;
  },
  subscribeHomeHistoryUpserted(listener) {
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
  getBalanceHideType() {
    return preferenceService.getPreference('balanceHideType');
  },
  setBalanceHideType(type) {
    preferenceService.setPreference({
      balanceHideType: type as BalanceHideType,
    });
  },
  subscribeHomeAccountsChanged(listener) {
    const subAdd = apisAccount.accountEvents.subscribe(
      'ACCOUNT_ADDED',
      listener,
    );
    const subRemove = apisAccount.accountEvents.subscribe(
      'ACCOUNT_REMOVED',
      listener,
    );

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
