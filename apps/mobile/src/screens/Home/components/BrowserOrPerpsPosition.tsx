import React from 'react';
import { useHomePostStartupReady } from '@/core/utils/homeStartupReady';
import { traceStartup, traceStartupOnce } from '@/core/utils/startupTrace';
import { useHomeDisplayedTabs } from '@/hooks/browser/useBrowser';
import { BrowserSearchEntry } from '../../Browser/components/BrowserSearchEntry';
import { InteractionManager } from 'react-native';

const HOME_PERPS_POSITION_DELAY_MS = 6000;

const LazyPerpsMultiAssetPosition = React.lazy(() =>
  import('../../Perps/components/PerpsMultiAssetPosition').then(m => ({
    default: m.PerpsMultiAssetPosition,
  })),
);

export const BrowserOrPerpsPosition: React.FC = () => {
  const { homeDisplayedTabs } = useHomeDisplayedTabs();
  const homePostStartupReady = useHomePostStartupReady();
  const [canRenderPerpsPosition, setCanRenderPerpsPosition] =
    React.useState(false);

  React.useEffect(() => {
    if (!homePostStartupReady || homeDisplayedTabs.length > 0) {
      setCanRenderPerpsPosition(false);
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    traceStartup('home_perps_position_schedule', {
      delayMs: HOME_PERPS_POSITION_DELAY_MS,
    });

    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => {
        if (disposed) {
          return;
        }

        traceStartup('home_perps_position_ready', {
          delayMs: HOME_PERPS_POSITION_DELAY_MS,
        });
        setCanRenderPerpsPosition(true);
      }, HOME_PERPS_POSITION_DELAY_MS);
    });

    return () => {
      disposed = true;
      interactionHandle.cancel?.();
      timer && clearTimeout(timer);
    };
  }, [homeDisplayedTabs.length, homePostStartupReady]);

  if (homeDisplayedTabs.length > 0) {
    return <BrowserSearchEntry />;
  }

  if (!homePostStartupReady || !canRenderPerpsPosition) {
    return null;
  }

  traceStartupOnce('browser_or_perps_position_lazy_perps_render');
  return (
    <React.Suspense fallback={null}>
      <LazyPerpsMultiAssetPosition />
    </React.Suspense>
  );
};
