import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scroll restoration for React Router v6 SPAs.
 *
 * Problem: navigate(-1) remounts the component tree from scratch; the browser's
 * native scroll restoration only works for real page loads, not pushState SPA nav.
 *
 * Why two separate effects:
 *   useLayoutEffect cleanup  → runs synchronously BEFORE the browser paints the
 *                              new page, which means it runs before the browser
 *                              fires the post-DOM-change scroll-clamp event that
 *                              would corrupt window.scrollY.  We save the value
 *                              from scrollRef (last genuine user scroll) not from
 *                              window.scrollY (which may already be clamped).
 *
 *   useEffect                → runs after paint; safe to schedule scrollTo calls
 *                              and to set up/tear-down the scroll listener.
 */
export default function ScrollRestorer() {
  const { key } = useLocation();

  // Always-current scroll position tracked in a ref (no re-renders)
  const scrollRef = useRef(0);

  useEffect(() => {
    const track = () => { scrollRef.current = window.scrollY; };
    window.addEventListener("scroll", track, { passive: true });
    return () => window.removeEventListener("scroll", track);
  }, []);

  // Save position synchronously before the browser has a chance to clamp scrollY
  useLayoutEffect(() => {
    return () => {
      sessionStorage.setItem(`scroll_${key}`, String(scrollRef.current));
    };
  }, [key]);

  // Restore with retries for async Firestore content loading.
  // Cancel all pending retries the moment the user intentionally scrolls —
  // wheel/touchmove cannot be triggered by a programmatic scrollTo, so there
  // is no risk of cancelling our own restoration call.
  useEffect(() => {
    const saved = sessionStorage.getItem(`scroll_${key}`);
    const target = saved !== null ? Number(saved) : 0;

    const timers = [0, 250, 600, 1000].map((d) =>
      setTimeout(() => window.scrollTo(0, target), d)
    );

    const cancelRetries = () => timers.forEach(clearTimeout);

    window.addEventListener("wheel",      cancelRetries, { once: true, passive: true });
    window.addEventListener("touchmove",  cancelRetries, { once: true, passive: true });
    window.addEventListener("touchstart", cancelRetries, { once: true, passive: true });

    return () => {
      cancelRetries();
      window.removeEventListener("wheel",      cancelRetries);
      window.removeEventListener("touchmove",  cancelRetries);
      window.removeEventListener("touchstart", cancelRetries);
    };
  }, [key]);

  return null;
}
