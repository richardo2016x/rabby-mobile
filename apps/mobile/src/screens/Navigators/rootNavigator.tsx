import 'react-native-gesture-handler';

import { useThemeColors } from '@/hooks/theme';

import { DEFAULT_NAVBAR_FONT_SIZE, RootNames } from '@/constant/layout';
import { WebViewControlPreload } from '@/perfs/loadables/rootNavigatorScreens';
import MultiAddressHome from '@/screens/Home/MultiAddressHome';

import { HomeNavigatorParamsList } from '@/navigation-type';
import React, { useLayoutEffect } from 'react';
import { InteractionManager } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { preloadHomeShortcutNavigators } from '@/perfs/preloads';
import { traceStartup, traceStartupOnce } from '@/core/utils/startupTrace';
import { useHomePostStartupReady } from '@/core/utils/homeStartupReady';

const HomeHiddenTabStack = createBottomTabNavigator<HomeNavigatorParamsList>();

const TabBarComponent = () => null;
const WEBVIEW_CONTROL_PRELOAD_DELAY_MS = 6000;

function useDelayedWebViewControlPreloadReady(homePostStartupReady: boolean) {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (!homePostStartupReady) {
      setReady(false);
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    traceStartup('webview_control_preload_schedule', {
      delayMs: WEBVIEW_CONTROL_PRELOAD_DELAY_MS,
    });

    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      timeoutId = setTimeout(() => {
        if (disposed) {
          return;
        }

        traceStartup('webview_control_preload_ready', {
          delayMs: WEBVIEW_CONTROL_PRELOAD_DELAY_MS,
        });
        setReady(true);
      }, WEBVIEW_CONTROL_PRELOAD_DELAY_MS);
    });

    return () => {
      disposed = true;
      interactionHandle.cancel?.();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [homePostStartupReady]);

  return ready;
}

export function HomeScreenNavigator() {
  const colors = useThemeColors();
  const homePostStartupReady = useHomePostStartupReady();
  const webViewControlPreloadReady =
    useDelayedWebViewControlPreloadReady(homePostStartupReady);
  traceStartupOnce('home_screen_navigator_render');

  if (__DEV__) {
    console.debug('[BottomTabNavigator] Render');
  }

  useLayoutEffect(() => {
    if (!homePostStartupReady) {
      return;
    }

    const timer = setTimeout(() => {
      preloadHomeShortcutNavigators().catch(error => {
        console.error('preloadHomeShortcutNavigators::error', error);
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [homePostStartupReady]);

  return (
    <>
      <HomeHiddenTabStack.Navigator
        screenOptions={
          /* mergeScreenOptions */ {
            // gestureEnabled: false,
            headerTitleAlign: 'center',
            headerStyle: {
              backgroundColor: 'transparent',
            },
            // headerShadowVisible: true,
            headerTintColor: colors['neutral-title-1'],
            headerTitleStyle: {
              color: colors['neutral-title-1'],
              fontWeight: '500',
              fontSize: DEFAULT_NAVBAR_FONT_SIZE,
            },
            // headerTransparent: true,
          }
        }
        tabBar={TabBarComponent}>
        <HomeHiddenTabStack.Screen
          name={RootNames.Home}
          component={MultiAddressHome}
          options={{
            headerShown: false,
            freezeOnBlur: false,
          }}
        />

        {/* <HomeHiddenTabStack.Screen
          name={RootNames.DappWebViewStubOnHome}
          component={DappWebViewStubScreen}
          options={{
            title: '',
            headerShadowVisible: false,
            headerShown: false,
            // tabBarStyle: { height: 0, display: 'none' },
            // tabBarButton(props) {
            //   return null;
            // },
            // animation: 'slide_from_bottom',
            // animationDuration: 500,
            // animationTypeForReplace: 'push',
            // header: (headerProps) => {
            //   // return <DappWebViewStubScreen.Header />
            //   return null;
            // }
          }}
        /> */}
      </HomeHiddenTabStack.Navigator>

      {webViewControlPreloadReady ? (
        <React.Suspense fallback={null}>
          <WebViewControlPreload />
        </React.Suspense>
      ) : null}
    </>
  );
}
