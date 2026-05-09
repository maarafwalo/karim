# Changelog

All notable hardening and feature changes to nou7.shop / joud-app.

---

## 2026-05 — Vendor + POS hardening sprint

10 audit rounds, **82 issues fixed**. The vendor workspace, POS register, partner system, and admin tabs are all production-hardened against data integrity bugs, cross-session leaks, race conditions, and broken cross-component links.

### Round 1 — Vendor workspace (12 fixes)

- `CartTab` edit-save: insert-first / delete-after pattern so a network blip can't erase the original order.
- `CartTab` save: `if (sending) return` guard against rapid double-tap.
- `CartTab` `negotiated` flag: float-tolerant compare (`|np - orig| < 0.005`).
- `CartTab` partial split: validate `0..packSize`; `0` clears the split.
- `OrdersTab` edit: warn before overwriting unsaved bag for a different order.
- `OrdersTab` edit-load: strip `(units/packSize)` suffix to avoid double-encoding.
- `OrdersTab`: always-available delete (with stronger confirm if processed).
- `OrdersTab` filter chips: always show count.
- `OrdersTab` + `CustomerPickerModal`: phone search strips non-digits both sides.
- `CustomerPickerModal`: new customer pushed into local list immediately.
- `NewCustomerForm`: confirm before discarding typed data on backdrop close.
- `WorkspacePage.recordPayment`: caps amount at outstanding, refetches history shared via `refreshHistory()`.

### Round 2 — Data integrity + cross-session (9 fixes)

- `bagStore.addItem`: snapshots `originalPrice` (saved orders match what vendor saw).
- `bagStore.addItem`: caps qty at `product.stock` when defined.
- `bagStore.setNegPrice`: clamps `≥ 0`.
- `bagStore.setPartial`: guards `packSize > 0` and `units ≥ 0`.
- `bagStore.reconcile(liveProducts)`: drops items whose product was deleted.
- `AppLayout`: clears bag on auth user change.
- `AppLayout`: cancel-flag on partner-orders polling.
- `CartTab.sendOrder`: reads live store state, strips `-tmp-…` suffix, rename via `withTimeout`, empty-cart guard.
- `OrdersTab` + `CustomersTab`: action error checks before mutating local state.

### Round 3 — Network + i18n (11 fixes)

- `generateOrderNumber`: adds milliseconds + 3-digit random.
- `buildWhatsApp` + new `normalizePhoneForWA`: prepends `212` to local Moroccan numbers.
- `OrdersTab.editOrder`: preserves saved `original_price`.
- `authStore.signOut`: clears bag + session markers.
- `productsStore.subscribeRealtime`: realtime INSERT preserves the `categories(name,emoji)` join.
- `ProductsTab`: `useMemo` filtered list; clears search on unmount.
- `CartTab` empty-bag editing trap: now has `← تصفح` and `إلغاء التعديل` exits.
- `CartTab CartRow`: image error fallback to emoji.
- `CustomerPickerModal`: Enter picks the only match.
- `NewCustomerForm`: phone field gets `inputMode="tel"` + `autoComplete="tel"`.
- `CustomerCard.refreshHistory`: passes `isCancelled()` so a fast collapse can't overwrite.

### Round 4 — PWA + persistence (6 fixes)

- `vite.config.js` workbox: Supabase cache restricted to `/rest/v1/` GETs only.
- `bagStore` persist `version: 2` with migration that backfills `originalPrice`.
- `OrdersTab OrderCard`: whole header is the toggle, lazy-loaded items list with original/negotiated prices.
- `OrdersTab` partial regex: accepts Arabic-Indic + Eastern Arabic-Indic digits.
- `_workspaceHelpers.itemSubtotal`: rounded at line level so display matches DB exactly.
- `ProductsTab` sticky bar: reuses rounded `itemSubtotal`.

### Round 5 — Integration with POS + adjacent (8 fixes)

