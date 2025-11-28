/**
 * Settings Layout
 */

import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: '#0f0f1a',
        },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="business" />
      <Stack.Screen name="sync" />
      <Stack.Screen name="catalog" />
      <Stack.Screen name="mint" />
      <Stack.Screen name="appearance" />
      <Stack.Screen name="currency" />
      <Stack.Screen name="settlement" />
      <Stack.Screen name="offline" />
      <Stack.Screen name="staff" />
      <Stack.Screen name="security" />
    </Stack>
  );
}
