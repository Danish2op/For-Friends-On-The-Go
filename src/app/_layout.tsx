import * as Notifications from "expo-notifications";
import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { TamaguiProvider, Theme } from "tamagui";
import tamaguiConfig from "../../tamagui.config";
import { COLORS } from "../../constants/theme";
import { AuthProvider, useAppAuth } from "../context/AuthContext";
import { ToastProvider } from "../context/ToastContext";

// Configure how notifications appear when app is in FOREGROUND
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function NotificationInviteBridge() {
  const router = useRouter();

  useEffect(() => {
    const navigateFromResponse = (
      response: Notifications.NotificationResponse | null | undefined
    ) => {
      const data = response?.notification?.request?.content?.data as
        | { type?: unknown; lobbyId?: unknown }
        | undefined;

      if (
        data?.type === "lobby_invite" &&
        typeof data?.lobbyId === "string" &&
        data.lobbyId
      ) {
        // Route to the lobby waiting room
        router.push(`/(lobby)/${data.lobbyId}`);
      }
    };

    // Killed-state recovery: check if the app was opened by tapping a notification
    Notifications.getLastNotificationResponseAsync()
      .then(navigateFromResponse)
      .catch(() => undefined);

    // Background/foreground: user tapped a notification while app was running
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromResponse(response);
    });

    return () => subscription.remove();
  }, [router]);

  return null;
}

function AuthGate() {
  const { loading: authLoading, signedIn, profileState } = useAppAuth();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();
  const router = useRouter();
  const navigationMounted = Boolean(rootNavigationState?.key);

  useEffect(() => {
    if (authLoading || !navigationMounted) {
      return;
    }

    const inAuthGroup = (segments[0] as string | undefined) === "(auth)";
    const activeAuthScreen = segments[1] as string | undefined;

    if (!signedIn && !inAuthGroup) {
      router.replace("/sign-in");
      return;
    }

    const requiresProfileSetup = signedIn && profileState === "missing";

    if (requiresProfileSetup && !(inAuthGroup && activeAuthScreen === "sign-up")) {
      router.replace("/sign-up?mode=complete-profile");
      return;
    }

    if (signedIn && inAuthGroup && !requiresProfileSetup) {
      router.replace("/");
    }
  }, [authLoading, navigationMounted, profileState, router, segments, signedIn]);

  if (authLoading || !navigationMounted) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: COLORS.background,
        }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="(auth)" options={{ animation: "none" }} />
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(lobby)/[id]" />
      <Stack.Screen name="(lobby)/navigation" />
      <Stack.Screen name="(lobby)/voting" />
      <Stack.Screen name="(lobby)/winner" />
      <Stack.Screen name="history" />
      <Stack.Screen name="history-detail" options={{ presentation: "modal", headerShown: true }} />
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
    </Stack>
  );
}

export default function Layout() {
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <Theme name="light">
        <AuthProvider>
          <ToastProvider>
            <StatusBar style="dark" />
            <NotificationInviteBridge />
            <AuthGate />
          </ToastProvider>
        </AuthProvider>
      </Theme>
    </TamaguiProvider>
  );
}
