import type { GroupView } from "../lib/world-cup.server";
import { TeamCrest } from "./TeamCrest";

const HEAD_CELL = "px-1.5 py-2 text-center font-semibold text-white/50";
const BODY_CELL = "px-1.5 py-2 text-center tabular-nums";

export function GroupCard({ group }: { group: GroupView }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-lg">
      <h2 className="mb-3 text-lg font-bold tracking-tight">{group.name}</h2>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs">
            <th className={`${HEAD_CELL} w-6 text-left`}>#</th>
            <th className={`${HEAD_CELL} text-left`}>Team</th>
            <th className={HEAD_CELL}>P</th>
            <th className={`${HEAD_CELL} hidden sm:table-cell`}>W</th>
            <th className={`${HEAD_CELL} hidden sm:table-cell`}>D</th>
            <th className={`${HEAD_CELL} hidden sm:table-cell`}>L</th>
            <th className={HEAD_CELL}>GD</th>
            <th className={HEAD_CELL}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {group.rows.map((row) => (
            <tr
              key={row.team.name}
              className={`border-b border-white/5 last:border-0 ${
                row.qualifies
                  ? "border-l-4 border-l-emerald-400 bg-emerald-500/10"
                  : "border-l-4 border-l-transparent"
              }`}
            >
              <td className="px-1.5 py-2 text-left font-semibold text-white/40">
                {row.position}
              </td>
              <td className="px-1.5 py-2 text-left">
                <span className="flex items-center gap-2">
                  <TeamCrest team={row.team} className="h-5 w-5" />
                  <span className="truncate font-medium">
                    {row.team.shortName}
                  </span>
                </span>
              </td>
              <td className={BODY_CELL}>{row.played}</td>
              <td className={`${BODY_CELL} hidden sm:table-cell`}>{row.won}</td>
              <td className={`${BODY_CELL} hidden sm:table-cell`}>{row.draw}</td>
              <td className={`${BODY_CELL} hidden sm:table-cell`}>{row.lost}</td>
              <td className={BODY_CELL}>
                {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
              </td>
              <td className={`${BODY_CELL} font-bold`}>{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
