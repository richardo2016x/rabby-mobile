import { debounce } from 'lodash';

import { makeAvoidParallelAsyncFunc } from '@/core/utils/concurrency';
import { zCreate } from '@/core/utils/reexports';
import {
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { RefLikeObject } from '@/utils/type';
import { balanceAccountsStore } from '@/store/balance';
import { callHomeStartupService } from '@/core/services/homeStartupDeferredClient';

type HomeHistoryState = {
  pendingTxCount: number;
  historyCount: {
    success: number;
    fail: number;
  };
};

const homeHistoryStore = zCreate<HomeHistoryState>(() => ({
  pendingTxCount: 0,
  historyCount: {
    success: 0,
    fail: 0,
  },
}));

export function useHomeHistoryStore() {
  return {
    pendingTxCount: homeHistoryStore(s => s.pendingTxCount),
    historyCount: homeHistoryStore(s => s.historyCount),
  };
}

export function useHomePendingTxCount() {
  return homeHistoryStore(s => s.pendingTxCount);
}

export function useHomeHistoryCount() {
  return homeHistoryStore(s => s.historyCount);
}

function setHistoryCount(
  valOrFunc: UpdaterOrPartials<HomeHistoryState['historyCount']>,
) {
  homeHistoryStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.historyCount,
      valOrFunc,
      { strict: true },
    );

    if (!changed) return prev;

    return { ...prev, historyCount: newVal };
  });
}

export const refreshSuccessAndFailList = makeAvoidParallelAsyncFunc(
  async () => {
    const nextCount = await callHomeStartupService(
      'refreshHomeSuccessAndFailList',
      [],
    );
    if (nextCount) {
      setHistoryCount(nextCount);
    }
    return nextCount;
  },
);

function setPendingTxCount(count: number) {
  homeHistoryStore.setState(prev => {
    if (prev.pendingTxCount === count) {
      return prev;
    }
    return { ...prev, pendingTxCount: count };
  });
}

const timeRef: RefLikeObject<ReturnType<typeof setInterval> | null> = {
  current: null,
};
export const resetFetchHistoryTxCount = makeAvoidParallelAsyncFunc(async () => {
  timeRef.current && clearInterval(timeRef.current);
  // TODO: 这里只需要 accounts，不需要 balance 相关信息
  const balanceAccounts = balanceAccountsStore.getState().balance;
  const addresses = Object.keys(balanceAccounts);
  if (!addresses.length) {
    return;
  }
  const pendingsLength = await callHomeStartupService('getHomePendingTxCount', [
    addresses,
  ]);
  setPendingTxCount(pendingsLength);
  timeRef.current = pendingsLength
    ? setInterval(resetFetchHistoryTxCount, 5000)
    : null;
});

const thorttleGetSuccessAndFailList = debounce(refreshSuccessAndFailList, 1000);

runIIFEFunc(() => {
  callHomeStartupService('subscribeHomeHistoryUpserted', [
    thorttleGetSuccessAndFailList,
  ]).catch(error => {
    console.error('subscribeHomeHistoryUpserted error', error);
  });

  resetFetchHistoryTxCount();
});
