# Multi-Terminal Sync

## Overview

The multi-terminal sync system enables real-time data synchronization across multiple POS devices (tablets, phones) within a store. This ensures consistent product information, order visibility, and accurate inventory counts across all terminals.

## Architecture

### Sync Architecture Diagram

```
                    ┌─────────────────────────────────────────┐
                    │           SUPABASE CLOUD                 │
                    │  ┌─────────────────────────────────────┐ │
                    │  │         PostgreSQL                  │ │
                    │  │  ┌──────┐ ┌──────┐ ┌──────┐       │ │
                    │  │  │Orders│ │Products│ │Inventory│    │ │
                    │  │  └──────┘ └──────┘ └──────┘       │ │
                    │  └─────────────────────────────────────┘ │
                    │                    │                      │
                    │  ┌─────────────────┼─────────────────┐   │
                    │  │           Realtime                │   │
                    │  │     (WebSocket Channels)          │   │
                    │  └─────────────────┼─────────────────┘   │
                    └────────────────────┼─────────────────────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              │                          │                          │
              ▼                          ▼                          ▼
    ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
    │   Terminal 1    │        │   Terminal 2    │        │   Terminal 3    │
    │   (Counter)     │        │   (Floor)       │        │   (Kitchen)     │
    │                 │        │                 │        │                 │
    │  ┌───────────┐  │        │  ┌───────────┐  │        │  ┌───────────┐  │
    │  │ Zustand   │  │        │  │ Zustand   │  │        │  │ Zustand   │  │
    │  │  Store    │  │        │  │  Store    │  │        │  │  Store    │  │
    │  └───────────┘  │        │  └───────────┘  │        │  └───────────┘  │
    │                 │        │                 │        │                 │
    │  ┌───────────┐  │        │  ┌───────────┐  │        │  ┌───────────┐  │
    │  │ Offline   │  │        │  │ Offline   │  │        │  │ Offline   │  │
    │  │  Queue    │  │        │  │  Queue    │  │        │  │  Queue    │  │
    │  └───────────┘  │        │  └───────────┘  │        │  └───────────┘  │
    └─────────────────┘        └─────────────────┘        └─────────────────┘
```

## Supabase Realtime Setup

### Channel Configuration

```typescript
import { createClient, RealtimeChannel } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

interface SyncChannels {
  orders: RealtimeChannel;
  products: RealtimeChannel;
  inventory: RealtimeChannel;
  store: RealtimeChannel;
}

function initializeSyncChannels(storeId: string): SyncChannels {
  return {
    orders: supabase.channel(`orders:${storeId}`),
    products: supabase.channel(`products:${storeId}`),
    inventory: supabase.channel(`inventory:${storeId}`),
    store: supabase.channel(`store:${storeId}`),
  };
}
```

### Subscribing to Changes

```typescript
interface SyncOptions {
  storeId: string;
  terminalId: string;
  onOrderChange: (payload: OrderChangePayload) => void;
  onProductChange: (payload: ProductChangePayload) => void;
  onInventoryChange: (payload: InventoryChangePayload) => void;
  onConnectionChange: (status: ConnectionStatus) => void;
}

type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

function subscribeToStoreChanges(options: SyncOptions): () => void {
  const channels = initializeSyncChannels(options.storeId);

  // Orders subscription
  channels.orders
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `store_id=eq.${options.storeId}`,
      },
      (payload) => {
        options.onOrderChange({
          type: payload.eventType,
          old: payload.old as Order | null,
          new: payload.new as Order | null,
        });
      }
    )
    .subscribe((status) => {
      options.onConnectionChange(
        status === 'SUBSCRIBED' ? 'connected' : 'reconnecting'
      );
    });

  // Products subscription
  channels.products
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'products',
        filter: `store_id=eq.${options.storeId}`,
      },
      (payload) => {
        options.onProductChange({
          type: payload.eventType,
          old: payload.old as Product | null,
          new: payload.new as Product | null,
        });
      }
    )
    .subscribe();

  // Inventory subscription
  channels.inventory
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'inventory',
        filter: `store_id=eq.${options.storeId}`,
      },
      (payload) => {
        options.onInventoryChange({
          type: payload.eventType,
          old: payload.old as InventoryLevel | null,
          new: payload.new as InventoryLevel | null,
        });
      }
    )
    .subscribe();

  // Cleanup function
  return () => {
    channels.orders.unsubscribe();
    channels.products.unsubscribe();
    channels.inventory.unsubscribe();
    channels.store.unsubscribe();
  };
}
```

