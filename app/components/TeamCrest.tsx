import type { TeamView } from "../lib/world-cup.server";

interface TeamCrestProps {
  team: TeamView;
  className?: string;
}

/**
 * Shows a team's crest, falling back to its three-letter abbreviation when no
 * crest URL is available (some teams ship without one early in the tournament).
 */
export function TeamCrest({ team, className = "h-6 w-6" }: TeamCrestProps) {
  if (!team.crest) {
    return (
      <span
        className={`${className} inline-flex items-center justify-center rounded-full bg-white/10 text-[0.6rem] font-bold tracking-tight`}
        aria-hidden="true"
      >
        {team.tla}
      </span>
    );
  }

  return (
    <img
      src={team.crest}
      alt=""
      aria-hidden="true"
      loading="lazy"
      className={`${className} object-contain`}
    />
  );
}
