import {
  getStandings,
  type FdStandingGroup,
  type FdTeam,
} from "./football-data.server";
import {
  SWEEPSTAKE_PARTICIPANTS,
  toApiTeamName,
} from "./sweepstake-config";
import type { TeamView } from "./world-cup.server";

export interface SweepstakeTeamRow {
  team: TeamView;
  points: number;
  played: number;
  group: string | null;
  position: number | null;
  /** True when the team could not be found in current standings. */
  missing: boolean;
}

export interface SweepstakePersonView {
  name: string;
  teams: SweepstakeTeamRow[];
  totalPoints: number;
  averagePoints: number;
  isLeading: boolean;
}

export interface SweepstakeView {
  participants: SweepstakePersonView[];
  lastUpdated: string;
}

interface TeamStandingEntry {
  team: TeamView;
  points: number;
  played: number;
  group: string | null;
  position: number;
}

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

function resolveTeamRow(
  label: string,
  lookup: Map<string, TeamStandingEntry>,
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
    missing: true,
  };
}

export async function getSweepstakeView(): Promise<SweepstakeView> {
  const standings = await getStandings();
  const lookup = buildTeamStandingsLookup(standings.standings);

  const participants: SweepstakePersonView[] = SWEEPSTAKE_PARTICIPANTS.map(
    (participant) => {
      const teams = participant.teams.map((label) =>
        resolveTeamRow(label, lookup),
      );
      const totalPoints = teams.reduce((sum, row) => sum + row.points, 0);
      const averagePoints =
        teams.length > 0 ? totalPoints / teams.length : 0;

      return {
        name: participant.name,
        teams,
        totalPoints,
        averagePoints,
        isLeading: false,
      };
    },
  );

  const maxAverage = Math.max(...participants.map((p) => p.averagePoints));

  for (const participant of participants) {
    participant.isLeading = participant.averagePoints === maxAverage;
  }

  return {
    participants,
    lastUpdated: new Date().toISOString(),
  };
}
