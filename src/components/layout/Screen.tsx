/**
 * Screen Component
 *
 * Base screen wrapper with SafeAreaView and consistent styling.
 */

import { View, StyleSheet, ViewStyle, ScrollView } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { colors } from '../../theme';

interface ScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  scrollable?: boolean;
  edges?: Edge[];
}

export function Screen({
  children,
  style,
  scrollable = false,
  edges = ['top', 'bottom'],
}: ScreenProps) {
  const content = scrollable ? (
    <ScrollView style={styles.scrollView} contentContainerStyle={style}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, style]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.container} edges={edges}>
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
});
