// getSentryExpoConfig wraps Expo's default Metro config to enable source-map
// upload for crash symbolication. It is a drop-in for getDefaultConfig; if the
// Sentry integration is ever removed, swap this line back to getDefaultConfig.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const path = require('node:path');

const config = getSentryExpoConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = [
  'react-native',
  'browser',
  'require',
  'default',
];

// Force native entries for @solana-mobile packages — Metro picks browser
// entry otherwise, which throws "must be used in secure context (https)".
const NATIVE_OVERRIDES = {
  '@solana-mobile/mobile-wallet-adapter-protocol':
    path.resolve(__dirname, 'node_modules/@solana-mobile/mobile-wallet-adapter-protocol/lib/cjs/index.native.js'),
  '@solana-mobile/mobile-wallet-adapter-protocol-web3js':
    path.resolve(__dirname, 'node_modules/@solana-mobile/mobile-wallet-adapter-protocol-web3js/lib/cjs/index.native.js'),
};

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'android' && NATIVE_OVERRIDES[moduleName]) {
    return { filePath: NATIVE_OVERRIDES[moduleName], type: 'sourceFile' };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
