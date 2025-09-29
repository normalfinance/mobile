const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Modern polyfill approach for Node.js modules in React Native
config.resolver.resolverMainFields = ["react-native", "browser", "main"];
config.resolver.platforms = ["ios", "android", "native", "web"];

// Add polyfill mappings for Node.js modules
config.resolver.extraNodeModules = {
  crypto: require.resolve("crypto-browserify"),
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
