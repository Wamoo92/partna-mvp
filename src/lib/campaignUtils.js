// Shared campaign status utility
// Used by both business portal and customer portal

const DELETION_WINDOW_MS = 48 * 60 * 60 * 1000 // 48 hours

/**
 * Returns the effective status of a campaign.
 * If paused and 48hrs have passed, treats it as deleted (lazy evaluation).
 * @param {object} campaign
 * @returns 'active' | 'paused' | 'deleted'
 */
export function getEffectiveStatus(campaign) {
  if (!campaign) return 'deleted'
  if (campaign.status === 'deleted') return 'deleted'
  if (campaign.status === 'paused') {
    if (!campaign.deletion_initiated_at) return 'paused'
    const elapsed = Date.now() - new Date(campaign.deletion_initiated_at).getTime()
    if (elapsed >= DELETION_WINDOW_MS) return 'deleted'
    return 'paused'
  }
  return 'active'
}

/**
 * Returns ms remaining in the 48hr deletion window.
 * Returns 0 if window has passed.
 * @param {object} campaign
 * @returns number
 */
export function getDeletionMsRemaining(campaign) {
  if (!campaign?.deletion_initiated_at) return 0
  const elapsed = Date.now() - new Date(campaign.deletion_initiated_at).getTime()
  return Math.max(DELETION_WINDOW_MS - elapsed, 0)
}

/**
 * Formats milliseconds as dd:hh:mm:ss
 * @param {number} ms
 * @returns string
 */
export function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const d = Math.floor(totalSeconds / 86400)
  const h = Math.floor((totalSeconds % 86400) / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [
    String(d).padStart(2, '0'),
    String(h).padStart(2, '0'),
    String(m).padStart(2, '0'),
    String(s).padStart(2, '0'),
  ].join(':')
}