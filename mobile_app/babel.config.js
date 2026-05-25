module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // three.js (pulled in by the mesh-map renderer) uses ES2022 class
      // static blocks. babel-preset-expo's default target list doesn't
      // include the transform, so iOS bundling fails with "Static class
      // blocks are not enabled" before the dev-client can fetch anything.
      '@babel/plugin-transform-class-static-block',
    ],
  };
};
