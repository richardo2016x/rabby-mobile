import React, { useCallback } from 'react';
import { View } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import { useRendererDetect } from '@/components/Perf/PerfDetector';
import { perfEvents } from '@/core/utils/perf';
import { runIIFEFunc } from '@/core/utils/store';
import { startStartupTraceSpan } from '@/core/utils/startupTrace';
import { apisHomeTabIndex, HomeTabName } from '@/hooks/navigation';
import { HomeCustomMaterialTabBar } from '@/screens/Home/components/CustomTabBar';
import { TabsTopHeader } from '@/screens/Home/components/OverviewTopHeader';
import { HOME_TOP_HEADER_SIZES } from '@/constant/home';
import { matomoRequestEvent } from '@/utils/analytics';
import { RabbyControlledContainer as TabsContainer } from '@rabby-wallet/react-native-collapsible-tab-view/src/RabbyControlledContainer';
import { Tab as TabsTab } from '@rabby-wallet/react-native-collapsible-tab-view/src/Tab';
import { isTabsSwiping } from './hooks';
import { IS_IOS } from '@/core/native/utils';
import { HomeOverview } from '@/screens/Home/components/HomeOverview';
import { homeDrawerAnimateMutable } from '@/screens/Home/hooks/useHomeDrawerAnimate';
import { useValueFromSharedValue } from '@/hooks/reanimated';

export const TAB_HEADER_FULL_HEIGHT =
  HOME_TOP_HEADER_SIZES.headerHeight +
  HOME_TOP_HEADER_SIZES.scrollableListTopOffset;

interface TabMultiAssetsProps {}

import { HomeTabName as TabName } from '@/hooks/navigation';
export { HomeTabName as TabName } from '@/hooks/navigation';

const homeTabScrollerRef = apisHomeTabIndex.homeTabScrollerRef;

runIIFEFunc(() => {
  perfEvents.subscribe('NAV_BACK_ON_HOME', () => {
    if (!homeTabScrollerRef.current) {
      return;
    }
    const currentIndex = homeTabScrollerRef.current?.getCurrentIndex() || 0;
    if (currentIndex > 0) {
      homeTabScrollerRef.current?.setIndex(Math.max(0, currentIndex - 1));
    }
  });
});

const onIndexChange = (idx: number) => {
  apisHomeTabIndex.setTabIndex(idx);
};

const LazyTokenList = React.lazy(() => {
  const endTrace = startStartupTraceSpan('home_tab_token_import');

  return import('./TokenList').then(
    m => {
      endTrace('end');
      return { default: m.TokenList };
    },
    error => {
      endTrace('error', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    },
  );
});

const LazyProtocolList = React.lazy(() => {
  const endTrace = startStartupTraceSpan('home_tab_protocol_import');

  return import('./ProtocolList').then(
    m => {
      endTrace('end');
      return { default: m.ProtocolList };
    },
    error => {
      endTrace('error', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    },
  );
});

const LazyNFTList = React.lazy(() => {
  const endTrace = startStartupTraceSpan('home_tab_nft_import');

  return import('./NFTList').then(
    m => {
      endTrace('end');
      return { default: m.NFTList };
    },
    error => {
      endTrace('error', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    },
  );
});

export const TabsMultiAssets: React.FC<TabMultiAssetsProps> = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const isDappDrawerExpanded = useValueFromSharedValue(
    homeDrawerAnimateMutable.isExpanded,
  );

  const handleTabChange = useCallback(
    ({ prevIndex, index }: { prevIndex: number; index: number }) => {
      // 在前两个tab之间切换
      const isSwapBetweenOverviewAndOtherTabs =
        (prevIndex === 0 && index === 1) || (prevIndex === 1 && index === 0);
      if (isSwapBetweenOverviewAndOtherTabs) {
        matomoRequestEvent({
          category: 'HomeTab',
          action: 'HomeTab_Switch',
        });
      }
    },
    [],
  );
  useRendererDetect({ name: 'TabsMultiAssets' });

  return (
    <View style={styles.container}>
      <TabsTopHeader />
      <HomeCustomMaterialTabBar />
      <TabsContainer
        ref={homeTabScrollerRef}
        onIndexChange={onIndexChange}
        onTabChange={handleTabChange}
        // renderHeader={renderTabHeaderStub}
        workletOnIndexDecimalChange={ctx => {
          'worklet';
          apisHomeTabIndex.onTabSvsChange(
            ctx.indexDecimal,
            ctx.tabName as HomeTabName,
          );
        }}
        renderHeader={() => null}
        renderTabBar={() => null}
        // renderTabBar={renderTabBar}
        headerHeight={0}
        minHeaderHeight={0}
        tabBarHeight={0}
        allowHeaderOverscroll={IS_IOS}
        lazy
        cancelLazyFadeIn
        pagerProps={{
          scrollEnabled: !isDappDrawerExpanded,
          onPageScrollStateChanged: event => {
            isTabsSwiping.value =
              event?.nativeEvent?.pageScrollState !== 'idle';
          },
          // scrollEnabled: !accountToShowReceiveTip,
        }}
        containerStyle={styles.tabsContainer}
        headerContainerStyle={styles.headerContainer}>
        <TabsTab
          key={TabName.overview}
          name={TabName.overview}
          label={() => null}>
          <HomeOverview />
        </TabsTab>

        <TabsTab key={TabName.token} name={TabName.token} label={() => null}>
          <React.Suspense fallback={null}>
            <LazyTokenList />
          </React.Suspense>
        </TabsTab>
        <TabsTab key={TabName.defi} name={TabName.defi} label={() => null}>
          <React.Suspense fallback={null}>
            <LazyProtocolList />
          </React.Suspense>
        </TabsTab>
        <TabsTab key={TabName.nft} name={TabName.nft} label={() => null}>
          <React.Suspense fallback={null}>
            <LazyNFTList />
          </React.Suspense>
        </TabsTab>
      </TabsContainer>
    </View>
  );
};

const getStyles = createGetStyles2024(() => ({
  container: {
    position: 'relative',
    flex: 1,
    // paddingTop: safeAreaInsets.top,
  },
  tabsContainer: {
    flex: 1,
    // marginTop: safeAreaInsets.top,
    // ...makeDebugBorder('blue'),
  },
  headerContainer: {
    backgroundColor: 'transparent',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
}));
