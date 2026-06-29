// ── Single source of truth for fee values + formatting (Edge Functions) ────
// Keep in sync with src/lib/constants.js.

export const CARRIER_FEE                   = 1800  // flat mobile-money payout fee (UGX) — cost to Partna
export const PARTNA_WITHDRAWAL_FEE_PERCENT = 0.02  // 2% Partna fee on customer withdrawals
export const PARTNA_GENERAL_FEE_PERCENT    = 0.01  // 1% Partna fee on general savings payments
export const EARLY_EXIT_FEE_PERCENT        = 0.10  // 10% fee on leaving a campaign / closing account

export const BUSINESS_WITHDRAWAL_FEE_PERCENT = 0.03  // 3% Partna fee on business withdrawals
export const BUSINESS_CARRIER_FEE            = 6000  // flat bank-transfer fee (UGX) — cost to Partna
export const MIN_BUSINESS_WITHDRAWAL         = 1000

// Single currency formatter: full number, comma separators, 2 decimals.
// e.g. UGX 12,000.00 — never abbreviated. Use this in emails/SMS/responses.
export function formatUGX(n: number): string {
  const num = Number(n)
  return 'UGX ' + (isNaN(num) ? 0 : num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
