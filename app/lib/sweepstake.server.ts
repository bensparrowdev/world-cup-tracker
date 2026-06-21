import {
  getMatches,
  getStandings,
  type FdMatch,
  type FdStandingGroup,
  type FdTeam,
} from "./football-data.server";
import {
  SWEEPSTAKE_PARTICIPANTS,
  toApiTeamName,
} from "./sweepstake-config";
import type { TeamView } from "./world-cup.server";

export type TeamHighlight = "active" | "eliminated" | "lastWin" | "lastDraw";

export interface SweepstakeTeamRow {
  team: TeamView;
  points: number;
  played: number;
  group: string | null;
  position: number | null;
  highlight: TeamHighlight;
  /** True when the team could not be found in current standings. */
  missing: boolean;
}

export interface SweepstakePersonView {
  name: string;
  teams: SweepstakeTeamRow[];
  totalPoints: number;
  teamsRemaining: number;
}

export interface SweepstakeView {
  participants: SweepstakePersonView[];
  lastMatchSummary: string | null;
  lastUpdated: string;
}

interface TeamStandingEntry {
  team: TeamView;
  points: number;
  played: number;
  group: string | null;
  position: number;
}

const GROUP_MATCHES_PER_TEAM = 3;

const KNOCKOUT_STAGES: ReadonlySet<string> = new Set([
  "LAST_32",
  "LAST_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
  "THIRD_PLACE",
  "FINAL",
]);

function toTeamView(team: FdTeam): TeamView {
  return {
    name: team.name,
    shortName: team.shortName ?? team.name,
    tla: team.tla ?? team.name.slice(0, 3).toUpperCase(),
    crest: team.crest,
  };
}

function prettyGroup(raw: string | null): string | null {
  if (!raw) return null;
  return raw
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildTeamStandingsLookup(
  rawGroups: FdStandingGroup[],
): Map<string, TeamStandingEntry> {
  const lookup = new Map<string, TeamStandingEntry>();

  for (const group of rawGroups) {
    if (group.type !== "TOTAL") continue;

    const groupName = prettyGroup(group.group);
    for (const row of group.table) {
      lookup.set(row.team.name, {
        team: toTeamView(row.team),
        points: row.points,
        played: row.playedGames,
        group: groupName,
        position: row.position,
      });
    }
  }

  return lookup;
}

/** Teams definitively out after group stage (3 games, 3rd or 4th). */
function buildGroupEliminatedNames(
  rawGroups: FdStandingGroup[],
): Set<string> {
  const eliminated = new Set<string>();

  for (const group of rawGroups) {
    if (group.type !== "TOTAL") continue;

    for (const row of group.table) {
      if (
        row.playedGames >= GROUP_MATCHES_PER_TEAM &&
        row.position > 2
      ) {
        eliminated.add(row.team.name);
      }
    }
  }

  return eliminated;
}

/** Teams knocked out by losing a finished knockout match. */
function buildKnockoutEliminatedNames(matches: FdMatch[]): Set<string> {
  const eliminated = new Set<string>();

  for (const match of matches) {
    if (match.status !== "FINISHED" || !KNOCKOUT_STAGES.has(match.stage)) {
      continue;
    }

    const winner = match.score.winner;
    if (winner === "HOME_TEAM") {
      eliminated.add(match.awayTeam.name);
    } else if (winner === "AWAY_TEAM") {
      eliminated.add(match.homeTeam.name);
    }
  }

  return eliminated;
}

function buildEliminatedTeamNames(
  rawGroups: FdStandingGroup[],
  matches: FdMatch[],
): Set<string> {
  const eliminated = buildGroupEliminatedNames(rawGroups);
  for (const name of buildKnockoutEliminatedNames(matches)) {
    eliminated.add(name);
  }
  return eliminated;
}

function buildLastMatchHighlights(
  matches: FdMatch[],
): Map<string, "lastWin" | "lastDraw"> {
  const finished = matches
    .filter((match) => match.status === "FINISHED")
    .sort((a, b) => b.utcDate.localeCompare(a.utcDate));

  if (finished.length === 0) return new Map();

  const last = finished[0];
  const highlights = new Map<string, "lastWin" | "lastDraw">();
  const winner = last.score.winner;

  if (winner === "DRAW") {
    highlights.set(last.homeTeam.name, "lastDraw");
    highlights.set(last.awayTeam.name, "lastDraw");
  } else if (winner === "HOME_TEAM") {
    highlights.set(last.homeTeam.name, "lastWin");
  } else if (winner === "AWAY_TEAM") {
    highlights.set(last.awayTeam.name, "lastWin");
  }

  return highlights;
}

function formatLastMatchSummary(match: FdMatch): string {
  const home = match.score.fullTime.home ?? 0;
  const away = match.score.fullTime.away ?? 0;
  return `Last result: ${match.homeTeam.shortName ?? match.homeTeam.name} ${home}–${away} ${match.awayTeam.shortName ?? match.awayTeam.name}`;
}

function resolveHighlight(
  apiName: string,
  eliminated: Set<string>,
  lastMatch: Map<string, "lastWin" | "lastDraw">,
): TeamHighlight {
  if (eliminated.has(apiName)) return "eliminated";

  const lastResult = lastMatch.get(apiName);
  if (lastResult === "lastWin") return "lastWin";
  if (lastResult === "lastDraw") return "lastDraw";

  return "active";
}

function resolveTeamRow(
  label: string,
  lookup: Map<string, TeamStandingEntry>,
  eliminated: Set<string>,
  lastMatch: Map<string, "lastWin" | "lastDraw">,
): SweepstakeTeamRow {
  const apiName = toApiTeamName(label);
  const entry = lookup.get(apiName);

  if (entry) {
    return {
      team: entry.team,
      points: entry.points,
      played: entry.played,
      group: entry.group,
      position: entry.position,
      highlight: resolveHighlight(apiName, eliminated, lastMatch),
      missing: false,
    };
  }

  return {
    team: {
      name: apiName,
      shortName: label,
      tla: label.slice(0, 3).toUpperCase(),
      crest: null,
    },
    points: 0,
    played: 0,
    group: null,
    position: null,
    highlight: resolveHighlight(apiName, eliminated, lastMatch),
    missing: true,
  };
}

export async function getSweepstakeView(): Promise<SweepstakeView> {
  const [standings, matchesResponse] = await Promise.all([
    getStandings(),
    getMatches(),
  ]);

  const matches = matchesResponse.matches;
  const lookup = buildTeamStandingsLookup(standings.standings);
  const eliminated = buildEliminatedTeamNames(standings.standings, matches);
  const lastMatch = buildLastMatchHighlights(matches);

  const finished = matches
    .filter((match) => match.status === "FINISHED")
    .sort((a, b) => b.utcDate.localeCompare(a.utcDate));

  const participants: SweepstakePersonView[] = SWEEPSTAKE_PARTICIPANTS.map(
    (participant) => {
      const teams = participant.teams.map((label) =>
        resolveTeamRow(label, lookup, eliminated, lastMatch),
      );
      const totalPoints = teams.reduce((sum, row) => sum + row.points, 0);
      const teamsRemaining = teams.filter(
        (row) => row.highlight !== "eliminated",
      ).length;

      return {
        name: participant.name,
        teams,
        totalPoints,
        teamsRemaining,
      };
    },
  );

  return {
    participants,
    lastMatchSummary:
      finished.length > 0 ? formatLastMatchSummary(finished[0]) : null,
    lastUpdated: new Date().toISOString(),
  };
}
