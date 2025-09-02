const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add resolver configuration for better iOS compatibility
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Add transformer configuration
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    keep_fnames: true,
    mangle: {
      keep_fnames: true,
    },
  },
};

// Add resolver configuration
config.resolver = {
  ...config.resolver,
  alias: {
    ...config.resolver.alias,
  },
};

module.exports = config;
