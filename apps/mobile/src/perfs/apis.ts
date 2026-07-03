import { register } from 'react-native-bundle-splitter';
import { startStartupTraceSpan } from '@/core/utils/startupTrace';

export { register as registerLazyComponent };

type RegisterSharedConfig = {
  cached?: boolean;
  group?: string;
  name?: string;
  placeholder?: React.SuspenseProps['fallback'];
  static?: object;
};

type RegisterDefaultExportConfig<
  T extends React.ComponentType<any>,
  M extends { default: T },
> = RegisterSharedConfig & {
  loader: () => Promise<M>;
};

type RegisteredAppScreen<T extends React.ComponentType<any>> =
  React.ForwardRefExoticComponent<
    React.PropsWithoutRef<React.ComponentProps<T>> &
      React.RefAttributes<unknown>
  >;

function inferLoaderName(config: RegisterSharedConfig & { loader: () => any }) {
  if (config.name || config.group) {
    return config.name || config.group;
  }

  const loaderSource = String(config.loader);
  const importPath = loaderSource.match(/import\(['"]([^'"]+)['"]\)/)?.[1];

  return importPath || 'anonymous';
}

export function registerAppScreen<
  T extends React.ComponentType<any>,
  M extends { default: T },
>(config: RegisterDefaultExportConfig<T, M>): RegisteredAppScreen<T>;
export function registerAppScreen<T extends React.ComponentType<any>>(
  config: RegisterDefaultExportConfig<T, { default: T }>,
): RegisteredAppScreen<T>;
export function registerAppScreen<T extends React.ComponentType<any>>(
  config: RegisterDefaultExportConfig<T, { default: T }>,
) {
  const loaderName = inferLoaderName(config);
  const wrappedConfig = {
    ...config,
    loader: () => {
      const endTrace = startStartupTraceSpan('loadable_component_import', {
        name: loaderName,
      });

      return config.loader().then(
        module => {
          endTrace('end');
          return module;
        },
        error => {
          endTrace('error', {
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        },
      );
    },
  };

  return register<React.ComponentProps<T>>(
    wrappedConfig as Parameters<typeof register>[0],
  );
}
