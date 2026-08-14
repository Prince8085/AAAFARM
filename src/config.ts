/**
 * App configuration.
 *
 * DATA_SOURCE controls where bills/customers/payments are stored:
 *  - 'local' → everything stays in this browser (localStorage). Works offline,
 *              no server needed. Active by default.
 *  - 'api'   → talks to your Neon-backed API. The apiRepo.ts stub is ready;
 *              point API_BASE_URL at your deployed API and it will be used.
 */
export const DATA_SOURCE: 'local' | 'api' = 'local'

/** Base URL of the future Neon-backed API (only used when DATA_SOURCE === 'api'). */
export const API_BASE_URL = 'https://your-api.example.com/api'

/** Invoice numbers start from BILL-737108. */
export const INVOICE_START = 737108

/** localStorage keys (local mode only). */
export const LS_KEYS = {
  business: 'aaa.business',
  customers: 'aaa.customers',
  bills: 'aaa.bills',
  payments: 'aaa.payments',
  draft: 'aaa.draft',
  parties: 'aaa.parties',
  trips: 'aaa.trips',
  partyPayments: 'aaa.partyPayments',
} as const