## Data Sync Strategies

### 1. Order Sync

Orders are the most critical data to sync in real-time.

```typescript
interface OrderSyncManager {
  // Called when local order is created
  publishOrder(order: Order): Promise<void>;

  // Called when remote order change is received
  handleRemoteOrderChange(payload: OrderChangePayload): void;

  // Get orders for display (kitchen, floor staff, etc.)
  getActiveOrders(): Order[];
}

class OrderSyncManagerImpl implements OrderSyncManager {
  private orderStore: OrderStore;

  async publishOrder(order: Order): Promise<void> {
    // Insert to Supabase - realtime will broadcast to other terminals
    const { error } = await supabase.from('orders').insert(order);

    if (error) {
      // Queue for retry if offline
      this.queueForSync('orders', 'insert', order);
      throw error;
    }
  }

  handleRemoteOrderChange(payload: OrderChangePayload): void {
    switch (payload.type) {
      case 'INSERT':
        // New order from another terminal
        this.orderStore.addOrder(payload.new!);
        this.notifyNewOrder(payload.new!);
        break;

      case 'UPDATE':
        // Order status changed
        this.orderStore.updateOrder(payload.new!);
        if (payload.new?.status === 'ready') {
          this.notifyOrderReady(payload.new);
        }
        break;

      case 'DELETE':
        // Order cancelled
        this.orderStore.removeOrder(payload.old!.id);
        break;
    }
  }

  private notifyNewOrder(order: Order): void {
    // Play sound, show notification
    if (this.isKitchenTerminal()) {
      playSound('new_order');
      showNotification(`New Order #${order.orderNumber}`);
    }
  }
}
```

### 2. Product Sync

Products sync less frequently but affect all terminals.

```typescript
interface ProductSyncStrategy {
  // Full sync on app start
  fullSync(): Promise<void>;

  // Handle incremental changes
  handleChange(payload: ProductChangePayload): void;

  // Check for updates periodically
  checkForUpdates(): Promise<boolean>;
}

