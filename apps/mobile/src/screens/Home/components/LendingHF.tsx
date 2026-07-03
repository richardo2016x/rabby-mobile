import { useRendererDetect } from '@/components/Perf/PerfDetector';
import { useTheme2024 } from '@/hooks/theme';
import { apisLending, useLendingHF } from '@/screens/Lending/hooks';
import { getHealthStatusColor } from '@/screens/Lending/utils';
import { formatNum } from '@/utils/math';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { useEffect } from 'react';
import { Text } from '@/components/Typography';
import { InteractionManager } from 'react-native';
import { traceStartup } from '@/core/utils/startupTrace';

const LENDING_HF_STARTUP_DELAY_MS = 6000;

const NetWorthBadge: React.FC<{ netWorth: string }> = ({ netWorth }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  if (Number(netWorth) <= 0) {
    return null;
  }
  return <Text style={styles.netWorthText}>{formatUsdValue(netWorth)}</Text>;
};

export const LendingHF: React.FC<{}> = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { lendingHf } = useLendingHF();

  useRendererDetect({ name: 'LendingHF' });

  useEffect(() => {
    if (lendingHf) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    traceStartup('home_lending_hf_fetch_schedule', {
      delayMs: LENDING_HF_STARTUP_DELAY_MS,
    });
    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => {
        traceStartup('home_lending_hf_fetch_start');
        apisLending
          .fetchLendingData()
          .finally(() => traceStartup('home_lending_hf_fetch_end'));
      }, LENDING_HF_STARTUP_DELAY_MS);
    });

    return () => {
      interactionHandle.cancel?.();
      timer && clearTimeout(timer);
    };
  }, [lendingHf]);

  if (
    !lendingHf?.healthFactor ||
    Number(lendingHf.healthFactor) <= 0 ||
    Number(lendingHf.healthFactor) >= 3
  ) {
    return <NetWorthBadge netWorth={lendingHf?.netWorthUSD || '0'} />;
  }
  return (
    <Text
      style={[
        styles.text,
        {
          color: getHealthStatusColor(Number(lendingHf.healthFactor || '0'))
            .color,
        },
      ]}>
      {formatNum(lendingHf.healthFactor)}
    </Text>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  text: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  green: {
    color: colors2024['green-default'],
  },
  red: {
    color: colors2024['red-default'],
  },
  netWorthText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
}));
