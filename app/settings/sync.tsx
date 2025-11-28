/**
 * Sync Settings Screen
 *
 * Configure and monitor multi-terminal sync via Nostr
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Switch,
  TextInput,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { syncService } from '@/services/sync.service';
import { nostrService } from '@/services/nostr.service';
import { deviceApprovalService, type ApprovalStatus } from '@/services/device-approval.service';
import { useConfigStore } from '@/store/config.store';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { JoinRequest, ApprovedDevice } from '@/types/nostr';

const { width: screenWidth } = Dimensions.get('window');

export default function SyncSettingsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { merchantId, terminalId, terminalType, merchantName, terminalName } = useConfigStore();
  const setMerchantId = useConfigStore((state) => state.setMerchantId);
  const [permission, requestPermission] = useCameraPermissions();

  const [syncStatus, setSyncStatus] = useState({
    enabled: false,
    syncing: false,
    pendingEvents: 0,
    lastSync: 0,
    nostrPubkey: null as string | null,
  });
  const [loading, setLoading] = useState(true);
  const [showJoinNetwork, setShowJoinNetwork] = useState(false);
  const [joinNetworkId, setJoinNetworkId] = useState('');
  const [showQRCode, setShowQRCode] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);

  // Device approval state
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>('none');
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([]);
  const [approvedDevices, setApprovedDevices] = useState<ApprovedDevice[]>([]);

  useEffect(() => {
    loadSyncStatus();
    loadApprovalStatus();
  }, []);

  useEffect(() => {
    // Subscribe to device events for both main and sub terminals
    // Main terminal: to see join requests
    // Sub terminal: to receive approval/denial notifications
    if (merchantId) {
      const setupSubscription = async () => {
        try {
          await nostrService.initialize();
          await deviceApprovalService.initialize();
          deviceApprovalService.subscribeToDeviceEvents(merchantId, () => {
            console.log('[Sync] Device event received, reloading status');
            loadApprovalStatus();
          });
          console.log('[Sync] Subscribed to device events for merchant:', merchantId);
        } catch (error) {
          console.error('[Sync] Error setting up device subscription:', error);
        }
      };
      setupSubscription();

      // Poll periodically for updates
      const pollInterval = setInterval(() => {
        loadApprovalStatus();
      }, 10000); // Every 10 seconds

      return () => {
        clearInterval(pollInterval);
        deviceApprovalService.cleanup();
      };
    }
    return () => {
      deviceApprovalService.cleanup();
    };
  }, [merchantId]);

  const loadSyncStatus = async () => {
    try {
      const status = await syncService.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Error loading sync status:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadApprovalStatus = async () => {
    try {
      await deviceApprovalService.initialize();

      if (merchantId) {
        // For main terminal, fetch pending requests from relays
        if (terminalType === 'main') {
          await deviceApprovalService.fetchPendingRequests(merchantId);
        }
        // For sub-terminal, fetch approval status from relays
        if (terminalType === 'sub') {
          await deviceApprovalService.fetchMyApprovalStatus(merchantId);
        }
      }

      setApprovalStatus(deviceApprovalService.getMyApprovalStatus());
      setPendingRequests(deviceApprovalService.getPendingRequests());
      setApprovedDevices(deviceApprovalService.getApprovedDevices());

      console.log('[Sync] Loaded approval status:', {
        status: deviceApprovalService.getMyApprovalStatus(),
        pending: deviceApprovalService.getPendingRequests().length,
        approved: deviceApprovalService.getApprovedDevices().length,
      });
    } catch (error) {
      console.error('Error loading approval status:', error);
    }
  };

  const handleToggleSync = async () => {
    try {
      if (syncStatus.enabled) {
        // Sub-terminals cannot disable sync - they must leave the network
        if (terminalType === 'sub') {
          Alert.alert(
            'Cannot Disable Sync',
            'Sub-terminals must stay synced with the store. To disconnect, leave the sync network from the options below.',
          );
          return;
        }
        syncService.stopSync();
        setSyncStatus(prev => ({ ...prev, enabled: false }));
      } else {
        if (!merchantId || !terminalId) {
          Alert.alert('Setup Required', 'Please complete terminal setup first');
          return;
        }

        // Check if sub-terminal needs approval
        if (terminalType === 'sub' && approvalStatus !== 'approved') {
          Alert.alert(
            'Approval Required',
            'Sub-terminals must be approved by the main terminal before syncing. Please request approval first.',
          );
          return;
        }

        // Initialize if needed
        await syncService.initialize(merchantId, terminalId);
        await deviceApprovalService.initialize();

        // Register as main terminal if first time
        if (terminalType === 'main' && approvalStatus === 'none') {
          await deviceApprovalService.registerAsMain(terminalId, merchantName, merchantId);
          setApprovalStatus('approved');
        }

        await syncService.startSync();
        loadSyncStatus();
      }
    } catch (error) {
      console.error('Error toggling sync:', error);
      Alert.alert('Error', 'Failed to toggle sync: ' + (error as Error).message);
    }
  };

  const handleApproveDevice = async (request: JoinRequest) => {
    try {
      await deviceApprovalService.approveDevice(request, terminalId!);
      loadApprovalStatus();
      Alert.alert('Approved', `${request.terminalName} can now sync with this network.`);
    } catch (error) {
      Alert.alert('Error', 'Failed to approve device');
    }
  };

  const handleDenyDevice = async (request: JoinRequest) => {
    Alert.alert(
      'Deny Access',
      `Are you sure you want to deny ${request.terminalName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deny',
          style: 'destructive',
          onPress: async () => {
            try {
              await deviceApprovalService.denyDevice(request, terminalId!);
              loadApprovalStatus();
            } catch (error) {
              Alert.alert('Error', 'Failed to deny device');
            }
          },
        },
      ]
    );
  };

  const handleRevokeDevice = async (device: ApprovedDevice) => {
    Alert.alert(
      'Revoke Access',
      `Are you sure you want to revoke access for ${device.terminalName}? They will no longer be able to sync.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              await deviceApprovalService.revokeDevice(device.terminalId, merchantId!);
              loadApprovalStatus();
            } catch (error) {
              Alert.alert('Error', 'Failed to revoke device');
            }
          },
        },
      ]
    );
  };

  const handleRequestApproval = async () => {
    try {
      await deviceApprovalService.initialize();
      await deviceApprovalService.sendJoinRequest(terminalId!, terminalName, merchantId!);
      setApprovalStatus('pending');
      Alert.alert(
        'Request Sent',
        'Your join request has been sent to the main terminal. Please wait for approval.',
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to send join request');
    }
  };

  const handleManualSync = async () => {
    try {
      // Push local changes
      await syncService.performSync();
      // Pull from relays
      await syncService.refreshFromRelays();
      // Reload status
      loadSyncStatus();
    } catch (error) {
      console.error('Error performing sync:', error);
      Alert.alert('Sync Failed', (error as Error).message);
    }
  };

  const handleCopyNetworkId = async () => {
    if (merchantId) {
      await Clipboard.setStringAsync(merchantId);
      Alert.alert('Copied!', 'Network ID copied to clipboard. Share this with other terminals to connect them.');
    }
  };

  const handleJoinNetwork = () => {
    if (!joinNetworkId.trim()) {
      Alert.alert('Error', 'Please enter a Network ID');
      return;
    }

    Alert.alert(
      'Join Network',
      `This will request to join network: ${joinNetworkId}\n\nThe main terminal will need to approve this device before you can sync.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request to Join',
          onPress: async () => {
            // Stop sync if running
            if (syncStatus.enabled) {
              syncService.stopSync();
              setSyncStatus(prev => ({ ...prev, enabled: false }));
            }

            // Update merchant ID
            setMerchantId(joinNetworkId.trim());

            // Reset UI
            setShowJoinNetwork(false);
            setJoinNetworkId('');

            // If sub-terminal, send join request
            if (terminalType === 'sub') {
              try {
                await deviceApprovalService.initialize();
                await deviceApprovalService.sendJoinRequest(
                  terminalId!,
                  terminalName,
                  joinNetworkId.trim()
                );
                setApprovalStatus('pending');
                Alert.alert(
                  'Request Sent',
                  'Your join request has been sent. The main terminal must approve this device before you can sync.',
                );
              } catch (error) {
                Alert.alert('Error', 'Failed to send join request. Please try again.');
              }
            } else {
              Alert.alert(
                'Network Set',
                'Network ID updated. Enable sync to start synchronizing.',
              );
            }
          },
        },
      ]
    );
  };

  const handlePasteNetworkId = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setJoinNetworkId(text);
    }
  };

  const handleShowQRCode = () => {
    setShowQRCode(true);
  };

  const handleOpenScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera permission is needed to scan QR codes');
        return;
      }
    }
    setScanned(false);
    setShowScanner(true);
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setShowScanner(false);

    // Validate that it looks like a network ID (numeric string)
    if (!/^\d+$/.test(data)) {
      Alert.alert('Invalid QR Code', 'This QR code does not contain a valid Network ID');
      return;
    }

    Alert.alert(
      'Join Network',
      `Found Network ID: ${data}\n\n${terminalType === 'sub' ? 'The main terminal will need to approve this device.' : 'Join this network?'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: terminalType === 'sub' ? 'Request to Join' : 'Join',
          onPress: async () => {
            if (syncStatus.enabled) {
              syncService.stopSync();
              setSyncStatus(prev => ({ ...prev, enabled: false }));
            }
            setMerchantId(data);

            if (terminalType === 'sub') {
              try {
                await deviceApprovalService.initialize();
                await deviceApprovalService.sendJoinRequest(terminalId!, terminalName, data);
                setApprovalStatus('pending');
                Alert.alert(
                  'Request Sent',
                  'Your join request has been sent. The main terminal must approve this device before you can sync.',
                );
              } catch (error) {
                Alert.alert('Error', 'Failed to send join request.');
              }
            } else {
              Alert.alert('Network Joined', 'Enable sync to start synchronizing.');
            }
          },
        },
      ]
    );
  };

  const formatLastSync = (timestamp: number) => {
    if (!timestamp) return 'Never';

    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </Pressable>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Back Button */}
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </Pressable>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Network ID Card */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Network Identity</Text>

          <View style={styles.networkIdSection}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>NETWORK ID</Text>
            <View style={styles.networkIdRow}>
              <Text style={[styles.networkId, { color: colors.text }]} numberOfLines={1}>
                {merchantId || 'Not set'}
              </Text>
              <Pressable onPress={handleCopyNetworkId} style={styles.iconButton}>
                <Ionicons name="copy-outline" size={20} color={colors.accent} />
              </Pressable>
              <Pressable onPress={handleShowQRCode} style={styles.iconButton}>
                <Ionicons name="qr-code-outline" size={20} color={colors.accent} />
              </Pressable>
            </View>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Share this ID or show QR code to connect other terminals
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Join Network Section */}
          <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 12 }]}>JOIN A NETWORK</Text>

          <View style={styles.joinButtons}>
            <Pressable
              style={[styles.joinOptionButton, { backgroundColor: colors.accent }]}
              onPress={handleOpenScanner}
            >
              <Ionicons name="scan-outline" size={24} color="#fff" />
              <Text style={styles.joinOptionButtonText}>Scan QR Code</Text>
            </Pressable>

            <Pressable
              style={[styles.joinOptionButton, { backgroundColor: colors.border }]}
              onPress={() => setShowJoinNetwork(true)}
            >
              <Ionicons name="keypad-outline" size={24} color={colors.text} />
              <Text style={[styles.joinOptionButtonText, { color: colors.text }]}>Enter ID Manually</Text>
            </Pressable>
          </View>

          {showJoinNetwork && (
            <View style={styles.joinSection}>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[styles.label, { color: colors.textSecondary }]}>ENTER NETWORK ID</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  value={joinNetworkId}
                  onChangeText={setJoinNetworkId}
                  placeholder="Paste network ID here..."
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable onPress={handlePasteNetworkId} style={styles.pasteButton}>
                  <Ionicons name="clipboard-outline" size={20} color={colors.accent} />
                </Pressable>
              </View>
              <View style={styles.joinActions}>
                <Pressable
                  style={[styles.cancelButton, { backgroundColor: colors.border }]}
                  onPress={() => {
                    setShowJoinNetwork(false);
                    setJoinNetworkId('');
                  }}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.joinButton, { backgroundColor: colors.accent }]}
                  onPress={handleJoinNetwork}
                >
                  <Text style={styles.joinButtonText}>Join Network</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* Sub-Terminal Approval Status */}
        {terminalType === 'sub' && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Approval Status</Text>

            <View style={styles.approvalStatusContainer}>
              <View style={[
                styles.approvalBadge,
                approvalStatus === 'approved' && { backgroundColor: colors.accent },
                approvalStatus === 'pending' && { backgroundColor: '#f59e0b' },
                approvalStatus === 'denied' && { backgroundColor: '#ef4444' },
                approvalStatus === 'none' && { backgroundColor: colors.border },
              ]}>
                <Ionicons
                  name={
                    approvalStatus === 'approved' ? 'checkmark-circle' :
                    approvalStatus === 'pending' ? 'time' :
                    approvalStatus === 'denied' ? 'close-circle' : 'help-circle'
                  }
                  size={24}
                  color="#fff"
                />
              </View>
              <View style={styles.approvalInfo}>
                <Text style={[styles.approvalTitle, { color: colors.text }]}>
                  {approvalStatus === 'approved' && 'Approved'}
                  {approvalStatus === 'pending' && 'Pending Approval'}
                  {approvalStatus === 'denied' && 'Access Denied'}
                  {approvalStatus === 'none' && 'Not Requested'}
                </Text>
                <Text style={[styles.approvalSubtitle, { color: colors.textSecondary }]}>
                  {approvalStatus === 'approved' && 'You can sync with the network'}
                  {approvalStatus === 'pending' && 'Waiting for main terminal to approve'}
                  {approvalStatus === 'denied' && 'Main terminal denied your request'}
                  {approvalStatus === 'none' && 'Join a network to request approval'}
                </Text>
              </View>
            </View>

            {approvalStatus === 'none' && merchantId && (
              <Pressable
                style={[styles.requestApprovalButton, { backgroundColor: colors.accent }]}
                onPress={handleRequestApproval}
              >
                <Text style={styles.requestApprovalText}>Request Approval</Text>
              </Pressable>
            )}

            {approvalStatus === 'denied' && (
              <Pressable
                style={[styles.requestApprovalButton, { backgroundColor: colors.accent }]}
                onPress={handleRequestApproval}
              >
                <Text style={styles.requestApprovalText}>Request Again</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Sync Status */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.statusHeader}>
            <View style={styles.statusIcon}>
              <Ionicons
                name={syncStatus.enabled ? 'cloud-done' : 'cloud-offline'}
                size={32}
                color={syncStatus.enabled ? colors.accent : colors.textSecondary}
              />
            </View>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusTitle, { color: colors.text }]}>
                {syncStatus.enabled ? 'Sync Active' : 'Sync Disabled'}
              </Text>
              <Text style={[styles.statusSubtitle, { color: colors.textSecondary }]}>
                Last sync: {formatLastSync(syncStatus.lastSync)}
              </Text>
            </View>
            <Switch
              value={syncStatus.enabled}
              onValueChange={handleToggleSync}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#fff"
              disabled={
                (terminalType === 'sub' && approvalStatus !== 'approved') ||
                (terminalType === 'sub' && syncStatus.enabled) // Sub-terminals can't disable sync
              }
            />
          </View>

          {terminalType === 'sub' && approvalStatus !== 'approved' && (
            <Text style={[styles.syncDisabledHint, { color: colors.textSecondary }]}>
              Sync requires approval from the main terminal
            </Text>
          )}

          {terminalType === 'sub' && syncStatus.enabled && (
            <Text style={[styles.syncDisabledHint, { color: colors.textSecondary }]}>
              Sync is locked for sub-terminals to ensure all transactions are recorded
            </Text>
          )}

          {syncStatus.enabled && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {syncStatus.pendingEvents}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Pending
                  </Text>
                </View>

                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {syncStatus.syncing ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      '✓'
                    )}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Status
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Pending Requests (Main Terminal Only) */}
        {terminalType === 'main' && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 0 }]}>
                Pending Requests
              </Text>
              {pendingRequests.length > 0 && (
                <View style={[styles.badge, { backgroundColor: '#f59e0b' }]}>
                  <Text style={styles.badgeText}>{pendingRequests.length}</Text>
                </View>
              )}
              <Pressable
                onPress={loadApprovalStatus}
                style={styles.refreshButton}
              >
                <Ionicons name="refresh" size={18} color={colors.accent} />
              </Pressable>
            </View>

            {pendingRequests.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No pending requests. When sub-terminals scan your QR code or enter your Network ID, their requests will appear here.
              </Text>
            ) : (
              pendingRequests.map((request) => (
                <View key={request.terminalId} style={[styles.deviceItem, { borderColor: colors.border }]}>
                  <View style={styles.deviceInfo}>
                    <Text style={[styles.deviceName, { color: colors.text }]}>
                      {request.terminalName}
                    </Text>
                    <Text style={[styles.deviceId, { color: colors.textSecondary }]}>
                      Requested {new Date(request.requestedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.deviceActions}>
                    <Pressable
                      style={[styles.deviceActionButton, { backgroundColor: colors.accent }]}
                      onPress={() => handleApproveDevice(request)}
                    >
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    </Pressable>
                    <Pressable
                      style={[styles.deviceActionButton, { backgroundColor: '#ef4444' }]}
                      onPress={() => handleDenyDevice(request)}
                    >
                      <Ionicons name="close" size={20} color="#fff" />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Approved Devices (Main Terminal Only) */}
        {terminalType === 'main' && approvedDevices.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Connected Devices</Text>

            {approvedDevices.map((device) => (
              <View key={device.terminalId} style={[styles.deviceItem, { borderColor: colors.border }]}>
                <View style={styles.deviceInfo}>
                  <View style={styles.deviceNameRow}>
                    <Text style={[styles.deviceName, { color: colors.text }]}>
                      {device.terminalName}
                    </Text>
                    {device.terminalType === 'main' && (
                      <View style={[styles.mainBadge, { backgroundColor: colors.accent }]}>
                        <Text style={styles.mainBadgeText}>Main</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.deviceId, { color: colors.textSecondary }]}>
                    {device.terminalId}
                  </Text>
                </View>
                {device.terminalType !== 'main' && (
                  <Pressable
                    style={styles.revokeButton}
                    onPress={() => handleRevokeDevice(device)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Terminal Identity */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>This Terminal</Text>

          <View style={styles.identityRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Store Name</Text>
            <Text style={[styles.value, { color: colors.text }]}>{merchantName || 'Not set'}</Text>
          </View>

          <View style={styles.identityRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Terminal ID</Text>
            <Text style={[styles.value, { color: colors.text }]}>{terminalId || 'Not set'}</Text>
          </View>

          <View style={styles.identityRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Terminal Type</Text>
            <Text style={[styles.value, { color: colors.text }]}>
              {terminalType === 'main' ? 'Main Terminal' : 'Sub-Terminal'}
            </Text>
          </View>

          {syncStatus.nostrPubkey && (
            <View style={styles.identityRow}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Nostr Pubkey</Text>
              <Text style={[styles.pubkey, { color: colors.textSecondary }]} numberOfLines={1}>
                {syncStatus.nostrPubkey.substring(0, 24)}...
              </Text>
            </View>
          )}
        </View>

        {/* Actions */}
        {syncStatus.enabled && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Actions</Text>

            <Pressable
              onPress={handleManualSync}
              style={[styles.actionButton, { backgroundColor: colors.accent }]}
              disabled={syncStatus.syncing}
            >
              {syncStatus.syncing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="sync" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Sync Now</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* Info */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>How It Works</Text>
          <View style={styles.infoItem}>
            <Ionicons name="share-outline" size={20} color={colors.accent} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              <Text style={{ fontWeight: '600', color: colors.text }}>Main terminal:</Text> Copy the Network ID and share it with your other devices
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="link-outline" size={20} color={colors.accent} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              <Text style={{ fontWeight: '600', color: colors.text }}>Other terminals:</Text> Tap "Join Existing Network" and paste the Network ID
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="cloud-outline" size={20} color={colors.accent} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              <Text style={{ fontWeight: '600', color: colors.text }}>Enable sync:</Text> Products and transactions will sync automatically via Nostr relays
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* QR Code Display Modal */}
      <Modal
        visible={showQRCode}
        animationType="fade"
        transparent
        onRequestClose={() => setShowQRCode(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Network QR Code</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Scan this code from another terminal to join your network
            </Text>

            <View style={styles.qrContainer}>
              {merchantId && (
                <QRCode
                  value={merchantId}
                  size={Math.min(screenWidth * 0.6, 250)}
                  backgroundColor="#fff"
                  color="#000"
                />
              )}
            </View>

            <Text style={[styles.networkIdSmall, { color: colors.textSecondary }]}>
              {merchantId}
            </Text>

            <Pressable
              style={[styles.modalCloseButton, { backgroundColor: colors.accent }]}
              onPress={() => setShowQRCode(false)}
            >
              <Text style={styles.modalCloseButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* QR Scanner Modal */}
      <Modal
        visible={showScanner}
        animationType="slide"
        onRequestClose={() => setShowScanner(false)}
      >
        <View style={[styles.scannerContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.scannerHeader, { backgroundColor: colors.surface }]}>
            <Pressable onPress={() => setShowScanner(false)} style={styles.scannerCloseButton}>
              <Ionicons name="close" size={28} color={colors.text} />
            </Pressable>
            <Text style={[styles.scannerTitle, { color: colors.text }]}>Scan Network QR Code</Text>
            <View style={{ width: 28 }} />
          </View>

          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          >
            <View style={styles.scannerOverlay}>
              <View style={styles.scannerFrame}>
                <View style={[styles.scannerCorner, styles.topLeft]} />
                <View style={[styles.scannerCorner, styles.topRight]} />
                <View style={[styles.scannerCorner, styles.bottomLeft]} />
                <View style={[styles.scannerCorner, styles.bottomRight]} />
              </View>
              <Text style={styles.scannerHint}>
                Point camera at the QR code on the main terminal
              </Text>
            </View>
          </CameraView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    padding: 12,
    paddingLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  networkIdSection: {
    marginBottom: 16,
  },
  networkIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  networkId: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  iconButton: {
    padding: 8,
  },
  joinButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  joinOptionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  joinOptionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  hint: {
    fontSize: 12,
    marginTop: 8,
  },
  joinSection: {
    marginTop: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  pasteButton: {
    padding: 12,
  },
  joinActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontWeight: '600',
  },
  joinButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  joinNetworkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 8,
  },
  joinNetworkButtonText: {
    fontWeight: '600',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    marginRight: 12,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 14,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
  },
  identityRow: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
  },
  pubkey: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
  },
  networkIdSmall: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 24,
  },
  modalCloseButton: {
    width: '100%',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  // Approval styles
  approvalStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  approvalBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  approvalInfo: {
    flex: 1,
  },
  approvalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  approvalSubtitle: {
    fontSize: 14,
  },
  requestApprovalButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  requestApprovalText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  syncDisabledHint: {
    fontSize: 13,
    marginTop: 12,
    fontStyle: 'italic',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  refreshButton: {
    marginLeft: 'auto',
    padding: 8,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  deviceId: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  mainBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mainBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  deviceActions: {
    flexDirection: 'row',
    gap: 8,
  },
  deviceActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  revokeButton: {
    padding: 8,
  },
  // Scanner styles
  scannerContainer: {
    flex: 1,
  },
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 60,
  },
  scannerCloseButton: {
    padding: 4,
  },
  scannerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  scannerCorner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#fff',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  scannerHint: {
    color: '#fff',
    fontSize: 14,
    marginTop: 32,
    textAlign: 'center',
    paddingHorizontal: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
