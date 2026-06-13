import { useEffect, useState } from "react";
import { formatLocal, formatUtc } from "../lib/datetime";

/**
 * Renders a kickoff time without a hydration mismatch: the server and the
 * first client render both show the deterministic UTC string, then we swap to
 * the visitor's local time zone once mounted in the browser.
 */
export function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState(() => formatUtc(iso));

  useEffect(() => {
    setText(formatLocal(iso));
  }, [iso]);

  return <time dateTime={iso}>{text}</time>;
}
