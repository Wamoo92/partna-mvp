// ── Single source of truth for fee values (Edge Functions) ────────────────
// Keep in sync with src/lib/constants.js. Imported by process-withdrawal,
// leave-campaign and close-account instead of hardcoding the carrier fee, etc.

export const CARRIER_FEE                   = 1800  // flat mobile-money payout fee (UGX)
export const PARTNA_WITHDRAWAL_FEE_PERCENT = 0.02  // 2% Partna fee on withdrawals
export const PARTNA_GENERAL_FEE_PERCENT    = 0.01  // 1% Partna fee on general savings payments
export const EARLY_EXIT_FEE_PERCENT        = 0.10  // 10% fee on leaving a campaign / closing account
