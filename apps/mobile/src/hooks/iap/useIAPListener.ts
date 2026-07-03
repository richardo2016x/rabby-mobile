import { devLog } from '@/utils/logger';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { gasAccountProducts } from '@/constant/iap';
import { openapi } from '@/core/request';
import { eventBus, EVENTS } from '@/utils/events';
import * as Sentry from '@sentry/react-native';
import { useMemoizedFn } from 'ahooks';
import {
  finishTransaction,
  flushFailedPurchasesCachedAsPendingAndroid,
  getProducts,
  initConnection,
  Purchase,
  PurchaseError,
  purchaseErrorListener,
  purchaseUpdatedListener,
} from 'react-native-iap';
import { startStartupTraceSpan, traceStartup } from '@/core/utils/startupTrace';
import { runAfterHomePostStartupReady } from '@/core/utils/homeStartupReady';

const handlePurchase = async (purchase: Purchase) => {
  devLog('purchaseUpdatedListener -> 1', purchase);
  const receipt = purchase.transactionReceipt;
  if (receipt) {
    try {
      try {
        await openapi.confirmIapOrder(
          Platform.select({
            ios: {
              transaction_id: purchase.transactionId || '',
              product_id: purchase.productId,
              device_type: 'ios',
            },
            android: {
              transaction_id: purchase.purchaseToken || '',
              product_id: purchase.productId,
              device_type: 'android',
            },
          })!,
        );

        eventBus.emit(EVENTS.PURCHASE_UPDATED, { data: purchase });
      } catch (e: any) {
        eventBus.emit(EVENTS.PURCHASE_UPDATED, { data: purchase, error: e });
      }
      finishTransaction({ purchase, isConsumable: true });
    } catch (e: any) {
      eventBus.emit(EVENTS.PURCHASE_UPDATED, { data: purchase, error: e });
      console.error(e);
    }
  }
};

export const useIAPListener = () => {
  useEffect(() => {
    const effectEndTrace = startStartupTraceSpan('iap_listener_effect');
    let purchaseUpdateSubscription: ReturnType<
      typeof purchaseErrorListener
    > | null;
    let purchaseErrorSubscription: ReturnType<
      typeof purchaseErrorListener
    > | null;

    const init = async () => {
      const initEndTrace = startStartupTraceSpan('iap_listener_init');
      try {
        traceStartup('iap_listener_init_connection_start');
        await initConnection();
        traceStartup('iap_listener_init_connection_end');
        traceStartup('iap_listener_get_products_start');
        getProducts({
          skus: gasAccountProducts.map(item => item.id),
        });
        traceStartup('iap_listener_get_products_end');

        devLog('init IAP listener');
        if (Platform.OS === 'android') {
          traceStartup('iap_listener_flush_failed_purchases_start');
          flushFailedPurchasesCachedAsPendingAndroid();
          traceStartup('iap_listener_flush_failed_purchases_end');
        }
        purchaseUpdateSubscription = purchaseUpdatedListener(handlePurchase);

        purchaseErrorSubscription = purchaseErrorListener(
          (error: PurchaseError) => {
            // payment error
            error;
            devLog('purchaseErrorListener', error);
          },
        );
        initEndTrace('end');
      } catch (error: any) {
        initEndTrace('error', {
          error: error instanceof Error ? error.message : String(error),
        });
        devLog('initConnection error', error);
        Sentry.captureException(error);
      }
    };

    const cancelInit = runAfterHomePostStartupReady(init, {
      label: 'iap_listener_init',
      fallbackMs: 5000,
    });
    effectEndTrace('scheduled');

    return () => {
      cancelInit();
      purchaseUpdateSubscription?.remove();
      purchaseUpdateSubscription = null;
      purchaseErrorSubscription?.remove();
      purchaseErrorSubscription = null;
    };
  }, []);
};
