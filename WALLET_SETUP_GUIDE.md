# Wallet Setup & Recovery Guide

## Overview

The Cashu POS system now includes a secure wallet with seed-based recovery. This allows store owners to backup and restore their wallet using a 12-word recovery phrase.

## Key Features

✅ **BIP39 12-Word Recovery Phrase** - Industry-standard seed generation
✅ **Secure Storage** - Seeds stored in Expo SecureStore (hardware-backed on mobile)
✅ **First-Run Wizard** - Automatic wallet setup on first launch
✅ **Backup & Restore** - Easy backup and recovery from settings
✅ **Export Options** - Copy to clipboard or download backup file
✅ **Wallet Identification** - Unique wallet ID derived from seed

---

## How It Works

### Wallet Initialization Flow

```
App Launch
    ↓
Check Onboarding Completed?
    ↓ Yes
Check Wallet Initialized?
    ↓ No
    ↓
Wallet Setup Screen
    ↓
1. Generate 12-word BIP39 mnemonic
2. Display to user
3. User confirms backup
4. Store in SecureStore
    ↓
Ready to Use
```

### Architecture

#### Core Files

**Services:**
- `src/services/seed.service.ts` - Seed generation, validation, storage

**State Management:**
- `src/store/seed.store.ts` - Zustand store for wallet state

**UI Screens:**
- `app/wallet/setup.tsx` - Initial wallet setup wizard
- `app/wallet/restore.tsx` - Restore from recovery phrase
- `app/wallet/backup.tsx` - View and backup recovery phrase

**Integration:**
- `app/index.tsx` - Checks wallet initialization on app start
- `app/settings/index.tsx` - Wallet management options

---

## For Store Owners

### Initial Setup

1. **Complete onboarding** - Set up terminal name, mints, etc.
2. **Wallet setup screen appears** - Your 12-word recovery phrase is generated
3. **CRITICAL: Write down the 12 words** - This is the ONLY way to recover your wallet
4. **Confirm backup** - Tap "I Have Saved My Recovery Phrase"
5. **Start using your POS** - Your wallet is now ready

### Security Best Practices

⚠️ **Your 12-word recovery phrase is extremely important:**

- **Write it down** on paper (not digitally)
- **Store it securely** (safe, lockbox, or secure location)
- **Never share it** with anyone
- **Make multiple copies** in different secure locations
- **Test recovery** on a different device to verify your backup

### Backup Your Wallet

**Via Settings:**
1. Go to **Settings**
2. Tap **Wallet** → **Backup Wallet**
3. Tap **Reveal Recovery Phrase** (confirm security warning)
4. Options:
   - **Copy to Clipboard** - Paste into secure password manager
   - **Export Backup File** - Download encrypted JSON file
   - **Write it down** - Old school but most secure

### Restore Your Wallet

If you lose your device or need to restore:

1. Install Cashu POS on new device
2. Complete onboarding
3. Go to **Settings** → **Wallet** → **Restore Wallet**
4. Enter your 12 words in correct order
5. Tap **Restore Wallet**
6. Your wallet is restored!

---

## For Developers

### Using the Seed Service

```typescript
import { seedService } from '@/services/seed.service';

// Generate a new seed
const mnemonic = await seedService.generateSeed();
console.log(mnemonic); // "word1 word2 word3 ..."

// Validate a mnemonic
const isValid = seedService.validateSeed(mnemonic);

// Store securely
await seedService.storeSeed(mnemonic);

// Retrieve stored seed
const seed = await seedService.getSeed();
console.log(seed.mnemonic);

// Check if seed exists
const hasSeed = await seedService.hasSeed();

// Get wallet ID
const walletId = await seedService.getWalletId(mnemonic);
```

### Using the Seed Store

```typescript
import { useSeedStore } from '@/store/seed.store';

function MyComponent() {
  const {
    isWalletInitialized,
    isSeedBackedUp,
    walletId,
    checkWalletStatus,
    initializeWallet,
    restoreWallet,
    markSeedBackedUp,
    getSeedForBackup,
  } = useSeedStore();

  // Check wallet status on mount
  useEffect(() => {
    checkWalletStatus();
  }, []);

  // Initialize new wallet
  const handleSetup = async () => {
    try {
      const mnemonic = await initializeWallet();
      console.log('Wallet created:', mnemonic);
    } catch (error) {
      console.error('Failed to initialize:', error);
    }
  };

  // Restore from backup
  const handleRestore = async (mnemonic: string) => {
    try {
      await restoreWallet(mnemonic);
      console.log('Wallet restored!');
    } catch (error) {
      console.error('Restore failed:', error);
    }
  };

  return (
    <View>
      <Text>Wallet ID: {walletId}</Text>
      <Text>Backed Up: {isSeedBackedUp ? 'Yes' : 'No'}</Text>
    </View>
  );
}
```

### Integration Points

#### App Initialization (app/index.tsx)

```typescript
const { isWalletInitialized, checkWalletStatus } = useSeedStore();

useEffect(() => {
  checkWalletStatus();
}, []);

useEffect(() => {
  if (!hasCompletedOnboarding) {
    router.replace('/onboarding');
  } else if (!isWalletInitialized) {
    router.push('/wallet/setup');
  }
}, [hasCompletedOnboarding, isWalletInitialized]);
```

#### Settings Integration (app/settings/index.tsx)

