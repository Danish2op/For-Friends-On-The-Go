module.exports = function (api) {
    api.cache(true);

    return {
        presets: ["babel-preset-expo"],
        plugins: [
            "expo-router/babel",
            [
                "@tamagui/babel-plugin",
                {
                    components: ["tamagui"],
                    config: "./tamagui.config.ts",
                    disableExtraction: process.env.NODE_ENV === "development",
                    logTimings: true,
                    experimentalFlattenThemesOnNative: true,
                },
            ],
            "react-native-reanimated/plugin",
        ],
    };
};
