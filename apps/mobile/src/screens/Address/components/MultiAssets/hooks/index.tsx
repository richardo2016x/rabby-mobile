import { openapi } from '@/core/request';
import { perfEvents } from '@/core/utils/perf';
import {
  KeyringAccountWithAlias,
  storeApiAccounts,
  useAccounts,
} from '@/hooks/account';
import { useCreationWithShallowCompare } from '@/hooks/common/useMemozied';
import addressBalanceStore from '@/store/balance';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { filterMyAccounts } from '@/utils/account';
import { eventBus, EventBusListeners, EVENTS } from '@/utils/events';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useEffect } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import useAppChainStore from '@/store/appchain';
import { callHomeStartupService } from '@/core/services/homeStartupDeferredClient';

export const isTabsSwiping = {
  value: false,
};

function filterOutTop10Accounts<
  T extends {
    address: string;
    balance?: number;
  },
>(sortedAccounts: T[], { gatherSameAddress = false } = {}) {
  const topCount = 10;
  const topRecords = new Set<string>();
  const topAccounts: T[] = [];
  const restAccounts: T[] = [];
  let top10Addresses: string[] = [];

  if (gatherSameAddress) {
    for (const item of sortedAccounts) {
      if (topRecords.size >= topCount) {
        break;
      }
      topRecords.add(item.address.toLowerCase());
    }

    sortedAccounts.forEach(account => {
      if (topRecords.has(account.address.toLowerCase())) {
        topAccounts.push(account);
      } else {
        restAccounts.push(account);
      }
    });
    top10Addresses = Array.from(topRecords);
  } else {
    topAccounts.push(...sortedAccounts.slice(0, topCount));
    restAccounts.push(...sortedAccounts.slice(topCount));
    topAccounts.forEach(account => {
      const address = account.address.toLowerCase();
      if (!topRecords.has(address)) {
        top10Addresses.push(address);
      }
      topRecords.add(address);
    });
  }

  return {
    top10Accounts: topAccounts,
    top10Addresses,
    top10Records: topRecords,
    restAccounts,
  };
}

function isDirectlySignableAccount(account: KeyringAccountWithAlias) {
  return (
    account.type === KEYRING_TYPE.SimpleKeyring ||
    account.type === KEYRING_TYPE.HdKeyring
  );
}

function isHardwareAccount(account: KeyringAccountWithAlias) {
  return (
    account.type === KEYRING_CLASS.HARDWARE.LEDGER ||
    account.type === KEYRING_CLASS.HARDWARE.TREZOR ||
    account.type === KEYRING_CLASS.HARDWARE.KEYSTONE ||
    account.type === KEYRING_CLASS.HARDWARE.ONEKEY
  );
}

export function useAccountInfo() {
  const { accounts, fetchAccounts } = useAccounts({
    disableAutoFetch: true,
  });

  const myAccounts = useCreationWithShallowCompare(
    () => filterMyAccounts(accounts),
    [accounts],
  );

  const sortedList = useSortAddressList(myAccounts);
  const {
    myTop10Accounts,
    myTop10Addresses,
    myTop10Records,
    myNotTop10Accounts,
  } = useCreationWithShallowCompare(() => {
    const {
      top10Accounts: myTop10Accounts,
      top10Addresses: myTop10Addresses,
      top10Records: myTop10Records,
      restAccounts: myNotTop10Accounts,
    } = filterOutTop10Accounts(sortedList, { gatherSameAddress: false });

    return {
      myTop10Accounts,
      myTop10Addresses,
      myTop10Records,
      myNotTop10Accounts,
    };
  }, [sortedList]);

  const stableTop10Addresses = useCreationWithShallowCompare(
    () => myTop10Addresses,
    myTop10Addresses,
  );

  const { hasWatchAddress, hasSafeAddress, gnosisAccounts, watchAccounts } =
    useCreationWithShallowCompare(() => {
      const ret = {
        hasWatchAddress: false,
        hasSafeAddress: false,
        gnosisAccounts: [] as KeyringAccountWithAlias[],
        watchAccounts: [] as KeyringAccountWithAlias[],
      };

      accounts.forEach(account => {
        if (account.type === KEYRING_CLASS.WATCH) {
          ret.hasWatchAddress = true;
          ret.watchAccounts.push(account);
        } else if (account.type === KEYRING_CLASS.GNOSIS) {
          ret.hasSafeAddress = true;
          ret.gnosisAccounts.push(account);
        }
      });

      return ret;
    }, [accounts]);

  const notMatteredAccounts = useCreationWithShallowCompare(() => {
    return [...myNotTop10Accounts, ...gnosisAccounts, ...watchAccounts];
  }, [myNotTop10Accounts, gnosisAccounts, watchAccounts]);

  return {
    myTop10Accounts,
    myTop10Addresses: stableTop10Addresses,
    myTop10Records,
    myNotTop10Accounts,
    notMatteredAccounts,
    gnosisAccounts,
    watchAccounts,
    list: sortedList,
    hasWatchAddress,
    hasSafeAddress,
    fetchAccounts,
    rawAllAccounts: accounts,
    matteredAccountCount: filterMyAccounts(sortedList).length,
  };
}

