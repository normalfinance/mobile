const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Modern polyfill approach for Node.js modules in React Native
config.resolver.resolverMainFields = ["react-native", "browser", "main"];
config.resolver.platforms = ["ios", "android", "native", "web"];

// Add polyfill mappings for Node.js modules
config.resolver.extraNodeModules = {
  crypto: require.resolve("crypto-browserify"),
  // @turnkey/api-key-stamper's own "react-native" field maps `crypto` →
  // `react-native-crypto` (deleted here 2026-09-15); Metro honours a package's
  // field map before extraNodeModules, so its never-executed nodecrypto.mjs
  // branch only resolves if that name exists. Release bundles (expo export /
  // EAS) bundle every dynamic import eagerly and failed on it (2026-10-05);
  // dev bundles were lazy and never hit it. Point the name at the same shim.
  "react-native-crypto": require.resolve("crypto-browserify"),
  stream: require.resolve("stream-browserify"),
  buffer: require.resolve("buffer"),
  process: require.resolve("process/browser"),
  vm: require.resolve("vm-browserify"),
  events: require.resolve("events"),
  util: require.resolve("util"),
  url: require.resolve("url"),
  querystring: require.resolve("querystring-es3"),
  http: require.resolve("@tradle/react-native-http"),
  https: require.resolve("https-browserify"),
  os: require.resolve("os-browserify"),
  path: require.resolve("path-browserify"),
  // Keep existing mappings from rn-nodeify
  _stream_transform: require.resolve("readable-stream/transform"),
  _stream_readable: require.resolve("readable-stream/readable"),
  _stream_writable: require.resolve("readable-stream/writable"),
  _stream_duplex: require.resolve("readable-stream/duplex"),
  _stream_passthrough: require.resolve("readable-stream/passthrough")
};

module.exports = config;
