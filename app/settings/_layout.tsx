/**
 * Settings Layout
 */

import { Stack } from 'expo-router';

export default function SettingsLayout() {
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
          title: 'Settings',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="mint"
        options={{
          title: 'Mint Configuration',
        }}
      />
      <Stack.Screen
        name="currency"
        options={{
          title: 'Currency Settings',
        }}
      />
      <Stack.Screen
        name="settlement"
        options={{
          title: 'Settlement',
        }}
      />
      <Stack.Screen
        name="offline"
        options={{
          title: 'Offline Mode',
        }}
      />
      <Stack.Screen
        name="staff"
        options={{
          title: 'Staff Management',
        }}
      />
      <Stack.Screen
        name="security"
        options={{
          title: 'Security',
        }}
      />
    </Stack>
  );
}
