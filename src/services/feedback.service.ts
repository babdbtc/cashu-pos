/**
 * Feedback Service
 *
 * Provides haptic and audio feedback for payment events.
 */

import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

export type FeedbackType =
  | 'payment_received'
  | 'payment_success'
  | 'payment_failed'
  | 'button_press'
  | 'error'
  | 'warning'
  | 'notification';

interface FeedbackConfig {
  hapticsEnabled: boolean;
  soundsEnabled: boolean;
  volume: number; // 0-1
}

class FeedbackService {
  private config: FeedbackConfig = {
    hapticsEnabled: true,
    soundsEnabled: true,
    volume: 0.8,
  };

  private sounds: Map<string, Audio.Sound> = new Map();
  private isInitialized = false;

  /**
   * Initialize the feedback service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Set audio mode for playback
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize feedback service:', error);
    }
  }

  /**
   * Configure feedback settings
   */
  configure(config: Partial<FeedbackConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Trigger feedback for an event
   */
  async trigger(type: FeedbackType): Promise<void> {
    await Promise.all([
      this.triggerHaptic(type),
      this.triggerSound(type),
    ]);
  }

  /**
   * Trigger haptic feedback
   */
  async triggerHaptic(type: FeedbackType): Promise<void> {
    if (!this.config.hapticsEnabled) return;

    try {
      switch (type) {
        case 'payment_received':
          // Light tap when payment is detected
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;

        case 'payment_success':
          // Strong success pattern: medium-pause-heavy
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await this.delay(100);
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;

        case 'payment_failed':
          // Error pattern
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;

        case 'button_press':
          // Light tap for buttons
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;

        case 'error':
          // Error notification
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;

        case 'warning':
          // Warning pattern
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;

        case 'notification':
          // Selection feedback
          await Haptics.selectionAsync();
          break;

        default:
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  }

  /**
   * Trigger sound feedback
   */
  async triggerSound(type: FeedbackType): Promise<void> {
    if (!this.config.soundsEnabled) return;

    try {
      // For a real app, you would load actual sound files
      // This is a placeholder that uses system sounds where available
      switch (type) {
        case 'payment_success':
          await this.playSystemSound('success');
          break;

        case 'payment_failed':
          await this.playSystemSound('error');
          break;

        case 'payment_received':
          await this.playSystemSound('received');
          break;

        case 'button_press':
          // No sound for button press typically
          break;

        case 'error':
          await this.playSystemSound('error');
          break;

        case 'warning':
          await this.playSystemSound('warning');
          break;

        case 'notification':
          await this.playSystemSound('notification');
          break;
      }
    } catch (error) {
      console.warn('Sound feedback failed:', error);
    }
  }

  /**
   * Play a tone at a specific frequency (for simple feedback)
   */
  async playTone(frequency: number, duration: number): Promise<void> {
    if (!this.config.soundsEnabled) return;

    // Note: expo-av doesn't support generating tones directly
    // In a production app, you would use pre-recorded sound files
    // or a library that supports tone generation
    console.log(`Playing tone: ${frequency}Hz for ${duration}ms`);
  }

  /**
   * Play success melody
   */
  async playSuccessMelody(): Promise<void> {
    if (!this.config.soundsEnabled) return;

    // Simulate a success melody with haptics as fallback
    await this.triggerHaptic('payment_success');

    // In production, load and play actual success sound
    // const sound = await this.loadSound('success.mp3');
    // await sound.playAsync();
  }

  /**
   * Play failure sound
   */
  async playFailureSound(): Promise<void> {
    if (!this.config.soundsEnabled) return;

    await this.triggerHaptic('payment_failed');
  }

  /**
   * Vibration pattern for getting attention
   */
  async alertPattern(): Promise<void> {
    if (!this.config.hapticsEnabled) return;

    for (let i = 0; i < 3; i++) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await this.delay(200);
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Unload all sounds
    for (const [key, sound] of this.sounds) {
      try {
        await sound.unloadAsync();
      } catch (error) {
        console.warn(`Failed to unload sound ${key}:`, error);
      }
    }
    this.sounds.clear();
  }

  // Private methods

  private async playSystemSound(type: string): Promise<void> {
    // Placeholder - in production, you would:
    // 1. Bundle sound files with the app
    // 2. Load them with Audio.Sound.createAsync()
    // 3. Play them here

    // For now, we just trigger haptics as a fallback
    switch (type) {
      case 'success':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'error':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case 'warning':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      default:
        await Haptics.selectionAsync();
    }
  }

  private async loadSound(filename: string): Promise<Audio.Sound> {
    // Check cache
    const cached = this.sounds.get(filename);
    if (cached) return cached;

    // Load sound
    // In production:
    // const { sound } = await Audio.Sound.createAsync(
    //   require(`../../assets/sounds/${filename}`)
    // );
    // this.sounds.set(filename, sound);
    // return sound;

    // Placeholder
    const { sound } = await Audio.Sound.createAsync({ uri: '' });
    return sound;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const feedbackService = new FeedbackService();

// Export class for testing
export { FeedbackService };

// Convenience functions
export const triggerFeedback = (type: FeedbackType) => feedbackService.trigger(type);
export const haptic = (type: FeedbackType) => feedbackService.triggerHaptic(type);
