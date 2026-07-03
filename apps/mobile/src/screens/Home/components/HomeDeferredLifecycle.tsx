import { useEffect } from 'react';

import { traceStartup } from '@/core/utils/startupTrace';
import { useTrack0331HomeActiveSnapshots } from '@/utils/analytics0331';
import { useInitDetectDBAssets } from '../../Search/useAssets';

export default function HomeDeferredLifecycle() {
  useEffect(() => {
    traceStartup('home_deferred_lifecycle_mount');
  }, []);

  useInitDetectDBAssets();
  useTrack0331HomeActiveSnapshots();

  return null;
}
