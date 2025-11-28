/**
 * POS Layout
 *
 * Stack navigation for POS screens.
 */

import { Stack } from 'expo-router';

export default function POSLayout() {
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
          title: 'Point of Sale',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="product/[id]"
        options={{
          title: 'Add to Cart',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="checkout"
        options={{
          title: 'Checkout',
          presentation: 'card',
        }}
      />
    </Stack>
  );
}
