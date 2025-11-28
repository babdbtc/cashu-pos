/**
 * Admin Layout
 */

import { Stack } from 'expo-router';

export default function AdminLayout() {
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
      <Stack.Screen name="deposit" />
      <Stack.Screen name="withdraw" />
      <Stack.Screen name="export" />
    </Stack>
  );
}
