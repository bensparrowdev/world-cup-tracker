// Loads FOOTBALL_DATA_TOKEN (and any other vars) from .env into process.env.
// Vite's dev server does not populate process.env with unprefixed vars, so we
// load it explicitly here. This module is server-only (".server" suffix).
import "dotenv/config";

const BASE_URL = "https://api.football-data.org/v4";
const COMPETITION_CODE = "WC"; // FIFA World Cup

/**
 * Thrown when the API token is not configured. The route catches this and
 * renders a friendly "add your token" screen instead of crashing.
 */
export class MissingTokenError extends Error {
  constructor() {
    super("FOOTBALL_DATA_TOKEN is not set");
    this.name = "MissingTokenError";
  }
}

// --- Raw response types (only the fields we actually consume) ---

export interface FdTeam {
  id: number;
  name: string | null;
  shortName: string | null;
  tla: string | null;
  crest: string | null;
}

export interface FdStandingRow {
  position: number;
  team: FdTeam;
  playedGames: number;
  form: string | null;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface FdStandingGroup {
  stage: string;
  type: string; // "TOTAL" | "HOME" | "AWAY"
  group: string | null; // standings format, e.g. "Group A"
  table: FdStandingRow[];
}

export interface FdStandingsResponse {
  standings: FdStandingGroup[];
}

export type FdMatchStatus =
  | "SCHEDULED"
  | "TIMED"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "SUSPENDED"
  | "POSTPONED"
  | "CANCELLED"
  | "AWARDED";

export interface FdScoreLine {
  home: number | null;
  away: number | null;
}

export interface FdMatch {
  id: number;
  utcDate: string;
  status: FdMatchStatus;
  stage: string;
  group: string | null; // matches format, e.g. "GROUP_A"
  matchday: number | null;
  /** Match clock when live; omitted from list responses once finished. */
  minute?: number | null;
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  score: {
    winner: string | null;
    fullTime: FdScoreLine;
    halfTime: FdScoreLine;
  };
}

export interface FdMatchesResponse {
  matches: FdMatch[];
}

// --- In-memory TTL cache ---
// Shared across all requests in a single server process, so the number of
// upstream calls is decoupled from the number of visitors. In-flight dedup,
// minimum fetch spacing, and 429 backoff keep us under the free tier limit.
// Note: Vite dev HMR reloads this module and clears the cache — avoid rapid
// saves while testing against the live API.

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
const backoffUntil = new Map<string, number>();

/** Minimum gap between upstream fetches for the same path (~8 req/min cap). */
const MIN_FETCH_INTERVAL_MS = 7_500;
/** After a 429, stop calling upstream until this window elapses. */
const RATE_LIMIT_BACKOFF_MS = 90_000;

async function fetchCached<T>(path: string, ttlMs: number): Promise<T> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new MissingTokenError();

  const now = Date.now();
  const cached = cache.get(path) as CacheEntry<T> | undefined;

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  // Serve stale data while in a rate-limit backoff window.
  if (cached && now < (backoffUntil.get(path) ?? 0)) {
    return cached.data;
  }

  // Even after TTL expiry, don't hammer upstream if we fetched recently.
  if (cached && now - cached.fetchedAt < MIN_FETCH_INTERVAL_MS) {
    return cached.data;
  }

  const pending = inFlight.get(path) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = fetchFromUpstream<T>(path, ttlMs, cached, now);
  inFlight.set(path, promise);

  try {
    return await promise;
  } finally {
    inFlight.delete(path);
  }
}

async function fetchFromUpstream<T>(
  path: string,
  ttlMs: number,
  cached: CacheEntry<T> | undefined,
  now: number,
): Promise<T> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new MissingTokenError();

  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "X-Auth-Token": token },
  });

  if (!response.ok) {
    if (response.status === 429) {
      backoffUntil.set(path, now + RATE_LIMIT_BACKOFF_MS);
    }
    // Prefer stale data over breaking the page (including expired cache entries).
    if (cached) return cached.data;
    throw new Error(
      `football-data.org request failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as T;
  cache.set(path, { data, expiresAt: now + ttlMs, fetchedAt: now });
  backoffUntil.delete(path);
  return data;
}

// Shared cache TTLs — tuned to stay under football-data.org free tier (10 req/min)
// on a single Render instance even with homepage (60s) + sweepstake (5 min) open:
//   matches:   60s → up to ~1 upstream call/min
//   standings: 180s → up to ~0.33 upstream calls/min
//   combined worst case ≈ 1.3/min (sweepstake revalidates usually hit this cache)
const STANDINGS_TTL_MS = 180_000;
const MATCHES_TTL_MS = 60_000;

export function getStandings(): Promise<FdStandingsResponse> {
  return fetchCached<FdStandingsResponse>(
    `/competitions/${COMPETITION_CODE}/standings`,
    STANDINGS_TTL_MS,
  );
}

export function getMatches(): Promise<FdMatchesResponse> {
  return fetchCached<FdMatchesResponse>(
    `/competitions/${COMPETITION_CODE}/matches`,
    MATCHES_TTL_MS,
  );
}
