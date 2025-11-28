# Testing Guide - Table Management System

This guide provides step-by-step instructions for testing the complete table management and waiter assignment features.

## Prerequisites

1. App is installed and running
2. Onboarding completed
3. At least one mint configured

## Quick Start with Sample Data

The fastest way to test the table management system is to use the sample data generator.

### Load Sample Data

1. **Navigate to Settings**
   - From home screen, tap Settings icon (top right)

2. **Open Developer Tools**
   - Scroll to the "Developer" section
   - Tap "Developer Tools"

3. **Load Sample Data**
   - Tap "Preview Data" to see what will be created
   - Tap "Load Sample Data"
   - Confirm the action
   - Wait for success message

**What Gets Created:**
- 4 areas: Main Dining (10 tables), Patio (6 tables), Bar (4 tables), Private Room (2 tables)
- 22 tables total with various capacities (2-12 seats)
- 6 staff members: 1 manager, 1 cashier, 3 waiters, 1 chef
- Waiters automatically assigned to sections
- Some tables pre-set to occupied/reserved status

**Sample Staff PINs:**
- Manager (Sarah): 1234
- Waiter (Emma): 3456
- Waiter (James): 4567
- Waiter (Olivia): 5678

## Testing Table Management

### 1. View Tables

**From Home Screen:**
- Tap "Floor Plan" in Restaurant section
- You should see all 22 tables organized by area

**From Settings:**
- Settings → Tables & Areas
- View tables in management interface

### 2. Filter and Search

**Filter by Status:**
1. Open Floor Plan
2. Tap status filter buttons (All, Available, Occupied, Reserved, Cleaning)
3. Verify only matching tables display

**Filter by Area:**
1. Tap area filter chips (Main Dining, Patio, Bar, Private Room)
2. Verify only tables in that area display

**Toggle View Mode:**
1. Tap grid/list icon in header
2. Switch between grid and list views

### 3. View Table Details

1. Open Floor Plan
2. Tap any table card
3. Modal should show:
   - Table number and capacity
   - Current status
   - Assigned area
   - Assigned waiter (if any)
   - Quick action buttons

### 4. Change Table Status

**Method 1 - From Detail Modal:**
1. Tap table to open details
2. Tap "Change Status" button
3. Select new status from modal
4. Verify table color updates

**Method 2 - Quick Action:**
1. In Floor Plan, tap status icon on table card
2. Select new status
3. Verify immediate update

**Statuses to Test:**
- Available (green)
- Occupied (orange)
- Reserved (blue)
- Cleaning (purple)
- Unavailable (red)

### 5. Create New Table

1. Settings → Tables & Areas
2. Tap "+" button (top right)
3. Fill in form:
   - Table Number: "TEST1"
   - Capacity: 4
   - Area: Main Dining
4. Tap "Create Table"
5. Verify table appears in list
6. Open Floor Plan to see new table

### 6. Edit Existing Table

1. Settings → Tables & Areas
2. Tap any table row
3. Modify details:
   - Change number
   - Change capacity
   - Change area
4. Tap "Save Changes"
5. Verify updates in both settings and floor plan

### 7. Delete Table

1. Settings → Tables & Areas
2. Tap table row
3. Tap "Delete Table"
4. Confirm deletion
5. Verify table removed from all views

## Testing Area Management

### 1. View Areas

1. Settings → Tables & Areas → Areas tab
2. Should see 4 sample areas with statistics

### 2. Create New Area

1. Tap "+" button in Areas tab
2. Fill in form:
   - Name: "Garden Terrace"
   - Description: "Outdoor garden seating"
   - Color: Select a color (tap color circle)
3. Tap "Create Area"
4. Verify area appears with correct color

### 3. Edit Area

1. Tap any area row
2. Modify name, description, or color
3. Tap "Save Changes"
4. Verify updates in areas list and floor plan filters

### 4. Delete Area

**Without Tables:**
1. Create new area (no tables assigned)
2. Tap area row
3. Tap "Delete Area"
4. Confirm - should delete immediately

**With Tables:**
1. Try to delete "Main Dining" (has 10 tables)
2. Should show warning with table count
3. Confirm understanding
4. Area deleted, tables become unassigned

