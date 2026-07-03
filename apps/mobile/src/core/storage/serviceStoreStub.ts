import { getChainList } from '@/constant/chains';
import { useMount } from 'ahooks';
import { setChainList } from '@/hooks/useChainList';
import { startStartupTraceSpan } from '@/core/utils/startupTrace';
import { runAfterHomePostStartupReady } from '@/core/utils/homeStartupReady';
import { callDeferredService } from '@/core/services/deferred';
import {
  HOME_STARTUP_DEFERRED_SERVICE,
  type HomeStartupDeferredService,
} from '@/core/services/homeStartupDeferred';

/**
 * @description only call this hook on app's top level
 */
export function useSetupServiceStub() {
  useMount(() => {
    const endTrace = startStartupTraceSpan('setup_service_stub_chain_list');
    setChainList({
      mainnetList: getChainList('mainnet'),
      testnetList: getChainList('testnet'),
    });
    endTrace('end');
  });

  useMount(() => {
    return runAfterHomePostStartupReady(
      () => {
        callDeferredService<
          HomeStartupDeferredService,
          'setupBrowserServiceStubData'
        >(
          HOME_STARTUP_DEFERRED_SERVICE,
          'setupBrowserServiceStubData',
          [],
        ).catch(error => {
          console.error('setupBrowserServiceStubData error', error);
        });
      },
      {
        label: 'setup_service_stub_browser_data',
        fallbackMs: 5000,
      },
    );
  });
}
