import {
  getMatches,
  type FdMatch,
  type FdMatchStatus,
  type FdTeam,
} from "./football-data.server";

// --- View models consumed by the UI (decoupled from the raw API shape) ---

export interface TeamView {
  name: string;
  shortName: string;
  tla: string;
  crest: string | null;
}

export interface StandingRowView {
  position: number;
  team: TeamView;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  /** Top two teams in each group qualify for the next round. */
  qualifies: boolean;
}

export interface GroupView {
  name: string;
  rows: StandingRowView[];
}

export type HeroStatus = "LIVE" | "HALF_TIME" | "FINISHED" | "UPCOMING";

export interface KnockoutMatchView {
  id: number;
  status: HeroStatus;
  statusLabel: string;
  kickoff: string; // ISO 8601 (UTC)
  home: TeamView;
  away: TeamView;
  homeScore: number | null;
  awayScore: number | null;
}

export interface KnockoutRoundView {
  stage: string;
  label: string;
  matches: KnockoutMatchView[];
}

export interface HeroView {
  status: HeroStatus;
  statusLabel: string;
  kickoff: string; // ISO 8601 (UTC)
  /** Match clock from the API when available (e.g. 67 during second half). */
  minute: number | null;
  /** Group name during the group stage; null for knockout matches. */
  group: string | null;
  /** Human-readable round label (group or knockout stage). */
  roundLabel: string | null;
  home: TeamView;
  away: TeamView;
  homeScore: number | null;
  awayScore: number | null;
}

export interface WorldCupView {
  knockoutRounds: KnockoutRoundView[];
  hero: HeroView | null;
  lastUpdated: string; // ISO 8601 (UTC)
}

const KNOCKOUT_STAGES: ReadonlySet<string> = new Set([
  "LAST_32",
  "LAST_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
  "THIRD_PLACE",
  "FINAL",
]);

const KNOCKOUT_STAGE_ORDER: readonly string[] = [
  "LAST_32",
  "LAST_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
  "THIRD_PLACE",
  "FINAL",
];

const STAGE_LABELS: Readonly<Record<string, string>> = {
  LAST_32: "Round of 32",
  LAST_16: "Round of 16",
  QUARTER_FINALS: "Quarter-finals",
  SEMI_FINALS: "Semi-finals",
  THIRD_PLACE: "Third-place playoff",
  FINAL: "Final",
};
const UPCOMING_STATUSES: ReadonlySet<FdMatchStatus> = new Set([
  "SCHEDULED",
  "TIMED",
]);
const SKIP_STATUSES: ReadonlySet<FdMatchStatus> = new Set([
  "CANCELLED",
  "POSTPONED",
  "SUSPENDED",
]);

// How long after kickoff a match is still considered "in progress". Covers 90
// minutes plus half-time and stoppage, with headroom for knockout extra time.
// Used to detect live games even when the free-tier feed is slow to flip a
// match's status away from "TIMED".
const LIVE_WINDOW_MS = 150 * 60 * 1000;

// Elapsed kickoff window where PAUSED most likely means the actual half-time
// break. Outside this window the free tier often leaves status stuck on PAUSED
// through the entire second half.
const HALF_TIME_ELAPSED_START_MIN = 42;
const HALF_TIME_ELAPSED_END_MIN = 70;

function toTeamView(team: FdTeam): TeamView {
  // Knockout fixtures often ship with null team names before pairings are set.
  const name = team.name ?? "TBD";
  return {
    name,
    shortName: team.shortName ?? name,
    tla: team.tla ?? name.slice(0, 3).toUpperCase(),
    crest: team.crest,
  };
}

/**
 * Normalizes group labels to a single readable form. The two endpoints
 * disagree: standings return "Group A" while matches return "GROUP_A".
 */
