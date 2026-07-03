import {
  BALANCE_HIDE_TYPE as BALANCE_HIDE_TYPE_CONST,
  type BALANCE_HIDE_TYPE as BalanceHideType,
} from '@/constant/balanceHide';
import { callHomeStartupService } from '@/core/services/homeStartupDeferredClient';
import { atom, useAtom } from 'jotai';

export const BALANCE_HIDE_TYPE = BALANCE_HIDE_TYPE_CONST;
export type BALANCE_HIDE_TYPE = BalanceHideType;

const baseHideTypeAtom = atom<BALANCE_HIDE_TYPE>(BALANCE_HIDE_TYPE.SHOW);

baseHideTypeAtom.onMount = setAtom => {
  let cancelled = false;
  callHomeStartupService('getBalanceHideType', [])
    .then(hideType => {
      if (!cancelled) {
        setAtom((hideType as BALANCE_HIDE_TYPE) || BALANCE_HIDE_TYPE.SHOW);
      }
    })
    .catch(error => {
      console.error('getBalanceHideType error', error);
    });

  return () => {
    cancelled = true;
  };
};

const hideTypeAtom = atom<
  BALANCE_HIDE_TYPE,
  [((v: BALANCE_HIDE_TYPE) => BALANCE_HIDE_TYPE) | BALANCE_HIDE_TYPE],
  void
>(
  get => {
    return get(baseHideTypeAtom);
  },
  (get, set, update) => {
    const nextValue =
      typeof update === 'function' ? update(get(baseHideTypeAtom)) : update;
    set(baseHideTypeAtom, nextValue);
    callHomeStartupService('setBalanceHideType', [nextValue]).catch(error => {
      console.error('setBalanceHideType error', error);
    });
  },
);

export const useHideBalance = () => {
  return useAtom(hideTypeAtom);
};
