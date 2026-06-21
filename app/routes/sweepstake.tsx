import { Link } from "react-router";
import type { Route } from "./+types/sweepstake";
import { SweepstakePersonCard } from "../components/SweepstakePersonCard";
import { LocalTime } from "../components/LocalTime";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { MissingTokenError } from "../lib/football-data.server";
import { getSweepstakeView } from "../lib/sweepstake.server";

// Slower than the homepage — standings change infrequently and the shared
// server cache (120s) means most revalidates never hit the upstream API.
const SWEEPSTAKE_REFRESH_MS = 5 * 60 * 1000;

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Sweepstake - World Cup 2026" },
    {
      name: "description",
      content: "World Cup sweepstake tournament survival tracker.",
    },
  ];
}

export async function loader() {
  try {
    return { tokenMissing: false as const, view: await getSweepstakeView() };
  } catch (error) {
    if (error instanceof MissingTokenError) {
      return { tokenMissing: true as const, view: null };
    }
    throw error;
  }
}

export default function Sweepstake({ loaderData }: Route.ComponentProps) {
  useAutoRefresh(SWEEPSTAKE_REFRESH_MS);

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
            Sweepstake
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Tournament survival tracker
          </p>
        </div>
        <Link
          to="/"
          className="self-start rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 sm:self-auto"
        >
          Live tracker
        </Link>
      </header>

      {view.lastMatchSummary && (
        <p className="mb-6 rounded-xl border border-white/10 bg-white/3 px-4 py-3 text-sm text-white/70">
          {view.lastMatchSummary}
        </p>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/50">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-emerald-400" />
          Won last match
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-amber-400" />
          Drew last match
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-red-400" />
          Knocked out
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {view.participants.map((person) => (
          <SweepstakePersonCard key={person.name} person={person} />
        ))}
      </div>

      <footer className="mt-10 text-center text-xs text-white/40">
        Updates every 5 min · last updated{" "}
        <LocalTime iso={view.lastUpdated} /> · data from football-data.org
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
        load sweepstake data:
      </p>
      <pre className="mt-4 w-full overflow-x-auto rounded-xl border border-white/10 bg-white/3 p-4 text-left text-sm">
        <code>FOOTBALL_DATA_TOKEN=your_token_here</code>
      </pre>
      <p className="mt-4 text-sm text-white/50">
        Get a free token at football-data.org/client/register, then restart the
        dev server.
      </p>
      <Link
        to="/"
        className="mt-8 rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
      >
        Back to live tracker
      </Link>
    </main>
  );
}
