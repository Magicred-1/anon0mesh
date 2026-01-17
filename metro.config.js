const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Essential for nostr-tools v2
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];
config.resolver.unstable_enablePackageExports = true;

// Add CSV files as assets so they can be imported
// treat svg as a source so we can transform into RN components
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];
// remove svg from assetExts so metro treats it as code
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg');
// keep csv assets
config.resolver.assetExts = [...config.resolver.assetExts, 'csv'];

// use react-native-svg-transformer to load SVGs as components
config.transformer = {
    ...config.transformer,
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

// Map Node modules to React Native compatible ones
config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    buffer: require.resolve('buffer'),
};

module.exports = withNativeWind(config, { input: './global.css' });