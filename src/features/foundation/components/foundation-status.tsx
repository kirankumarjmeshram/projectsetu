const foundations = [
  "Modular domain boundaries",
  "Deterministic calculation policy",
  "Security-first document handling guidance",
  "Unit testing and quality checks",
] as const;

export function FoundationStatus() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-20">
      <section className="w-full rounded-3xl border border-emerald-950/10 bg-white p-8 shadow-sm sm:p-12">
        <p className="mb-4 text-sm font-semibold tracking-[0.2em] text-emerald-700 uppercase">
          Foundation phase
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-emerald-950 sm:text-6xl">
          ProjectSetu is being built on careful foundations.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          The application shell and engineering boundaries are ready. Financial,
          scheme, document, and report capabilities remain intentionally
          unimplemented until their rules and sources are validated.
        </p>
        <ul className="mt-10 grid gap-3 sm:grid-cols-2">
          {foundations.map((foundation) => (
            <li
              className="rounded-xl border border-emerald-950/10 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950"
              key={foundation}
            >
              {foundation}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
