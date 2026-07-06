import { useEffect, useRef } from "react";

const TRACKED_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];

const idleKey    = (uid) => `sfms_last_activity_${uid}`;
const sessionKey = (uid) => `sfms_session_start_${uid}`;

/**
 * Calls onExpire when:
 *   - the user has been idle for >= idleMs, OR
 *   - the session has been open for >= sessionMs
 *
 * Timestamps live in localStorage so they survive tab refreshes.
 * DOM events on the window keep lastActivity current while the user is active.
 */
export function useIdleTimer({ uid, idleMs, sessionMs, onExpire }) {
  // Keep onExpire stable so the effect doesn't re-run on every render
  const onExpireRef = useRef(onExpire);
  useEffect(() => { onExpireRef.current = onExpire; });

  useEffect(() => {
    if (!uid) return;

    const ik = idleKey(uid);
    const sk = sessionKey(uid);
    const now = Date.now();

    // Seed timestamps if this is a fresh session
    if (!localStorage.getItem(ik)) localStorage.setItem(ik, now);
    if (!localStorage.getItem(sk)) localStorage.setItem(sk, now);

    const updateActivity = () => localStorage.setItem(ik, Date.now());

    const check = () => {
      const n    = Date.now();
      const idle = n - Number(localStorage.getItem(ik) ?? n);
      const age  = n - Number(localStorage.getItem(sk) ?? n);
      if (idle >= idleMs || age >= sessionMs) {
        // Clear both so the next mount starts a fresh clock
        localStorage.removeItem(ik);
        localStorage.removeItem(sk);
        onExpireRef.current();
      }
    };

    TRACKED_EVENTS.forEach(e => window.addEventListener(e, updateActivity, { passive: true }));

    // Check immediately on mount (covers "came back after a long time" case)
    check();

    const interval = setInterval(check, 60_000);

    return () => {
      TRACKED_EVENTS.forEach(e => window.removeEventListener(e, updateActivity));
      clearInterval(interval);
    };
  }, [uid, idleMs, sessionMs]);
}
