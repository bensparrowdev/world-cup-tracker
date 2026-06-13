import {
  getMatches,
  getStandings,
  type FdMatch,
  type FdMatchStatus,
  type FdStandingGroup,
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

export interface HeroView {
  status: HeroStatus;
  statusLabel: string;
  kickoff: string; // ISO 8601 (UTC)
  group: string | null;
  home: TeamView;
  away: TeamView;
  homeScore: number | null;
  awayScore: number | null;
}

export interface WorldCupView {
  groups: GroupView[];
  hero: HeroView | null;
  lastUpdated: string; // ISO 8601 (UTC)
}

const QUALIFYING_SPOTS = 2;
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

function toTeamView(team: FdTeam): TeamView {
  return {
    name: team.name,
    shortName: team.shortName ?? team.name,
    tla: team.tla ?? team.name.slice(0, 3).toUpperCase(),
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

function buildGroups(rawGroups: FdStandingGroup[]): GroupView[] {
  return rawGroups
    .filter((group) => group.type === "TOTAL")
    .map((group) => ({
      name: prettyGroup(group.group) ?? "Group",
      rows: group.table.map((row, index) => ({
        position: row.position,
        team: toTeamView(row.team),
        played: row.playedGames,
        won: row.won,
        draw: row.draw,
        lost: row.lost,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDifference: row.goalDifference,
        points: row.points,
        qualifies: index < QUALIFYING_SPOTS,
      })),
    }));
}

function heroStatusLabel(status: HeroStatus): string {
  switch (status) {
    case "LIVE":
      return "LIVE";
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
    statusLabel: heroStatusLabel(status),
    kickoff: match.utcDate,
    group: prettyGroup(match.group),
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
 * Works out the hero status for a match that has already kicked off. We trust
 * the API status when it is meaningful, but fall back to elapsed time because
 * the free tier is often slow to move a match off "TIMED" once it starts.
 */
function statusForKickedOffMatch(match: FdMatch, elapsedMs: number): HeroStatus {
  if (match.status === "PAUSED") return "HALF_TIME";
  if (match.status === "IN_PLAY") return "LIVE";
  if (match.status === "FINISHED") return "FINISHED";
  return elapsedMs <= LIVE_WINDOW_MS ? "LIVE" : "FINISHED";
}

/**
 * Picks the match shown in the hero:
 * - The most recent match that has already kicked off. If it is still within
 *   its playing window (and not marked finished) it shows as LIVE with the
 *   latest score; otherwise it is the last result played.
 * - Before any match has kicked off, the next upcoming match is shown instead.
 */
function selectHeroMatch(matches: FdMatch[], now: number): HeroView | null {
  const kickedOff = matches
    .filter(
      (match) =>
        !SKIP_STATUSES.has(match.status) && Date.parse(match.utcDate) <= now,
    )
    .sort(byUtcDateDesc);

  if (kickedOff.length > 0) {
    const match = kickedOff[0];
    const elapsedMs = now - Date.parse(match.utcDate);
    return toHeroView(match, statusForKickedOffMatch(match, elapsedMs));
  }

  const upcoming = matches
    .filter((match) => UPCOMING_STATUSES.has(match.status))
    .sort(byUtcDateAsc);
  return upcoming.length > 0 ? toHeroView(upcoming[0], "UPCOMING") : null;
}

export async function getWorldCupView(): Promise<WorldCupView> {
  const [standings, matches] = await Promise.all([
    getStandings(),
    getMatches(),
  ]);

  return {
    groups: buildGroups(standings.standings),
    hero: selectHeroMatch(matches.matches, Date.now()),
    lastUpdated: new Date().toISOString(),
  };
}
