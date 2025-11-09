const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Essential for nostr-tools v2
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];
config.resolver.unstable_enablePackageExports = true;

// Add CSV files as assets so they can be imported
config.resolver.assetExts = [...config.resolver.assetExts, 'csv'];

module.exports = withNativeWind(config, { input: './global.css' });