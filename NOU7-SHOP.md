# nou7.shop — Joud POS / Catalog / Stock

> Production: **https://nou7.shop** · Repo: `github.com/maarafwalo/karim` · Vercel project: `karim`
> Supabase project: `tatimyttuxxyeyxztawn` · Sister app: `joud-lite` (separate Supabase, source for product imports)

A multi-role Arabic-first PWA running a Moroccan retail business. Three audiences share one app:
**cashiers** at the till, **vendors** taking field orders, **admin** managing everything.

---

## 1. Tech stack

- **Vite + React 19** SPA, deployed as a PWA (`vite-plugin-pwa`, `skipWaiting + clientsClaim`)
- **Tailwind CSS** with `font-arabic` and `dir="rtl"` everywhere
- **Zustand** for state, with `persist` middleware on most stores
- **Supabase** for DB, Auth, and Storage (`product-images` bucket)
- `react-router-dom` v7 (data-router style)
- `react-hot-toast` for user feedback

Production env vars on Vercel:

| Var | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key |
| `VITE_SUPABASE_SERVICE_KEY` | Service role — used by `supabaseAdmin` to bypass RLS for vendor/admin writes |

Local dev (`.env`) does **not** have the service key, so any feature that bypasses RLS only works on production.

---

## 2. Roles & nav

The header shows different buttons per role (`src/layouts/AppLayout.jsx`). Routes outside the nav still
work via direct URL, gated by `RequireRole` in `src/router/index.jsx`.

| Role | Header buttons | Lands on |
| --- | --- | --- |
| **admin** | `🛒 POS · 🧰 ساحة · 📦 مخزن · ⚙️ إدارة` | `/pos` |
| **cashier** | `🛒 POS · 👤 الزبائن · 💼 محاسبة` | `/pos` |
| **store_manager** | `POS · الزبائن · محاسبة · مخزن · تقارير` | `/pos` |
| **stock_manager** | `📦 مخزن · 🚚 موردون` | `/stock` |
| **assistant** | `📦 مخزن` | `/stock` |
| **delivery** | `الزبائن · محاسبة` | `/customers` |
| **vendor** | _(none — header is just logo + خروج)_ | `/workspace` |
| **trusted_partner** | `طلب بضاعة · حسابي` | `/partner-catalog` |

Defaults are in `ROLE_HOME` (src/lib/utils.js) and `DEFAULT_PERMISSIONS` (src/stores/permissionsStore.js).
Admins can override per-page permissions in **إدارة → الصلاحيات**.

---

## 3. Pages

### Vendor side — `/workspace` (everything in one tabbed page)

Route component: `src/pages/catalog/WorkspacePage.jsx`. Vendors only see this page. Admin reaches the
same page via the **🧰 ساحة** nav button.

- **📋 منتجات** — products grid with search + a category sheet (3-col modal). Adding from any card writes to `bagStore`.
- **🛍 السلة** — live bag with ± price negotiation (0.10 step), qty steppers, **✂ تقسيم** for partial pack sales (e.g., sell 9 of an 18-pack), **🗑 إفراغ** to clear, and an inline checkout stage:
  - **إكمال الطلب** opens a customer picker on the same screen — recent customers as one-tap chips, search/autocomplete with highlighted match, **+ جديد** inline form, optional virtual keyboard. Customer is **optional** ("حفظ بدون زبون" → saves under `زبون عابر`).
  - On save, items are inserted into `catalog_orders` + `catalog_order_items` with negotiation metadata, and the URL flips to `#orders` so the vendor sees the new order.
- **🧾 طلبات** — vendor's own order history. Inline ✏️ / 🗑 on each row when status is still `جديد` (and `stock_approved=false`). Editing loads the order back into the bag and reuses the original order number on save.
- **👤 الزبائن** — CRM-style customer cards. Tap to expand for inline edit, WhatsApp deep link, call link, debt-payment input, and side-by-side last-10 invoices / last-10 payments. The **🛒 استخدم لهذا الطلب** button on each card is an alternate path to fill the cart's customer.

### Admin side — `/admin` (10 tabs)

Route component: `src/pages/admin/AdminPage.jsx`. Most other admin pages are embedded as tabs here so
the top nav stays small.

| Tab | Source page |
| --- | --- |
| ⚙️ الإعدادات | local `SettingsTab` |
| 👥 المستخدمون | local `UsersTab` (uses `supabase.auth.admin.createUser`) |
| 🔐 الصلاحيات | local `PermissionsTab` (writes `permissionsStore`) |
| 🏬 الفروع | local `StoresTab` |
| 📊 الإحصائيات | local `StatsTab` |
| 📋 طلبات الباعة | `VendorOrdersTab.jsx` — list of `catalog_orders` with `is_partner_request=false`. **🛒** button calls `useCartStore.loadFromOrder()` and navigates to `/pos` so cashier finishes the sale; source order flips to `status='invoiced'`. |
| 💼 محاسبة | `pages/debt/DebtPage.jsx` (which itself has 4 tabs: customers / suppliers / employees / expenses) |
| 🚚 موردون | `pages/suppliers/SuppliersPage.jsx` |
| 📈 تقارير | `pages/reports/ReportsPage.jsx` |
| 🤝 حساب سعيد | `pages/partner/PartnerAccountPage.jsx` (red badge on the `/admin` nav button when there are unverified partner orders) |
| 📦 استيراد | `ImportProductsTab.jsx` — connects to **joud-lite Supabase** read-only, lets admin pick products with checkboxes (chips per category, hide-existing toggle), bulk-imports via service role into `products`. |

