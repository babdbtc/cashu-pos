/**
 * History Layout
 */

import { Stack } from 'expo-router';

export default function HistoryLayout() {
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
        name="index"
        options={{
          title: 'Transaction History',
          headerShown: false,
        }}
      />
    </Stack>
  );
}