async function fullProductSync(storeId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      category:categories(id, name),
      variants:product_variants(*),
      modifier_groups:product_modifier_groups(
        modifier_group:modifier_groups(
          *,
          modifiers(*)
        )
      )
    `)
    .eq('store_id', storeId)
    .eq('active', true)
    .order('sort_order');

  if (error) throw error;
  return data;
}
```

### 3. Inventory Sync

Inventory requires careful handling to prevent overselling.

```typescript
interface InventorySyncConfig {
  // How often to check for discrepancies
  reconciliationInterval: number; // ms

  // Threshold for alerting on discrepancy
  discrepancyThreshold: number;

  // Whether to block sales on out-of-stock
  blockOutOfStock: boolean;
}

class InventorySyncManager {
  private localInventory: Map<string, number> = new Map();
  private pendingAdjustments: InventoryAdjustment[] = [];

  handleRemoteInventoryChange(payload: InventoryChangePayload): void {
    if (!payload.new) return;

    const productId = payload.new.product_id;
    const newQuantity = payload.new.quantity;

    // Update local cache
    this.localInventory.set(productId, newQuantity);

    // Check if this affects any pending cart items
    this.validatePendingCarts(productId, newQuantity);

    // Update UI
    this.notifyInventoryChange(productId, newQuantity);
  }

  private validatePendingCarts(productId: string, available: number): void {
    // Check all open carts on this terminal
    const openCarts = this.getOpenCarts();

    for (const cart of openCarts) {
      const item = cart.items.find((i) => i.productId === productId);
      if (item && item.quantity > available) {
        // Alert the cashier
        this.showStockWarning(cart.id, productId, item.quantity, available);
      }
    }
  }
}
```

## Terminal Registration

### Terminal Data Model

```typescript
interface Terminal {
  id: string;
  storeId: string;
  name: string; // "Counter 1", "Floor Tablet", "Kitchen Display"
  type: 'pos' | 'kitchen' | 'customer_display' | 'self_service';

  // Device info
  deviceId: string; // Unique device identifier
  deviceName: string;
  platform: 'ios' | 'android' | 'web';

  // Status
  status: 'online' | 'offline' | 'maintenance';
  lastSeenAt: Date;

  // Configuration
  settings: TerminalSettings;

  createdAt: Date;
  updatedAt: Date;
}

interface TerminalSettings {
  // What this terminal can do
  capabilities: {
    takeOrders: boolean;
    processPayments: boolean;
    viewKitchenQueue: boolean;
    manageInventory: boolean;
    accessReports: boolean;
  };

  // Display preferences
  display: {
    showPrices: boolean;
    showInventory: boolean;
    fontSize: 'small' | 'medium' | 'large';
  };

  // Hardware
  hardware: {
    hasNfc: boolean;
    hasPrinter: boolean;
    printerAddress?: string;
  };
}
```

### Terminal Registration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    TERMINAL SETUP                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. SELECT STORE                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Coffee Corner                                    [✓]   │    │
│  │  Downtown Location                                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  2. TERMINAL TYPE                                                │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
│  │    POS     │  │  Kitchen   │  │   Floor    │                │
│  │  Terminal  │  │  Display   │  │  Service   │                │
│  │    [✓]     │  │    [ ]     │  │    [ ]     │                │
│  └────────────┘  └────────────┘  └────────────┘                │
│                                                                  │
│  3. TERMINAL NAME                                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Counter 1                                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  4. CAPABILITIES                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  [✓] Take Orders                                        │    │
│  │  [✓] Process Payments                                   │    │
│  │  [ ] View Kitchen Queue                                 │    │
│  │  [ ] Manage Inventory                                   │    │
│  │  [ ] Access Reports                                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 REGISTER TERMINAL                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Registration Implementation

```typescript
import * as Device from 'expo-device';
import * as Application from 'expo-application';

async function registerTerminal(config: {
  storeId: string;
  name: string;
  type: Terminal['type'];
  capabilities: TerminalSettings['capabilities'];
}): Promise<Terminal> {
  // Get unique device identifier
  const deviceId = await getDeviceId();

  // Check if this device is already registered
  const { data: existing } = await supabase
    .from('terminals')
    .select('*')
    .eq('device_id', deviceId)
    .eq('store_id', config.storeId)
    .single();

  if (existing) {
    // Update existing registration
    const { data, error } = await supabase
      .from('terminals')
      .update({
        name: config.name,
        type: config.type,
        settings: { capabilities: config.capabilities },
        status: 'online',
        last_seen_at: new Date(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Create new registration
  const { data, error } = await supabase
    .from('terminals')
    .insert({
      store_id: config.storeId,
      device_id: deviceId,
      device_name: Device.deviceName || 'Unknown Device',
      platform: Device.osName?.toLowerCase() as 'ios' | 'android',
      name: config.name,
      type: config.type,
      settings: { capabilities: config.capabilities },
      status: 'online',
      last_seen_at: new Date(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getDeviceId(): Promise<string> {
  // Try to get a persistent device ID
  const storedId = await AsyncStorage.getItem('device_id');
  if (storedId) return storedId;

  // Generate new ID if not exists
  const newId =
    Application.getAndroidId() ||
    (await Application.getIosIdForVendorAsync()) ||
    `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  await AsyncStorage.setItem('device_id', newId);
  return newId;
}
```

## Presence and Status

### Terminal Heartbeat

```typescript
class TerminalPresence {
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private terminalId: string;
  private storeId: string;

  constructor(terminalId: string, storeId: string) {
    this.terminalId = terminalId;
    this.storeId = storeId;
  }