### POS — `/pos`

`src/pages/pos/POSPage.jsx`. Big screen. Cash-shift gate via `shiftStore` (`_hasHydrated` is wired
through `onRehydrateStorage`). Loads customer/items via `cartStore`, supports scale items
(`addScaleItem`), held carts (`heldCarts`), refunds (`returnMode`).

### Stock — `/stock`

`src/pages/stock/StockPage.jsx`. Grid of cards with **fully inline editable fields**: tap image →
upload, tap name → text input, tap category → dropdown that commits on select, tap price → number
input, stock is direct input. **⚙** button opens a modal for advanced fields (barcode, size, emoji,
min stock, notes, discount price).

### Catalog — `/catalog`

Standalone catalog page used by trusted partners (different from the vendor workspace). Admin can also
hit it via direct URL — but the vendor-style workspace is preferred. The vendor's old WhatsApp send
flow has been removed; CatalogPage now exports `ProductCard`, `VirtualKeyboard`, and `PRICE_STEP` for
reuse from the workspace.

### Other roles' standalone pages

`/customers`, `/debt`, `/suppliers`, `/reports`, `/expenses` (only via URL),
`/partner-catalog`, `/my-account`, `/surveillance`, `/install`. Most also live as tabs inside
`/admin` for the admin role.

---

## 4. Data model (key tables)

```sql
-- Catalog orders (vendor-side, used by workspace + partner pages)
catalog_orders (
  id, order_number, vendor_id, customer_name, customer_phone, customer_address,
  subtotal, total, status, wa_sent, is_partner_request, stock_approved,
  stock_approved_at, stock_approved_by, notes, created_at, updated_at
)

catalog_order_items (
  id, order_id, product_id, product_name, unit_price, original_price,
  negotiated, price_diff, quantity, total
)
-- See sql/catalog_negotiation_migration.sql for the negotiation columns.

-- Products + categories — stock + catalog source
products    (id, name, size, sell_price, cost_price, barcode, emoji, image_url,
             stock, is_active, is_hidden, category_id, created_at, …)
categories  (id, name, emoji, …)

-- POS invoices (pos cart → checkout)
pos_invoices (id, order_number, customer_id, total, payment_method,
              payment_label, shift_id, created_at, …)
debt_payments (id, customer_id, amount, notes, created_at)

-- Customers
customers (id, name, phone, address, balance, loyalty_pts, price_tier, …)

-- Cash shift (open/close cycle for cashiers)
cash_shifts (id, cashier_id, opening_cash, closing_cash, expected_cash,
             cash_difference, opened_at, closed_at, status, notes)

-- Partner system (trusted partners — Said & co)
-- See sql/partner_schema.sql.
partner_orders, partner_payments, partner_ledger
```

`status` values for `catalog_orders` used by the UI: `new`, `approved`, `delivered`, `rejected`,
`cancelled`, **`invoiced`** (set by VendorOrdersTab when admin pushes to POS).

### RLS

