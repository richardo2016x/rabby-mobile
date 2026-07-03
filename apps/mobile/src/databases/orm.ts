import { DataSource, DataSourceOptions } from 'typeorm/browser';

import { SQLite } from '@/core/databases/exports';
import { getMigrations } from './migrations';
import { APP_DB_PREFIX, getRabbyAppDbName } from './constant';
import {
  exp_dropAndResyncDataSource,
  initializeAppDataSource,
} from './imports';
import { abortAllSyncTasks } from './sync/_task';
import {
  RabbyOrmDevConsoleLogger,
  RabbyOrmDeployedConsoleLogger,
  RnSqlExecutionTimes,
} from './logger';
import { ALL_ORM_ENTITIES } from './entities';
import { startStartupTraceSpan } from '@/core/utils/startupTrace';

const dbOptions: DataSourceOptions = {
  type: 'react-native',
  database: getRabbyAppDbName(),
  /**
   * @notice set to 'default' to use the default database path on iOS
   * @see https://github.com/boltcode-js/react-native-sqlite-storage?tab=readme-ov-file#opening-a-database
   */
  location: 'default',
  // "query" | "schema" | "error" | "warn" | "info" | "log" | "migration"
  logging: __DEV__
    ? ['error', 'query', 'schema', 'migration']
    : ['error', 'migration'],
  // logger: isNonPublicProductionEnv ? 'file' : 'advanced-console',
  // logger: __DEV__ ? 'advanced-console' : 'simple-console',
  logger: __DEV__
    ? new RabbyOrmDevConsoleLogger()
    : new RabbyOrmDeployedConsoleLogger(),
  // don't synchronize on initial load, we will handle it manually
  synchronize: false,
  driver: SQLite,
  entityPrefix: APP_DB_PREFIX,
  entities: Object.values(ALL_ORM_ENTITIES),
  maxQueryExecutionTime: 10 * 1e3,
  rnMaxQueryExecutionTime: RnSqlExecutionTimes.config,
  // only enable file logger in non-public production env, avoid leaking user's sensitive info
  // migrationsRun: true,
  migrations: getMigrations(),
};

let initializeAppDataSourcePromise: Promise<DataSource> | null = null;

export function startInitializeAppDataSource() {
  if (!initializeAppDataSourcePromise) {
    const endTrace = startStartupTraceSpan('database_default_init');
    initializeAppDataSourcePromise = initializeAppDataSource(dbOptions)
      .catch(err => {
        endTrace('error', {
          error: err instanceof Error ? err.message : String(err),
        });
        initializeAppDataSourcePromise = null;
        console.log('initializeAppDataSource error', err);
        throw err;
      })
      .then(appDataSource => {
        endTrace('end');
        return appDataSource;
      });
  }

  return initializeAppDataSourcePromise;
}

export async function exp_reConnectAppDataSource() {
  abortAllSyncTasks();

  return exp_dropAndResyncDataSource(dbOptions);
}
