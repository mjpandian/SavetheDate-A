import type { TallyRow } from "@/lib/types";

export function TallyTable({
  rows,
  labels,
  ballotsCast,
  totalMembers,
}: {
  rows: TallyRow[];
  labels: Record<string, string>; // candidateId -> activity name
  ballotsCast: number;
  totalMembers?: number;
}) {
  const sorted = [...rows].sort((a, b) => b.points - a.points || b.firstChoiceVotes - a.firstChoiceVotes);
  const top = Math.max(1, ...sorted.map((r) => r.points));
  return (
    <section
      aria-label="Live tally"
      className="grid gap-3 rounded-2xl border-2 border-[var(--ink)] bg-white p-4 shadow-[5px_5px_0_var(--ink)] dark:bg-zinc-900"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-xl font-extrabold">Live tally</h2>
        <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400" aria-live="polite">
          {ballotsCast} {ballotsCast === 1 ? "ballot" : "ballots"} cast
          {totalMembers ? ` of ${totalMembers} members` : ""}
        </p>
      </header>
      {sorted.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No votes yet. The first ballot will show up here.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b-2 border-zinc-200 text-xs uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                <th scope="col" className="py-2 pr-3 font-bold">#</th>
                <th scope="col" className="py-2 pr-3 font-bold">Option</th>
                <th scope="col" className="py-2 pr-3 font-bold"><span className="sr-only">Share of top score</span></th>
                <th scope="col" className="py-2 pr-3 text-right font-bold">Points</th>
                <th scope="col" className="py-2 text-right font-bold">1st choices</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.candidateId} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td className="py-2 pr-3 font-extrabold tabular-nums">{i + 1}</td>
                  <td className="py-2 pr-3 font-bold">{labels[r.candidateId] ?? r.candidateId}</td>
                  <td className="py-2 pr-3">
                    <div className="tally-bar" aria-hidden="true">
                      <span style={{ width: `${Math.round((r.points / top) * 100)}%` }} />
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right font-extrabold tabular-nums">{r.points}</td>
                  <td className="py-2 text-right tabular-nums">{r.firstChoiceVotes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
