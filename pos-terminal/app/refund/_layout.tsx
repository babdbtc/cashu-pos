/**
 * Refund Layout
 */

import { Stack } from 'expo-router';

export default function RefundLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1a1a2e',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '600',
        },
        contentStyle: {
          backgroundColor: '#0f0f1a',
        },
      }}
    >
      <Stack.Screen
        name="search"
        options={{
          title: 'Find Transaction',
        }}
      />
      <Stack.Screen
        name="[txId]"
        options={{
          title: 'Process Refund',
        }}
      />
    </Stack>
  );
}
