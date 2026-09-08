const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Disable package exports so Metro prefers CommonJS-compatible
// package entry points instead of ESM files containing import.meta.
config.resolver.unstable_enablePackageExports = false;

// Prefer CommonJS-compatible package entry points on web.
config.resolver.resolverMainFields = [
  "react-native",
  "browser",
  "main",
];

// Allow Metro to recognize GLB and GLTF model files as assets.
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  "glb",
  "gltf",
];

module.exports = config;