- `VendorOrdersTab.sendToPos`: warns + `holdCart()` if cashier has unfinished sale; passes `customer.id`; defers `status='invoiced'` flip until POS save succeeds.
- `cartStore.loadFromOrder`: optional `liveProducts` arg hydrates image/category/barcode/stock; preserves `customer.id`.
- `POSPage`: flips `catalog_orders.status='invoiced'` after the POS sale actually saves.
- `PartnerLedgerPage`: only verified orders count toward debt.
- `PartnerCatalogPage`: filters by `!p.store_id` (main store only).
- `AdminPage`: tab persists in URL hash.
- `StockPage`: image upload uses `crypto.randomUUID()`, error toast includes message.
- `StockPage`: `parseInt` clamped to `Math.max(0, …)`, `oos.join` bug fixed.

### Round 6 — Stock leak + races (4 fixes)

- `PartnerOrdersPage.handleApprove`: actually deducts product stock now (was a status flip only — silent inventory leak).
- `authStore.init`: stores `_authSub` and unsubscribes previous to prevent StrictMode listener stacking.
- `partnerOrderStore.submit`: early-return on `submitting` against double-tap race.
- `ImportProductsTab`: detects duplicate category names and warns the admin.

### Round 7 — Debt + i18n (4 fixes)

- `DebtPage.recordCustPayment`: caps at outstanding, errors out if balance ≤ 0, surfaces a warning if balance update fails post-insert.
- `ImportProductsTab`: paged fetch (1000 rows at a time) — was silently truncating at Supabase's default cap.
- `productsStore.subscribeRealtime`: also subscribes to `categories` table.
- `utils.fmt` + new `toLatinDigits`: handles Arabic-Indic + Eastern Arabic-Indic numerals; never renders literal `NaN`.

### Round 8 — POS + cross-session (7 fixes)

- `POSPage.handleConfirm`: ref-based `savingRef` lock against rapid double-tap.
- `POSPage` debt tracking on refund: `Math.max(0, …)` clamp so customer balance can't underflow.
- `authStore.signOut` + `AppLayout` user-switch: also clears `cartStore` + `heldCarts`.
- `cartStore.addItem`: matches `id && !isReturn` so a sale add doesn't increment a return-line.
- `cartStore.partialize`: persists `discountType/Value`, `paymentMethod`, `notes`, `returnMode`.
- `PartnerOrdersPage.handleApprove`: DB-side race guard via `.eq('stock_approved', false)` — two admin tabs can't double-deduct stock.

### Round 9 — Resilience (3 fixes)

- New `ErrorPage` + `errorElement` on every route — single page crash no longer blanks the whole app.
- `DebtPage`: tab persists in URL hash.
- `shiftStore.reconcileLocalShift()`: retries DB insert for shifts that started in offline-fallback mode, so invoice `shift_id` references real rows.

### Round 10 — Final polish (8 fixes)

- `cartStore.addScaleItem`: random suffix prevents same-ms scan id collision.
- `AppLayout MiniCamera`: re-attach stream on `minimized` toggle, null `srcObject` on unmount.
- `PartnerLedgerPage` timeline: tiebreaker (orders before payments at equal time) for stable running balance.
- `WorkspacePage`: removed dead `currency_symbol` OR; invalid hash → `replaceState` to fallback.
- `CartTab` editing banner: strips `-tmp-…` suffix from displayed order_number.
- `CartTab.sendOrder`: re-checks `liveItems.length` right before items insert (race guard against realtime DELETE during save).
- `POSPage`: `useEffect` calls `reconcileLocalShift()` whenever `currentShift._local` is true.

---

## 2026-04 → 2026-05 — Feature work

Vendor workspace consolidation, admin tabs reorg, joud-lite product import, partner system, stock inline editing — see commit history (`bb05f7d` and earlier).

---

## SQL migrations to run on a fresh database

In order, in the Supabase SQL editor:

1. `sql/partner_schema.sql` — partner orders + payments + ledger
2. `sql/catalog_negotiation_migration.sql` — negotiation columns on `catalog_order_items`
3. `sql/vendor_customers_rls.sql` — RLS for `customers` + `debt_payments` (`app_user_role()` helper)
4. `sql/admin_orders_rls.sql` — admin/store_manager can read all `catalog_orders`
5. `sql/import-batch-1.sql` — optional curated 38-product seed from joud-lite
