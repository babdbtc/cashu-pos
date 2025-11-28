/**
 * NFC Service
 *
 * Handles NFC operations for reading Cashu tokens from customer devices.
 * Supports both NDEF messages and Android HCE.
 */

import { Platform } from 'react-native';

// Dynamically import NFC manager to handle Expo Go where native modules aren't available
let NfcManager: any = null;
let NfcTech: any = null;
let Ndef: any = null;
let NfcEvents: any = null;
let nfcAvailable = false;

try {
  const nfcModule = require('react-native-nfc-manager');
  NfcManager = nfcModule.default;
  NfcTech = nfcModule.NfcTech;
  Ndef = nfcModule.Ndef;
  NfcEvents = nfcModule.NfcEvents;
  nfcAvailable = true;
} catch (error) {
  console.log('NFC module not available (running in Expo Go or web)');
}

export interface NfcReadResult {
  success: boolean;
  token?: string;
  error?: string;
}

export interface NfcStatus {
  supported: boolean;
  enabled: boolean;
}

// Event callback types
type NfcEventCallback = (result: NfcReadResult) => void;
type NfcStatusCallback = (status: NfcStatus) => void;

class NfcService {
  private isInitialized = false;
  private isReading = false;
  private onTokenReceived: NfcEventCallback | null = null;
  private onStatusChange: NfcStatusCallback | null = null;

  /**
   * Initialize NFC manager
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    // Check if NFC module is available (not in Expo Go)
    if (!nfcAvailable || !NfcManager) {
      console.log('NFC module not available');
      return false;
    }

    try {
      const supported = await NfcManager.isSupported();
      if (!supported) {
        console.log('NFC is not supported on this device');
        return false;
      }

      await NfcManager.start();
      this.isInitialized = true;

      // Set up session invalidation listener (iOS)
      if (Platform.OS === 'ios' && NfcEvents) {
        NfcManager.setEventListener(NfcEvents.SessionClosed, () => {
          this.isReading = false;
        });
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize NFC:', error);
      return false;
    }
  }

  /**
   * Check if NFC is supported and enabled
   */
  async getStatus(): Promise<NfcStatus> {
    // Check if NFC module is available (not in Expo Go)
    if (!nfcAvailable || !NfcManager) {
      return { supported: false, enabled: false };
    }

    try {
      const supported = await NfcManager.isSupported();
      if (!supported) {
        return { supported: false, enabled: false };
      }

      const enabled = await NfcManager.isEnabled();
      return { supported: true, enabled };
    } catch (error) {
      console.error('Failed to get NFC status:', error);
      return { supported: false, enabled: false };
    }
  }