  start(): void {
    // Send heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000);

    // Initial heartbeat
    this.sendHeartbeat();

    // Also use Supabase presence
    this.joinPresenceChannel();
  }

  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.leavePresenceChannel();
  }

  private async sendHeartbeat(): Promise<void> {
    await supabase
      .from('terminals')
      .update({
        status: 'online',
        last_seen_at: new Date(),
      })
      .eq('id', this.terminalId);
  }

  private joinPresenceChannel(): void {
    const channel = supabase.channel(`presence:${this.storeId}`);

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        this.onPresenceSync(state);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        this.onTerminalJoin(newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        this.onTerminalLeave(leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            terminal_id: this.terminalId,
            online_at: new Date().toISOString(),
          });
        }
      });
  }

  private onPresenceSync(state: Record<string, any[]>): void {
    // Update store with all online terminals
    const onlineTerminals = Object.values(state).flat();
    terminalStore.setOnlineTerminals(onlineTerminals);
  }

  private onTerminalJoin(presences: any[]): void {
    // Another terminal came online
    for (const presence of presences) {
      console.log(`Terminal ${presence.terminal_id} is now online`);
    }
  }

  private onTerminalLeave(presences: any[]): void {
    // A terminal went offline
    for (const presence of presences) {
      console.log(`Terminal ${presence.terminal_id} went offline`);
    }
  }
}
```

### Online Terminals Display

```
┌─────────────────────────────────────────────────────────────────┐
│                    STORE STATUS                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ONLINE TERMINALS (3)                                           │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ● Counter 1              POS         Online 2h 15m    │    │
│  │    iPad Pro 12.9 • Taking orders                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ● Counter 2              POS         Online 45m       │    │
│  │    iPad Air • Processing payment                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ● Kitchen Display        Kitchen     Online 2h 15m    │    │
│  │    Android Tablet • 3 orders in queue                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  OFFLINE TERMINALS (1)                                          │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ○ Floor Tablet           Floor       Offline 3h 20m   │    │
│  │    Last seen: 10:45 AM                                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Offline Support

### Offline Queue

```typescript
interface QueuedOperation {
  id: string;
  timestamp: Date;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
}

class OfflineQueue {
  private queue: QueuedOperation[] = [];
  private storage: AsyncStorage;
  private isOnline: boolean = true;

  async enqueue(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount' | 'status'>): Promise<void> {
    const queuedOp: QueuedOperation = {
      ...operation,
      id: generateId(),
      timestamp: new Date(),
      retryCount: 0,
      status: 'pending',
    };

    this.queue.push(queuedOp);
    await this.persistQueue();

    // Try to sync immediately if online
    if (this.isOnline) {
      this.processQueue();
    }
  }

  async processQueue(): Promise<void> {
    const pending = this.queue.filter((op) => op.status === 'pending');

    for (const operation of pending) {
      try {
        operation.status = 'syncing';
        await this.executeOperation(operation);

        // Remove from queue on success
        this.queue = this.queue.filter((op) => op.id !== operation.id);
      } catch (error) {
        operation.status = 'pending';
        operation.retryCount++;

        if (operation.retryCount >= 5) {
          operation.status = 'failed';
          this.notifyFailure(operation);
        }
      }
    }

    await this.persistQueue();
  }

  private async executeOperation(operation: QueuedOperation): Promise<void> {
    switch (operation.operation) {
      case 'insert':
        await supabase.from(operation.table).insert(operation.data);
        break;
      case 'update':
        await supabase.from(operation.table).update(operation.data).eq('id', operation.data.id);
        break;
      case 'delete':
        await supabase.from(operation.table).delete().eq('id', operation.data.id);
        break;
    }
  }

  setOnlineStatus(online: boolean): void {
    const wasOffline = !this.isOnline;
    this.isOnline = online;

    if (wasOffline && online) {
      // Coming back online - process queue
      this.processQueue();
    }
  }
}
```

### Network Status Monitoring

```typescript
import NetInfo from '@react-native-community/netinfo';

function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const [connectionType, setConnectionType] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? false);
      setConnectionType(state.type);

      // Update offline queue
      offlineQueue.setOnlineStatus(state.isConnected ?? false);

      // Update terminal status
      if (state.isConnected) {
        terminalPresence.sendHeartbeat();
      }
    });

    return () => unsubscribe();
  }, []);

  return { isConnected, connectionType };
}
```

### Offline Indicator UI

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ OFFLINE MODE                                          [X]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  You are currently offline. Orders will be saved locally        │
│  and synced when connection is restored.                        │
│                                                                  │
│  Pending operations: 3                                          │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  • Order #240115-0089 (pending sync)                    │    │
│  │  • Inventory adjustment (pending sync)                  │    │
│  │  • Customer update (pending sync)                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Last synced: 2 minutes ago                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Conflict Resolution

