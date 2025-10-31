module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Disable reanimated plugin from babel-preset-expo
          reanimated: false,
        },
      ],
    ],
    plugins: [],
  };
};
