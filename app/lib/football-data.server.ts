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
  name: string;
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
// upstream calls is decoupled from the number of visitors. This keeps us
// well under the free tier's 10 requests/minute limit.

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

async function fetchCached<T>(path: string, ttlMs: number): Promise<T> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new MissingTokenError();

  const now = Date.now();
  const cached = cache.get(path) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > now) return cached.data;

  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "X-Auth-Token": token },
  });

  if (!response.ok) {
    // Serve stale data on a transient upstream error rather than breaking the
    // page; only throw if we have nothing cached to fall back on.
    if (cached) return cached.data;
    throw new Error(
      `football-data.org request failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as T;
  cache.set(path, { data, expiresAt: now + ttlMs });
  return data;
}

// Shared cache TTLs — tuned to stay under football-data.org free tier (10 req/min)
// on a single Render instance even with homepage (30s) + sweepstake (5 min) open:
//   matches:   30s → up to ~2 upstream calls/min
//   standings: 120s → up to ~0.5 upstream calls/min
//   combined worst case ≈ 2.5/min (sweepstake revalidates usually hit this cache)
const STANDINGS_TTL_MS = 120_000;
const MATCHES_TTL_MS = 30_000;

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
