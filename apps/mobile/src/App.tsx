import 'react-native-gesture-handler';
/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */
import AppNavigation from '@/AppNavigation';
import AppErrorBoundary from '@/components/ErrorBoundary';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ThemeProvider, createTheme } from '@rneui/themed';
import { withExpoSnack } from 'nativewind';
import React, { Suspense, useEffect } from 'react';
import { withIAPContext } from 'react-native-iap';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootSiblingParent } from 'react-native-root-siblings';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import BigNumber from 'bignumber.js';
import { ThemeColors } from './constant/theme';
import { useSetupServiceStub } from './core/storage/serviceStoreStub';
import {
  useAppCouldRender,
  useBootstrapApp,
  useInitializeAppOnTop,
} from './hooks/useBootstrap';
import { AppProvider, loadSecurityChain } from './hooks/global';
import { ScreenSceneAccountProvider } from './hooks/accountsSwitcher';
import { useIAPListener } from './hooks/iap/useIAPListener';
import { useIncreaseTxCountOnAppTop } from './components/RateModal/hooks';
import { useUniversalLinkOnTop } from './hooks/universalLink';
import Safe from '@rabby-wallet/gnosis-sdk';
import {
  RerenderDetector,
  useRendererDetect,
} from './components/Perf/PerfDetector';
import { isEqual } from 'lodash';
import { svsLayout } from './hooks/useAppLayout';
import { openapi } from './core/request';
import { DEFAULT_RABBY_MOBILE_CODE, IS_ROZENITE_ENABLED } from './constant/env';
import { startSetupAppBeforeRenderDeferred } from './setup-app-before-render';
import {
  markStartupTrace,
  startStartupTraceSpan,
  traceStartup,
  traceStartupOnce,
} from './core/utils/startupTrace';
import { runAfterHomePostStartupReady } from './core/utils/homeStartupReady';

Safe.openapiService = openapi;

BigNumber.config({ EXPONENTIAL_AT: [-20, 100] });

const rneuiTheme = createTheme({
  lightColors: {
    grey4: ThemeColors.light['neutral-card-2'],
    grey5: ThemeColors.light['neutral-card-3'],
  },
  darkColors: {
    grey4: ThemeColors.dark['neutral-card-2'],
    grey5: ThemeColors.dark['neutral-card-3'],
  },
});

type AppProps = { rabbitCode: string };

const MemoziedAppNav = React.memo(AppNavigation);
const RozeniteDevTools = IS_ROZENITE_ENABLED
  ? require('./devtools/RozeniteDevTools').default
  : null;

const MainScreen = React.memo(({ rabbitCode }: AppProps) => {
  useInitializeAppOnTop();
  useSetupServiceStub();
  useUniversalLinkOnTop();
  useIAPListener();
  useIncreaseTxCountOnAppTop({ isTop: true });

  useRendererDetect({ name: 'MainScreen' });

  const { couldRender } = useAppCouldRender();
  traceStartupOnce('main_screen_render_initial', {
    couldRender,
  });
  if (couldRender) {
    traceStartupOnce('main_screen_render_could_render');
  }

  React.useEffect(() => {
    if (!couldRender) {
      return;
    }

    markStartupTrace('main_screen_could_render');
    traceStartup('setup_before_render_deferred_schedule', {
      delayMs: 120,
      waitForHomePostReady: true,
    });

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelHomePostReadyWait: (() => void) | null = null;
    const frameId = requestAnimationFrame(() => {
      timeoutId = setTimeout(() => {
        cancelHomePostReadyWait = runAfterHomePostStartupReady(
          () => {
            const endTrace = startStartupTraceSpan(
              'setup_before_render_deferred_call',
              {
                reason: 'home_post_startup_ready',
              },
            );
            startSetupAppBeforeRenderDeferred('home_post_startup_ready')
              .then(() => {
                endTrace('end');
              })
              .catch(error => {
                endTrace('error', {
                  error: error instanceof Error ? error.message : String(error),
                });
                console.error(
                  'startSetupAppBeforeRenderDeferred::error',
                  error,
                );
              });
          },
          {
            fallbackMs: 5000,
            label: 'setup_before_render_deferred',
          },
        );
      }, 120);
    });

    return () => {
      cancelHomePostReadyWait?.();
      cancelAnimationFrame(frameId);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [couldRender]);

  return (
    <AppProvider
      value={{ rabbitCode, securityChain: loadSecurityChain({ rabbitCode }) }}>
      <RerenderDetector name="UnderAppProvider" />
      <BottomSheetModalProvider>
        <ScreenSceneAccountProvider>
          {couldRender ? <MemoziedAppNav /> : null}
        </ScreenSceneAccountProvider>
      </BottomSheetModalProvider>
    </AppProvider>
  );
});

function SizeWatcher() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const prevInsets = svsLayout.insets.value;
    if (isEqual(prevInsets, insets)) {
      return;
    }
    svsLayout.insets.value = insets;
  }, [insets]);

  return null;
}

function App({ rabbitCode: propRabbitCode }: AppProps): JSX.Element {
  const rabbitCode = __DEV__ ? DEFAULT_RABBY_MOBILE_CODE : propRabbitCode || '';
  traceStartupOnce('app_render', {
    hasRabbitCode: !!rabbitCode,
  });
  React.useEffect(() => {
    markStartupTrace('app_mount');
  }, []);
  useBootstrapApp({ rabbitCode });

  return (
    <AppErrorBoundary>
      <ThemeProvider theme={rneuiTheme}>
        <SafeAreaProvider>
          <RootSiblingParent>
            {RozeniteDevTools ? <RozeniteDevTools /> : null}
            <SizeWatcher />
            <Suspense fallback={null}>
              {/* TODO: measure to check if memory leak occured when refresh on iOS */}
              <GestureHandlerRootView style={{ flex: 1 }}>
                {/* read from native bundle on production */}
                <MainScreen rabbitCode={rabbitCode} />
              </GestureHandlerRootView>
            </Suspense>
          </RootSiblingParent>
        </SafeAreaProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}

export default withExpoSnack(withIAPContext(App));
