import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(auth)" />      {/* No bottom tabs */}
        <Stack.Screen name="(tabs)" />       {/* Has bottom tabs */}
      </Stack>
    </>
  );
}