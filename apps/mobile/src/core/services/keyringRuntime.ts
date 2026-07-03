import {
  appStorage,
  keyringStorage,
  normalizeKeyringState,
} from '../storage/mmkv';
import { APP_MMKV_KEYS } from '../storage/mmkvConstants';
import {
  ContactBookService,
  ContactBookStore,
} from '@rabby-wallet/service-address';
import WatchKeyring from '@rabby-wallet/eth-keyring-watch';
import { GnosisKeyring } from '@rabby-wallet/eth-keyring-gnosis';
import { KeyringService } from '@rabby-wallet/service-keyring';
import RNEncryptor from './encryptor';
import { onCreateKeyring, onSetAddressAlias } from './keyringParams';
import { LedgerKeyring } from '@rabby-wallet/eth-keyring-ledger';
import { KeystoneKeyring } from '@rabby-wallet/eth-keyring-keystone';
import { OneKeyKeyring } from '@/core/keyring-bridge/onekey/onekey-keyring';
import SimpleKeyring from '@rabby-wallet/eth-simple-keyring';
import HDKeyring from '@rabby-wallet/eth-hd-keyring';
import { MockWalletConnectKeyring } from '../keyring-bridge/walletconnect/mock-walletconnect-keyring';
import { TrezorKeyring } from '../keyring-bridge/trezor/trezor-keyring';
import { perfEvents } from '../utils/perf';
import { KeyringIntf } from '@rabby-wallet/keyring-utils';
import { openapi } from '../request';

export const bootedKeyringState = normalizeKeyringState().keyringData;

GnosisKeyring.setOpenapiService(openapi);

const keyringClasses = [
  MockWalletConnectKeyring,
  WatchKeyring,
  LedgerKeyring,
  KeystoneKeyring,
  OneKeyKeyring,
  GnosisKeyring,
  SimpleKeyring,
  HDKeyring,
  TrezorKeyring,
] as (typeof KeyringIntf)[];

export const contactService = new ContactBookService({
  storageAdapter: appStorage,
});
contactService.setBeforeSetKV((k, v) => {
  switch (k) {
    case 'aliases': {
      const aliases = v as unknown as ContactBookStore['aliases'];
      perfEvents.emit('CONTACTS_ALIASES_UPDATE', {
        nextState: aliases,
      });
      break;
    }
  }
});

export const appEncryptor = new RNEncryptor();

export const keyringService = new KeyringService({
  encryptor: new RNEncryptor(),
  keyringClasses,
  onSetAddressAlias,
  onCreateKeyring,
  contactService,
});
keyringService.loadStore(bootedKeyringState || {});

keyringService.store.subscribe(value => {
  // // leave here to test migrate legacyData to keyringData
  // if (__DEV__) {
  //   appStorage.setItem(APP_MMKV_KEYS.LEGACY_KEYRING_STATE, value);
  // }

  keyringStorage.clearAll();
  // keyringStorage.flushToDisk?.();
  keyringStorage.setItem(APP_MMKV_KEYS.LEGACY_KEYRING_STATE, value);
});
