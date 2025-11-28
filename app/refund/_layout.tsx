/**
 * Refund Layout
 */

import { Stack } from 'expo-router';

export default function RefundLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: '#0f0f1a',
        },
      }}
    >
      <Stack.Screen name="search" />
      <Stack.Screen name="[txId]" />
    </Stack>
  );
}
