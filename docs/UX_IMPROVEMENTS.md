# Payment UX Improvements - Design Documentation

## Design Principles

### Core Philosophy
Make Cashu payments feel like **magic** - instant, clear, and delightful. Every interaction should communicate trust and progress.

### Key Principles
1. **Immediate Feedback** - User always knows what's happening
2. **Progressive Disclosure** - Show complexity only when needed
3. **Graceful Degradation** - Clear paths when things go wrong
4. **Visual Hierarchy** - Important info is unmissable
5. **Delight in Details** - Subtle animations and polish

---

## 1. Payment State Clarity

### Problem
Current states (`waiting_for_tap` → `validating` → `processing`) use the same visual treatment:
- Pulsing NFC circle animation runs continuously
- No visual distinction between "ready" vs "working"
- Users can't tell if the tap was detected

### Solution: State-Specific Visual Language

#### Visual States Design

**A. Waiting for Tap** (Idle State)
```
Visual Treatment:
- Pulsing NFC circle (current animation, keep it)
- Blue/purple gradient background on circle
- Text: "Tap to Pay" (primary) + "Hold customer's device near terminal" (secondary)
- Opacity: 100%
- Border: None
```

**B. Validating** (Processing State)
```
Visual Treatment:
- Stop pulsing animation immediately
- Add rotating border spinner around circle (360° rotation, 1s duration)
- Change circle background to solid blue
- NFC icon slightly smaller (scale: 0.9)
- Text: "Reading Token..." (primary) + "Verifying payment details" (secondary)
- Haptic: Light impact on transition
```

**C. Processing** (Swap State)
```
Visual Treatment:
- Replace NFC icon with animated checkmark → arrows → checkmark sequence
- Circle background changes to amber/yellow
- Border spinner continues but slower (1.5s duration)
- Text: "Processing Payment..." (primary) + "Exchanging tokens securely" (secondary)
- Progress indicator: "Step 2 of 2" badge
```

**D. Success** (Complete State)
```
Visual Treatment:
- Stop all animations
- Circle background: Green gradient
- Large checkmark icon (scale spring animation)
- No border spinner
- Text: "Payment Received!" (primary)
- Auto-advance to result screen after 800ms
- Haptic: Success pattern
```

**E. Error** (Failed State)
```
Visual Treatment:
- Stop all animations
- Circle background: Red gradient
- X icon (scale spring animation)
- Pulsing red glow effect
- Text: Specific error message (see Error Handling section)
- Show "Try Again" and "Cancel" buttons
- Haptic: Error pattern
```

#### Animation Specifications

```typescript
// Pulsing NFC (Waiting state)
scale: 1.0 → 1.1 → 1.0 (2s loop, easeInOut)

// Border Spinner (Validating/Processing)
rotation: 0° → 360° (linear timing)
strokeWidth: 3px
colors: Blue gradient (#3B82F6 → #8B5CF6)

// Success/Error Icon Spring
scale: 0 → 1.2 → 1.0
config: { tension: 100, friction: 5 }

// State Transition
opacity: crossfade 200ms
scale: smooth 150ms
```

#### Color Palette

```typescript
States = {
  waiting: {
    background: ['#3B82F6', '#8B5CF6'], // Blue to purple gradient
    text: '#FFFFFF',
    icon: '#FFFFFF'
  },
  validating: {
    background: '#3B82F6', // Solid blue
    border: ['#3B82F6', '#8B5CF6'],
    text: '#FFFFFF',
    icon: '#FFFFFF'
  },
  processing: {
    background: '#F59E0B', // Amber
    border: ['#F59E0B', '#FBBF24'],
    text: '#FFFFFF',
    icon: '#FFFFFF'
  },
  success: {
    background: ['#10B981', '#34D399'], // Green gradient
    text: '#FFFFFF',
    icon: '#FFFFFF'
  },
  error: {
    background: ['#EF4444', '#F87171'], // Red gradient
    text: '#FFFFFF',
    icon: '#FFFFFF',
    glow: '#EF4444'
  }
}
```

---

## 2. Enhanced Error Handling

### Problem
Generic error messages don't help users understand or fix issues:
- "Failed to process payment token"
- No indication of NFC disabled, network issues, or wrong mint
- No actionable guidance

### Solution: Contextual Error Messages with Recovery Paths

#### Error Categories & Messages