The Settings screen provides easy access to:
- **Backup Wallet** - `/wallet/backup`
- **Restore Wallet** - `/wallet/restore`

---

## Technical Details

### BIP39 Mnemonic Generation

- **Entropy:** 128 bits
- **Words:** 12 words from BIP39 wordlist
- **Checksum:** Built into BIP39 standard
- **Language:** English

### Secure Storage

- **Platform:** Expo SecureStore
- **Encryption:** Hardware-backed keystore (iOS Keychain, Android Keystore)
- **Keys:**
  - `cashupay-wallet-seed` - Encrypted seed storage
  - `cashupay-seed-backup-confirmed` - Backup confirmation flag

### Wallet ID Generation

```typescript
const seed = mnemonicToSeedSync(mnemonic);
const hash = SHA256(seed);
const walletId = hash.substring(0, 16);
```

The wallet ID is a deterministic identifier derived from the seed for wallet recognition.

### Future Enhancements

Potential future features:
- **BIP32 Key Derivation** - Derive keys for specific purposes
- **Multi-signature Support** - Require multiple seeds for transactions
- **Cloud Backup** - Encrypted cloud backup with password
- **Hardware Wallet Support** - Integration with hardware devices
- **Social Recovery** - Shamir secret sharing for family recovery

---

## Troubleshooting

### "Invalid recovery phrase" error

**Problem:** The 12 words don't form a valid BIP39 mnemonic

**Solutions:**
- Check for typos in each word
- Ensure words are in correct order
- Verify all words are from BIP39 wordlist
- Try lowercase only (no capitals)

### Cannot access wallet after restore

**Problem:** Wallet restored but balance is zero

**Solution:** Cashu proofs are separate from the seed. The seed identifies your wallet but doesn't automatically restore proofs. You'll need to:
1. Contact your mint for proof recovery (if supported)
2. Or manually re-add tokens you have stored elsewhere

### Wallet setup screen keeps appearing

**Problem:** Setup screen shows even after completing setup

**Solution:**
1. Check if seed is stored: Settings → Wallet → Backup Wallet
2. If no seed exists, complete setup again
3. Verify SecureStore permissions are granted

### Lost recovery phrase

**Problem:** Recovery phrase was not backed up

**Unfortunately:** Without the recovery phrase, the wallet cannot be recovered. This is by design for security. Always back up your recovery phrase immediately after wallet creation.

---

## Security Considerations

### Seed Storage

✅ **Secure:**
- Expo SecureStore (hardware-backed encryption)
- Never logged or transmitted
- Only accessible to the app

❌ **Avoid:**
- Storing in AsyncStorage
- Storing in plain text files
- Sending via email/SMS
- Screenshots (on some platforms)

### Recovery Phrase Best Practices

1. **Physical Backup** - Write on paper, not digital
2. **Multiple Locations** - Don't keep all backups in one place
3. **Secure Storage** - Safe, safety deposit box, etc.
4. **Test Recovery** - Verify backup works before relying on it
5. **Never Share** - Treat like cash - anyone with it owns it

### Threat Model

**Protected Against:**
- App uninstall/reinstall
- Device loss or theft (if phrase backed up)
- OS corruption
- App data corruption

**NOT Protected Against:**
- Compromised recovery phrase
- Malware accessing SecureStore
- Physical access to unlocked device
- User revealing recovery phrase

---

## API Reference

### SeedService

```typescript
class SeedService {
  // Generate new 12-word mnemonic
  generateSeed(): Promise<string>

  // Validate BIP39 mnemonic
  validateSeed(mnemonic: string): boolean

  // Store seed in SecureStore
  storeSeed(mnemonic: string): Promise<void>

  // Retrieve stored seed
  getSeed(): Promise<WalletSeed | null>

  // Check if seed exists
  hasSeed(): Promise<boolean>

  // Delete seed (use with caution!)
  deleteSeed(): Promise<void>

  // Mark seed as backed up
  markSeedBackedUp(): Promise<void>

  // Check backup status
  isSeedBackedUp(): Promise<boolean>

  // Convert mnemonic to seed bytes
  mnemonicToSeed(mnemonic: string): Buffer

  // Get deterministic wallet ID
  getWalletId(mnemonic: string): Promise<string>

  // Initialize new wallet
  initializeWallet(): Promise<string>

  // Restore from mnemonic
  restoreWallet(mnemonic: string): Promise<void>

  // Export wallet data
  exportWallet(): Promise<BackupData | null>
}
```

### SeedStore

```typescript
interface SeedState {
  isWalletInitialized: boolean
  isSeedBackedUp: boolean
  isLoading: boolean
  walletId: string | null

  checkWalletStatus(): Promise<void>
  initializeWallet(): Promise<string>
  restoreWallet(mnemonic: string): Promise<void>
  markSeedBackedUp(): Promise<void>
  getSeedForBackup(): Promise<string | null>
  deleteWallet(): Promise<void>
}
```

---

## Changelog

### v1.0.0 - Initial Release

- ✅ BIP39 seed generation
- ✅ SecureStore integration
- ✅ Setup wizard
- ✅ Backup functionality
- ✅ Restore functionality
- ✅ App initialization integration
- ✅ Settings integration

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/babdbtc/cashu-pos/issues
- Documentation: Check this file and inline code comments

---

**Remember: Your recovery phrase is the key to your funds. Keep it safe!** 🔐
