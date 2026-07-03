import { startStartupTraceSpan } from './core/utils/startupTrace';

type SetupBeforeRenderRuntime =
  typeof import('./setup-app-before-render.runtime');
type ReadableAccountStoresRuntime =
  typeof import('./setup-readable-account-stores');
type ReadableAccountBootstrapRuntime =
  typeof import('./setup-readable-account-bootstrap-warmups');

const setupBeforeRenderRuntimeRef = {
  promise: null as Promise<SetupBeforeRenderRuntime> | null,
};
const readableAccountStoresRuntimeRef = {
  promise: null as Promise<ReadableAccountStoresRuntime> | null,
};
const readableAccountBootstrapRuntimeRef = {
  promise: null as Promise<ReadableAccountBootstrapRuntime> | null,
};

async function loadSetupBeforeRenderRuntime(_reason: string) {
  if (setupBeforeRenderRuntimeRef.promise) {
    const endTrace = startStartupTraceSpan('setup_runtime_import_reuse', {
      reason: _reason,
    });
    setupBeforeRenderRuntimeRef.promise.then(
      () => endTrace('end'),
      error =>
        endTrace('error', {
          error: error instanceof Error ? error.message : String(error),
        }),
    );
    return setupBeforeRenderRuntimeRef.promise;
  }

  const endTrace = startStartupTraceSpan('setup_runtime_import', {
    reason: _reason,
  });
  const runtimePromise = import('./setup-app-before-render.runtime').catch(
    error => {
      setupBeforeRenderRuntimeRef.promise = null;
      endTrace('error', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    },
  );

  setupBeforeRenderRuntimeRef.promise = runtimePromise;
  return runtimePromise.then(runtime => {
    endTrace('end');
    return runtime;
  });
}

async function loadReadableAccountStoresRuntime(_reason: string) {
  if (readableAccountStoresRuntimeRef.promise) {
    const endTrace = startStartupTraceSpan('readable_stores_import_reuse', {
      reason: _reason,
    });
    readableAccountStoresRuntimeRef.promise.then(
      () => endTrace('end'),
      error =>
        endTrace('error', {
          error: error instanceof Error ? error.message : String(error),
        }),
    );
    return readableAccountStoresRuntimeRef.promise;
  }

  const endTrace = startStartupTraceSpan('readable_stores_import', {
    reason: _reason,
  });
  const runtimePromise = import('./setup-readable-account-stores').catch(
    error => {
      readableAccountStoresRuntimeRef.promise = null;
      endTrace('error', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    },
  );

  readableAccountStoresRuntimeRef.promise = runtimePromise;
  return runtimePromise.then(runtime => {
    endTrace('end');
    return runtime;
  });
}

async function loadReadableAccountBootstrapRuntime(_reason: string) {
  if (readableAccountBootstrapRuntimeRef.promise) {
    const endTrace = startStartupTraceSpan(
      'readable_account_bootstrap_import_reuse',
      {
        reason: _reason,
      },
    );
    readableAccountBootstrapRuntimeRef.promise.then(
      () => endTrace('end'),
      error =>
        endTrace('error', {
          error: error instanceof Error ? error.message : String(error),
        }),
    );
    return readableAccountBootstrapRuntimeRef.promise;
  }

  const endTrace = startStartupTraceSpan('readable_account_bootstrap_import', {
    reason: _reason,
  });
  const runtimePromise = import(
    './setup-readable-account-bootstrap-warmups'
  ).catch(error => {
    readableAccountBootstrapRuntimeRef.promise = null;
    endTrace('error', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  });

  readableAccountBootstrapRuntimeRef.promise = runtimePromise;
  return runtimePromise.then(runtime => {
    endTrace('end');
    return runtime;
  });
}

export async function startSetupAppBeforeRenderDeferred(
  reason = 'app_could_render',
) {
  await loadSetupBeforeRenderRuntime(reason);
}

export async function startInitPersistedStores() {
  return (
    await loadReadableAccountBootstrapRuntime('start_init_persisted_stores')
  ).startInitPersistedStores();
}

export async function startUnlockScreenBootstrapWarmups() {
  return (
    await loadReadableAccountBootstrapRuntime('unlock_screen_bootstrap_warmups')
  ).startUnlockScreenBootstrapWarmups();
}

export async function startReadableAccountBootstrapWarmups() {
  return (
    await loadReadableAccountBootstrapRuntime(
      'readable_account_bootstrap_warmups',
    )
  ).startReadableAccountBootstrapWarmups();
}

export async function startInitReadableAccountStores() {
  return (
    await loadReadableAccountStoresRuntime('start_init_readable_account_stores')
  ).startInitReadableAccountStores();
}
