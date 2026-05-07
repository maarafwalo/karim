# Joud — Claude Project Knowledge

> Upload this as Project Knowledge in Claude (claude.ai → Projects → New project → Add files).
> Covers both **joud-app** (full POS+Catalog+Partners) and **joud-lite** (slimmed POS).

---

## 🤖 SYSTEM INSTRUCTIONS (paste in Custom Instructions)

```
You are an expert collaborator on the "Joud" Arabic POS apps for شركة جود (El Jadida, Morocco).

TWO PROJECTS:
- joud-app  (C:\Users\marou\Desktop\joud-app)   — full app: POS + Catalog + Partners + Manager + Stock
- joud-lite (C:\Users\marou\Desktop\joud-lite)  — slim version: POS + Stock + Editing + Reports + Expenses

STACK (both):
- Vite + React 19 + Zustand + Supabase + Tailwind + PWA
- Arabic-first (RTL). UI in Arabic, code/comments in English.

WHEN USER ASKS FOR EDITS:
1. Identify which project (joud-app or joud-lite) — they overlap heavily but have different pages.
2. Give exact file path + approximate line.
3. Drop-in code blocks, NO "..." placeholders.
4. Preserve RTL, Arabic strings, fmt()/fmtDate().

DON'T:
- Push to GitHub unless asked.
- Add new dependencies casually.
- Break window.print() flow (~120ms delay).
- Try to fix Arabic shaping on Rongta scale (firmware limit).

OUTPUT: Arabic explanations, English code. Concise. Mobile-first.
```

---

## 📂 joud-app structure (full)

```
joud-app/
├── src/
│   ├── pages/
│   │   ├── pos/POSPage.jsx           ← cashier (main sales)
│   │   ├── catalog/CatalogPage.jsx   ← product catalog with WhatsApp order
│   │   ├── manager/ManagerPage.jsx   ← user/role mgmt (admin)
│   │   ├── stock/StockPage.jsx       ← inventory
│   │   ├── editing/EditingPage.jsx   ← product CRUD
│   │   ├── reports/ReportsPage.jsx
│   │   ├── expenses/ExpensesPage.jsx
│   │   ├── partners/                 ← partner orders/requests
│   │   ├── customers/
│   │   ├── debt/
│   │   ├── suppliers/
│   │   ├── surveillance/
│   │   ├── store-accounts/
│   │   ├── LoginPage.jsx
│   │   ├── InstallPage.jsx
│   │   └── UnauthorizedPage.jsx
│   ├── stores/
│   │   ├── authStore.js, cartStore.js, productsStore.js
│   │   ├── settingsStore.js, shiftStore.js, storeContext.js
│   │   ├── customersStore.js, debtsStore.js, suppliersStore.js
│   │   └── partnersStore.js
│   ├── lib/
│   │   ├── supabase.js               ← anon + admin clients
│   │   ├── useScale.js               ← Web Serial for Rongta
│   │   └── utils.js                  ← fmt, fmtDate, generateOrderNumber, ROLE_*, STORE_PHONE='212761568529'
│   ├── layouts/AppLayout.jsx
│   ├── router/index.jsx
│   ├── data/products_seed.json
│   ├── index.css
│   └── main.jsx
├── sql/
│   ├── schema.sql, seed_products.sql
│   ├── partner_schema.sql            ← partner-specific tables
│   ├── audit_log.sql
│   └── migration_missing_tables.sql
├── supabase_schema.sql               ← top-level full schema
├── update-passwords.mjs              ← user password reset script
├── fix-profiles.mjs                  ← profile setup script
├── migrate.mjs                       ← initial product import
├── gen-icons.cjs / .mjs              ← PWA icons
├── vercel.json                       ← Vercel deployment config
└── .env / .env.example
```

**Supabase project:** `tatimyttuxxyeyxztawn.supabase.co`

---

## 📂 joud-lite structure (slim)

Same as joud-app but only: POS, Stock, Editing, Reports, Expenses, Manager pages. No Catalog/Partners/Customers/Debt/etc.

**Supabase project:** `suemrjvzhfbxdpsccgoi.supabase.co` (separate from joud-app)

**Extras unique to joud-lite:**
- `scale-server.cjs` — local TCP↔HTTP bridge for Rongta scale (port 3333)
- `PLU-LIST.txt` — 180 sequential PLU master list
- `price-map.json` — Arabic name → price/kg
- `launch-pos.bat` — Chrome kiosk-printing launcher
- Desktop shortcut "Joud POS"

---

## 🗄️ Supabase Data Model

