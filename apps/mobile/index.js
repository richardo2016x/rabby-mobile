/**
 * @format
 */
require('react-native-gesture-handler');
const {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} = require('react-native-reanimated');
const { enableScreens } = require('react-native-screens');
// enableFreeze();
enableScreens(true);

const { initSentry } = require('./src/core/sentry');
// Init Sentry before polyfills as it patches global Promise
// @see https://docs.sentry.io/platforms/react-native/integrations/unhandled-rejections/#auto-patching-default-behavior
if (!__DEV__) {
  initSentry();
}

const {
  startStartupHermesProfiler,
} = require('./src/core/utils/startupHermesProfiler');
startStartupHermesProfiler();
require('./src/utils/logging/install');
require('./global');
require('./src/setup-app');
require('./src/utils/walletUnlock');
const {
  ENABLE_REACTOTRON,
} = require('./src/core/utils/reactotron-plugins/featureFlag');

if (process.env.WITH_ROZENITE === 'true') {
  const {
    withOnBootNetworkActivityRecording,
  } = require('@rozenite/network-activity-plugin');
  withOnBootNetworkActivityRecording();
}

if (__DEV__ && ENABLE_REACTOTRON) {
  import('./ReactotronConfig');
}

const { AppRegistry } = require('react-native');
const App = require('./src/App').default;
require('@/utils/i18n');
const { name: appName } = require('./app.json');

require('./src/setup-app-before-render');

// must be called synchoronously immediately
AppRegistry.registerComponent(appName, () => App);

// This is the default configuration
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false, // Reanimated runs in strict mode by default
});