## Testing Waiter Assignment

### 1. View Assignments

1. Open Floor Plan
2. Tables with assigned waiters show waiter name
3. Look for "Emma Waiter" on Main Dining tables
4. Look for "James Waiter" on Patio tables
5. Look for "Olivia Waiter" on Bar tables

### 2. Assign Waiter to Table

1. Open Floor Plan
2. Tap unassigned table (or VIP table in Private Room)
3. Scroll to "Server Assignment" section
4. Tap "Assign Server"
5. Select waiter from modal (Emma, James, or Olivia)
6. Verify waiter name appears on table card

### 3. Reassign Waiter

1. Tap table with existing assignment
2. Tap "Change Server"
3. Select different waiter
4. Verify new waiter name updates

### 4. Unassign Waiter

1. Tap table with assignment
2. Tap "Unassign Server"
3. Confirm action
4. Verify waiter name removed from table

### 5. View Waiter Dashboard

**From Home Screen:**
1. Tap "Waiter View" in Restaurant section

**From Floor Plan:**
1. Tap waiter icon in header

**Login as Waiter (if staff login enabled):**
1. Logout or switch user
2. Login with waiter PIN (3456, 4567, or 5678)
3. Navigate to Waiter View

**Verify Dashboard Shows:**
- Total assigned tables count
- Occupied tables count
- Available tables count
- Occupied tables section (full detail cards)
- Available tables section (grid view)
- Other tables section (reserved, cleaning, etc.)

### 6. Waiter Quick Actions

**From Dashboard:**
1. Tap "Add Order" on occupied table
   - Should navigate to POS
2. Tap "Clear" on occupied table
   - Should change status to available
3. Tap any available table card
   - Should navigate to POS

**Pull to Refresh:**
1. Pull down on dashboard
2. Wait for refresh animation
3. Verify data updates

## Testing POS Integration

### 1. Table Selection in Checkout

1. From home, tap "Start New Sale"
2. Add items to cart
3. Tap "Checkout"
4. Select "Dine In" order type
5. **Verify table selection appears**

### 2. Select Table

1. Scroll through available tables list
2. Tap a table card
3. Verify:
   - Table appears as selected
   - Shows table number, area, capacity
   - "Clear" button appears

### 3. Change Selected Table

1. With table selected, tap "Clear"
2. Table selection removed
3. Select different table
4. Verify new table shows as selected

### 4. Auto-Clear on Order Type Change

1. Select dine-in and choose table
2. Switch to "Takeout" or "Delivery"
3. **Verify table selection automatically clears**
4. Switch back to "Dine In"
5. Verify table selector reappears (no table selected)

### 5. Complete Order with Table

1. Select dine-in order type
2. Choose table (e.g., Table 5 in Main Dining)
3. Complete payment (use any method)
4. **Verify order completes successfully**

### 6. Verify Order Persistence

1. After successful payment with table selected
2. Navigate to History
3. Find the order you just created
4. **Verify order details include:**
   - Table information (if visible in UI)
   - All items
   - Correct total

### 7. Check Database Persistence

1. Complete order with table selected
2. Check console logs for: `[Result] Order saved: order_...`
3. **Verify no errors in order creation**

### 8. Automatic Table Status Update

**Note:** This requires database trigger functionality.

1. Select available table in checkout
2. Complete payment
3. Navigate to Floor Plan
4. **Verify table status changed to "occupied"**

**After all orders complete:**
1. Clear the table manually (for testing)
2. In production, table would auto-clear when all orders completed

## Testing End-to-End Flow

### Complete Restaurant Service Flow

**Setup (Manager):**
1. Settings → Tables & Areas
2. Verify areas and tables configured
3. Open Floor Plan
4. Assign waiters to tables for the shift

**Service (Waiter):**
1. Login or open Waiter View
2. Check assigned tables
3. Customers arrive at Table 5
4. Tap Table 5 in dashboard
5. Navigate to POS
6. Add items to cart:
   - 2x Classic Burger
   - 1x Caesar Salad
   - 2x Soft Drink
