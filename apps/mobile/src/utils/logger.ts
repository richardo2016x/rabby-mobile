import { Platform } from 'react-native';
import { AppLogger, RollingZipLogWriter } from '@rabby-wallet/rabby-logger';
import debugLogService from '@/core/services/debugLogService';
import { APP_DOCUMENT_LIKE_PATH } from '@/core/utils/appFS';
import { APP_RUNTIME_ENV } from '@/constant/env';
import { isNonPublicProductionEnv } from '@/constant';
import { rnfsLoggingAdapter } from './logging/rnfsAdapter';
import {
  getEffectiveConsoleCaptureEnabled,
  getEffectiveFileLoggingEnabled,
} from './logging/settings';

export const APP_LOG_ROOT_PATH = `${APP_DOCUMENT_LIKE_PATH}/applogs`;
const APP_LOG_ARCHIVE_SESSION_ID = `${Date.now().toString(36)}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;
const APP_LOG_ARCHIVE_PREFIX = `rabby-mobile-logs-${APP_LOG_ARCHIVE_SESSION_ID}`;

const logWriter = new RollingZipLogWriter({
  fs: rnfsLoggingAdapter,
  rootDir: APP_LOG_ROOT_PATH,
  // Avoid restoring and synchronously unzipping a previous session's archive on
  // the first startup log write. Old archives remain visible in the log viewer.
  archivePrefix: APP_LOG_ARCHIVE_PREFIX,
});

export const logger = new AppLogger({
  runtimeEnv: APP_RUNTIME_ENV,
  platform: Platform.OS,
  writer: logWriter,
  shouldWriteToFile: getEffectiveFileLoggingEnabled,
  shouldCaptureConsole: getEffectiveConsoleCaptureEnabled,
  captureInMemory: isNonPublicProductionEnv || APP_RUNTIME_ENV !== 'production',
  onInMemoryLog(entry) {
    debugLogService.addLog(entry.message, entry.level, entry.data);
  },
});

export const devLog = (key: string, ...info: any[]) => {
  if (!__DEV__) {
    return;
  }

  if (info.length === 0) {
    logger.debug(key);
    return;
  }

  logger.debug(`[${key}]`, ...info);
};
