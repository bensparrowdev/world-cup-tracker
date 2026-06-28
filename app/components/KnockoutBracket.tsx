import type {
  HeroStatus,
  KnockoutMatchView,
  KnockoutRoundView,
} from "../lib/world-cup.server";
import { LocalTime } from "./LocalTime";
import { TeamCrest } from "./TeamCrest";

const STATUS_STYLES: Record<HeroStatus, string> = {
  LIVE: "bg-red-500 text-white",
  HALF_TIME: "bg-amber-400 text-black",
  FINISHED: "bg-white/15 text-white",
  UPCOMING: "bg-sky-500/80 text-white",
};

function MatchCard({ match }: { match: KnockoutMatchView }) {
  const isLive = match.status === "LIVE";
  const hasScore = match.homeScore !== null && match.awayScore !== null;

  return (
    <article className="rounded-xl border border-white/10 bg-white/[0.03] p-3 shadow-md">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${STATUS_STYLES[match.status]}`}
        >
          {isLive && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          )}
          {match.statusLabel}
        </span>
        {match.status === "UPCOMING" && (
          <time className="text-[0.65rem] text-white/50">
            <LocalTime iso={match.kickoff} />
          </time>
        )}
      </div>

      <div className="space-y-2">
        <TeamRow
          team={match.home}
          score={hasScore ? match.homeScore : null}
          highlight={
            hasScore &&
            match.homeScore !== null &&
            match.awayScore !== null &&
            match.homeScore > match.awayScore
          }
        />
        <TeamRow
          team={match.away}
          score={hasScore ? match.awayScore : null}
          highlight={
            hasScore &&
            match.homeScore !== null &&
            match.awayScore !== null &&
            match.awayScore > match.homeScore
          }
        />
      </div>
    </article>
  );
}

function TeamRow({
  team,
  score,
  highlight,
}: {
  team: KnockoutMatchView["home"];
  score: number | null;
  highlight: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
        highlight ? "bg-emerald-500/15 ring-1 ring-emerald-400/30" : ""
      }`}
    >
      <TeamCrest team={team} className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {team.shortName}
      </span>
      {score !== null && (
        <span className="text-sm font-bold tabular-nums">{score}</span>
      )}
    </div>
  );
}

function RoundColumn({ round }: { round: KnockoutRoundView }) {
  return (
    <section className="flex w-52 shrink-0 flex-col sm:w-56">
      <h3 className="mb-3 text-center text-xs font-bold uppercase tracking-wider text-white/50">
        {round.label}
      </h3>
      <div className="flex flex-1 flex-col justify-around gap-3">
        {round.matches.map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
      </div>
    </section>
  );
}

export function KnockoutBracket({ rounds }: { rounds: KnockoutRoundView[] }) {
  if (rounds.length === 0) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center text-white/60">
        Knockout fixtures are not available yet.
      </section>
    );
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2">
      <div className="flex min-w-max items-stretch gap-4 sm:gap-6">
        {rounds.map((round, index) => (
          <div key={round.stage} className="flex items-stretch gap-4 sm:gap-6">
            <RoundColumn round={round} />
            {index < rounds.length - 1 && (
              <div
                className="hidden w-px self-stretch bg-white/10 sm:block"
                aria-hidden="true"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
