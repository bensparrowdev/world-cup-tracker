import type {
  SweepstakePersonView,
  TeamHighlight,
} from "../lib/sweepstake.server";
import { TeamCrest } from "./TeamCrest";

const HEAD_CELL = "px-1.5 py-2 text-center font-semibold text-white/50";
const BODY_CELL = "px-1.5 py-2 text-center tabular-nums";

const ROW_STYLES: Record<TeamHighlight, string> = {
  active: "border-l-4 border-l-transparent",
  eliminated:
    "border-l-4 border-l-red-400 bg-red-500/10 text-white/50",
  lastWin: "border-l-4 border-l-emerald-400 bg-emerald-500/10",
  lastDraw: "border-l-4 border-l-amber-400 bg-amber-500/10",
};

export function SweepstakePersonCard({
  person,
}: {
  person: SweepstakePersonView;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/3 p-4 shadow-lg">
      <h2 className="mb-3 text-lg font-bold tracking-tight">{person.name}</h2>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs">
            <th className={`${HEAD_CELL} text-left`}>Team</th>
            <th className={`${HEAD_CELL} hidden sm:table-cell`}>Grp</th>
            <th className={HEAD_CELL}>P</th>
            <th className={HEAD_CELL}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {person.teams.map((row) => (
            <tr
              key={row.team.name}
              className={`border-b border-white/5 last:border-0 ${ROW_STYLES[row.highlight]} ${
                row.missing ? "text-amber-400/80" : ""
              }`}
            >
              <td className="px-1.5 py-2 text-left">
                <span className="flex items-center gap-2">
                  <TeamCrest team={row.team} className="h-5 w-5" />
                  <span className="truncate font-medium">
                    {row.team.shortName}
                  </span>
                </span>
              </td>
              <td className={`${BODY_CELL} hidden sm:table-cell text-white/50`}>
                {row.group ?? "—"}
              </td>
              <td className={BODY_CELL}>{row.played}</td>
              <td className={`${BODY_CELL} font-bold`}>{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 border-t border-white/10 pt-3 text-sm text-white/70">
        <span className="font-semibold text-white">
          Total: {person.totalPoints} pts
        </span>
        <span className="mx-2 text-white/30">·</span>
        <span>
          {person.teamsRemaining} team{person.teamsRemaining === 1 ? "" : "s"}{" "}
          still in
        </span>
      </p>
    </section>
  );
}