function isAccountToShowReceiveTip(account: KeyringAccountWithAlias) {
  return isDirectlySignableAccount(account) || isHardwareAccount(account);
}

export async function getShowReceiveAddressTip(options?: {
  caredAccount?: KeyringAccountWithAlias | null;
  isForSingle?: boolean;
  source?: string;
}) {
  const { caredAccount, isForSingle = false, source } = options || {};

  if (!caredAccount && isForSingle) {
    throw new Error('caredAccount is required when isForSingle is true');
  }

  let targetAccount = caredAccount;
  if (!isForSingle) {
    const myAccounts = await storeApiAccounts
      .fetchAccounts({
        source: source ?? 'getShowReceiveAddressTip',
      })
      .then(accounts => filterMyAccounts(accounts));
    const accountsToCheck = myAccounts.filter(account =>
      isAccountToShowReceiveTip(account),
    );
    if (accountsToCheck.length !== 1) return null;

    targetAccount = accountsToCheck[0];
  }

  if (!targetAccount) return null;
  if (!isAccountToShowReceiveTip(targetAccount)) return null;

  const evmBalance =
    addressBalanceStore.getAddressValue(targetAccount.address)?.evmBalance ??
    targetAccount.evmBalance ??
    0;

  const appChains = await useAppChainStore
    .getState()
    .getAppChains(targetAccount.address);
  const appChainHasBalance =
    !!appChains &&
    appChains.some(chain =>
      typeof chain.netWorth === 'number'
        ? chain.netWorth > 0
        : !!chain.netWorth,
    );

  let borned = true;
  try {
    const addressDesc = await openapi.addrDesc(targetAccount.address);
    borned = addressDesc.desc.born_at != null;
  } catch (error) {
    console.warn('Failed to fetch address desc', error);
  }

  return {
    targetAccount,
    evmBalance,
    appChainHasBalance,
    borned,
  };
}

export function useAccountHomeShowReceiveTip(
  caredAccount?: KeyringAccountWithAlias | null,
  options?: {
    enabled?: boolean;
    source?: string;
  },
) {
  const isForSingle = !!caredAccount;
  const {
    enabled = true,
    source = isForSingle
      ? 'useAccountHomeShowReceiveTip.single'
      : 'useAccountHomeShowReceiveTip.multi',
  } = options || {};
  const [asyncResult, detect] = useAsyncFn(() => {
    if (!enabled) {
      return Promise.resolve(null);
    }

    return getShowReceiveAddressTip({ caredAccount, isForSingle, source });
  }, [caredAccount, enabled, isForSingle, source]);

  if (asyncResult.error) {
    console.error('Failed to get show receive address tip', asyncResult.error);
  }

  const targetAccount = asyncResult.loading
    ? null
    : asyncResult.value?.targetAccount || null;
  const accountToShowReceiveTip =
    !!targetAccount &&
    asyncResult.value?.evmBalance === 0 &&
    !asyncResult.value?.borned &&
    !asyncResult.value?.appChainHasBalance
      ? targetAccount
      : null;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    detect();
  }, [detect, enabled]);

  useEffect(() => {
    if (isForSingle || !enabled) return;

    const onTxCompleted: EventBusListeners[typeof EVENTS.TX_COMPLETED] = () => {
      detect();
    };
    eventBus.addListener(EVENTS.TX_COMPLETED, onTxCompleted);

    const sub = perfEvents.subscribe('HOME_WILL_BE_REFRESHED_MANUALLY', () => {
      detect();
    });

    // const timer = setInterval(() => {
    //   detect();
    // }, 5 * 60 * 1000); // every 5 minutes

    return () => {
      eventBus.removeListener(EVENTS.TX_COMPLETED, onTxCompleted);
      sub.remove();
      // clearInterval(timer);
    };
  }, [isForSingle, detect, enabled]);

  useEffect(() => {
    if (isForSingle || !enabled) return;

    const onAccountsChanged = () => {
      detect();
    };
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;
    callHomeStartupService('subscribeHomeAccountsChanged', [onAccountsChanged])
      .then(nextUnsubscribe => {
        if (cancelled) {
          nextUnsubscribe();
          return;
        }
        unsubscribe = nextUnsubscribe;
      })
      .catch(error => {
        if (!cancelled) {
          console.error('subscribeHomeAccountsChanged error', error);
        }
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [isForSingle, detect, enabled]);

  return {
    targetAccount,
    isLoadingAccountToShowReceiveTip: asyncResult.loading,
    accountToShowReceiveTip:
      accountToShowReceiveTip &&
      isAccountToShowReceiveTip(accountToShowReceiveTip)
        ? accountToShowReceiveTip
        : null,
  };
}
