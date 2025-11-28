import { Stack } from 'expo-router';

export default function WalletLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#000',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="setup"
        options={{
          title: 'Wallet Setup',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="restore"
        options={{
          title: 'Restore Wallet',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="backup"
        options={{
          title: 'Backup Wallet',
          headerBackTitle: 'Back',
        }}
      />
    </Stack>
  );
}