`sql/vendor_customers_rls.sql` enables RLS on `customers` and `debt_payments` so vendors / cashiers /
delivery can read + insert + update, and only admin/store_manager can delete. The helper is
`public.app_user_role()` which reads `profiles.role` for `auth.uid()`. (An earlier helper named
`current_role()` collided with a Postgres built-in — don't use that name.)

---

## 5. State management — Zustand stores

| Store | What's in it |
| --- | --- |
| `authStore` | `user`, `profile { id, role, full_name, phone }`, `signIn / signOut`, `loading`. Subscribes to `supabase.auth.onAuthStateChange`. |
| `productsStore` | `products`, `categories`, `activeCat`, `searchQ`, `filteredProducts(storeId)` (function!), `load`, `subscribeRealtime`, `updateStock`, `updateProduct`, `createProduct`. |
| `settingsStore` | App settings row (`store_name`, `currency`, `phone`, `tva_rate`, `cashier_name`). |
| `permissionsStore` | Per-role page-key permission map (persisted, with default fallback for newly-added pages). |
| `cartStore` | **POS** cart: `items`, `discountType/Value`, `amountPaid`, `paymentMethod`, `notes`, `customer`, `returnMode`, `heldCarts`, `addItem(product, { ignoreStock })`, `addScaleItem`, `loadFromOrder(items, customer, ref)`, `getTotals(tvaRate)`. |
| `bagStore` | **Vendor catalog** bag (separate from POS): `items`, `customer`, `editingOrder`, `addItem`, `decItem`, `removeItem`, `setNegPrice`, `setPartial({ units, packSize })`, `clear`. Persisted under `joud_bag`. |
| `shiftStore` | Cash shift, with proper `_hasHydrated` flag for POS gating. |
| `cameraStore` | Surveillance camera stream (admin-only, auto-start). |
| `storeContext` | Multi-branch store switcher. |
| `partnerOrderStore` | Trusted-partner order state. |

> **Two carts.** `cartStore` = POS cashier's cart (sells immediately, prints invoice).
> `bagStore` = vendor's field-sales basket (creates a `catalog_order` to be invoiced later).

---

## 6. Conventions

- **Arabic-first.** All labels are Arabic, root `<html dir="rtl">`. Fonts via `font-arabic` class.
- **`fmt(n)`** in `src/lib/utils.js` formats numbers (no currency suffix). Currency is `settings.currency` (defaults to "درهم").
- **`generateOrderNumber(prefix)`** produces `PREFIX-YYYYMMDD-HHMMSS` order numbers. Used for `ORD` (vendor catalog), `INV` (POS), `TKR` (partner take-request).
- **Service-role writes.** When inserting into tables that vendors don't have RLS for (orders, customers from non-admin roles, products), wrap with `(supabaseAdmin || supabase)` so it bypasses RLS in production and falls back to anon for dev/visibility.
- **Realtime.** `productsStore.subscribeRealtime()` is hooked once in `AppLayout`; product changes propagate everywhere.
- **PWA forced updates.** `vite.config.js` workbox uses `skipWaiting + clientsClaim + cleanupOutdatedCaches` so users always get the latest JS bundle.
- **Role-based imports work both ways.** A page can be both a top-level route (for cashier/store_manager/etc) and an embedded tab (for admin). DebtPage, SuppliersPage, ReportsPage, PartnerAccountPage, ExpensesPage all do this.

---

## 7. Recent feature highlights

- **Vendor workspace consolidated** into a single 4-tab page (browse / cart / orders / customers). Vendor's nav is just the logo. (commits `64199bc`, `e2e0bde`, `1613a87`, `570362e`, `556f058`)
- **Inline customer picker** in checkout: recent-chips (top 5 from this vendor's history), autocomplete with highlighted match, `+ جديد` inline-add-and-select, virtual keyboard support.
- **Pack split** — sell a fraction of a packed product. Pack size auto-detected from product names (`*18 وحدة`, `60وحدة`, `30*110غ`). Cart row shows `✂ 9/18 وحدة`. Saved orders encode the partial in `product_name` (e.g. `"name (9/18)"`).
- **Vendor → POS handoff** (`VendorOrdersTab` + `cartStore.loadFromOrder`).
- **Admin nav reduced** from 7 → 4 buttons; suppliers, reports, accounting, partner-account, vendor-orders, import all live as إدارة tabs.
- **Inline-editable stock cards** — tap image/name/category/price/stock to edit in place, ⚙ for advanced.
- **Joud-lite import tab** — connects to the sibling Supabase project read-only and bulk-imports selected products with category mapping by name.

---

## 8. SQL migrations to run on a fresh database

Run these in order in the Supabase SQL editor for any new project clone:

1. `sql/partner_schema.sql` — partner system tables
2. `sql/catalog_negotiation_migration.sql` — `original_price`, `negotiated`, `price_diff` on `catalog_order_items`
3. `sql/vendor_customers_rls.sql` — RLS policies + the `public.app_user_role()` helper. Required for vendors to insert customers without the service key.
4. `sql/import-batch-1.sql` — optional, seeds 38 products + 7 categories from joud-lite curated picks.

---

## 9. Working with this app from Claude

When you ask Claude to change something, it will usually:

1. **Edit the source file** under `src/pages/...` or `src/stores/...`.
2. **Build** with `npm run build` to confirm green.
3. **Commit + push** to `github.com/maarafwalo/karim` (Vercel auto-redeploys `nou7.shop`).
4. **Verify in the local preview** (`vite dev` server on `:5173` reused by the Claude Preview tool).

Common patterns:

- _"Remove this nav button"_ → edit `src/layouts/AppLayout.jsx` `NAV` array.
- _"Make this editable"_ → swap the read-only span for a click-to-edit input pattern (see `StockPage.jsx`'s ProductCard).
- _"Add a tab to إدارة"_ → import the page component in `AdminPage.jsx`, add a `{ id, label }` to the `TABS` array, add the matching `{tab === 'id' && <Component />}` line.
- _"Fix vendor cannot do X"_ → check (a) RLS policy in `sql/vendor_customers_rls.sql`, (b) the call uses `(supabaseAdmin || supabase)` not bare `supabase`.

If the SQL editor wants you to log in but Claude can't (passwords are user-only), Claude will hand you the SQL to paste in the Supabase SQL Editor manually.

---

_Updated 2026-05-08._
