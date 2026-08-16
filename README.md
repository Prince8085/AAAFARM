# AAA Farm Mandi Billing

Wholesale vegetable/commission (mandi arhtiya) billing app for **AAA FARM, Katni**. Make bills on your phone, download/save PDFs locally, and (when you're ready) sync everything to a Neon PostgreSQL database via your own API.

- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS (no server needed)
- **PDF:** jsPDF — generated on-device, saved straight to the phone (Android → Downloads, iPhone → Files/Share sheet)
- **PWA:** installable on the phone home screen, works offline
- **Storage:** localStorage by default (offline, no setup) · API-ready for Neon

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm run preview  # serve the production build
```

## Deploy (free, no server)

Build once, host the static `dist/` anywhere:

- **Vercel:** `npx vercel` — framework preset "Vite", build `npm run build`, output `dist`
- **Netlify:** `npx netlify deploy --prod` — build `npm run build`, publish `dist`

## Use on your phone

1. Open the deployed URL (or `npm run dev -- --host` and visit from your phone on the same Wi-Fi).
2. **Install as an app:** Chrome/Android → ⋮ menu → "Add to Home screen" (works offline afterwards).
3. Make a bill → **⬇ Download PDF** → it saves to the phone.
4. **🖨 Print** opens the system print dialog (or "Save as PDF").

## Features

- **📊 Dashboard (home)** — whole business at a glance: today/week/month **sales & collections**, **udhaar baaki** (customer balance due), **parties ko dena** (payables), a 7-day sales bar chart, Billed vs Collected (vasooli %), and a **Profit & Loss** section (income = commission + byaj + labour collected; expense = bhada + party trip diesel + toll + labour). Bottom nav: Dashboard · Bills · **+ New Bill** (center button) · Customers · Parties — Settings moved to the ⚙️ icon in the header.
- **New Bill** — search existing customers or add new inline, dynamic item rows with mandi-produce autocomplete (Dhaniya, Tamatar, Aloo, Pyaz…), live-calculated amounts, live invoice preview in the exact printed style, and automatic local draft saving (refresh won't lose work).
- **Calculations** (always 2 decimals, ₹ Indian formatting — ₹1,23,456.00):
  ```
  item amount   = qty × rate × unit factor   (quintal = ×100, kg/piece/bag = ×1)
  total         = Σ item amounts
  commission    = total × commission% / 100
  grand total   = total + commission + labour cost + byaj − bhada
  ```
  Commission, Labour and Byaj are **added on top** of the item total, while **Bhada (transport) is deducted** — the business bears the transport cost, so the customer pays items + commission + labour + any udhaar interest minus bhada. The rate is always **per kg** — selecting **quintal** multiplies the amount by 100 (1 quintal = 100 kg).
- **Bills** — history with search (invoice no / customer), date filter, running billed/collected/balance totals, view/reprint/edit/delete, status tracking (DRAFT → SAVED → PRINTED).
- **Customers** — bill counts, lifetime billed amounts, balance due per customer.
- **Payments** — record partial payments (Cash/UPI/Bank/Other) against a bill; balances update everywhere automatically. The invoice becomes a **consolidated bill**: once any payment is recorded, the preview, **PDF download and print output** show a Payment Summary — each payment (date · method · amount), Total Paid and Balance Due — right below Grand Total (the app's payment card stays on screen only).
- **Parties (supplier khata)** — parties (kisan/traders) who send produce by truckload; per-party trips with editable line amounts, per-trip commission/expenses, net trip bill, consolidated party statement (khata bill), advance/partial payments, and running **Balance Due** per party.
- **Settings** — business name, tagline, address, phone, footer note, next invoice number.
- Invoice numbers auto-increment from **BILL-737108** and never repeat.

## Party / Supplier ledger (khata)

The customer module is one side of the business; **Parties** is the other — paying the kisan/traders who bring produce to the mandi in truckloads. A party has a **running account**, not one-shot bills.

- **Parties** (`/parties`) — add parties, see trips count, total billed, total paid, balance due. Each row has a **⬇️ one-tap Party Bill (Khata) PDF** — no trip selection needed.
- **Party detail** (`/parties/:id`) — add trips and payments, running summary, pick trips to build a consolidated bill.
- **Trip form** — date range, item rows (item name + optional group label + qty + rate + **editable amount**), commission (flat ₹), diesel/driver, toll tax, labour/palledari. Net Trip Bill updates live.
- **Consolidated bill** — select trips → statement with each trip's summary (Item Total, Commission (−), Expenses (−), Net) **plus the full trip goods (saman) itemized per trip** (item · qty · rate · amount) — preview, print and PDF all show it, with bold **Balance Due** at the bottom.
- **Party Bill (Khata) PDF** — one tap from the parties list or party detail: a single clean A4 page with the party's full account (per-trip summary table, item total / commission / expenses, **trip goods (saman) itemized per trip**, total bill, total paid, balance due) — the proof-of-account to hand to the kisan/trader, no trip selection required.

**Trip calculations** (validated against real ledger records):
```
item total       = Σ line amounts (amount is editable — qty × rate is only a suggestion)
net trip bill    = item total − commission − diesel/driver − toll tax − labour cost
party bill total = Σ net trip bills of selected trips
balance due      = party bill total − total paid
```

> Note: payments are tracked per party (running khata, matching how advances are actually recorded), not attached to a specific consolidated bill. The consolidated statement is generated on demand from the selected trips + all recorded payments.

## Data storage: local now, Neon later

`src/config.ts` decides where data lives:

```ts
export const DATA_SOURCE: 'local' | 'api' = 'local'
export const API_BASE_URL = 'https://your-api.example.com/api'
```

- **`local`** (default) — everything stays in the browser's localStorage. Works fully offline; data is only on that phone/browser. Good for single-phone use right away.
- **`api`** — the app talks to your API instead. **`src/repos/apiRepo.ts` is already written** — implement your Neon-backed endpoints to match, flip the flag, done. No other app code changes needed.

### Expected REST contract (for your Neon backend)

| Method | Endpoint           | Body/Returns                                   |
| ------ | ------------------ | ---------------------------------------------- |
| GET    | `/business`        | BusinessInfo                                   |
| PUT    | `/business`        | BusinessInfo                                   |
| GET    | `/customers`       | Customer[]                                     |
| POST   | `/customers`       | Customer (client sends the full record incl. id) |
| DELETE | `/customers/:id`   | 204                                            |
| GET    | `/bills`           | Bill[] (items embedded)                        |
| GET    | `/bills/:id`       | Bill                                           |
| POST   | `/bills`           | Bill — **server assigns `invoiceNo` atomically** |
| PUT    | `/bills/:id`       | Bill                                           |
| DELETE | `/bills/:id`       | 204                                            |
| GET    | `/payments`        | Payment[]                                      |
| POST   | `/payments`        | Payment                                        |
| DELETE | `/payments/:id`    | 204                                            |
| GET    | `/parties`         | Party[]                                        |
| POST   | `/parties`         | Party                                          |
| GET    | `/trips`           | Trip[] (items embedded)                        |
| GET    | `/trips/:id`       | Trip                                           |
| POST   | `/trips`           | Trip — server assigns `trip_number` per party  |
| PUT    | `/trips/:id`       | Trip                                           |
| DELETE | `/trips/:id`       | 204                                            |
| GET    | `/party-payments`  | PartyPayment[]                                 |
| POST   | `/party-payments`  | PartyPayment                                   |
| DELETE | `/party-payments/:id` | 204                                        |

**Critical rules for the API:**
- Invoice numbers must be allocated **server-side** with a DB counter/sequence in `POST /bills` — never trust a client-supplied `invoiceNo`. Start at `737108`.
- Recompute `total_amount`, `commission_amount`, `grand_total` server-side from the items — never trust client totals. Apply the same unit factor: `item amount = qty × rate × factor` where `factor = 100` for `quintal`, `1` for `kg`/`piece`/`bag`.
- `grand_total = total + commission + labour + byaj − bhada` (commission, labour and byaj are added on top; bhada is deducted because the business bears transport).

### Suggested Neon schema

```sql
create table businesses (
  id serial primary key,
  name text not null default 'AAA FARM',
  tagline text default 'Professional Mandi Accounting System',
  address text, phone text, footer_note text,
  next_invoice_no int not null default 737108
);

create table customers (
  id text primary key,          -- client-generated uuid
  name text not null, mobile text, email text, address text,
  created_at timestamptz default now()
);

create table bills (
  id text primary key,          -- client-generated uuid
  invoice_no text unique not null,
  customer_id text references customers(id),
  bill_date date not null,
  status text not null default 'SAVED',
  commission_pct numeric default 8,
  bhada numeric default 0,
  labour_cost numeric default 0,
  byaj numeric default 0,          -- udhaar interest / credit charge
  notes text default 'FINAL BILL',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table bill_items (
  id text primary key,
  bill_id text references bills(id) on delete cascade,
  item_name text, qty numeric, unit text, rate numeric
);

create table payments (
  id text primary key,
  bill_id text references bills(id) on delete cascade,
  amount numeric, paid_date date, method text,
  created_at timestamptz default now()
);

create table parties (
  id text primary key,          -- client-generated uuid
  name text not null, phone text, address text,
  created_at timestamptz default now()
);

create table trips (
  id text primary key,
  party_id text references parties(id) on delete cascade,
  trip_number int not null,     -- sequential per party, server-assigned
  start_date date, end_date date,
  diesel_driver_cost numeric default 0,
  toll_tax numeric default 0,
  labour_cost numeric default 0,
  commission_amount numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table trip_items (
  id text primary key,
  trip_id text references trips(id) on delete cascade,
  item_name text, group_label text,
  quantity numeric, rate numeric, amount numeric  -- amount editable (ledger)
);

create table party_payments (
  id text primary key,
  party_id text references parties(id) on delete cascade,
  amount numeric, paid_date date, notes text,
  created_at timestamptz default now()
);
```

## Project structure

```
src/
  config.ts              # DATA_SOURCE switch, API base URL, invoice start
  types.ts               # Bill, Customer, Payment, BusinessInfo
  lib/calc.ts            # money formulas for bills AND trips (single source of truth)
  lib/format.ts          # ₹ Indian formatting, D/M/YYYY dates
  lib/pdf.ts             # jsPDF invoice + party statement (Roboto embedded → ₹ renders)
  lib/balance.ts         # bill + party paid / balance helpers
  repos/localRepo.ts     # localStorage repo (active)
  repos/apiRepo.ts       # Neon API repo (stub, ready to fill in)
  repos/types.ts         # DataRepo interface
  store/AppStore.tsx     # global state + actions
  components/            # BillForm, InvoicePreview, PartyBillPreview, Layout, ui
  pages/                 # NewBill, BillsList, BillView, Customers, CustomerDetail,
                         # Parties, PartyDetail, TripForm, PartyBill, Settings
```

## Notes

- `scripts/gen-icons.mjs` regenerates the PWA icons (`node scripts/gen-icons.mjs`) — no image tools needed.
- Roboto (OFL license) is embedded in the PDF so the ₹ symbol renders correctly; jsPDF's built-in Helvetica has no rupee glyph.
- Everything runs client-side; there are no environment variables required in local mode.
