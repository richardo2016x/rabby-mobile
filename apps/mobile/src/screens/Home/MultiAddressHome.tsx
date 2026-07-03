import { RootNames } from '@/constant/layout';
import { useAppThemeConfig, useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect } from 'react';
import { AppState, InteractionManager, View } from 'react-native';

import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import {
  resetHomeStartupReady,
  scheduleHomeStartupReady,
  traceHomeStartupReady,
  useHomePostStartupReady,
  useHomeStartupReady,
} from '@/core/utils/homeStartupReady';
import {
  startStartupTraceSpan,
  traceStartup,
  traceStartupOnce,
} from '@/core/utils/startupTrace';
import { apisHomeTabIndex, resetNavigationTo } from '@/hooks/navigation';
import { matomoRequestEvent } from '@/utils/analytics';
import { getReadyNavigationInstance } from '@/utils/navigation';
import { ScreenSpecificStatusBar } from '@/components/FocusAwareStatusBar';
import { useRendererDetect } from '@/components/Perf/PerfDetector';
import { HomeGuidanceMultipleTabs } from '@/components2024/Animations/HomeGuidanceMultipleTabs';
import { setIsFoldMultiChart } from '../Address/components/MultiAssets/RenderRow/CurveChart';
import { TabsMultiAssets } from '../Address/components/MultiAssets/TabsMultiAssets';
import { TmpHomeRefresher } from './components/TmpHomeRefresher';
import { useHomePortfolioStore } from './hooks/useHomePortfolioSummary';
import { callHomeStartupService } from '@/core/services/homeStartupDeferredClient';

const HomeDeferredLifecycle = React.lazy(
  () => import('./components/HomeDeferredLifecycle'),
);

let hasStartedInitReadableAccountStoresAfterHomeReady = false;

