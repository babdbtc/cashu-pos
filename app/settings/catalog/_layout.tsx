/**
 * Catalog Layout
 */

import { Stack } from 'expo-router';

export default function CatalogLayout() {
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
      <Stack.Screen name="products" />
      <Stack.Screen name="categories" />
      <Stack.Screen name="modifiers" />
      <Stack.Screen name="preset/[id]" />
    </Stack>
  );
}