### Order Conflicts

```typescript
interface ConflictResolution {
  strategy: 'last_write_wins' | 'merge' | 'manual';
  onConflict: (local: any, remote: any) => Promise<any>;
}

const orderConflictResolution: ConflictResolution = {
  strategy: 'last_write_wins',
  onConflict: async (local: Order, remote: Order) => {
    // For orders, the most recent update wins
    if (new Date(local.updatedAt) > new Date(remote.updatedAt)) {
      return local;
    }
    return remote;
  },
};

const inventoryConflictResolution: ConflictResolution = {
  strategy: 'merge',
  onConflict: async (local: InventoryLevel, remote: InventoryLevel) => {
    // For inventory, we need to be more careful
    // Calculate the delta that was applied locally
    const localDelta = local.quantity - (local._originalQuantity || remote.quantity);

    // Apply our delta to the remote value
    return {
      ...remote,
      quantity: remote.quantity + localDelta,
    };
  },
};
```

### Conflict UI

```
┌─────────────────────────────────────────────────────────────────┐
│                    SYNC CONFLICT                          [X]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Order #240115-0089 was modified on another terminal            │
│                                                                  │
│  YOUR VERSION                    OTHER VERSION                  │
│  ┌─────────────────────┐        ┌─────────────────────┐        │
│  │ Status: Completed   │        │ Status: Preparing   │        │
│  │ Total: $45.00       │        │ Total: $42.00       │        │
│  │ Items: 4            │        │ Items: 3            │        │
│  └─────────────────────┘        └─────────────────────┘        │
│                                                                  │
│  ┌────────────────────────┐  ┌────────────────────────┐        │
│  │   KEEP MINE           │  │   USE OTHER            │        │
│  └────────────────────────┘  └────────────────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Kitchen Display System

### Kitchen Queue Sync

```typescript
interface KitchenOrder {
  orderId: string;
  orderNumber: string;
  items: KitchenOrderItem[];
  priority: 'normal' | 'rush';
  status: 'new' | 'preparing' | 'ready';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  assignedTo?: string;
}

interface KitchenOrderItem {
  name: string;
  quantity: number;
  modifiers: string[];
  notes?: string;
  status: 'pending' | 'preparing' | 'done';
}

function subscribeToKitchenQueue(
  storeId: string,
  onUpdate: (orders: KitchenOrder[]) => void
): () => void {
  const channel = supabase.channel(`kitchen:${storeId}`);

  channel
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `store_id=eq.${storeId}`,
      },
      async () => {
        // Fetch updated kitchen queue
        const orders = await fetchKitchenQueue(storeId);
        onUpdate(orders);
      }
    )
    .subscribe();

  return () => channel.unsubscribe();
}

