import type { HeroStatus, HeroView } from "../lib/world-cup.server";
import { LocalTime } from "./LocalTime";
import { TeamCrest } from "./TeamCrest";

const STATUS_STYLES: Record<HeroStatus, string> = {
  LIVE: "bg-red-500 text-white",
  HALF_TIME: "bg-amber-400 text-black",
  FINISHED: "bg-white/15 text-white",
  UPCOMING: "bg-sky-500 text-white",
};

function TeamSide({
  team,
  align,
}: {
  team: HeroView["home"];
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex flex-col items-center gap-3 ${
        align === "left" ? "sm:items-end" : "sm:items-start"
      }`}
    >
      <TeamCrest team={team} className="h-16 w-16 mx-auto sm:h-20 sm:w-20" />
      <span className="text-center text-lg font-bold sm:text-xl">
        {team.name}
      </span>
    </div>
  );
}

// Shown in place of the score when the (free-tier) feed has not published one.
const NO_SCORE_LABEL: Record<HeroStatus, string> = {
  LIVE: "Playing now",
  HALF_TIME: "Half time",
  FINISHED: "Recently played",
  UPCOMING: "", // upcoming shows the kickoff time instead
};

export function MatchHero({ hero }: { hero: HeroView }) {
  const isLive = hero.status === "LIVE";
  // Only trust a score when the feed actually provides both values; otherwise
  // we fall back to the matchup rather than showing a misleading 0-0.
  const hasScore = hero.homeScore !== null && hero.awayScore !== null;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-indigo-600/30 via-slate-900 to-slate-950 p-6 shadow-2xl sm:p-10">
      <div className="mb-6 flex items-center justify-center gap-3">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-sm font-bold uppercase tracking-wider ${STATUS_STYLES[hero.status]}`}
        >
          {isLive && (
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          )}
          {hero.statusLabel}
        </span>
        {hero.group && (
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white/70">
            {hero.group}
          </span>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 sm:gap-8">
        <TeamSide team={hero.home} align="left" />

        <div className="flex flex-col items-center">
          {hasScore ? (
            <div className="flex items-center gap-3 text-5xl font-black tabular-nums sm:text-7xl">
              <span>{hero.homeScore}</span>
              <span className="text-white/30">-</span>
              <span>{hero.awayScore}</span>
            </div>
          ) : (
            <div className="text-center">
              <div className="text-3xl font-black text-white/40 sm:text-5xl">
                vs
              </div>
              <div className="mt-2 text-sm font-medium text-white/70">
                {hero.status === "UPCOMING" ? (
                  <LocalTime iso={hero.kickoff} />
                ) : (
                  NO_SCORE_LABEL[hero.status]
                )}
              </div>
            </div>
          )}
        </div>

        <TeamSide team={hero.away} align="right" />
      </div>
    </section>
  );
}
