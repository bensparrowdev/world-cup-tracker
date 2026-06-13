import { useEffect } from "react";
import { useRevalidator } from "react-router";

/**
 * Silently re-fetches route loader data on an interval. Pauses while the tab is
 * hidden so background tabs don't trigger pointless server/API work.
 */
export function useAutoRefresh(intervalMs: number) {
  const revalidator = useRevalidator();

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        revalidator.revalidate();
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [revalidator, intervalMs]);
}
