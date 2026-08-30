const { withAppDelegate } = require('@expo/config-plugins');

module.exports = function withBindReactNativeFactory(config) {
  return withAppDelegate(config, (config) => {
    if (config.modResults.language !== 'swift') {
      throw new Error(
        'with-bind-react-native-factory expects a Swift AppDelegate.'
      );
    }

    let contents = config.modResults.contents;

    // Already correct, so do nothing.
    if (contents.includes('bindReactNativeFactory(factory)')) {
      return config;
    }

    const target = `    reactNativeDelegate = delegate
    reactNativeFactory = factory
`;

    const replacement = `    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)
`;

    if (!contents.includes(target)) {
      throw new Error(
        'Could not find Expo React Native factory setup in AppDelegate.swift.'
      );
    }

    config.modResults.contents = contents.replace(
      target,
      replacement
    );

    return config;
  });
};