**Common tables:** `profiles, products, categories, sales, sale_items, expenses, shifts, stores, settings`

**joud-app extras:** `catalog_orders, catalog_order_items, customers, debts, suppliers, partners, partner_requests, surveillance_logs`

**products fields:**
```sql
id uuid, name text, barcode text, category_id int, cat text, emoji text,
sell_price numeric, wholesale_price numeric, cost_price numeric,
stock numeric (nullable=unlimited), store_id uuid (null=main),
is_active bool, is_hidden bool, image_url text
```

**Roles:** `admin | cashier | stock_manager | vendor | store_manager | delivery | assistant | trusted_partner`

DB enum (in Supabase) only allows: `admin, cashier, vendor, stock_manager`. Others map to `vendor` via `fix-profiles.mjs`.

`productsStore.load()` paginates 1000/request. Realtime subscription syncs stock across terminals live.

---

## 🛒 Cart logic (cartStore.js)

| Concept | What |
|---|---|
| `addItem({ ignoreStock: true })` | Barcode scans (item physically present) |
| `addScaleItem(product, totalPrice)` | Scale weighing → unique line per scan (id has timestamp) |
| `returnMode` | Refund mode. `total = subtotal - discount - returnTotal + tva`. <0 → `isRefund` |
| `heldCarts` | Parked invoices |
| `discountType` | `'fixed'` or `'pct'`, clamped to `[0, subtotal]` |
| Wholesale pricing | ONLY if `customer.price_tier === 'wholesale'` AND `wholesale_price > 0` |

Persisted: localStorage `joud_cart` (only items, customer, heldCarts).

---

## 🖥️ POSPage.jsx (~2348 lines, joud-lite)

| Component | Approx line | Purpose |
|---|---|---|
| `CategorySidebar` | 12 | Left rail |
| `ProductGrid` | 50 | MAX_GRID=120 cap |
| `Cart` | mid | Right panel |
| `PrintView` | 381 | `#print-area`, 80mm RTL |
| `ScaleModal` | 430 | Sync to scale via localhost:3333 |
| `WeightModal` | mid | Polls /weight every 500ms |
| `QuickAddModal` | mid | Quick add by code |

**Print flow:** `setPendingPrint(true)` → useEffect → `window.print()` after ~120ms.
**Reprint:** `reprintInvoice(inv)` → `setLastInvoice` → `window.print()` after 300ms.

---

## 🛍️ CatalogPage.jsx (joud-app only)

Public-ish catalog view. Customers browse → add to bag → submit order via WhatsApp + Supabase.

| Section | Lines |
|---|---|
| `ProductCard` | 10-51 |
| `addToBag/removeFromBag` | 67+ |
| `sendOrder` | 125+ |
| Layout: search bar + category chips + product grid + floating bag button + bag/order modals | 183+ |

**Recent changes (current state):**
- Grid: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5` (was 1/3 only)
- Card image: 130px height (was 200px)
- Bottom padding `pb-24` so floating bag button doesn't cover last row
- `sendOrder` now: SAVE Supabase first → open WhatsApp after → fallback to localStorage `pending_orders` if save fails

**Related Supabase tables:** `catalog_orders, catalog_order_items` (joud-app only).

---

## ⚖️ Rongta scale (RLS1100C Arabic OEM)

**TCP:** `192.168.1.200:4001`
**Local bridge:** `localhost:3333` via `scale-server.cjs` (joud-lite only)

**Endpoints:**
- `GET /ping` — liveness
- `GET /weight` — `{ ok, weightKg, stable }`
- `POST /upload` — push PLU `{plu, name, price, barcode, unit}`
- `GET /extract` — read all PLUs

**PLU upload frame (30 bytes):**
```
[0]    STX 0x02
[1]    'U' 0x55
[2-5]  PLU number (BE uint32)
[6-21] Name (16 bytes, CP1256 Arabic)
[22-25] price × 100 (BE uint32)
[26]   unit (0x41=kg)
[27-29] CR LF ETX
```

**Delete frame (9 bytes):** `STX 'D' PLU(4) CR LF ETX`

**KNOWN LIMITS — don't retry:**
1. Arabic letters render isolated on scale (firmware limit). Real fix: OEM `RLS1000_AR v2.0.1` from darbalawael.com.
2. RLS1000 v1.129 caps batch upload at 45 PLUs.
3. "télécharge PLU" log can be silent on success or failure — verify physically.
4. PLU.USR is binary database. If RTPLU shows empty grid → reinstall RLS1000.

**Current state:** 180 sequential PLUs (1-180, no gaps). List in `joud-lite/PLU-LIST.txt`.

---

## 🖨️ Receipt printing

- `window.print()` + `@media print` in `index.css`
- Width 80mm (thermal: WDLink/POS Printer 203DPI). Falls back on A4.
- `joud-lite/launch-pos.bat` → Chrome `--kiosk-printing --disable-print-preview` for silent print.
- Desktop shortcut "Joud POS" runs the .bat.

**Edit print:** `PrintView` (POSPage.jsx ~381) + `index.css @media print`.

---

## 🔐 Auth & Roles

```
RequireAuth → all except /login, /unauthorized, /install

