/** Maps sweepstake labels to football-data.org API team names. */
export const TEAM_API_ALIASES: Readonly<Record<string, string>> = {
  USA: "United States",
  Bosnia: "Bosnia-Herzegovina",
  Curacao: "Curaçao",
  "Cape Verde": "Cape Verde Islands",
  Congo: "Congo DR",
};

export interface SweepstakeParticipant {
  name: string;
  /** Display names as provided in the sweepstake draw. */
  teams: readonly string[];
}

/** Static sweepstake assignments — order preserved for display. */
export const SWEEPSTAKE_PARTICIPANTS: readonly SweepstakeParticipant[] = [
  {
    name: "Maecy",
    teams: ["Scotland", "Turkey", "New Zealand", "Sweden", "Portugal"],
  },
  {
    name: "Zak",
    teams: [
      "Morocco",
      "Saudi Arabia",
      "Algeria",
      "England",
      "Paraguay",
      "Switzerland",
    ],
  },
  {
    name: "Lish",
    teams: ["Iran", "Netherlands", "Spain", "Senegal", "Ivory Coast"],
  },
  {
    name: "Naz",
    teams: ["Japan", "Austria", "Haiti", "Uruguay", "Australia"],
  },
  {
    name: "Ben",
    teams: ["Ghana", "Mexico", "Panama", "South Korea", "Jordan"],
  },
  {
    name: "Scarlett",
    teams: ["Germany", "Argentina", "Brazil", "South Africa", "USA"],
  },
  {
    name: "Dean",
    teams: ["Croatia", "Bosnia", "Czechia", "Ecuador", "Curacao"],
  },
  {
    name: "Julie",
    teams: ["Colombia", "Belgium", "Tunisia", "Uzbekistan", "Norway"],
  },
  {
    name: "Jav",
    teams: ["France", "Cape Verde", "Congo", "Egypt", "Iraq"],
  },
  { name: "Cairo", teams: ["Canada"] },
  { name: "Aruba", teams: ["Qatar"] },
];

/** Resolves a sweepstake team label to the API name used in standings. */
export function toApiTeamName(label: string): string {
  return TEAM_API_ALIASES[label] ?? label;
}
