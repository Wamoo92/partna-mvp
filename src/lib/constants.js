// ── Single source of truth for fee values + currency formatting (frontend) ──
// Keep the fee values in sync with supabase/functions/_shared/fees.ts.

// ── Customer withdrawal fees (mobile money) ───────────────────────────────
export const CARRIER_FEE                  = 1800   // flat mobile-money payout fee (UGX) — cost to Partna, not revenue
export const PARTNA_WITHDRAWAL_FEE_PERCENT = 0.02  // 2% Partna fee on customer withdrawals
export const PARTNA_GENERAL_FEE_PERCENT    = 0.01  // 1% Partna fee on general savings payments (legacy)
export const EARLY_EXIT_FEE_PERCENT        = 0.10  // 10% fee when leaving a campaign / closing account
export const MIN_WITHDRAWAL                = 5000  // minimum customer withdrawal (UGX)

// ── Business withdrawal fees (business wallet → bank) ──────────────────────
export const BUSINESS_WITHDRAWAL_FEE_PERCENT = 0.03  // 3% Partna fee on business withdrawals
export const BUSINESS_CARRIER_FEE            = 6000  // flat bank-transfer fee (UGX) — cost to Partna, not revenue
export const MIN_BUSINESS_WITHDRAWAL         = 1000  // minimum business withdrawal (UGX)

// ── Card subscription pricing (UGX) ───────────────────────────────────────
export const VIRTUAL_CARD_MONTHLY_FEE      = 5000
export const PHYSICAL_CARD_MONTHLY_FEE     = 10000
export const PHYSICAL_CARD_ISSUING_FEE     = 20000

// ── Single currency formatter for the entire platform ─────────────────────
// Always renders the full number with comma thousands separators and exactly
// two decimal places, e.g. UGX 12,000.00 / UGX 1,500,000.00 / UGX 100.00.
// Do NOT abbreviate to K/M anywhere — import this instead of redefining formatUGX.
export function formatUGX(n) {
  const num = Number(n)
  return 'UGX ' + (isNaN(num) ? 0 : num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Customer-withdrawal fee breakdown helper (single source for UI + checks).
export function customerWithdrawalFees(gross) {
  const amt        = Number(gross) || 0
  const partnaFee  = Math.round(amt * PARTNA_WITHDRAWAL_FEE_PERCENT)
  const carrierFee = CARRIER_FEE
  const totalFees  = partnaFee + carrierFee
  const netAmount  = Math.max(0, amt - totalFees)
  return { gross: amt, partnaFee, carrierFee, totalFees, netAmount }
}

// Business-withdrawal fee breakdown helper.
export function businessWithdrawalFees(gross) {
  const amt        = Number(gross) || 0
  const partnaFee  = Math.round(amt * BUSINESS_WITHDRAWAL_FEE_PERCENT)
  const carrierFee = BUSINESS_CARRIER_FEE
  const totalFees  = partnaFee + carrierFee
  const netAmount  = Math.max(0, amt - totalFees)
  return { gross: amt, partnaFee, carrierFee, totalFees, netAmount }
}
