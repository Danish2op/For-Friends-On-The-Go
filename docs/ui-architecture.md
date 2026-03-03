# UI Architecture (Tamagui)

## Overview

This app now uses Tamagui as the primary UI primitive system while preserving the existing visual identity and spacing rhythm from the legacy React Native StyleSheet design.

Primary goals:
- Keep UI parity with the existing product look and behavior.
- Use Tamagui primitives/provider for better static extraction and cross-platform consistency.
- Preserve platform-critical native behavior for maps, modals, and low-level integrations.

## Core Setup

- Tamagui config: [`/Users/danishsharma/Projects/ForFriendsOnTheGo/tamagui.config.ts`](/Users/danishsharma/Projects/ForFriendsOnTheGo/tamagui.config.ts)
- Babel plugin: [`/Users/danishsharma/Projects/ForFriendsOnTheGo/babel.config.js`](/Users/danishsharma/Projects/ForFriendsOnTheGo/babel.config.js)
- Provider wiring: [`/Users/danishsharma/Projects/ForFriendsOnTheGo/src/app/_layout.tsx`](/Users/danishsharma/Projects/ForFriendsOnTheGo/src/app/_layout.tsx)

`TamaguiProvider` is mounted at the app root, with `defaultTheme="light"` and `Theme name="light"` wrapping the router stack.

## Token System

The Tamagui tokens are mapped directly from [`/Users/danishsharma/Projects/ForFriendsOnTheGo/src/constants/theme.ts`](/Users/danishsharma/Projects/ForFriendsOnTheGo/src/constants/theme.ts):

- `color`: `background`, `card`, `surface`, `primary`, `secondary`, `accent`, `danger`, `success`, text/border/shadow tokens.
- `space`: based on `SKEUO.spacing` plus compact values (`0`, `1`).
- `radius`: based on `SKEUO.radius` (`xs` through `xl`, plus `full` pill radius).
- `size`: based on `TYPE.size` (`caption`, `body`, `h2`, `h1`, `title`, `hero`).
- `zIndex`: standardized overlay depth scale.

Fonts:
- `body`, `heading`, `mono` are configured in `tamagui.config.ts`.
- Existing typography sizing/weight remains aligned to `TYPE`.

## Component Usage Rules

Use Tamagui primitives by default:
- `View`, `Text`, `ScrollView`, `YStack`, `XStack`, `Input` from `tamagui`.

Use React Native primitives only when required:
- `Modal`, `FlatList`, `ActivityIndicator`, `KeyboardAvoidingView`, `WebView`, map wrappers, and gesture/animated platform internals.

## Styling Rules

- Keep design values tied to the established token/palette system.
- Prefer static styles over dynamic runtime style construction.
- Avoid mixing ad hoc inline style objects for new UI.
- Keep motion/animation consistent with configured Tamagui animation presets (`quick`, `medium`, `slow`, `bouncy`).

## Migration Conventions

When migrating or adding screens:
1. Use Tamagui primitives first.
2. Reuse existing color/spacing/shape values from `src/constants/theme.ts` and Tamagui tokens.
3. Do not replace platform-critical map/navigation internals unless behavior is fully equivalent.
4. Preserve current UX parity (padding, hierarchy, text weights, and touch targets).
