"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ReceptionStamp } from "@/components/reception-stamp";
import { SAFE_DOCUMENT, SAMPLE_DOCUMENTS, SAMPLE_GOAL } from "@/lib/swarm/sample";
import { SCOUTS, type MissionResult } from "@/lib/swarm/types";
import { localDeadline } from "@/lib/time";

type DocDraft = {
  key: string;
  id: string;
  title: string;
  body: string;
  open: boolean;
};

type RunError = { error: string; hint?: string };

type BeforeInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function sampleDocs(): DocDraft[] {
  return SAMPLE_DOCUMENTS.map((doc) => ({
    key: doc.id,
    id: doc.id,
    title: doc.title,
    body: doc.body,
    open: false,
  }));
}

function inferenceLabel(value: MissionResult["agents"][number]["inference"]): string {
  if (value === "near-ai") return "NEAR AI";
  if (value === "scripted-fallback") return "Scripted fallback";
  return "Scripted";
}

export function MissionDesk({ initialDeadline }: { initialDeadline: string }) {
  const [goal, setGoal] = useState(SAMPLE_GOAL);
  const [budget, setBudget] = useState("1000");
  const [deadline, setDeadline] = useState(initialDeadline);
  const [docs, setDocs] = useState<DocDraft[]>(sampleDocs);
  const [scoutCount, setScoutCount] = useState(3);
  const [mode, setMode] = useState<"simulation" | "near-ai">("simulation");
  const [parentAccount, setParentAccount] = useState("cloak-swarm.testnet");
  const [nearAiConfigured, setNearAiConfigured] = useState(false);
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<MissionResult | null>(null);
  const [shown, setShown] = useState(0);
  const [foldOn, setFoldOn] = useState(false);
  const [error, setError] = useState<RunError | null>(null);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPrompt | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    fetch("/api/status")
      .then((response) => response.json())
      .then((status: { parentAccount?: string; nearAiConfigured?: boolean }) => {
        if (status.parentAccount) setParentAccount(status.parentAccount);
        setNearAiConfigured(Boolean(status.nearAiConfigured));
      })
      .catch(() => {
        setError({
          error: "Could not read server status.",
          hint: "The shell can stay open offline. Start pnpm dev to file a mission.",
        });
      });
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      timers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  function clearTimers() {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }

  function reveal(next: MissionResult, immediate: boolean) {
    clearTimers();
    setResult(next);
    if (immediate) {
      setShown(next.agents.length);
      setFoldOn(true);
      setPhase("done");
      return;
    }
    setShown(0);
    setFoldOn(false);
    next.agents.forEach((_, index) => {
      timers.current.push(
        window.setTimeout(() => setShown(index + 1), 420 * (index + 1)),
      );
    });
    const foldAt = 420 * (next.agents.length + 1);
    timers.current.push(window.setTimeout(() => setFoldOn(true), foldAt));
    timers.current.push(window.setTimeout(() => setPhase("done"), foldAt + 280));
  }

  function reloadSample() {
    setGoal(SAMPLE_GOAL);
    setBudget("1000");
    setDeadline(localDeadline());
    setDocs(sampleDocs());
    setScoutCount(3);
    setMode("simulation");
    setError(null);
  }

  function addSafe() {
    if (docs.length >= 4 || docs.some((doc) => doc.id === SAFE_DOCUMENT.id)) return;
    setDocs((current) => [
      ...current,
      { key: SAFE_DOCUMENT.id, ...SAFE_DOCUMENT, open: false },
    ]);
  }

  async function onSubmit(event?: React.SyntheticEvent) {
    event?.preventDefault();
    setError(null);
    if (docs.length < 2) {
      setPhase("error");
      setError({
        error: "A mission needs at least two snippets.",
        hint: "Reload the Northwind packet or paste another document.",
      });
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setPhase("error");
      setError({
        error: "This browser is offline.",
        hint: "The installed shell can still open. Reconnect, then run the swarm again.",
      });
      return;
    }
    const deadlineDate = new Date(deadline);
    if (Number.isNaN(deadlineDate.getTime())) {
      setPhase("error");
      setError({
        error: "The deadline is not a valid time.",
        hint: "Pick a date and time, then run again.",
      });
      return;
    }
    setPhase("running");
    setFoldOn(false);
    setShown(0);
    const started = performance.now();
    try {
      const response = await fetch("/api/mission", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          goal,
          budgetUnits: Number(budget),
          deadlineIso: deadlineDate.toISOString(),
          scoutCount,
          mode,
          documents: docs.map((doc) => ({
            id: doc.id,
            title: doc.title,
            body: doc.body,
          })),
        }),
      });
      const json = (await response.json()) as MissionResult & RunError;
      if (!response.ok) {
        setPhase("error");
        setResult(null);
        setError({
          error: json.error || "The swarm did not finish.",
          hint: json.hint || "Fix the mission and run it again.",
        });
        return;
      }
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      reveal(json, reduced || performance.now() - started > 2200);
    } catch {
      setPhase("error");
      setResult(null);
      setError({
        error: "The local server did not respond.",
        hint: "Keep this page installed if you like. A run needs pnpm dev.",
      });
    }
  }

  const waitingScouts = SCOUTS.slice(0, scoutCount);
  const running = phase === "running";

  return (
    <div className="min-h-full">
      <header className="bg-[var(--stamp)] text-[var(--reverse)]">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-end justify-between gap-4 px-4 py-4 md:px-6">
          <div>
            <p className="font-stamp text-[2rem] leading-none">Cloak</p>
            <p className="mt-1 max-w-md text-sm text-[var(--reverse-dim)]">
              Research swarm for documents that stay in the room.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-stamp text-base tracking-wide">{parentAccount}</span>
            <span className="bg-[var(--reverse)] px-2 py-1 font-semibold text-[var(--stamp)]">
              {mode === "simulation" ? "Simulation" : "NEAR AI"}
            </span>
            {installEvent ? (
              <Button
                type="button"
                size="sm"
                className="bg-[var(--reverse)] text-[var(--stamp)] hover:bg-[var(--reverse-dim)]"
                onClick={() => {
                  void installEvent.prompt();
                  setInstallEvent(null);
                }}
              >
                Install
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1120px] gap-8 px-4 py-6 md:px-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start">
        <form
          action="javascript:void(0)"
          onSubmit={onSubmit}
          className="min-w-0"
          aria-labelledby="mission-heading"
        >
          <h1 id="mission-heading" className="text-2xl font-semibold tracking-tight">
            Mission
          </h1>
          <p className="mt-1 mb-3 max-w-[65ch] text-sm text-[var(--muted)]">
            Each scout receives one shard. The public brief is built from accepted claims, not from the snippets.
          </p>

          {error ? (
            <div role="alert" className="mb-5 bg-[var(--danger)] px-3 py-3 text-sm text-[var(--danger-ink)]">
              <p className="font-semibold">{error.error}</p>
              {error.hint ? <p className="mt-1">{error.hint}</p> : null}
            </div>
          ) : null}

          <div className="space-y-3">
            <div>
              <Label htmlFor="goal">Goal</Label>
              <Textarea
                id="goal"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                className="mt-1 min-h-12"
                required
                minLength={8}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="budget">Budget units</Label>
                <Input
                  id="budget"
                  inputMode="numeric"
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  className="mt-1 nums"
                  required
                />
              </div>
              <div>
                <Label htmlFor="deadline">Deadline</Label>
                <Input
                  id="deadline"
                  type="datetime-local"
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                  suppressHydrationWarning
                  className="mt-1"
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="scouts">Scouts</Label>
                <select
                  id="scouts"
                  value={scoutCount}
                  onChange={(event) => setScoutCount(Number(event.target.value))}
                  className="mt-1 h-11 w-full bg-[var(--sheet)] px-3 text-base ring-1 ring-[var(--line)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </div>
              <fieldset>
                <legend className="text-sm font-semibold">Inference</legend>
                <div className="mt-2 flex flex-wrap gap-4 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="mode"
                      value="simulation"
                      checked={mode === "simulation"}
                      onChange={() => setMode("simulation")}
                    />
                    Simulation
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="mode"
                      value="near-ai"
                      checked={mode === "near-ai"}
                      onChange={() => setMode("near-ai")}
                    />
                    NEAR AI
                  </label>
                </div>
              </fieldset>
            </div>
            <p className="text-sm text-[var(--muted)]">
              {mode === "simulation"
                ? "Scripted scouts. No model call and no attestation request."
                : nearAiConfigured
                  ? "NEAR_AI_KEY is set. Attestation is requested before the scouts run."
                  : "NEAR_AI_KEY is not set. This choice will fail until you add it and restart pnpm dev."}
            </p>
          </div>

          <div className="mt-5">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-lg font-semibold">Operator vault</h2>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={reloadSample}>
                  Reload Northwind
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addSafe}
                  disabled={docs.length >= 4 || docs.some((doc) => doc.id === SAFE_DOCUMENT.id)}
                >
                  Add SAFE footnote
                </Button>
              </div>
            </div>
            <p className="mb-2 max-w-[65ch] text-sm text-[var(--muted)]">
              Shown here only. Omitted from the public brief.
            </p>
            {docs.length === 0 ? (
              <p className="bg-[var(--sheet)] px-3 py-4 text-sm ring-1 ring-[var(--line)]">
                The vault is empty. Reload the fictional Northwind packet or add two snippets.
              </p>
            ) : (
              <ul className="bg-[var(--sheet)] ring-1 ring-[var(--line)]">
                {docs.map((doc, index) => (
                  <li key={doc.key} className="border-b border-[var(--line)] px-3 py-2 last:border-b-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="sr-only" htmlFor={`title-${doc.key}`}>
                        Title for document {index + 1}
                      </label>
                      <Input
                        id={`title-${doc.key}`}
                        value={doc.title}
                        onChange={(event) =>
                          setDocs((current) =>
                            current.map((item) =>
                              item.key === doc.key ? { ...item, title: event.target.value } : item,
                            ),
                          )
                        }
                        className="h-9 min-w-48 flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDocs((current) =>
                            current.map((item) =>
                              item.key === doc.key ? { ...item, open: !item.open } : item,
                            ),
                          )
                        }
                      >
                        {doc.open ? "Hide text" : "Show text"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDocs((current) => current.filter((item) => item.key !== doc.key))}
                        disabled={docs.length <= 2}
                      >
                        Remove
                      </Button>
                      <span className="text-sm text-[var(--muted)]">{doc.body.trim().length} sealed</span>
                    </div>
                    {doc.open ? (
                      <Textarea
                        aria-label={`Body of ${doc.title || `document ${index + 1}`}`}
                        value={doc.body}
                        onChange={(event) =>
                          setDocs((current) =>
                            current.map((item) =>
                              item.key === doc.key ? { ...item, body: event.target.value } : item,
                            ),
                          )
                        }
                        className="mt-2"
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={docs.length >= 4}
                onClick={() =>
                  setDocs((current) => [
                    ...current,
                    {
                      key: `doc-${Date.now()}`,
                      id: `doc-${current.length + 1}`,
                      title: "",
                      body: "",
                      open: true,
                    },
                  ])
                }
              >
                Add snippet
              </Button>
            </div>
          </div>

          <div className="mt-5">
            <Button type="button" size="lg" disabled={running} onClick={onSubmit}>
              {running ? "Scouts are reading" : "Run swarm"}
            </Button>
          </div>
        </form>

        <div className="min-w-0 space-y-8">
          <section aria-labelledby="scouts-heading">
            <h2 id="scouts-heading" className="text-lg font-semibold">
              Scouts
            </h2>
            <p className="mt-1 mb-3 text-sm text-[var(--muted)]" aria-live="polite">
              {running && !result
                ? "Filing the mission and sealing one shard per scout."
                : result
                  ? `Instrument ${result.missionId}. ${result.deadlineNote}`
                  : "Waiting for a filing. Sub-accounts are named when the mission id is issued."}
            </p>
            <ul className="bg-[var(--sheet)] ring-1 ring-[var(--line)]">
              {(result ? result.agents : waitingScouts).map((agent, index) => {
                const ready = result && shown > index;
                const report = result?.agents[index];
                const name = "displayName" in agent ? agent.displayName : agent.name;
                const job = agent.job;
                const account =
                  ready && report
                    ? report.subAccount
                    : `${"id" in agent ? agent.id : agent.strategy}-······.${parentAccount}`;
                let status = "Waiting";
                if (running && !ready) status = "Reading";
                if (ready && report) {
                  status =
                    report.status === "accepted"
                      ? "Accepted"
                      : report.status === "rejected"
                        ? "Rejected"
                        : "Unassigned";
                }
                const reversed = status === "Accepted" || status === "Reading";
                return (
                  <li key={name} className="border-b border-[var(--line)] px-3 py-3 last:border-b-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold">
                        {name}
                        <span className="ml-2 font-normal text-[var(--muted)]">{job}</span>
                      </p>
                      <span
                        className={
                          reversed
                            ? "bg-[var(--stamp)] px-2 py-0.5 text-sm font-semibold text-[var(--reverse)]"
                            : "px-2 py-0.5 text-sm font-semibold ring-1 ring-[var(--line)]"
                        }
                      >
                        {status}
                      </span>
                    </div>
                    <p className="font-stamp mt-1 break-all text-base text-[var(--muted)]">{account}</p>
                    {ready && report ? (
                      <div className="mt-2 text-sm">
                        <p>
                          {report.shardLabel
                            ? `${report.shardLabel} · ${report.documentCount} document${report.documentCount === 1 ? "" : "s"} · ${inferenceLabel(report.inference)}`
                            : "No shard"}
                          {report.budgetUnits ? ` · ${report.budgetUnits} units` : ""}
                        </p>
                        {report.rejectReason && report.status !== "accepted" ? (
                          <p className="mt-1 text-[var(--danger)]">{report.rejectReason}</p>
                        ) : null}
                        {report.fallbackNote ? <p className="mt-1">{report.fallbackNote}</p> : null}
                        {report.claims.length > 0 ? (
                          <ul className="mt-2 space-y-1">
                            {report.claims.map((claim) => (
                              <li key={claim.topic}>
                                <span className="font-stamp mr-2">{claim.topic}</span>
                                {claim.text}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="brief-heading">
            <h2 id="brief-heading" className="text-lg font-semibold">
              Public brief
            </h2>
            {!foldOn || !result ? (
              <p className="mt-3 max-w-[65ch] text-sm text-[var(--muted)]">
                Nothing has been recorded. Run the swarm and the only text that leaves the vault is the fold.
              </p>
            ) : (
              <div className="mt-3 bg-[var(--sheet)] px-3 py-4 ring-1 ring-[var(--line)]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="max-w-[62ch]">
                    <p className="text-xl font-semibold">{result.fold.headline}</p>
                    <p className="mt-2">{result.fold.recommendation}</p>
                    <p className="mt-3 text-sm text-[var(--muted)]">
                      {result.fold.seal.shardsSealed} shards stayed sealed. Overlap scan:{" "}
                      {result.fold.seal.overlapSpans}.
                    </p>
                  </div>
                  <ReceptionStamp
                    instrument={result.missionId}
                    fee={result.budgetUnits}
                    state={result.fold.seal.status}
                  />
                </div>
                <ul className="mt-4 space-y-3">
                  {result.fold.claims.map((claim) => (
                    <li key={claim.topic} className="border-t border-[var(--line)] pt-3">
                      <p className="text-sm">
                        <span className="font-stamp mr-2">{claim.keys.join(" ")}</span>
                        <span
                          className={
                            claim.label === "corroborated"
                              ? "bg-[var(--stamp)] px-1.5 py-0.5 font-semibold text-[var(--reverse)]"
                              : "font-semibold"
                          }
                        >
                          {claim.label === "corroborated" ? "Corroborated" : "Single-source"}
                        </span>
                      </p>
                      <p className={claim.label === "corroborated" ? "mt-1 font-semibold" : "mt-1"}>
                        {claim.text}
                      </p>
                    </li>
                  ))}
                </ul>
                {result.fold.dissent.length > 0 ? (
                  <div className="mt-4 border-t border-[var(--line)] pt-3 text-sm">
                    <p className="font-semibold">Not in the fold</p>
                    <ul className="mt-1 space-y-1">
                      {result.fold.dissent.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </section>

          <section aria-labelledby="settlement-heading">
            <h2 id="settlement-heading" className="text-lg font-semibold">
              Settlement
            </h2>
            {!foldOn || !result ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                Shares post when a finding is accepted. Rejected and unassigned scouts earn zero.
              </p>
            ) : (
              <div className="mt-3">
                <table className="w-full border-collapse text-sm">
                  <caption className="sr-only">Budget shares for this mission</caption>
                  <thead>
                    <tr className="border-b border-[var(--line)] text-left">
                      <th className="py-2 pr-3 font-semibold">Party</th>
                      <th className="py-2 pr-3 font-semibold">Sub-account</th>
                      <th className="py-2 pr-3 text-right font-semibold">Units</th>
                      <th className="py-2 font-semibold">Record</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.settlement.map((row) => (
                      <tr key={row.txRef} className="border-b border-[var(--line)] align-top">
                        <td className="py-2 pr-3 font-semibold">{row.displayName}</td>
                        <td className="font-stamp py-2 pr-3 break-all">{row.subAccount}</td>
                        <td className="nums py-2 pr-3 text-right">{row.units}</td>
                        <td className="font-stamp py-2 break-all">{row.txRef}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-sm text-[var(--muted)]">{result.rpcNote}</p>
              </div>
            )}
          </section>

          <section aria-labelledby="attest-heading">
            <h2 id="attest-heading" className="text-lg font-semibold">
              Attestation
            </h2>
            {!result ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                Simulation skips the request. A NEAR AI run asks the gateway for a report bound to a fresh nonce.
              </p>
            ) : (
              <div className="mt-3 text-sm">
                <p>
                  <span className="bg-[var(--stamp)] px-2 py-0.5 font-semibold text-[var(--reverse)]">
                    {result.attestation.status === "skipped-mock"
                      ? "Skipped · mock"
                      : result.attestation.status === "verified"
                        ? "Verified"
                        : result.attestation.status === "unverified"
                          ? "Unverified"
                          : "Unavailable"}
                  </span>
                  {result.model ? (
                    <span className="ml-2 text-[var(--muted)]">{result.model}</span>
                  ) : null}
                </p>
                <p className="mt-2 max-w-[65ch]">{result.attestation.detail}</p>
                {result.attestation.nonce ? (
                  <p className="font-stamp mt-2 break-all text-base">{result.attestation.nonce}</p>
                ) : null}
              </div>
            )}
          </section>

          {result ? (
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold">What left the room</summary>
              <p className="mt-2 text-[var(--muted)]">{result.publicPayloadNote}</p>
              <pre className="mt-2 max-h-80 overflow-auto bg-[var(--sheet)] p-3 text-xs ring-1 ring-[var(--line)]">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      </main>
      <footer className="mx-auto max-w-[1120px] px-4 pb-10 text-sm text-[var(--muted)] md:px-6">
        Sub-accounts use {"{role}-{missionId}"}
        {"."}
        {parentAccount}. Budget units are an internal ledger. Receipts stay simulated unless a signer is added later.
        The service worker caches the shell; running a mission still needs the local server.
      </footer>
    </div>
  );
}
