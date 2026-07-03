import { isEqual } from 'lodash';
import { startStartupEarlySpan, traceStartupEarly } from './startupEarlyTrace';

export type UpdaterOrPartials<Val = unknown> =
  | (Val extends any[] ? Val[number][] : Partial<Val>)
  | ((prev: Val) => Val);
export function resolveValFromUpdater<Val = unknown>(
  prevVal: Val,
  input: UpdaterOrPartials<Val>,
  options?: {
    /**
     * @default true
     */
    strict?: boolean | ((prevVal: Val, newVal: Val) => boolean);
    /**
     * @default true
     */
    destructuringObjInput?: boolean;
  },
) {
  let strictCompare = options?.strict ?? true;
  const { destructuringObjInput = !strictCompare } = options || {};

  const ret = {
    newVal: prevVal,
    changed: false,
    isNonFuncInput: typeof input !== 'function',
    isChangedObjectInput: false,
  };
  if (typeof input === 'function') {
    strictCompare = strictCompare ?? true;
    ret.newVal = input(prevVal);
  } else if (typeof input === 'object') {
    if (strictCompare === undefined) {
      strictCompare = !destructuringObjInput;
    }

    if (strictCompare && destructuringObjInput) {
      strictCompare = false;
      console.warn(
        '[resolveValFromUpdater] Warning: strict mode with destructuringObjInput may cause unnecessary compare.',
      );
    }
    ret.isChangedObjectInput = prevVal !== input;
    if (Array.isArray(prevVal)) {
      ret.newVal = !destructuringObjInput
        ? (input as any as Val)
        : ([...(input as any[])] as Val);
    } else {
      ret.newVal = !destructuringObjInput
        ? (input as any as Val)
        : { ...prevVal, ...input };
    }
  } else {
    strictCompare = strictCompare ?? true;
    // for primitive type
    ret.newVal = input as Val;
  }

  if (typeof strictCompare === 'function') {
    ret.changed = strictCompare(prevVal, ret.newVal);
  } else if (strictCompare) {
    ret.changed = !isEqual(prevVal, ret.newVal);
  } else {
    ret.changed = prevVal !== ret.newVal;
  }

  return ret;
}

export {
  makeAvoidParallelFunc,
  makeAvoidParallelAsyncFunc,
} from './concurrency';

/**
 * @description nothing, just run it, mark it `iife` with this method
 */
export function runIIFEFunc<T extends (...args: any[]) => any>(
  func: T,
  ...inputArags: any[]
) {
  const name = func.name || 'anonymous';
  const endTrace = startStartupEarlySpan('run_iife', {
    name,
  });

  try {
    const result = func(...inputArags);

    endTrace('end');
    return result;
  } catch (error) {
    endTrace('error', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export function runDevIIFEFunc<T extends (...args: any[]) => any>(
  func: T,
  ...inputArags: any[]
) {
  if (__DEV__) {
    return func(...inputArags);
  }
  return undefined;
}

export function traceSlowSyncStartupWork(
  event: string,
  startedAt: number,
  data: Record<string, unknown> = {},
  thresholdMs = 8,
) {
  const elapsedMs = Date.now() - startedAt;

  if (elapsedMs < thresholdMs) {
    return;
  }

  traceStartupEarly(event, {
    ...data,
    elapsedMs,
  });
}