**A. NFC Hardware Errors**
```typescript
Errors = {
  nfc_disabled: {
    title: "NFC is Disabled",
    message: "Please enable NFC in your device settings to accept tap payments.",
    icon: "nfc-off",
    actions: ["Open Settings", "Use QR Code Instead", "Cancel"],
    recovery: "fallback_qr"
  },
  nfc_not_supported: {
    title: "NFC Not Available",
    message: "This device doesn't support NFC. Use QR code scanning instead.",
    icon: "device",
    actions: ["Use QR Code", "Cancel"],
    recovery: "force_qr"
  },
  nfc_read_error: {
    title: "Couldn't Read Tag",
    message: "Please hold the device steady and try again.",
    icon: "nfc-error",
    actions: ["Try Again", "Use QR Code", "Cancel"],
    recovery: "retry_or_qr"
  }
}
```

**B. Token Validation Errors**
```typescript
Errors = {
  invalid_token_format: {
    title: "Invalid Payment Token",
    message: "The scanned token is not a valid Cashu token. Please check and try again.",
    icon: "alert",
    actions: ["Scan Again", "Cancel"],
    recovery: "retry"
  },
  wrong_mint: {
    title: "Incompatible Token",
    message: "This token is from a different mint. We accept tokens from: [mint_url]",
    icon: "link-off",
    actions: ["Try Different Token", "Cancel"],
    recovery: "retry",
    technical: "Expected mint: [expected], Got: [received]"
  },
  insufficient_amount: {
    title: "Insufficient Amount",
    message: "Token amount ([received_sats] sats) is less than required ([required_sats] sats).",
    icon: "currency",
    actions: ["Request Correct Amount", "Cancel"],
    recovery: "restart",
    showAmountDiff: true
  },
  token_already_spent: {
    title: "Token Already Used",
    message: "This token has already been spent. Each token can only be used once.",
    icon: "check-circle",
    actions: ["Use Different Token", "Cancel"],
    recovery: "retry"
  }
}
```

**C. Network Errors**
```typescript
Errors = {
  network_timeout: {
    title: "Connection Timeout",
    message: "Couldn't reach the mint server. Check your internet connection.",
    icon: "wifi-off",
    actions: ["Try Again", "Cancel"],
    recovery: "retry",
    technical: "Mint: [mint_url], Timeout: 30s"
  },
  mint_unavailable: {
    title: "Mint Server Unavailable",
    message: "The mint server is temporarily unavailable. Please try again in a moment.",
    icon: "server",
    actions: ["Try Again", "Cancel"],
    recovery: "retry",
    retryDelay: 3000
  },
  swap_failed: {
    title: "Token Swap Failed",
    message: "Couldn't exchange tokens with the mint. Your payment was not processed.",
    icon: "refresh",
    actions: ["Try Again", "Contact Support", "Cancel"],
    recovery: "retry"
  }
}
```

**D. Business Logic Errors**
```typescript
Errors = {
  exchange_rate_changed: {
    title: "Price Changed",
    message: "Exchange rate updated during payment. New amount: [new_amount] sats (was [old_amount] sats).",
    icon: "trending",
    actions: ["Accept New Price", "Cancel"],
    recovery: "confirm_new_rate",
    showRateChange: true
  },
  forwarding_failed: {
    title: "Payment Received (Sync Pending)",
    message: "Payment accepted but couldn't sync to main terminal. Will retry automatically.",
    icon: "sync",
    actions: ["Continue"],
    recovery: "accept_partial",
    severity: "warning" // Not a failure
  }
}
```

#### Error UI Design

**Visual Layout**
```
┌─────────────────────────────────┐
│  [Icon in colored circle]       │
│                                  │
│  Error Title (large, bold)       │
│  Error message (body text)       │
│                                  │
│  [Optional: Amount difference]   │
│  [Optional: Technical details]   │
│                                  │
│  ┌──────────┐  ┌──────────┐    │
│  │ Primary  │  │Secondary │    │
│  └──────────┘  └──────────┘    │
│                                  │
│  [Collapse/Expand technical]     │
└─────────────────────────────────┘
```

