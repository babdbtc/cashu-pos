/**
 * Waiter Layout
 */

import { Stack } from 'expo-router';

export default function WaiterLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'card',
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
