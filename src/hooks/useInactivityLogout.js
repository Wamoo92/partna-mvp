import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * useInactivityLogout
 *
 * Logs the user out after a period of inactivity.
 * Shows a warning modal 60 seconds before logout so the user
 * can extend their session.
 *
 * @param {number}   timeoutMs  - Inactivity timeout in milliseconds
 * @param {function} onLogout   - Called when the session expires (should sign out + redirect)
 *
 * @returns {{ showWarning, secondsLeft, extendSession }}
 *   showWarning    — boolean, true when the warning modal should be shown
 *   secondsLeft    — number, countdown seconds remaining in the warning window
 *   extendSession  — function, call this when the user clicks "Stay logged in"
 */

const WARNING_BEFORE_MS = 60 * 1000  // show warning 60 seconds before logout
const EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']

export function useInactivityLogout(timeoutMs, onLogout) {
  const [showWarning, setShowWarning]   = useState(false)
  const [secondsLeft, setSecondsLeft]   = useState(60)

  const logoutTimer    = useRef(null)
  const warningTimer   = useRef(null)
  const countdownTimer = useRef(null)
  const onLogoutRef    = useRef(onLogout)

  // Keep onLogout ref current without re-running effects
  useEffect(() => { onLogoutRef.current = onLogout }, [onLogout])

  const clearAllTimers = useCallback(() => {
    clearTimeout(logoutTimer.current)
    clearTimeout(warningTimer.current)
    clearInterval(countdownTimer.current)
  }, [])

  const startTimers = useCallback(() => {
    clearAllTimers()
    setShowWarning(false)

    // Warning fires (timeoutMs - WARNING_BEFORE_MS) after last activity
    warningTimer.current = setTimeout(() => {
      setShowWarning(true)
      setSecondsLeft(60)

      // Countdown ticker
      countdownTimer.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) {
            clearInterval(countdownTimer.current)
            return 0
          }
          return s - 1
        })
      }, 1000)
    }, Math.max(timeoutMs - WARNING_BEFORE_MS, 0))

    // Hard logout at timeoutMs
    logoutTimer.current = setTimeout(() => {
      clearAllTimers()
      setShowWarning(false)
      onLogoutRef.current()
    }, timeoutMs)
  }, [timeoutMs, clearAllTimers])

  // Reset timers on any user activity
  const handleActivity = useCallback(() => {
    // Only reset if warning is not yet showing — once warning shows,
    // the user must explicitly click "Stay logged in"
    setShowWarning(prev => {
      if (!prev) startTimers()
      return prev
    })
  }, [startTimers])

  // Extend session — called when user clicks "Stay logged in"
  const extendSession = useCallback(() => {
    clearAllTimers()
    setShowWarning(false)
    setSecondsLeft(60)
    startTimers()
  }, [clearAllTimers, startTimers])

  useEffect(() => {
    startTimers()

    EVENTS.forEach(event => window.addEventListener(event, handleActivity, { passive: true }))

    return () => {
      clearAllTimers()
      EVENTS.forEach(event => window.removeEventListener(event, handleActivity))
    }
  }, [startTimers, handleActivity, clearAllTimers])

  return { showWarning, secondsLeft, extendSession }
}