async function startInitReadableAccountStoresAfterHomeReady() {
  if (hasStartedInitReadableAccountStoresAfterHomeReady) {
    traceStartup('home_ready_readable_stores_skipped', {
      reason: 'already_started',
    });
    return;
  }

  const endTrace = startStartupTraceSpan('home_ready_readable_stores');

  try {
    const fetchAccountsEndTrace = startStartupTraceSpan(
      'home_ready_fetch_accounts',
    );
    const accounts = await callHomeStartupService('fetchAccounts', [
      {
        source: 'home_ready_readable_stores',
      },
    ]);
    fetchAccountsEndTrace('end', {
      count: accounts.length,
    });

    if (!accounts.length || hasStartedInitReadableAccountStoresAfterHomeReady) {
      endTrace('skipped', {
        reason: !accounts.length ? 'no_accounts' : 'already_started',
      });
      return;
    }

    hasStartedInitReadableAccountStoresAfterHomeReady = true;
    await callHomeStartupService('initReadableAccountStores', []);
    endTrace('end', {
      count: accounts.length,
    });
  } catch (error) {
    endTrace('error', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

const detectHasAccounts = async () => {
  const result = { redirectAction: null as Function | null };
  const hasAccountsInKeyring = await callHomeStartupService(
    'hasVisibleAccounts',
    [],
  );

  if (!hasAccountsInKeyring) {
    result.redirectAction = () => {
      const navigation = getReadyNavigationInstance();
      navigation && resetNavigationTo(navigation, 'GetStarted');
    };
  }

  return result;
};

function HomeStartupReadyScheduler() {
  useEffect(() => {
    resetHomeStartupReady();
    traceHomeStartupReady('home_mount');

    return scheduleHomeStartupReady();
  }, []);

  return null;
}

function HomeReadableStoresBootstrap() {
  const homeStartupReady = useHomeStartupReady();

  useEffect(() => {
    if (!homeStartupReady) {
      return;
    }

    let disposed = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    traceStartup('home_ready_readable_stores_schedule');
    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      timeoutId = setTimeout(() => {
        if (disposed) {
          return;
        }

        traceStartup('home_ready_readable_stores_run');
        startInitReadableAccountStoresAfterHomeReady().catch(error => {
          console.error(
            'startInitReadableAccountStoresAfterHomeReady::error',
            error,
          );
        });
      }, 0);
    });

    return () => {
      disposed = true;
      interactionHandle.cancel?.();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [homeStartupReady]);

  return null;
}

function HomePostStartupEffects({
  appThemeConfig,
}: {
  appThemeConfig: ReturnType<typeof useAppThemeConfig>;
}) {
  const homePostStartupReady = useHomePostStartupReady();

  useEffect(() => {
    if (!homePostStartupReady) {
      return;
    }

    traceStartup('home_post_delete_long_cache_schedule');
    const timeoutId = setTimeout(() => {
      const endTrace = startStartupTraceSpan('home_post_delete_long_cache');
      callHomeStartupService('deleteLongTimeHomeCache', [])
        .then(() => {
          endTrace('end');
        })
        .catch(error => {
          endTrace('error', {
            error: error instanceof Error ? error.message : String(error),
          });
          console.error('deleteLongTimeHomeCache error', error);
        });
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [homePostStartupReady]);

  useFocusEffect(
    useCallback(() => {
      if (!homePostStartupReady) {
        return;
      }

      (async () => {
        traceHomeStartupReady('home_has_visible_accounts_start');
        const endTrace = startStartupTraceSpan('home_has_visible_accounts');
        const { redirectAction } = await detectHasAccounts();
        endTrace('end', {
          shouldRedirect: !!redirectAction,
        });
        traceHomeStartupReady('home_has_visible_accounts_end', {
          shouldRedirect: !!redirectAction,
        });
        if (redirectAction) {
          redirectAction();
        }
      })();
    }, [homePostStartupReady]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!homePostStartupReady) {
        return;
      }

      traceStartup('home_post_track_gas_account_active');
      callHomeStartupService('trackGasAccountActiveStatusOncePerDay', []).catch(
        error => {
          console.error('trackGasAccountActiveStatusOncePerDay error', error);
        },
      );

      const subscription = AppState.addEventListener('change', state => {
        if (state === 'active') {
          callHomeStartupService(
            'trackGasAccountActiveStatusOncePerDay',
            [],
          ).catch(error => {
            console.error('trackGasAccountActiveStatusOncePerDay error', error);
          });
        }
      });

      return () => {
        subscription.remove();
      };
    }, [homePostStartupReady]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!homePostStartupReady) {
        return;
      }

      traceStartup('home_post_gas_account_refresh_start');
      callHomeStartupService('scheduleGasAccountSnapshotRefresh', [
        {
          reason: 'home_focus',
        },
      ]).catch(error => {
        console.error('scheduleGasAccountSnapshotRefresh error', error);
      });
      const endTrace = startStartupTraceSpan('home_post_auto_login_gas');
      callHomeStartupService('autoLoginGasAccountIfNeeded', [])
        .then(() => {
          endTrace('end');
        })
        .catch(error => {
          endTrace('error', {
            error: error instanceof Error ? error.message : String(error),
          });
          console.error('autoLoginGasAccountIfNeeded error', error);
        });
    }, [homePostStartupReady]),
  );

  useEffect(() => {
    if (!homePostStartupReady) {
      return;
    }

    traceStartup('home_post_theme_matomo');
    matomoRequestEvent({
      category: 'ThemeMode',
      action: `ThemeMode_${appThemeConfig}`,
    });
  }, [appThemeConfig, homePostStartupReady]);

  useEffect(() => {
    if (!homePostStartupReady) {
      return;
    }

    traceStartup('home_post_daily_report_check');
    callHomeStartupService('runHomeDailyReport', []).catch(error => {
      console.error('runHomeDailyReport error', error);
    });
  }, [homePostStartupReady]);

  if (!homePostStartupReady) {
    return null;
  }

  return (
    <>
      <React.Suspense fallback={null}>
        <HomeDeferredLifecycle />
      </React.Suspense>
      <HomeGuidanceMultipleTabs />
    </>
  );
}

function MultiAddressHome(): JSX.Element {
  traceStartupOnce('multi_address_home_render');
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle,
  });
  const appThemeConfig = useAppThemeConfig();
  const isLoss = useHomePortfolioStore(state => state.changeData.isLoss);
  useRendererDetect({ name: 'MultiAddressHome' });

  useEffect(() => {
    apisHomeTabIndex.setTabIndex(0);
  }, []);

  return (
    <NormalScreenContainer2024
      type="linear"
      noHeader
      bgImageSource={
        isLoss
          ? require('@/assets2024/singleHome/loss-home.png')
          : require('@/assets2024/singleHome/up-home.png')
      }
      linearProp={{
        colors: isLight
          ? [colors2024['neutral-bg-1'], colors2024['neutral-bg-2']]
          : [colors2024['neutral-bg-1'], colors2024['neutral-bg-1']],
        locations: [0, 1],
        start: { x: 0.5, y: 0 },
        end: { x: 0.5, y: 0.26 },
      }}
      overwriteStyle={styles.screenContainer}>
      <ScreenSpecificStatusBar screenName={RootNames.Home} />

      <View
        style={[styles.paddingContainer]}
        onLayout={() => {
          traceStartupOnce('multi_address_home_content_layout');
        }}
        onTouchStart={() => {
          setIsFoldMultiChart(true);
        }}>
        <TabsMultiAssets />
      </View>

      <HomeStartupReadyScheduler />
      <HomeReadableStoresBootstrap />
      <HomePostStartupEffects appThemeConfig={appThemeConfig} />

      <TmpHomeRefresher />
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(({ safeAreaInsets }) => ({
  screenContainer: {
    paddingTop: safeAreaInsets.top,
  },
  paddingContainer: {
    paddingHorizontal: 0,
    flex: 1,
    flexGrow: 1,
  },
}));

export default MultiAddressHome;
