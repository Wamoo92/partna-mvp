// ── Single source of truth for fee values (frontend) ──────────────────────
// Keep these in sync with supabase/functions/_shared/fees.ts. They are imported
// instead of hardcoding the numbers in individual pages.

export const CARRIER_FEE                  = 1800   // flat mobile-money payout fee (UGX)
export const PARTNA_WITHDRAWAL_FEE_PERCENT = 0.02  // 2% Partna fee on withdrawals
export const PARTNA_GENERAL_FEE_PERCENT    = 0.01  // 1% Partna fee on general savings payments
export const EARLY_EXIT_FEE_PERCENT        = 0.10  // 10% fee when leaving a campaign / closing account
export const MIN_WITHDRAWAL                = 5000  // minimum withdrawal (UGX)

// Card subscription pricing (UGX)
export const VIRTUAL_CARD_MONTHLY_FEE      = 5000
export const PHYSICAL_CARD_MONTHLY_FEE     = 10000
export const PHYSICAL_CARD_ISSUING_FEE     = 20000