**Color Coding**
- Error (critical): Red (#EF4444)
- Warning (non-critical): Amber (#F59E0B)
- Info (FYI): Blue (#3B82F6)

**Interaction Patterns**
- Primary action (right): Most common recovery (e.g., "Try Again")
- Secondary action (left): Alternative (e.g., "Use QR Code")
- Tertiary action (text link): Advanced (e.g., "Show Technical Details")

#### Implementation Requirements

1. **Error Toast for Minor Issues**
   - Network blips that auto-recover
   - Non-blocking warnings
   - 3-second auto-dismiss

2. **Error Modal for Critical Issues**
   - Blocks payment flow
   - Requires user action
   - Logs error details for debugging

3. **Error Logging**
   ```typescript
   logPaymentError({
     errorCode: 'nfc_read_error',
     timestamp: Date.now(),
     context: {
       paymentId: payment.id,
       amount: payment.satsAmount,
       state: payment.state
     },
     recovery: 'retry_or_qr',
     userAction: 'selected_qr_fallback'
   });
   ```

---

## 3. Overpayment Change Return Flow

### Problem
- When customer sends more sats than required, difference is tracked but no UI exists
- No way to return change to customer as a Cashu token
- Customer loses overpayment or it's treated as a tip (unclear)

### Solution: Automatic Change Detection + QR Return

#### Flow Design

**Scenario: Customer overpays by 1000 sats**

1. **Detection Phase**
   ```
   Payment received: 10,000 sats
   Amount required: 9,000 sats
   Overpayment: 1,000 sats (11%)
   ```

2. **Threshold Logic**
   ```typescript
   if (overpayment < 100 sats || overpayment < amount * 0.05) {
     // < 100 sats or < 5%: Auto-add as tip
     showToast("Extra sats added as tip. Thanks!");
   } else if (overpayment >= 100 sats && overpayment < amount * 0.20) {
     // 100+ sats and < 20%: Ask user
     showOverpaymentDialog({
       amount: overpayment,
       options: ['Add as Tip', 'Return as Change']
     });
   } else {
     // ≥ 20% overpayment: Auto-offer change return
     showChangeReturnScreen({
       amount: overpayment,
       autoSelected: 'return_change'
     });
   }
   ```

3. **Change Return Screen**
   ```
   Visual Layout:
   ┌─────────────────────────────────┐
   │  Payment Complete! ✓            │
   │                                  │
   │  Paid: 10,000 sats               │
   │  Required: 9,000 sats            │
   │  ─────────────────               │
   │  Change: 1,000 sats              │
   │                                  │
   │  How would you like the change?  │
   │                                  │
   │  ○ Return to Customer            │
   │     Cashu token QR code          │
   │                                  │
   │  ○ Add as Tip                    │
   │     Keep extra sats              │
   │                                  │
   │  [Continue]                      │
   └─────────────────────────────────┘
   ```

4. **Change Token Generation**
   - Mint new Cashu token for exact overpayment amount
   - Use mint that customer originally paid from (if possible)
   - Generate QR code
   - Show scannable QR with instructions

5. **Change QR Display**
   ```
   Visual Layout:
   ┌─────────────────────────────────┐
   │  Scan to Receive Change          │
   │                                  │
   │  ┌─────────────────────┐        │
   │  │                     │        │
   │  │   [QR Code]         │        │
   │  │   300x300px         │        │
   │  │                     │        │
   │  └─────────────────────┘        │
   │                                  │
   │  Amount: 1,000 sats              │
   │  ≈ $0.85                         │
   │                                  │
   │  Customer: Scan with Cashu       │
   │  wallet to receive change        │
   │                                  │
   │  [Copy Token] [Done]             │
   └─────────────────────────────────┘
   ```

#### Animation Sequence

```typescript
// On overpayment detection
1. Show payment success (500ms)
2. Slide in "Change Detected" badge from top (300ms)
3. Expand to change options screen (400ms, spring)
4. Haptic: Light impact

// On "Return to Customer" selected
1. Fade out options (200ms)
2. Show "Generating change token..." spinner (800ms avg)
3. Fade in QR code with scale spring (400ms)
4. Pulse QR code gently (once, 600ms)
5. Haptic: Success pattern
```

#### Edge Cases

**A. Change token generation fails**
```
Fallback:
1. Show error: "Couldn't generate change token"
2. Offer: "Add as Tip instead" or "Show token text"
3. If token text: Display raw Cashu token string for manual copy
```

**B. Customer leaves before scanning**
```
Solution:
1. Save change token to transaction record
2. Allow merchant to print receipt with QR code later
3. Add "Unclaimed Change" section in transaction history
```

**C. Multiple overpayments (rare)**
```
Example: Customer taps twice accidentally
1. Detect duplicate payment within 10 seconds
2. Auto-refund second payment entirely
3. Show: "Duplicate payment refunded automatically"
```

---

## 4. Exchange Rate Locking

### Problem
- Rate refreshes every 30 seconds on amount screen
- If rate changes between entering amount and completing payment:
  - Customer expects different sat amount
  - Merchant may undercharge or overcharge
  - No confirmation or rate lock mechanism

### Solution: Rate Lock with Expiry + Confirmation

#### Flow Design

**1. Rate Lock at Checkout**
```typescript
When user taps "Continue" on amount screen:
1. Lock current exchange rate
2. Set expiry timestamp (5 minutes from now)
3. Pass locked rate + expiry to payment screen
4. Display locked rate with countdown

LockedRate = {
  rate: 91234.56, // Sats per USD
  currency: 'USD',
  lockedAt: 1703001234567,
  expiresAt: 1703001534567, // +5 minutes
  source: 'coingecko'
}
```

**2. Payment Screen Display**
```
Visual Layout:
┌─────────────────────────────────┐
│  $10.00                          │
│  912 sats @ $91,235/BTC          │
│  🔒 Rate locked • 4:32 remaining │
│                                  │
│  [NFC tap area]                  │
└─────────────────────────────────┘

Components:
- Lock icon (🔒) indicates rate is fixed
- Countdown timer (MM:SS format)
- Small text showing rate source
```

**3. Rate Expiry Handling**

**Approach A: Hard Expiry (Recommended)**
```
When timer reaches 0:00:
1. Disable payment methods
2. Show overlay: "Rate Expired"
3. Message: "Exchange rate has expired. Please restart payment with current rate."
4. Actions: ["Get New Rate"] → Returns to amount screen
5. Haptic: Warning pattern
```

**Approach B: Soft Expiry (Alternative)**
```
When timer reaches 0:00:
1. Keep payment methods active
2. Show warning banner: "Rate expired - using current rate"
3. Update displayed sat amount with new rate
4. Highlight amount change in yellow
5. Require explicit confirmation: "Confirm new amount: [new_sats] sats"
```

**Choose: Hard Expiry** (cleaner UX, prevents confusion)

**4. Rate Change During Payment**
```
If locked rate differs significantly from current rate (>2% difference):

Warning Display:
┌─────────────────────────────────┐
│  ⚠️ Rate Changed                 │
│                                  │
│  Locked rate: 912 sats           │
│  Current rate: 935 sats (+2.5%)  │
│                                  │
│  Your locked rate is still valid │
│  for 3:45                        │
│                                  │
│  [Continue with Locked Rate]     │
│  [Update to Current Rate]        │
└─────────────────────────────────┘
```

#### Visual Design

**Rate Lock Badge**
```
Appearance:
- Small pill-shaped badge
- Lock icon + countdown
- Background: Dark semi-transparent (#00000040)
- Text: White, monospace for timer
- Border: 1px solid white (20% opacity)
- Position: Below amount display

States:
- Active (>60s remaining): Green accent (#10B981)
- Warning (10-60s): Amber accent (#F59E0B)
- Critical (<10s): Red accent + pulsing (#EF4444)
```

**Countdown Timer Animation**
```typescript
// Update every second
useEffect(() => {
  const interval = setInterval(() => {
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      handleRateExpiry();
    } else {
      setTimeRemaining(remaining);
    }
  }, 1000);
  return () => clearInterval(interval);
}, [expiresAt]);

// Visual urgency
if (remaining < 10000) {
  // Pulse red background
  pulseAnimation.start();
  // Haptic every second for last 5 seconds
  if (remaining < 5000) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}
```

#### Implementation Details

**1. Rate Lock Storage**
```typescript
// Add to payment store
payment: {
  ...existingFields,
  lockedRate?: {
    rate: number;
    currency: string;
    lockedAt: number;
    expiresAt: number;
    source: string;
  }
}
```

**2. POS Checkout Integration**
```typescript
// When "Charge" button is pressed in checkout.tsx:
const lockedRate = {
  rate: currentExchangeRate,
  currency: config.fiatCurrency,
  lockedAt: Date.now(),
  expiresAt: Date.now() + 5 * 60 * 1000, // 5 min
  source: 'coingecko'
};

navigation.navigate('payment', {
  ...paymentParams,
  lockedRate
});
```

**3. Amount Screen Integration**
```typescript
// When "Continue" pressed in amount.tsx:
if (!exchangeRate) {
  showError('Exchange rate not available');
  return;
}

const lockedRate = {
  rate: exchangeRate,
  currency: selectedCurrency,
  lockedAt: Date.now(),
  expiresAt: Date.now() + 5 * 60 * 1000,
  source: rateSource
};

navigation.navigate('payment', {
  satsAmount: calculatedSats,
  fiatAmount: enteredAmount,
  lockedRate
});
```

**4. Payment Validation**
```typescript
// In payment.tsx, validate received amount against locked rate
function validatePaymentAmount(receivedSats: number): ValidationResult {
  if (!lockedRate) {
    return { valid: true }; // No rate lock, accept any amount
  }

  const now = Date.now();
  if (now > lockedRate.expiresAt) {
    return {
      valid: false,
      error: 'rate_expired',
      message: 'Exchange rate has expired'
    };
  }

  const expectedSats = Math.ceil(
    (fiatAmount / lockedRate.rate) * 100000000
  );

  const tolerance = expectedSats * 0.01; // 1% tolerance
  const diff = Math.abs(receivedSats - expectedSats);

  if (diff > tolerance) {
    return {
      valid: false,
      error: 'amount_mismatch',
      message: `Expected ${expectedSats} sats, received ${receivedSats} sats`,
      expectedSats,
      receivedSats
    };
  }

  return { valid: true };
}
```

---

## Visual Design System

### Typography Scale
```typescript
Font Sizes:
- Heading 1: 32px (Payment amounts)
- Heading 2: 24px (Screen titles)
- Heading 3: 20px (Section headers)
- Body Large: 18px (Primary text)
- Body: 16px (Default text)
- Body Small: 14px (Secondary text)
- Caption: 12px (Hints, labels)

Font Weights:
- Bold: 700 (Amounts, titles)
- Semibold: 600 (Buttons, emphasis)
- Medium: 500 (Body text)
- Regular: 400 (Secondary text)

Line Heights:
- Headings: 1.2
- Body: 1.5
- Captions: 1.4
```

### Spacing System
```typescript
Spacing Scale (8px base):
- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px
- 2xl: 48px
- 3xl: 64px

Screen Padding: 16px (md)
Section Spacing: 24px (lg)
Element Spacing: 8px (sm)
```

### Animation Timing
```typescript
Durations:
- Instant: 100ms (hover states)
- Quick: 200ms (fades, slides)
- Normal: 300ms (modals, drawers)
- Slow: 400ms (page transitions)
- Emphasis: 600ms (success celebrations)

Easing:
- Standard: cubic-bezier(0.4, 0.0, 0.2, 1)
- Decelerate: cubic-bezier(0.0, 0.0, 0.2, 1)
- Accelerate: cubic-bezier(0.4, 0.0, 1, 1)
- Spring: { tension: 100, friction: 5 }
```

### Border Radius
```typescript
Radius:
- sm: 4px (badges, tags)
- md: 8px (buttons, inputs)
- lg: 12px (cards)
- xl: 16px (modals)
- full: 9999px (pills, circles)
```

### Shadow Elevations
```typescript
Shadows:
- sm: 0 1px 2px rgba(0,0,0,0.05)
- md: 0 4px 6px rgba(0,0,0,0.1)
- lg: 0 10px 15px rgba(0,0,0,0.1)
- xl: 0 20px 25px rgba(0,0,0,0.15)
```

---

## Accessibility Considerations

### Touch Targets
- Minimum: 44x44px (iOS HIG, Android Material)
- Preferred: 48x48px for primary actions
- Spacing: 8px minimum between adjacent targets

### Color Contrast
- Text on background: 4.5:1 (WCAG AA)
- Large text on background: 3:1
- Error states: 7:1 (higher contrast for urgency)

### Haptic Feedback Guidelines
```typescript
HapticPatterns = {
  tap: 'Light', // Keypress, minor interactions
  success: 'Success', // Payment complete
  warning: 'Warning', // Rate expiry soon
  error: 'Error', // Payment failed
  heavy: 'Heavy' // Major state changes
}
```

### Motion Sensitivity
- Provide option to reduce animations in settings
- Respect system "Reduce Motion" preference
- Essential feedback (success/error) should work without animation

---

## Testing Checklist

### State Transitions
- [ ] Waiting → Validating transition is smooth
- [ ] Validating → Processing shows progress
- [ ] Processing → Success has celebration moment
- [ ] Processing → Error is immediate and clear
- [ ] All animations can be interrupted safely

### Error Scenarios
- [ ] NFC disabled shows correct message and fallback
- [ ] Network timeout has retry mechanism
- [ ] Wrong mint shows expected vs received mints
- [ ] Insufficient amount shows difference clearly
- [ ] Token already spent doesn't allow retry

### Overpayment Flow
- [ ] Small overpayment (<100 sats) adds as tip automatically
- [ ] Medium overpayment shows dialog with choices
- [ ] Large overpayment (>20%) auto-offers change
- [ ] Change QR generates correctly
- [ ] Change token is scannable by Cashu wallets
- [ ] Failed change generation falls back gracefully

### Rate Locking
- [ ] Rate locks when entering payment screen
- [ ] Countdown updates every second
- [ ] Expiry at 0:00 disables payment
- [ ] Visual urgency increases as expiry approaches
- [ ] Rate change warning shows when >2% difference
- [ ] Expired rate requires restart

### Visual Polish
- [ ] All animations feel smooth (60fps)
- [ ] Color transitions are seamless
- [ ] Text is always readable
- [ ] Icons are properly sized and aligned
- [ ] Haptic feedback is appropriate for each action
- [ ] Loading states don't flash (<300ms)

---

## Implementation Priority

### Phase 1: Foundation (Week 1)
1. Payment state visual distinctions
2. Enhanced error messages and types
3. Rate locking mechanism

### Phase 2: Advanced Features (Week 2)
4. Overpayment detection and change return
5. Visual polish and animations
6. Accessibility improvements

### Phase 3: Testing & Refinement (Week 3)
7. User testing with real devices
8. Performance optimization
9. Edge case handling
10. Documentation and demos

---

## Success Metrics

### Quantitative
- Payment completion time: <5 seconds (tap to success)
- Error recovery rate: >90% (users complete after error)
- Rate lock expiry rate: <5% (most payments complete within 5min)
- Overpayment resolution: 100% (all overpayments handled)

### Qualitative
- "Wow, that was fast!" - Speed perception
- "I knew exactly what was happening" - Clarity
- "Even my grandma could use this" - Simplicity
- "This feels magical" - Delight

---

## Technical Architecture

### New Components Needed

```
src/components/payment/
├── PaymentStateIndicator.tsx      - Animated state circle
├── PaymentErrorModal.tsx          - Error display with recovery
├── OverpaymentDialog.tsx          - Change return options
├── ChangeQRDisplay.tsx            - Change token QR screen
├── RateLockBadge.tsx             - Locked rate countdown
└── RateExpiryOverlay.tsx         - Rate expired warning
```

### Store Updates

```typescript
// payment.store.ts
interface Payment {
  // Existing fields...

  // New fields
  lockedRate?: {
    rate: number;
    currency: string;
    lockedAt: number;
    expiresAt: number;
    source: string;
  };
  overpayment?: {
    amount: number;
    resolution: 'tip' | 'change' | 'pending';
    changeToken?: string;
  };
  errorDetails?: {
    code: string;
    message: string;
    technical?: string;
    recovery: string[];
    timestamp: number;
  };
}
```

### Service Extensions

```typescript
// cashu.service.ts
export async function generateChangeToken(
  amount: number,
  mint: string
): Promise<string> {
  // Mint new token for exact change amount
  // Return encoded token string
}

// rate.service.ts (new)
export async function lockExchangeRate(): Promise<LockedRate> {
  // Fetch current rate and create lock
}

export function isRateLockValid(lock: LockedRate): boolean {
  // Check if lock is still within expiry time
}
```

---

## Design Inspiration

### Visual Reference
- Apple Pay: State transitions, success animations
- Cash App: Speed, simplicity, clear amounts
- Stripe Terminal: Error handling, professional polish
- Physical cash: Instant finality, change return

### Interaction Patterns
- Pull-to-refresh: Familiar gesture for rate refresh
- Swipe-to-dismiss: Natural error/modal dismissal
- Long-press: Advanced options (show technical details)
- Shake-to-cancel: Emergency exit from stuck states

---

## Future Enhancements (Post-MVP)

1. **Payment Sound Effects** - Subtle audio cues for success/error
2. **Custom Payment Amounts via NFC** - Customer sets amount on their device
3. **Multi-Currency Display** - Show amount in multiple currencies simultaneously
4. **Payment Analytics Dashboard** - Success rates, average times, error frequencies
5. **Offline Payment Queue** - Store payments when offline, process when back online
6. **Payment Receipts via NFC** - Tap to get digital receipt
7. **Customer Display Integration** - Show payment progress on second screen
8. **Voice Confirmation** - "Payment received, 10 dollars" for accessibility

---

**End of Documentation**

This document will be updated as implementation progresses and user feedback is gathered.
