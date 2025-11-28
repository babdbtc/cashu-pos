/**
 * Onboarding Screen
 *
 * Multi-step onboarding flow for first-time users
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '@/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useConfigStore } from '@/store/config.store';
import { CURRENCIES } from '@/constants/currencies';
import type { BusinessType, TerminalType } from '@/types/config';

type OnboardingStep = 'welcome' | 'terminalType' | 'businessType' | 'terminal' | 'mints' | 'currency';

export default function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isPhone = width < 768;
  const themeColors = useThemeColors();

  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [terminalType, setTerminalType] = useState<TerminalType>('main');
  const [businessType, setBusinessType] = useState<BusinessType>('general');
  const [terminalName, setTerminalName] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [selectedMints, setSelectedMints] = useState<Array<{ url: string; name: string }>>([]);
  const [customMintUrl, setCustomMintUrl] = useState('');
  const [customMintName, setCustomMintName] = useState('');
  const [showCustomMintForm, setShowCustomMintForm] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [selectedPriceMode, setSelectedPriceMode] = useState<'fiat_sats' | 'sats_fiat' | 'sats_only'>('sats_fiat');
  const [selectedSatsFormat, setSelectedSatsFormat] = useState<'sats' | 'btc'>('btc');

  const completeOnboarding = useConfigStore((state) => state.completeOnboarding);
  const setTerminalInfo = useConfigStore((state) => state.setTerminalInfo);
  const setBusinessTypeConfig = useConfigStore((state) => state.setBusinessType);
  const addTrustedMint = useConfigStore((state) => state.addTrustedMint);
  const setDisplayCurrency = useConfigStore((state) => state.setDisplayCurrency);
  const setPriceDisplayMode = useConfigStore((state) => state.setPriceDisplayMode);
  const setSatsDisplayFormat = useConfigStore((state) => state.setSatsDisplayFormat);

  const handleNext = () => {
    if (currentStep === 'welcome') {
      setCurrentStep('terminalType');
    } else if (currentStep === 'terminalType') {
      setCurrentStep('businessType');
    } else if (currentStep === 'businessType') {
      setCurrentStep('terminal');
    } else if (currentStep === 'terminal') {
      setCurrentStep('mints');
    } else if (currentStep === 'mints') {
      setCurrentStep('currency');
    }
  };

  const handleSkip = () => {
    if (currentStep === 'mints') {
      setCurrentStep('currency');
    } else if (currentStep === 'currency') {
      handleFinish();
    }
  };

  const handleSkipAll = () => {
    // Set minimal defaults
    setTerminalInfo({
      terminalId: Date.now().toString(),
      terminalName: 'Terminal 1',
      terminalType: 'main',
      merchantId: Date.now().toString(),
      merchantName: 'My Store',
    });
    setBusinessTypeConfig('general');
    completeOnboarding();
    router.replace('/');
  };

  const handleFinish = () => {
    // Save all settings
    if (terminalName && merchantName) {
      setTerminalInfo({
        terminalId: Date.now().toString(),
        terminalName,
        terminalType,
        merchantId: Date.now().toString(),
        merchantName,
      });
    }

    setBusinessTypeConfig(businessType);

    selectedMints.forEach((mint) => {
      addTrustedMint(mint.url, mint.name);
    });

    setDisplayCurrency(selectedCurrency);
    setPriceDisplayMode(selectedPriceMode);
    setSatsDisplayFormat(selectedSatsFormat);

    // Mark onboarding as complete
    completeOnboarding();

    // Navigate to home
    router.replace('/');
  };

  const addCommonMint = () => {
    const commonMints = [
      { url: 'https://mint.minibits.cash/Bitcoin', name: 'Minibits' },
      { url: 'https://mint.coinos.io', name: 'Coinos' },
      { url: 'https://testnut.cashu.space', name: 'Test Mint' },
    ];

    const available = commonMints.filter(
      (m) => !selectedMints.find((sm) => sm.url === m.url)
    );

    if (available.length > 0) {
      setSelectedMints([...selectedMints, available[0]]);
    }
  };

  const addCustomMint = () => {
    if (customMintUrl && customMintName) {
      setSelectedMints([...selectedMints, { url: customMintUrl, name: customMintName }]);
      setCustomMintUrl('');
      setCustomMintName('');
      setShowCustomMintForm(false);
    }
  };

  const removeMint = (url: string) => {
    setSelectedMints(selectedMints.filter((m) => m.url !== url));
  };

  const renderWelcome = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.emoji}>👋</Text>
      <Text style={styles.title}>Welcome to CashuPay</Text>
      <Text style={styles.description}>
        Let's get your Bitcoin point-of-sale terminal set up in just a few steps.
      </Text>
      <View style={styles.features}>
        <Text style={styles.feature}>✓ Accept Bitcoin payments</Text>
        <Text style={styles.feature}>✓ Manage product catalog</Text>
        <Text style={styles.feature}>✓ Track sales and transactions</Text>
      </View>
      <View style={styles.buttonContainer}>
        <Pressable style={styles.secondaryButton} onPress={handleSkipAll}>
          <Text style={styles.secondaryButtonText}>Skip Setup</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: themeColors.accent }]}
          onPress={handleNext}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderTerminalType = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.emoji}>🖥️</Text>
      <Text style={styles.title}>Terminal Type</Text>
      <Text style={styles.description}>
        Is this your main terminal or a sub-terminal?
      </Text>

      <View style={styles.typeOptions}>
        <Pressable
          style={[
            styles.typeOption,
            terminalType === 'main' && styles.typeOptionActive,
            terminalType === 'main' && { borderColor: themeColors.accent },
          ]}
          onPress={() => setTerminalType('main')}
        >
          <Text style={styles.typeOptionEmoji}>👑</Text>
          <Text
            style={[
              styles.typeOptionTitle,
              terminalType === 'main' && { color: themeColors.accent },
            ]}
          >
            Main Terminal
          </Text>
          <Text style={styles.typeOptionDescription}>
            Full access to settings and admin functions. Other terminals can connect to this one.
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.typeOption,
            terminalType === 'sub' && styles.typeOptionActive,
            terminalType === 'sub' && { borderColor: themeColors.accent },
            styles.typeOptionDisabled,
          ]}
          disabled
        >
          <Text style={styles.typeOptionEmoji}>📱</Text>
          <Text
            style={[
              styles.typeOptionTitle,
              terminalType === 'sub' && { color: themeColors.accent },
              styles.typeOptionTitleDisabled,
            ]}
          >
            Sub-Terminal (Coming Soon)
          </Text>
          <Text style={styles.typeOptionDescription}>
            Connects to main terminal for sync. Limited settings access.
          </Text>
        </Pressable>
      </View>

      <View style={styles.buttonContainer}>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: themeColors.accent }]}
          onPress={handleNext}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderBusinessType = () => {
    const businessTypes = [
      {
        type: 'restaurant' as BusinessType,
        emoji: '🍽️',
        title: 'Restaurant / Café',
        description: 'Table management, coursing, kitchen display',
      },
      {
        type: 'retail' as BusinessType,
        emoji: '🛍️',
        title: 'Retail Store',
        description: 'Inventory, barcodes, customer directory',
      },
      {
        type: 'service' as BusinessType,
        emoji: '💇',
        title: 'Service Business',
        description: 'Appointments, staff scheduling, packages',
      },
      {
        type: 'general' as BusinessType,
        emoji: '🏪',
        title: 'General / Other',
        description: 'Basic POS features for any business',
      },
    ];

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.emoji}>🏢</Text>
        <Text style={styles.title}>Business Type</Text>
        <Text style={styles.description}>
          Choose your business type to customize your experience
        </Text>

        <ScrollView style={styles.businessTypeList} showsVerticalScrollIndicator={false}>
          {businessTypes.map((item) => (
            <Pressable
              key={item.type}
              style={[
                styles.businessTypeOption,
                businessType === item.type && styles.businessTypeOptionActive,
                businessType === item.type && { borderColor: themeColors.accent },
              ]}
              onPress={() => setBusinessType(item.type)}
            >
              <Text style={styles.businessTypeEmoji}>{item.emoji}</Text>
              <View style={styles.businessTypeContent}>
                <Text
                  style={[
                    styles.businessTypeTitle,
                    businessType === item.type && { color: themeColors.accent },
                  ]}
                >
                  {item.title}
                </Text>
                <Text style={styles.businessTypeDescription}>{item.description}</Text>
              </View>
              {businessType === item.type && (
                <Text style={[styles.checkmark, { color: themeColors.accent }]}>✓</Text>
              )}
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.buttonContainer}>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: themeColors.accent }]}
            onPress={handleNext}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderTerminal = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.emoji}>🏪</Text>
      <Text style={styles.title}>Name Your Terminal</Text>
      <Text style={styles.description}>
        This helps you identify your point-of-sale terminal (stored locally on your device)
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>Store Name</Text>
        <TextInput
          style={styles.input}
          value={merchantName}
          onChangeText={setMerchantName}
          placeholder="e.g., My Coffee Shop"
          placeholderTextColor={colors.text.muted}
        />

        <Text style={styles.label}>Terminal Name</Text>
        <TextInput
          style={styles.input}
          value={terminalName}
          onChangeText={setTerminalName}
          placeholder="e.g., Main Counter"
          placeholderTextColor={colors.text.muted}
        />
      </View>

      <View style={styles.buttonContainer}>
        <Pressable
          style={[
            styles.primaryButton,
            { backgroundColor: themeColors.accent },
            (!merchantName || !terminalName) && styles.buttonDisabled
          ]}
          onPress={handleNext}
          disabled={!merchantName || !terminalName}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderMints = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.emoji}>⚡</Text>
      <Text style={styles.title}>Connect to Mints</Text>
      <Text style={styles.description}>
        Select one or more mints to accept payments from
      </Text>

      <View style={styles.mintSection}>
        {selectedMints.length > 0 && (
          <ScrollView style={styles.mintList} showsVerticalScrollIndicator={true}>
            {selectedMints.map((mint) => (
              <View key={mint.url} style={styles.mintItem}>
                <View style={styles.mintInfo}>
                  <Text style={styles.mintName}>{mint.name}</Text>
                  <Text style={styles.mintUrl}>{mint.url}</Text>
                </View>
                <Pressable onPress={() => removeMint(mint.url)} style={styles.removeButton}>
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}

        {showCustomMintForm ? (
          <View style={styles.customMintForm}>
            <Text style={styles.label}>Mint Name</Text>
            <TextInput
              style={styles.input}
              value={customMintName}
              onChangeText={setCustomMintName}
              placeholder="e.g., My Mint"
              placeholderTextColor={colors.text.muted}
            />

            <Text style={styles.label}>Mint URL</Text>
            <TextInput
              style={styles.input}
              value={customMintUrl}
              onChangeText={setCustomMintUrl}
              placeholder="https://..."
              placeholderTextColor={colors.text.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.customMintActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => {
                  setShowCustomMintForm(false);
                  setCustomMintUrl('');
                  setCustomMintName('');
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.primaryButton,
                  { backgroundColor: themeColors.accent },
                  (!customMintUrl || !customMintName) && styles.buttonDisabled,
                ]}
                onPress={addCustomMint}
                disabled={!customMintUrl || !customMintName}
              >
                <Text style={styles.primaryButtonText}>Add</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.addMintButtons}>
            <Pressable style={styles.addButton} onPress={addCommonMint}>
              <Text style={styles.addButtonText}>+ Add Common Mint</Text>
            </Pressable>
            <Pressable
              style={styles.addButton}
              onPress={() => setShowCustomMintForm(true)}
            >
              <Text style={styles.addButtonText}>+ Add Custom Mint</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <Pressable style={styles.secondaryButton} onPress={handleSkip}>
          <Text style={styles.secondaryButtonText}>Skip for Now</Text>
        </Pressable>
        <Pressable
          style={[
            styles.primaryButton,
            { backgroundColor: themeColors.accent },
            selectedMints.length === 0 && styles.buttonDisabled
          ]}
          onPress={handleNext}
          disabled={selectedMints.length === 0}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderCurrency = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.emoji}>💰</Text>
      <Text style={styles.title}>Currency Settings</Text>
      <Text style={styles.description}>
        Configure how prices are displayed
      </Text>

      <View style={styles.settingGroup}>
        <Text style={styles.settingLabel}>Display Currency</Text>
        <ScrollView horizontal style={styles.currencyScroll} showsHorizontalScrollIndicator={false}>
          {CURRENCIES.slice(0, 5).map((curr) => (
            <Pressable
              key={curr.code}
              style={[
                styles.currencyOption,
                selectedCurrency === curr.code && styles.currencyOptionSelected,
                selectedCurrency === curr.code && { borderColor: themeColors.accent },
              ]}
              onPress={() => setSelectedCurrency(curr.code)}
            >
              <Text style={styles.currencySymbol}>{curr.symbol}</Text>
              <Text style={styles.currencyCode}>{curr.code}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.settingGroup}>
        <Text style={styles.settingLabel}>Price Display</Text>
        <View style={styles.optionsRow}>
          <Pressable
            style={[
              styles.option,
              selectedPriceMode === 'fiat_sats' && styles.optionActive,
              selectedPriceMode === 'fiat_sats' && { borderColor: themeColors.accent },
            ]}
            onPress={() => setSelectedPriceMode('fiat_sats')}
          >
            <Text style={[
              styles.optionText,
              selectedPriceMode === 'fiat_sats' && styles.optionTextActive,
              selectedPriceMode === 'fiat_sats' && { color: themeColors.accent },
            ]}>Fiat (Sats)</Text>
          </Pressable>
          <Pressable
            style={[
              styles.option,
              selectedPriceMode === 'sats_fiat' && styles.optionActive,
              selectedPriceMode === 'sats_fiat' && { borderColor: themeColors.accent },
            ]}
            onPress={() => setSelectedPriceMode('sats_fiat')}
          >
            <Text style={[
              styles.optionText,
              selectedPriceMode === 'sats_fiat' && styles.optionTextActive,
              selectedPriceMode === 'sats_fiat' && { color: themeColors.accent },
            ]}>Sats (Fiat)</Text>
          </Pressable>
          <Pressable
            style={[
              styles.option,
              selectedPriceMode === 'sats_only' && styles.optionActive,
              selectedPriceMode === 'sats_only' && { borderColor: themeColors.accent },
            ]}
            onPress={() => setSelectedPriceMode('sats_only')}
          >
            <Text style={[
              styles.optionText,
              selectedPriceMode === 'sats_only' && styles.optionTextActive,
              selectedPriceMode === 'sats_only' && { color: themeColors.accent },
            ]}>Bitcoin-Only</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.settingGroup}>
        <Text style={styles.settingLabel}>Sats Format</Text>
        <View style={styles.optionsRow}>
          <Pressable
            style={[
              styles.option,
              selectedSatsFormat === 'sats' && styles.optionActive,
              selectedSatsFormat === 'sats' && { borderColor: themeColors.accent },
            ]}
            onPress={() => setSelectedSatsFormat('sats')}
          >
            <Text style={[
              styles.optionText,
              selectedSatsFormat === 'sats' && styles.optionTextActive,
              selectedSatsFormat === 'sats' && { color: themeColors.accent },
            ]}>123 sats</Text>
          </Pressable>
          <Pressable
            style={[
              styles.option,
              selectedSatsFormat === 'btc' && styles.optionActive,
              selectedSatsFormat === 'btc' && { borderColor: themeColors.accent },
            ]}
            onPress={() => setSelectedSatsFormat('btc')}
          >
            <Text style={[
              styles.optionText,
              selectedSatsFormat === 'btc' && styles.optionTextActive,
              selectedSatsFormat === 'btc' && { color: themeColors.accent },
            ]}>₿123</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <Pressable style={styles.secondaryButton} onPress={handleSkip}>
          <Text style={styles.secondaryButtonText}>Skip for Now</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: themeColors.accent }]}
          onPress={handleFinish}
        >
          <Text style={styles.primaryButtonText}>Start Using CashuPay</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[
            styles.progressFill,
            {
              width: currentStep === 'welcome' ? '0%' :
                     currentStep === 'terminalType' ? '17%' :
                     currentStep === 'businessType' ? '34%' :
                     currentStep === 'terminal' ? '50%' :
                     currentStep === 'mints' ? '75%' :
                     currentStep === 'currency' ? '100%' : '0%',
              backgroundColor: themeColors.accent,
            }
          ]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {currentStep === 'welcome' && renderWelcome()}
        {currentStep === 'terminalType' && renderTerminalType()}
        {currentStep === 'businessType' && renderBusinessType()}
        {currentStep === 'terminal' && renderTerminal()}
        {currentStep === 'mints' && renderMints()}
        {currentStep === 'currency' && renderCurrency()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  progressContainer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.background.secondary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent.primary,
  },
  content: {
    flexGrow: 1,
    padding: spacing.xl,
  },
  stepContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  emoji: {
    fontSize: 64,
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  description: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  features: {
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  feature: {
    ...typography.bodyLarge,
    color: colors.text.primary,
  },
  form: {
    width: '100%',
    gap: spacing.lg,
    marginBottom: spacing.xxl,
  },
  label: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: spacing.lg,
    color: colors.text.primary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  mintSection: {
    width: '100%',
    flex: 1,
    marginBottom: spacing.xl,
  },
  mintList: {
    width: '100%',
    maxHeight: 180,
    marginBottom: spacing.lg,
  },
  mintItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  mintInfo: {
    flex: 1,
  },
  mintName: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  mintUrl: {
    ...typography.caption,
    color: colors.text.muted,
  },
  removeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  removeButtonText: {
    ...typography.bodySmall,
    color: colors.accent.danger,
  },
  addMintButtons: {
    gap: spacing.md,
  },
  addButton: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
    borderStyle: 'dashed',
  },
  addButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
  customMintForm: {
    width: '100%',
    gap: spacing.md,
  },
  customMintActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  settingGroup: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  settingLabel: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  currencyScroll: {
    flexGrow: 0,
  },
  currencyOption: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: spacing.lg,
    marginRight: spacing.md,
    alignItems: 'center',
    minWidth: 80,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  currencyOptionSelected: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
  },
  currencySymbol: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  currencyCode: {
    ...typography.caption,
    color: colors.text.muted,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  option: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  optionActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
  },
  optionText: {
    ...typography.bodySmall,
    color: colors.text.muted,
  },
  optionTextActive: {
    fontWeight: '600',
  },
  buttonContainer: {
    width: '100%',
    gap: spacing.md,
    marginTop: 'auto',
  },
  primaryButton: {
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.text.inverse,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
  },
  secondaryButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  typeOptions: {
    width: '100%',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  typeOption: {
    backgroundColor: colors.background.secondary,
    borderWidth: 2,
    borderColor: colors.border.default,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
  },
  typeOptionActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.05)',
  },
  typeOptionDisabled: {
    opacity: 0.5,
  },
  typeOptionEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  typeOptionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  typeOptionTitleDisabled: {
    color: colors.text.muted,
  },
  typeOptionDescription: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  businessTypeList: {
    width: '100%',
    maxHeight: 400,
    marginBottom: spacing.xl,
  },
  businessTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderWidth: 2,
    borderColor: colors.border.default,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  businessTypeOptionActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.05)',
  },
  businessTypeEmoji: {
    fontSize: 36,
    marginRight: spacing.md,
  },
  businessTypeContent: {
    flex: 1,
  },
  businessTypeTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  businessTypeDescription: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  checkmark: {
    fontSize: 24,
    fontWeight: '700',
  },
});
