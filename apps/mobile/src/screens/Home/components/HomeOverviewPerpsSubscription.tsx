import type { KeyringAccountWithAlias } from '@/hooks/account';
import { useSubscribePosition } from '@/hooks/perps/usePerpsStore';
import { traceStartup, traceStartupOnce } from '@/core/utils/startupTrace';

traceStartup('home_perps_subscription_module_evaluated');

export function HomeOverviewPerpsSubscription({
  sortedAccounts,
}: {
  sortedAccounts: KeyringAccountWithAlias[];
}) {
  traceStartupOnce('home_perps_subscription_render');
  useSubscribePosition(sortedAccounts);

  return null;
}
