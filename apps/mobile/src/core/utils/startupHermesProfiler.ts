import { Platform } from 'react-native';
import { getRNSentryModule } from '@sentry/react-native/dist/js/wrapper';

import { startStartupEarlySpan, traceStartupEarly } from './startupEarlyTrace';

type HermesStackFrame = {
  name?: string;
  parent?: number;
  category?: string;
  line?: number;
  column?: number;
  funcVirtAddr?: number;
  offset?: number;
};

type HermesSample = {
  sf: number;
  ts: number | string;
  tid: number | string;
};

type HermesProfile = {
  samples?: HermesSample[];
  stackFrames?: Record<string, HermesStackFrame>;
};

const PROFILE_DURATION_MS = 12_000;
const MAX_TOP_ITEMS = 30;
let hasStarted = false;

function isStartupHermesProfilerEnabled() {
  if (Platform.OS !== 'android') {
    return false;
  }

  if (__DEV__) {
    return false;
  }

  const runtimeEnv =
    process.env.RABBY_MOBILE_BUILD_ENV === 'production'
      ? 'production'
      : 'regression';
  const buildChannel = process.env.buildchannel || 'selfhost-reg';

  return runtimeEnv !== 'production' || buildChannel !== 'appstore';
}

function frameName(frame?: HermesStackFrame) {
  if (!frame?.name) {
    return '[unknown]';
  }

  return frame.name;
}

function getStackKey(profile: HermesProfile, stackFrameId: number) {
  const frames = profile.stackFrames || {};
  const names: string[] = [];
  let currentId: number | undefined = stackFrameId;
  let guard = 0;

  while (currentId !== undefined && guard < 80) {
    guard += 1;
    const frame = frames[String(currentId)];
    if (!frame) {
      break;
    }

    const name = frameName(frame);
    if (name !== '[root]') {
      names.push(name);
    }
    currentId = frame.parent;
  }

  return names.reverse().join(' > ') || '[unknown]';
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) || 0) + 1);
}

function topEntries(map: Map<string, number>, totalSamples: number) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TOP_ITEMS)
    .map(([name, samples]) => ({
      name,
      samples,
      pct: totalSamples ? Math.round((samples / totalSamples) * 1000) / 10 : 0,
    }));
}

function summarizeHermesProfile(profile: HermesProfile) {
  const samples = profile.samples || [];
  const stackFrames = profile.stackFrames || {};
  const leafCounts = new Map<string, number>();
  const stackCounts = new Map<string, number>();

  for (const sample of samples) {
    const frame = stackFrames[String(sample.sf)];
    increment(leafCounts, frameName(frame));
    increment(stackCounts, getStackKey(profile, sample.sf));
  }

  return {
    totalSamples: samples.length,
    stackFrameCount: Object.keys(stackFrames).length,
    topLeafFrames: topEntries(leafCounts, samples.length),
    topStacks: topEntries(stackCounts, samples.length),
  };
}

async function writeProfileFile(profile: HermesProfile) {
  const RNFS = await import('react-native-fs');
  const baseDir =
    Platform.OS === 'android' && RNFS.ExternalDirectoryPath
      ? RNFS.ExternalDirectoryPath
      : RNFS.CachesDirectoryPath;
  const filePath = `${baseDir}/rabby-startup-hermes-${Date.now()}.cpuprofile`;

  await RNFS.writeFile(filePath, JSON.stringify(profile), 'utf8');

  return filePath;
}

export function startStartupHermesProfiler() {
  if (hasStarted || !isStartupHermesProfilerEnabled()) {
    return;
  }

  hasStarted = true;

  const sentryNativeModule = getRNSentryModule();
  if (
    !sentryNativeModule?.startProfiling ||
    !sentryNativeModule.stopProfiling
  ) {
    traceStartupEarly('hermes_profiler_native_module_missing');
    return;
  }

  try {
    const startResult = sentryNativeModule.startProfiling(false);
    const started = !!startResult.started;
    traceStartupEarly('hermes_profiler_start', {
      started,
      error: startResult.error,
      durationMs: PROFILE_DURATION_MS,
    });

    if (!started) {
      return;
    }
  } catch (error) {
    traceStartupEarly('hermes_profiler_start_error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  setTimeout(() => {
    const endTrace = startStartupEarlySpan('hermes_profiler_stop');

    try {
      const profile = sentryNativeModule.stopProfiling();

      if (!profile?.profile || profile.error) {
        endTrace('empty', {
          error: profile?.error,
        });
        return;
      }

      const hermesProfile = JSON.parse(profile.profile) as HermesProfile;
      const summary = summarizeHermesProfile(hermesProfile);
      traceStartupEarly('hermes_profiler_summary', summary);

      writeProfileFile(hermesProfile)
        .then(filePath => {
          endTrace('end', {
            filePath,
            totalSamples: summary.totalSamples,
          });
        })
        .catch(error => {
          endTrace('file_error', {
            totalSamples: summary.totalSamples,
            error: error instanceof Error ? error.message : String(error),
          });
        });
    } catch (error) {
      endTrace('error', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, PROFILE_DURATION_MS);
}
