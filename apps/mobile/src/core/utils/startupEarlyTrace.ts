const globalObject = globalThis as typeof globalThis & {
  __RABBY_STARTUP_EARLY_TRACE__?: {
    startedAt: number;
  };
};

const state =
  globalObject.__RABBY_STARTUP_EARLY_TRACE__ ||
  (globalObject.__RABBY_STARTUP_EARLY_TRACE__ = {
    startedAt: Date.now(),
  });

function isEnabled() {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return false;
  }

  const runtimeEnv =
    process.env.RABBY_MOBILE_BUILD_ENV === 'production'
      ? 'production'
      : 'regression';
  const buildChannel = process.env.buildchannel || 'selfhost-reg';

  return runtimeEnv !== 'production' || buildChannel !== 'appstore';
}

export function traceStartupEarly(
  event: string,
  data: Record<string, unknown> = {},
) {
  if (!isEnabled()) {
    return;
  }

  const now = Date.now();
  const payload = {
    t: now - state.startedAt,
    ...data,
  };

  console.info('[RabbyStartupEarlyTrace]', event, payload);
}

export function startStartupEarlySpan(
  event: string,
  data: Record<string, unknown> = {},
) {
  const startedAt = Date.now();
  traceStartupEarly(`${event}_start`, data);

  return (status = 'end', extra: Record<string, unknown> = {}) => {
    traceStartupEarly(`${event}_${status}`, {
      ...data,
      ...extra,
      elapsedMs: Date.now() - startedAt,
    });
  };
}
