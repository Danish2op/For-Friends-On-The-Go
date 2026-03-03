# Tamagui UI Primitives Migration

> **Date**: 2026-03-04  
> **Scope**: Replaced React Native `View`, `Text`, and `ScrollView` with Tamagui equivalents across the entire component tree.

## What Changed

### New Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `tamagui` | `^2.0.0-rc.22` | Core UI framework — optimized `View`, `Text`, `ScrollView`, theming engine |
| `@tamagui/config` | `^2.0.0-rc.22` | Default configuration (tokens, themes) extended with our design system |
| `@tamagui/animations-react-native` | `^2.0.0-rc.22` | Native-thread animations for Tamagui components |
| `@tamagui/babel-plugin` | `^2.0.0-rc.22` | Compile-time style extraction — flattens styled components to direct native views at build time |

### Architecture

```
_layout.tsx
└─ TamaguiProvider (config=tamaguiConfig, theme="light")
   └─ Theme name="light"
      └─ ... entire app tree
```

**Adapter layer** — `src/components/ui/tamagui-primitives.tsx`:

```tsx
// Thin wrappers that accept RN prop types but render Tamagui internals.
// This lets every file migrate with a SINGLE import-line change.
export function View(props: ViewProps) { ... }
export function Text(props: TextProps) { ... }
export function ScrollView(props: ScrollViewProps) { ... }
```

### Files Migrated (24 files)

| Area | Files |
|------|-------|
| **Auth** | `sign-in.tsx`, `sign-up.tsx` |
| **Lobby** | `[id].tsx`, `navigation.tsx`, `voting.tsx`, `winner.tsx` |
| **Tabs** | `_layout.tsx`, `index.tsx`, `history.tsx`, `history-detail.tsx` |
| **Map** | `LeafletMap.tsx`, `OlaMap.tsx`, `OlaMap.web.tsx`, `SafeMap.tsx` |
| **Avatar** | `UserAvatar.tsx`, `avatar-ui.tsx` |
| **Lobby Components** | `ExitConfirmationCard.tsx`, `lobby-invite-notification-stack.tsx` |
| **Profile** | `ProfileDrawer.tsx` |
| **Friends** | `friend-request-center.tsx` |
| **UI** | `Toast.tsx`, `tamagui-primitives.tsx` (new) |
| **Voting** | `AddPlaceSheet.tsx` |
| **Core** | `ErrorBoundary.tsx` |

**Pattern applied in every file** — only the import line changes:

```diff
-import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
+import { StyleSheet, TouchableOpacity } from "react-native";
+import { Text, View } from "@/src/components/ui/tamagui-primitives";
```

All `StyleSheet`, `TouchableOpacity`, `TextInput`, `Modal`, `FlatList`, `ActivityIndicator`, etc. remain as React Native imports — only the three primitives (`View`, `Text`, `ScrollView`) moved to Tamagui.

### Tamagui Config (`tamagui.config.ts`)

The config maps the app's existing `COLORS`, `SKEUO`, and `TYPE` design tokens into Tamagui's token system:

- **Color tokens**: All `COLORS.*` values registered (background, card, surface, primary, danger, etc.)
- **Space tokens**: Mapped from `SKEUO.spacing.*` (xs → xxl)
- **Radius tokens**: Mapped from `SKEUO.radius.*` (xs → pill)
- **Fonts**: `body`, `heading`, `mono` — all using System font with `TYPE.*` sizes/weights
- **Themes**: `light` and `dark` themes defined with full semantic color mappings
- **Animations**: `quick` (170ms), `medium` (250ms), `slow` (360ms), `bouncy` (spring)
- **Style compat**: `styleCompat: "react-native"` ensures RN `StyleSheet` objects work seamlessly

## Why Tamagui Over Plain React Native

### 1. Compile-Time Optimization
Tamagui's Babel plugin extracts styles at **build time**, flattening styled components into direct native `<View>` / `<Text>` calls with pre-computed style objects. This eliminates the runtime `StyleSheet.create()` overhead and object spreading that React Native does on every render.

### 2. Unified Theming Without Runtime Cost
React Native has no built-in theming. The app currently passes `COLORS.*` constants everywhere via imports. With Tamagui, the `TamaguiProvider` makes theme tokens available to every component via compiled context — when a dark mode toggle is added, every component will automatically re-theme without code changes.

### 3. Web Compatibility
Tamagui compiles to optimized CSS on web (via `className` instead of inline styles). Since this app already has `OlaMap.web.tsx` and uses `react-native-web`, Tamagui makes the web output significantly faster and more DOM-efficient.

### 4. Progressive Adoption via Adapter Pattern
The `tamagui-primitives.tsx` adapter accepts standard `ViewProps` / `TextProps` / `ScrollViewProps`, so:
- **Zero breaking changes** — existing `StyleSheet.create()` styles work unchanged
- **Gradual migration** — files can incrementally adopt Tamagui-native props (`$theme`, `animation`, `pressStyle`, etc.)
- **Single-line diff** — each file needed only an import swap, not a rewrite

### 5. Animation Primitives
Tamagui provides declarative `enterStyle`, `exitStyle`, `pressStyle`, and `hoverStyle` props directly on components, powered by native-thread animations via `@tamagui/animations-react-native`. This replaces the need for `react-native-reanimated` wrappers for simple transitions.
