import {
  MMKV,
  type Configuration as MMKVConfiguration,
} from 'react-native-mmkv';
import { MMKV_FILE_NAMES } from './mmkvConstants';
import { startStartupEarlySpan } from '../utils/startupEarlyTrace';

function createMMKVInstance(options: MMKVConfiguration) {
  const endTrace = startStartupEarlySpan('mmkv_instance_create', {
    id: options.id,
    encrypted: !!options.encryptionKey,
  });

  try {
    const instance = new MMKV(options);
    endTrace('end');
    return instance;
  } catch (error) {
    endTrace('error', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export const appMMKV = createMMKVInstance({
  id: MMKV_FILE_NAMES.DEFAULT,
});

export const keyringMMKV = createMMKVInstance({
  id: MMKV_FILE_NAMES.KEYRING,
  encryptionKey: 'keyring',
});

export const keychainMMKV = createMMKVInstance({
  id: MMKV_FILE_NAMES.KEYCHAIN,
});

export const chainsMMKV = createMMKVInstance({
  id: MMKV_FILE_NAMES.CHAINS,
});

export const dayCurveMMKV = createMMKVInstance({
  id: MMKV_FILE_NAMES.DAYCURVE,
});

export const cexIdMMKV = createMMKVInstance({
  id: MMKV_FILE_NAMES.CEXID,
});

export const balance24hMMKV = createMMKVInstance({
  id: MMKV_FILE_NAMES.BALANCE_24H,
});

export const testnetBalanceMMKV = createMMKVInstance({
  id: MMKV_FILE_NAMES.TESTNET_BALANCE,
});

export const walletConnectMMKV = createMMKVInstance({
  id: MMKV_FILE_NAMES.WALLETCONNECT,
  encryptionKey: 'walletconnect',
});

export const lendingDataCacheMMKV = createMMKVInstance({
  id: MMKV_FILE_NAMES.LENDING_DATA_CACHE,
});

export const ALL_KNOWN_MMKV_INSTANCES = {
  [MMKV_FILE_NAMES.DEFAULT]: appMMKV,
  [MMKV_FILE_NAMES.KEYCHAIN]: keychainMMKV,
  [MMKV_FILE_NAMES.KEYRING]: keyringMMKV,
  [MMKV_FILE_NAMES.CHAINS]: chainsMMKV,
  [MMKV_FILE_NAMES.DAYCURVE]: dayCurveMMKV,
  [MMKV_FILE_NAMES.CEXID]: cexIdMMKV,
  [MMKV_FILE_NAMES.BALANCE_24H]: balance24hMMKV,
  [MMKV_FILE_NAMES.TESTNET_BALANCE]: testnetBalanceMMKV,
  [MMKV_FILE_NAMES.WALLETCONNECT]: walletConnectMMKV,
  [MMKV_FILE_NAMES.LENDING_DATA_CACHE]: lendingDataCacheMMKV,
} as const;