7. Tap Checkout
8. Verify "Dine In" selected
9. Verify Table 5 auto-selected (or select it)
10. Complete payment
11. Return to Waiter View
12. **Verify Table 5 now shows as Occupied**

**During Service:**
1. Customers order dessert
2. Tap "Add Order" on Table 5 occupied card
3. Navigate to POS
4. Add items:
   - 2x Chocolate Lava Cake
5. Complete payment
6. Return to dashboard

**End of Service:**
1. Customers leave
2. Tap "Clear" on Table 5
3. **Verify Table 5 returns to Available**
4. Ready for next customers

## Testing Data Management

### Clear All Data

**⚠️ WARNING: This deletes all tables, areas, and staff!**

1. Settings → Developer Tools
2. Scroll to "Data Management"
3. Tap "Clear All Data"
4. Confirm warning
5. Verify all sample data deleted
6. Only owner account should remain

### Reload Sample Data

1. After clearing, tap "Load Sample Data" again
2. Verify fresh data created
3. All tables, areas, and assignments restored

## Common Issues and Verification

### Issue: Tables not showing in Floor Plan
**Check:**
- Verify tables are marked as active
- Check area filter (tap "All")
- Check status filter (tap "All")

### Issue: Waiter not seeing assigned tables
**Check:**
- Verify waiter is logged in (correct staff member)
- Verify tables are actually assigned (check Floor Plan)
- Pull to refresh in Waiter View

### Issue: Table not appearing in checkout
**Check:**
- Verify order type is "Dine In"
- Verify table status is "Available"
- Verify table is marked as active

### Issue: Order not saving table data
**Check:**
- Console logs for errors
- Verify table was selected before completing payment
- Check database service is working

## Performance Testing

### Test with Many Tables

1. Clear all data
2. Manually create 50+ tables
3. Verify Floor Plan renders smoothly
4. Test filtering and search performance
5. Verify waiter dashboard handles many assignments

### Test Concurrent Updates

1. Open app on multiple devices/simulators
2. Make changes on device A (change table status)
3. Verify updates sync to device B (if Nostr sync enabled)

## Accessibility Testing

### Visual Indicators

- Verify color-coded status system is clear
- Check contrast of text on colored backgrounds
- Verify icons supplement color coding

### Touch Targets

- All buttons should be at least 44x44 points
- Verify comfortable tap areas in grid views
- Test modal interactions

## Final Verification Checklist

- [ ] All 22 sample tables created successfully
- [ ] All 4 areas created with correct colors
- [ ] 6 staff members created (3 waiters)
- [ ] Waiters assigned to tables automatically
- [ ] Floor Plan displays all tables correctly
- [ ] Grid and list views both work
- [ ] Status filtering works for all statuses
- [ ] Area filtering works for all areas
- [ ] Table detail modal displays all information
- [ ] Status changes update immediately
- [ ] Waiter assignment modal lists all waiters
- [ ] Waiter dashboard shows correct assigned tables
- [ ] Waiter dashboard statistics are accurate
- [ ] POS checkout shows table selector for dine-in
- [ ] Table can be selected and changed
- [ ] Table auto-clears when switching to takeout/delivery
- [ ] Orders complete successfully with table data
- [ ] Orders saved to database with table information
- [ ] Home screen shortcuts navigate correctly
- [ ] Developer tools load/clear data successfully

## Reporting Issues

If you find any issues during testing:

1. **Note the exact steps to reproduce**
2. **Check console logs for errors**
3. **Screenshot the issue if visual**
4. **Verify it's not a configuration issue**
5. **Clear data and reload sample data to test if persistent**

## Next Steps After Testing

Once testing is complete:

1. **Customize for your restaurant**
   - Create your actual areas
   - Add your real tables
   - Add your staff members
   - Configure proper PINs

2. **Train staff**
   - Show managers the Floor Plan
   - Train waiters on the dashboard
   - Practice the complete service flow

3. **Monitor in production**
   - Watch for performance issues
   - Gather user feedback
   - Iterate on workflow improvements

---

**Happy Testing!** 🎉

For more information, see `TABLES_IMPLEMENTATION.md` for architecture details and feature documentation.
