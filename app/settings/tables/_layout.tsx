/**
 * Table Management Settings Layout
 */

import { Stack } from 'expo-router';

export default function TablesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'card',
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="areas" />
    </Stack>
  );
}
