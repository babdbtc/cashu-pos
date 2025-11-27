/**
 * Root Layout
 *
 * Configures navigation and global providers for the app.
 */

// IMPORTANT: Crypto polyfill must be imported first, before any crypto-dependent libraries
import '@/lib/crypto-polyfill';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { colors } from '@/theme';
import { ToastProvider } from '@/hooks/useToast';
import { AlertProvider } from '@/hooks/useAlert';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <ToastProvider>
          <AlertProvider>
            <StatusBar style="light" />
            <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background.primary },
              animation: 'fade',
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="amount" />
            <Stack.Screen
              name="payment"
              options={{
                gestureEnabled: false,
              }}
            />
            <Stack.Screen
              name="result"
              options={{
                gestureEnabled: false,
              }}
            />
          </Stack>
          </AlertProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
});