function prettyGroup(raw: string | null): string | null {
  if (!raw) return null;
  return raw
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function prettyStage(stage: string): string | null {
  return STAGE_LABELS[stage] ?? null;
}

function roundLabelForMatch(match: FdMatch): string | null {
  return prettyGroup(match.group) ?? prettyStage(match.stage);
}

function heroStatusLabel(status: HeroStatus, minute: number | null): string {
  switch (status) {
    case "LIVE":
      return minute !== null ? `LIVE · ${minute}'` : "LIVE";
    case "HALF_TIME":
      return "HALF TIME";
    case "FINISHED":
      return "FULL TIME";
    case "UPCOMING":
      return "UPCOMING";
  }
}

function toHeroView(match: FdMatch, status: HeroStatus): HeroView {
  return {
    status,
    statusLabel: heroStatusLabel(status, match.minute ?? null),
    kickoff: match.utcDate,
    minute: match.minute ?? null,
    group: prettyGroup(match.group),
    roundLabel: roundLabelForMatch(match),
    home: toTeamView(match.homeTeam),
    away: toTeamView(match.awayTeam),
    homeScore: match.score.fullTime.home,
    awayScore: match.score.fullTime.away,
  };
}

const byUtcDateAsc = (a: FdMatch, b: FdMatch) =>
  a.utcDate.localeCompare(b.utcDate);
const byUtcDateDesc = (a: FdMatch, b: FdMatch) =>
  b.utcDate.localeCompare(a.utcDate);

/**
 * The free tier often keeps status on PAUSED long after half-time ends. Only
 * treat PAUSED as half-time when the match clock or elapsed kickoff time fits
 * the usual break window.
 */
function isAtHalfTime(match: FdMatch, elapsedMs: number): boolean {
  if (match.status !== "PAUSED") return false;

  if (match.minute != null) {
    return match.minute >= 44 && match.minute <= 47;
  }

  const elapsedMin = elapsedMs / 60_000;
  return (
    elapsedMin >= HALF_TIME_ELAPSED_START_MIN &&
    elapsedMin <= HALF_TIME_ELAPSED_END_MIN
  );
}

/**
 * Works out the hero status for a match that has already kicked off. We trust
 * the API status when it is meaningful, but fall back to elapsed time because
 * the free tier is often slow to move a match off "TIMED" once it starts.
 */
function statusForKickedOffMatch(match: FdMatch, elapsedMs: number): HeroStatus {
  if (match.status === "FINISHED") return "FINISHED";
  if (match.status === "IN_PLAY") return "LIVE";
  if (match.status === "PAUSED") {
    return isAtHalfTime(match, elapsedMs) ? "HALF_TIME" : "LIVE";
  }
  return elapsedMs <= LIVE_WINDOW_MS ? "LIVE" : "FINISHED";
}

function isPotentiallyLive(match: FdMatch, now: number): boolean {
  if (SKIP_STATUSES.has(match.status)) return false;
  if (match.status === "FINISHED") return false;

  const kickoffMs = Date.parse(match.utcDate);
  if (kickoffMs > now) return false;

  const elapsedMs = now - kickoffMs;
  if (elapsedMs > LIVE_WINDOW_MS) return false;

  return (
    match.status === "IN_PLAY" ||
    match.status === "PAUSED" ||
    UPCOMING_STATUSES.has(match.status)
  );
}

function matchDisplayStatus(match: FdMatch, now: number): HeroStatus {
  const kickoffMs = Date.parse(match.utcDate);
  const elapsedMs = now - kickoffMs;

  if (kickoffMs > now && UPCOMING_STATUSES.has(match.status)) {
    return "UPCOMING";
  }

  if (kickoffMs <= now) {
    return statusForKickedOffMatch(match, elapsedMs);
  }

  if (match.status === "PAUSED") {
    return isAtHalfTime(match, elapsedMs) ? "HALF_TIME" : "LIVE";
  }
  if (match.status === "IN_PLAY") return "LIVE";
  if (match.status === "FINISHED") return "FINISHED";
  return "UPCOMING";
}

function toKnockoutMatchView(match: FdMatch, now: number): KnockoutMatchView {
  const status = matchDisplayStatus(match, now);
  return {
    id: match.id,
    status,
    statusLabel: heroStatusLabel(status, match.minute ?? null),
    kickoff: match.utcDate,
    home: toTeamView(match.homeTeam),
    away: toTeamView(match.awayTeam),
    homeScore: match.score.fullTime.home,
    awayScore: match.score.fullTime.away,
  };
}

function buildKnockoutRounds(matches: FdMatch[], now: number): KnockoutRoundView[] {
  const byStage = new Map<string, FdMatch[]>();

  for (const match of matches) {
    if (!KNOCKOUT_STAGES.has(match.stage) || SKIP_STATUSES.has(match.status)) {
      continue;
    }
    const roundMatches = byStage.get(match.stage) ?? [];
    roundMatches.push(match);
    byStage.set(match.stage, roundMatches);
  }

  return KNOCKOUT_STAGE_ORDER.flatMap((stage) => {
    const roundMatches = byStage.get(stage);
    if (!roundMatches || roundMatches.length === 0) return [];

    return [
      {
        stage,
        label: STAGE_LABELS[stage] ?? stage,
        matches: roundMatches
          .sort(byUtcDateAsc)
          .map((match) => toKnockoutMatchView(match, now)),
      },
    ];
  });
}

/**
 * Picks the match shown in the hero:
 * - Prefer any match that is currently in its playing window (IN_PLAY, PAUSED,
 *   or stale TIMED) over a more recently kicked-off full-time result.
 * - Among live candidates, show the most recently kicked-off game.
 * - Otherwise show the latest finished result, then the next upcoming match.
 */
function selectHeroMatch(matches: FdMatch[], now: number): HeroView | null {
  const liveNow = matches
    .filter((match) => isPotentiallyLive(match, now))
    .sort(byUtcDateDesc);

  if (liveNow.length > 0) {
    const match = liveNow[0];
    const elapsedMs = now - Date.parse(match.utcDate);
    return toHeroView(match, statusForKickedOffMatch(match, elapsedMs));
  }

  const finished = matches
    .filter(
      (match) =>
        !SKIP_STATUSES.has(match.status) &&
        match.status === "FINISHED" &&
        Date.parse(match.utcDate) <= now,
    )
    .sort(byUtcDateDesc);

  if (finished.length > 0) {
    return toHeroView(finished[0], "FINISHED");
  }

  const upcoming = matches
    .filter((match) => UPCOMING_STATUSES.has(match.status))
    .sort(byUtcDateAsc);
  return upcoming.length > 0 ? toHeroView(upcoming[0], "UPCOMING") : null;
}

export async function getWorldCupView(): Promise<WorldCupView> {
  const matches = await getMatches();
  const now = Date.now();

  return {
    knockoutRounds: buildKnockoutRounds(matches.matches, now),
    hero: selectHeroMatch(matches.matches, now),
    lastUpdated: new Date().toISOString(),
  };
}