joud-app routes:
/pos, /expenses, /reports → admin, cashier, store_manager
/manager                  → admin only
/stock                    → admin, stock_manager, assistant, store_manager
/editing                  → admin, store_manager
/catalog                  → admin, cashier, store_manager, vendor, partner
/partners                 → admin
/customers                → admin, cashier, store_manager
/debt                     → admin, store_manager
/suppliers                → admin, stock_manager

joud-lite routes:
/pos, /expenses, /reports → admin, cashier, store_manager
/manager                  → admin only
/stock                    → admin, stock_manager, assistant, store_manager
/editing                  → admin, store_manager
```

**Existing accounts (joud-app, see `update-passwords.mjs`):**
- akh@joud.app / Akh@Joud24 (admin / "أخوك")
- imran@joud.app / Imran@Joud24, ibrahim@joud.app / Ibr@Joud24, etc.

---

## 📐 Conventions

- **Arabic UI strings, English code/comments.** Don't reverse.
- **RTL** — body has `dir="rtl"`. PrintView explicit.
- **`fmt(num)`** — always 2 decimals.
- **`fmtDate(iso)`** — ar-MA locale.
- **`generateOrderNumber(prefix)`** — `PREFIX-YYYYMMDD-HHMMSS`.
- **Zustand = source of truth.** No mirrored local state.
- **Writes:** `db = supabaseAdmin || supabase` (bypass RLS).
- **Reads:** plain `supabase`.
- **Tailwind for styles.** Inline `style={{}}` only for dynamic.
- **Don't break print delay** (~120ms).
- **WhatsApp orders:** SAVE Supabase first, THEN open WhatsApp (don't reverse — popup can navigate away).

---

## 🛠️ Common Tasks

| Task | Files |
|---|---|
| Add product field | sql migration → productsStore.js → EditingPage.jsx → POSPage cells |
| Receipt layout | PrintView (POSPage.jsx ~381) + index.css `@media print` |
| Add role | ROLE_LABELS + ROLE_HOME (utils.js) + RequireRole (router) + Supabase CHECK |
| Sync to scale | Open ScaleModal — auto-PLU 1-N for active products |
| New page | router/index.jsx + page file + AppLayout.jsx nav |
| Catalog WhatsApp | sendOrder in CatalogPage.jsx (line ~125) |

**Dev/Build:**
```bash
cd C:\Users\marou\Desktop\joud-app    # or joud-lite
npm install
npm run dev    # http://localhost:5173
npm run build  # → dist/
```

**Run POS in production:** double-click "Joud POS" desktop shortcut (joud-lite).

---

## 💬 How to ask Claude in chat

**Good:**
- "Edit PrintView in POSPage.jsx (joud-lite, ~line 381) — make store name 18px"
- "Add 'notes' text field to ExpensesPage.jsx (joud-lite). Add `notes text` column to expenses table."
- "In CatalogPage.jsx (joud-app), make ProductCard image height 150px instead of 130px"
- "Wire customer phone search in Cart component (POSPage.jsx, joud-app)"

**Bad:**
- "Make the receipt nicer" (vague)
- "Refactor the POS page" (too broad)
- "Use a different state library" (against conventions)

Always include: **which project** (joud-app/joud-lite) + **file path** + **rough line/component** + **what to change**.

---

## ⚠️ Known issues / time-savers

- **Arabic shaping on Rongta scale** — firmware limit, only OEM v2.0.1 fixes it.
- **45-PLU upload cap** in RLS1000 v1.129 — direct TCP works but inconsistent persistence.
- **Print dialog appears** — make sure default printer is set + use `launch-pos.bat`.
- **PLU.USR empty / RTPLU grid empty** — reinstall RLS1000.
- **CatalogPage WhatsApp not sending** — check popup blocker + ensure Supabase save runs first.
- **DB role enum is small** (admin/cashier/vendor/stock_manager) — others map to `vendor`. Don't assume schema accepts arbitrary roles.
