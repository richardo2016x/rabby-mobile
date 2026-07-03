import { getBookmarkList } from '@/hooks/browser/useBrowserBookmark';
import { getBrowserHistoryList } from '@/hooks/browser/useBrowserHistory';
import { getAllRPC } from '@/hooks/useCustomRPC';
import { setTabs } from '@/hooks/browser/useBrowser';
import { browserService, dappService } from '../services/shared';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { startStartupTraceSpan, traceStartup } from '@/core/utils/startupTrace';

let hasSetupBrowserServiceStub = false;

export async function setupBrowserServiceStubData() {
  if (hasSetupBrowserServiceStub) {
    traceStartup('setup_service_stub_browser_data_skipped', {
      reason: 'already_setup',
    });
    return;
  }

  hasSetupBrowserServiceStub = true;

  const endTrace = startStartupTraceSpan('setup_service_stub_browser_data');

  try {
    traceStartup('setup_service_stub_get_all_rpc_start');
    getAllRPC();
    traceStartup('setup_service_stub_get_all_rpc_end');

    traceStartup('setup_service_stub_get_bookmarks_start');
    getBookmarkList();
    traceStartup('setup_service_stub_get_bookmarks_end');

    traceStartup('setup_service_stub_get_history_start');
    getBrowserHistoryList();
    traceStartup('setup_service_stub_get_history_end');

    traceStartup('setup_service_stub_get_tabs_start');
    const data = browserService.getBrowserTabs();
    traceStartup('setup_service_stub_get_tabs_end', {
      count: data.tabs.length,
    });

    traceStartup('setup_service_stub_set_tabs_start', {
      count: data.tabs.length,
    });
    setTabs(
      data.tabs.map(tab => {
        if (tab.isDapp) {
          return tab;
        }
        const isDapp = !!dappService.getDapp(
          safeGetOrigin(tab.url || tab.initialUrl),
        )?.isDapp;

        return {
          ...tab,
          isDapp,
        };
      }),
    );
    traceStartup('setup_service_stub_set_tabs_end', {
      count: data.tabs.length,
    });
    endTrace('end', {
      count: data.tabs.length,
    });
  } catch (error) {
    hasSetupBrowserServiceStub = false;
    endTrace('error', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
