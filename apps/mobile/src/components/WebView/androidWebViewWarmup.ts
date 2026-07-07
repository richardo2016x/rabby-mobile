import { useEffect } from 'react';
import { Platform } from 'react-native';

const isAndroid = Platform.OS === 'android';

type WarmupState = {
  satisfied: boolean;
  reason: string | null;
};

const state: WarmupState = {
  satisfied: !isAndroid,
  reason: !isAndroid ? 'non-android' : null,
};

const listeners = new Set<(state: WarmupState) => void>();

function emit() {
  const snapshot = { ...state };
  listeners.forEach(listener => listener(snapshot));
}

export function isAndroidWebViewWarmupSatisfied() {
  return state.satisfied;
}

export function markAndroidWebViewWarmupSatisfied(reason: string) {
  if (!isAndroid || state.satisfied) {
    return;
  }

  state.satisfied = true;
  state.reason = reason;
  emit();
}

export function subscribeAndroidWebViewWarmupSatisfied(
  listener: (state: WarmupState) => void,
) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useMarkAndroidWebViewDemand(enabled: boolean, reason: string) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    markAndroidWebViewWarmupSatisfied(reason);
  }, [enabled, reason]);
}

export function isNewArchitectureEnabled() {
  return Boolean(
    (globalThis as any).nativeFabricUIManager ||
      (globalThis as any).RN$Bridgeless,
  );
}

export function runAfterJsIdle(
  callback: () => void,
  options: {
    timeoutMs?: number;
  } = {},
) {
  let cancelled = false;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const requestIdleCallback = (globalThis as any).requestIdleCallback;
  const cancelIdleCallback = (globalThis as any).cancelIdleCallback;

  if (typeof requestIdleCallback === 'function') {
    const idleId = requestIdleCallback(
      () => {
        if (!cancelled) {
          callback();
        }
      },
      { timeout: timeoutMs },
    );

    return () => {
      cancelled = true;
      if (typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(idleId);
      }
    };
  }

  const timer = setTimeout(() => {
    if (!cancelled) {
      callback();
    }
  }, 0);

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
