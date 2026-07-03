import React from 'react';
import { Keyboard, PanResponder, View, ViewProps } from 'react-native';

import { getLatestNavigationName } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { keyringService } from '@/core/services/keyringRuntime';
import { throttle } from 'lodash';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import {
  AsName,
  MakePropsByAsMap,
  useComponentByAsProp,
} from '@/hooks/common/useComponentAsProp';
import { perfEvents } from '@/core/utils/perf';
import {
  callAutoLockService,
  waitAutoLockService,
} from '@/core/services/autoLockDeferredClient';

const implUiRefreshTimeout = throttle(
  () => {
    const routeName = getLatestNavigationName();
    if (routeName === RootNames.Unlock) return;

    // if (__DEV__) console.debug('uiRefreshTimeout');

    return callAutoLockService('refreshAutolockTimeout', [], {
      timeoutMs: 5000,
    }).catch(error => {
      console.error('refreshAutolockTimeout::deferred::error', error);
    });
  },
  250 * 3,
  { leading: true },
);

export function useRefreshAutoLockPanResponder() {
  return React.useMemo(() => {
    /**
     * In order not to steal any touches from the children components, this method
     * must return false.
     */
    const resetTimerForPanResponder = () => {
      implUiRefreshTimeout();
      return false;
    };

    const panResponder = PanResponder.create({
      onMoveShouldSetPanResponderCapture: resetTimerForPanResponder,
      onPanResponderTerminationRequest: resetTimerForPanResponder,
      onStartShouldSetPanResponderCapture: resetTimerForPanResponder,
    });

    return {
      panResponder,
    };
  }, []);
}

const ViewMap = {
  View,
  BottomSheetView,
};

type Props<A extends AsName<typeof ViewMap>> = MakePropsByAsMap<
  typeof ViewMap,
  A
>;
export default function AutoLockView<
  T extends AsName<typeof ViewMap> = 'View',
>({ as = 'View' as T, ...props }: Props<T>) {
  const { panResponder } = useRefreshAutoLockPanResponder();

  const { Component: ViewComp } = useComponentByAsProp(as, ViewMap);

  return (
    <ViewComp {...props} {...panResponder.panHandlers}>
      {props.children || null}
    </ViewComp>
  );
}

function ForAppNav(props: Props<'View'>) {
  React.useEffect(() => {
    let cleanupAutoLock: (() => void) | null = null;
    let cancelled = false;

    waitAutoLockService({
      timeoutMs: 5000,
    })
      .then(autoLockService => {
        if (cancelled) {
          return;
        }

        const subUnlock = perfEvents.subscribe(
          'USER_MANUALLY_UNLOCK',
          autoLockService.handleUnlock,
        );
        const removeTriggerRefresh =
          autoLockService.subscribeTriggerRefresh(implUiRefreshTimeout);
        keyringService.on('lock', autoLockService.handleLock);

        cleanupAutoLock = () => {
          subUnlock.remove();
          removeTriggerRefresh();
          keyringService.off('lock', autoLockService.handleLock);
        };
      })
      .catch(error => {
        if (!cancelled) {
          console.error('AutoLockView.ForAppNav::setupAutoLock::error', error);
        }
      });

    const hideEvent = Keyboard.addListener(
      'keyboardDidHide',
      implUiRefreshTimeout,
    );
    const showEvent = Keyboard.addListener(
      'keyboardDidShow',
      implUiRefreshTimeout,
    );

    // release event listeners on destruction
    return () => {
      cancelled = true;
      cleanupAutoLock?.();

      hideEvent.remove();
      showEvent.remove();
    };
  }, []);

  return <AutoLockView {...props} />;
}

AutoLockView.ForAppNav = ForAppNav;