async function fetchKitchenQueue(storeId: string): Promise<KitchenOrder[]> {
  const { data } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      status,
      priority,
      created_at,
      items:order_items(
        product:products(name),
        quantity,
        modifiers:order_item_modifiers(
          modifier:modifiers(name)
        ),
        notes
      )
    `)
    .eq('store_id', storeId)
    .in('status', ['pending', 'preparing'])
    .order('created_at', { ascending: true });

  return data || [];
}
```

### Kitchen Display UI

```
┌─────────────────────────────────────────────────────────────────┐
│  KITCHEN DISPLAY                              [3 NEW]  [5 PREP] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────│
│  │  #0089            │  │  #0088            │  │  #0087        │
│  │  ⏱ 2:30          │  │  ⏱ 5:15          │  │  ⏱ 8:00       │
│  │  ─────────────────│  │  ─────────────────│  │  ─────────────│
│  │                   │  │                   │  │               │
│  │  2x Cappuccino    │  │  1x Latte         │  │  3x Espresso  │
│  │    - Extra shot   │  │    - Oat milk     │  │               │
│  │                   │  │    - No sugar     │  │  1x Croissant │
│  │  1x Croissant     │  │                   │  │               │
│  │                   │  │  2x Blueberry     │  │  Notes:       │
│  │  Notes:           │  │     Muffin        │  │  "Rush order" │
│  │  "For here"       │  │                   │  │               │
│  │                   │  │                   │  │               │
│  │  ─────────────────│  │  ─────────────────│  │  ─────────────│
│  │  [START]          │  │  [DONE]           │  │  [DONE]       │
│  │                   │  │                   │  │               │
│  │  🔴 NEW           │  │  🟡 PREPARING     │  │  🟡 PREPARING │
│  └───────────────────┘  └───────────────────┘  └───────────────│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Broadcast Messages

### Store-Wide Announcements

```typescript
interface BroadcastMessage {
  id: string;
  storeId: string;
  type: 'announcement' | 'alert' | 'price_change' | 'low_stock';
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  sentBy: string;
  sentAt: Date;
  expiresAt?: Date;
  acknowledgedBy: string[];
}

function broadcastToStore(
  storeId: string,
  message: Omit<BroadcastMessage, 'id' | 'sentAt' | 'acknowledgedBy'>
): void {
  const channel = supabase.channel(`broadcast:${storeId}`);

  channel.send({
    type: 'broadcast',
    event: 'message',
    payload: {
      ...message,
      id: generateId(),
      sentAt: new Date(),
    },
  });
}

function subscribeTobroadcasts(
  storeId: string,
  onMessage: (message: BroadcastMessage) => void
): () => void {
  const channel = supabase.channel(`broadcast:${storeId}`);

  channel
    .on('broadcast', { event: 'message' }, ({ payload }) => {
      onMessage(payload as BroadcastMessage);
    })
    .subscribe();

  return () => channel.unsubscribe();
}
```

### Broadcast Examples

```typescript
// Price change alert
broadcastToStore(storeId, {
  type: 'price_change',
  title: 'Price Update',
  message: 'Cappuccino price changed from $4.50 to $4.75',
  priority: 'normal',
  sentBy: staffId,
});

// Low stock alert
broadcastToStore(storeId, {
  type: 'low_stock',
  title: 'Low Stock Alert',
  message: 'Croissants are running low (3 remaining)',
  priority: 'high',
  sentBy: 'system',
});

// Urgent announcement
broadcastToStore(storeId, {
  type: 'announcement',
  title: '86 Item',
  message: 'Blueberry Muffin is sold out for today',
  priority: 'urgent',
  sentBy: staffId,
});
```

## Performance Optimization

### Selective Sync

```typescript
interface SyncConfig {
  // Which data to sync in real-time
  realtime: {
    orders: boolean;
    inventory: boolean;
    products: boolean;
  };

  // Which data to sync periodically
  periodic: {
    customers: number; // interval in ms
    reports: number;
  };

  // Which data to sync on demand only
  onDemand: string[];
}

const defaultSyncConfig: SyncConfig = {
  realtime: {
    orders: true,
    inventory: true,
    products: true,
  },
  periodic: {
    customers: 300000, // 5 minutes
    reports: 600000, // 10 minutes
  },
  onDemand: ['staff', 'settings', 'audit_log'],
};
```

### Debouncing Updates

```typescript
import { debounce } from 'lodash';

// Debounce inventory updates to prevent UI flickering
const debouncedInventoryUpdate = debounce((productId: string, quantity: number) => {
  inventoryStore.setQuantity(productId, quantity);
}, 100);

// Batch multiple rapid changes
function handleInventoryChanges(changes: InventoryChangePayload[]): void {
  const batched = new Map<string, number>();

  for (const change of changes) {
    if (change.new) {
      batched.set(change.new.product_id, change.new.quantity);
    }
  }

  // Apply all changes at once
  batched.forEach((quantity, productId) => {
    debouncedInventoryUpdate(productId, quantity);
  });
}
```

## Security Considerations

1. **Channel Authentication** - Use RLS to ensure terminals only receive their store's data
2. **Terminal Verification** - Validate terminal ID on each connection
3. **Rate Limiting** - Limit broadcast message frequency
4. **Data Encryption** - All data encrypted in transit (TLS) and at rest
5. **Audit Trail** - Log all sync operations for troubleshooting

## Next Steps

1. Implement terminal registration flow
2. Set up Supabase Realtime channels
3. Build offline queue system
4. Create kitchen display screen
5. Add presence indicators
6. Implement broadcast messaging