  /**
   * Start listening for NFC tags containing Cashu tokens
   */
  async startReading(onToken: NfcEventCallback): Promise<boolean> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        onToken({ success: false, error: 'NFC not available' });
        return false;
      }
    }

    if (this.isReading) {
      return true;
    }

    this.onTokenReceived = onToken;
    this.isReading = true;

    try {
      // Request NDEF technology
      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage: 'Hold your device near the customer\'s phone',
      });

      // Read the tag
      const tag = await NfcManager.getTag();

      if (tag && tag.ndefMessage && tag.ndefMessage.length > 0) {
        // Parse NDEF records
        const token = this.parseNdefForToken(tag.ndefMessage);

        if (token) {
          this.onTokenReceived?.({ success: true, token });
        } else {
          this.onTokenReceived?.({
            success: false,
            error: 'No Cashu token found in NFC message'
          });
        }
      } else {
        this.onTokenReceived?.({
          success: false,
          error: 'Empty or invalid NFC tag'
        });
      }
    } catch (error: any) {
      if (error.message !== 'cancelled') {
        console.error('NFC read error:', error);
        this.onTokenReceived?.({
          success: false,
          error: error.message || 'Failed to read NFC'
        });
      }
    } finally {
      await this.cancelReading();
    }

    return true;
  }

  /**
   * Start continuous reading mode (keeps scanning for tags)
   */
  async startContinuousReading(onToken: NfcEventCallback): Promise<void> {
    if (!nfcAvailable || !NfcManager) {
      onToken({ success: false, error: 'NFC not available' });
      return;
    }

    this.onTokenReceived = onToken;

    const readLoop = async () => {
      while (this.isReading) {
        try {
          await NfcManager.requestTechnology(NfcTech.Ndef, {
            alertMessage: 'Ready to receive payment',
          });

          const tag = await NfcManager.getTag();

          if (tag?.ndefMessage?.length) {
            const token = this.parseNdefForToken(tag.ndefMessage);
            if (token) {
              this.onTokenReceived?.({ success: true, token });
              // Brief pause after successful read
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }

          await NfcManager.cancelTechnologyRequest();
        } catch (error: any) {
          if (error.message === 'cancelled') {
            break;
          }
          // Small delay before retry
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    };

    this.isReading = true;
    readLoop();
  }

  /**
   * Stop NFC reading
   */
  async cancelReading(): Promise<void> {
    this.isReading = false;
    this.onTokenReceived = null;

    if (!nfcAvailable || !NfcManager) {
      return;
    }

    try {
      await NfcManager.cancelTechnologyRequest();
    } catch (error) {
      // Ignore cancellation errors
    }
  }

  /**
   * Parse NDEF message for Cashu token
   */
  private parseNdefForToken(ndefMessage: any[]): string | null {
    if (!Ndef) return null;

    for (const record of ndefMessage) {
      try {
        // Check for Text record
        if (record.tnf === Ndef.TNF_WELL_KNOWN &&
            record.type &&
            String.fromCharCode(...record.type) === 'T') {
          const text = Ndef.text.decodePayload(record.payload);
          if (this.isCashuToken(text)) {
            return text;
          }
        }

        // Check for URI record
        if (record.tnf === Ndef.TNF_WELL_KNOWN &&
            record.type &&
            String.fromCharCode(...record.type) === 'U') {
          const uri = Ndef.uri.decodePayload(record.payload);
          // Handle cashu: URI scheme
          if (uri.startsWith('cashu:')) {
            return uri.substring(6);
          }
          // Handle web+cashu: URI scheme
          if (uri.startsWith('web+cashu:')) {
            return uri.substring(10);
          }
          // Check if URI itself is a token
          if (this.isCashuToken(uri)) {
            return uri;
          }
        }

        // Check raw payload as string
        if (record.payload) {
          const rawText = String.fromCharCode(...record.payload);
          if (this.isCashuToken(rawText)) {
            return rawText;
          }
        }
      } catch (error) {
        console.warn('Failed to parse NDEF record:', error);
      }
    }

    return null;
  }

  /**
   * Check if a string is a valid Cashu token format
   */
  private isCashuToken(text: string): boolean {
    // Cashu tokens start with cashuA (v3) or cashuB (v4)
    return text.startsWith('cashuA') || text.startsWith('cashuB');
  }

  /**
   * Write a Cashu token to an NFC tag (for change tokens)
   */
  async writeToken(token: string): Promise<boolean> {
    if (!nfcAvailable || !NfcManager || !Ndef) {
      return false;
    }

    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage: 'Hold device near tag to write change token',
      });

      // Create NDEF message with the token
      const bytes = Ndef.encodeMessage([
        Ndef.textRecord(token),
        Ndef.uriRecord(`cashu:${token}`),
      ]);

      if (bytes) {
        await NfcManager.ndefHandler.writeNdefMessage(bytes);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to write NFC:', error);
      return false;
    } finally {
      await NfcManager.cancelTechnologyRequest();
    }
  }

  /**
   * Open device NFC settings
   */
  async openSettings(): Promise<void> {
    if (!nfcAvailable || !NfcManager) {
      return;
    }

    try {
      await NfcManager.goToNfcSetting();
    } catch (error) {
      console.error('Failed to open NFC settings:', error);
    }
  }

  /**
   * Clean up NFC resources
   */
  async cleanup(): Promise<void> {
    await this.cancelReading();
    this.isInitialized = false;
  }
}

// Export singleton instance
export const nfcService = new NfcService();

// Export class for testing
export { NfcService };
