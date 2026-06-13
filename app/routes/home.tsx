import { Link } from "react-router";
import type { Route } from "./+types/home";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { MissingTokenError } from "../lib/football-data.server";
import { getWorldCupView } from "../lib/world-cup.server";
import { GroupCard } from "../components/GroupCard";
import { LocalTime } from "../components/LocalTime";
import { MatchHero } from "../components/MatchHero";

const REFRESH_INTERVAL_MS = 30_000;

export function meta(_: Route.MetaArgs) {
  return [
    { title: "World Cup 2026 - Live Tracker" },
    {
      name: "description",
      content: "Live FIFA World Cup 2026 scores and group standings.",
    },
  ];
}

export async function loader() {
  try {
    return { tokenMissing: false as const, view: await getWorldCupView() };
  } catch (error) {
    if (error instanceof MissingTokenError) {
      return { tokenMissing: true as const, view: null };
    }
    throw error;
  }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  useAutoRefresh(REFRESH_INTERVAL_MS);

  if (loaderData.tokenMissing) {
    return <TokenMissingScreen />;
  }

  const { view } = loaderData;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-400">
            FIFA World Cup
          </p>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            2026 Live Tracker
          </h1>
        </div>
        <Link
          to="/sweepstake"
          className="self-start rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 sm:self-auto"
        >
          My Sweepstake
        </Link>
      </header>

      {view.hero ? (
        <MatchHero hero={view.hero} />
      ) : (
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center text-white/60">
          No matches available yet.
        </section>
      )}

      <div className="mt-10 mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Group Stage</h2>
        <span className="flex items-center gap-2 text-sm text-white/50">
          <span className="h-3 w-3 rounded-sm bg-emerald-400" />
          Qualifies
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {view.groups.map((group) => (
          <GroupCard key={group.name} group={group} />
        ))}
      </div>

      <footer className="mt-10 text-center text-xs text-white/40">
        Auto-updates every 30s - last updated{" "}
        <LocalTime iso={view.lastUpdated} /> - data from football-data.org
      </footer>
    </main>
  );
}

function TokenMissingScreen() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-black tracking-tight">Almost there</h1>
      <p className="mt-4 text-white/70">
        Add your free football-data.org API token to a{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5">.env</code> file to
        load live World Cup data:
      </p>
      <pre className="mt-4 w-full overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left text-sm">
        <code>FOOTBALL_DATA_TOKEN=your_token_here</code>
      </pre>
      <p className="mt-4 text-sm text-white/50">
        Get a free token at football-data.org/client/register, then restart the
        dev server.
      </p>
    </main>
  );
}
