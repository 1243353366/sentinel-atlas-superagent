import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Activity, ArrowUpRight, Ban, BrainCircuit, CheckCircle2, Database, FlaskConical, History, LockKeyhole, LogIn, PauseCircle, Play, Radar, ShieldCheck, Sparkles, TriangleAlert, Workflow } from "lucide-react";

const modes = [
  { value: "analyst", label: "Threat analyst", hint: "Classify what happened" },
  { value: "adversary", label: "Adversary perspective", hint: "Model the next observable" },
  { value: "defender", label: "Defender", hint: "Name the defensive objective" },
  { value: "detection", label: "Detection engineer", hint: "Translate behavior into telemetry" },
  { value: "auditor", label: "Auditor", hint: "Record assumptions and evidence" },
] as const;

type Result = {
  id?: number | null;
  summary: string;
  techniques: string[];
  objective: string;
  telemetry: string[];
  detectionGap: string;
  safeTest: string;
  confidence: "SUPPORTED" | "CANDIDATE" | "UNMAPPED" | "RESTRICTED";
};

type SimulationResult = {
  id?: number | null;
  label: string;
  technique: string;
  objective: string;
  expectedTelemetry: readonly string[];
  observedTelemetry: readonly string[];
  status: "completed" | "paused" | "blocked";
  detectionResult: "detected" | "partial" | "missed" | "not_run";
  containment: string;
  nextStep: string;
};

type GameScenario = {
  id: string;
  title: string;
  chapter: string;
  briefing: string;
  nodes: readonly string[];
  edges: readonly string[];
  quiz: { question: string; options: readonly string[] };
  mitigationOptions: readonly string[];
};

type GameResult = {
  score: number;
  mappingScore: number;
  quizScore: number;
  mitigationScore: number;
  epistemicBonus: number;
  connectionHits: number;
  totalConnections: number;
  correctQuiz: boolean;
  correctMitigation: boolean;
  explanation: string;
  progress?: { xp: number; level: number; unlocked: string[]; gamesPlayed: number } | null;
};

function confidenceTone(confidence?: Result["confidence"]) {
  if (confidence === "SUPPORTED") return "bg-emerald-400/15 text-emerald-300 border-emerald-300/30";
  if (confidence === "RESTRICTED") return "bg-rose-400/15 text-rose-300 border-rose-300/30";
  if (confidence === "CANDIDATE") return "bg-amber-300/15 text-amber-200 border-amber-200/30";
  return "bg-sky-300/15 text-sky-200 border-sky-200/30";
}

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [mode, setMode] = useState<(typeof modes)[number]["value"]>("analyst");
  const [observation, setObservation] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [scenario, setScenario] = useState<"decoy_document" | "suspicious_login" | "dns_beacon" | "scheduled_task">("decoy_document");
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [mitigation, setMitigation] = useState("");
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const analyze = trpc.atlas.analyze.useMutation({ onSuccess: data => setResult(data) });
  const runSimulation = trpc.simulation.run.useMutation({ onSuccess: data => setSimulation(data) });
  const catalog = trpc.simulation.catalog.useQuery();
  const gameCatalog = trpc.game.catalog.useQuery();
  const gameProgress = trpc.game.progress.useQuery(undefined, { enabled: isAuthenticated });
  const submitGame = trpc.game.submit.useMutation({ onSuccess: data => setGameResult(data) });
  const recent = trpc.atlas.recent.useQuery(undefined, { enabled: isAuthenticated });
  const selectedMode = useMemo(() => modes.find(item => item.value === mode) ?? modes[0], [mode]);
  const gameScenario = gameCatalog.data?.[0] as GameScenario | undefined;

  const submit = () => {
    if (observation.trim().length < 10) return;
    analyze.mutate({ mode, observation: observation.trim() });
  };

  const toggleEdge = (edge: string) => setSelectedEdges(current => current.includes(edge) ? current.filter(item => item !== edge) : [...current, edge]);
  const submitGameRun = () => {
    if (!gameScenario || quizAnswer === null || !mitigation) return;
    submitGame.mutate({ scenarioId: gameScenario.id, connections: selectedEdges, quizAnswer, mitigation });
  };

  return (
    <div className="min-h-screen bg-[#07111f] text-slate-100">
      <header className="border-b border-white/10 bg-[#07111f]/85 backdrop-blur-xl sticky top-0 z-20">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="atlas-mark"><Radar className="h-5 w-5" /></div>
            <div>
              <div className="text-sm font-semibold tracking-[0.18em] text-slate-100 uppercase">Sentinel Atlas</div>
              <div className="text-xs text-slate-500">Defensive reasoning workspace</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs text-emerald-200 sm:flex"><span className="status-dot" />AI layer online</div>
            {isAuthenticated ? <span className="hidden text-xs text-slate-500 sm:inline">{user?.name || user?.email}</span> : <Button size="sm" variant="outline" onClick={startLogin} className="border-white/15 bg-transparent text-slate-200 hover:bg-white/10"><LogIn className="mr-2 h-3.5 w-3.5" />Sign in for history</Button>}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1440px] gap-8 px-5 py-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:px-10 lg:py-12">
        <aside className="hidden lg:block">
          <div className="sticky top-28 space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <div className="mb-5 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-cyan-300"><Activity className="h-3.5 w-3.5" />Workspace</div>
              <nav className="space-y-1 text-sm">
                <a className="flex items-center gap-3 rounded-xl bg-violet-300/10 px-3 py-2.5 text-violet-100" href="#game"><Play className="h-4 w-4" />Play training run</a>
                <a className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-400 transition hover:bg-white/5 hover:text-slate-100" href="#analyze"><BrainCircuit className="h-4 w-4" />Analyze behavior</a>
                <a className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-400 transition hover:bg-white/5 hover:text-slate-100" href="#simulate"><FlaskConical className="h-4 w-4" />Run simulation</a>
                <a className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-400 transition hover:bg-white/5 hover:text-slate-100" href="#history"><History className="h-4 w-4" />Analysis history</a>
                <a className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-400 transition hover:bg-white/5 hover:text-slate-100" href="#boundaries"><LockKeyhole className="h-4 w-4" />Safety boundaries</a>
              </nav>
            </div>
            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] p-5">
              <ShieldCheck className="mb-3 h-5 w-5 text-cyan-300" />
              <p className="text-sm font-medium text-slate-100">Constrained by design</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">Evidence-first reasoning, bounded outputs, and human-reviewed lab exercises.</p>
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-8">
          <section className="hero-grid relative overflow-hidden rounded-[28px] border border-white/10 px-6 py-8 sm:px-10 sm:py-11">
            <div className="relative z-10 max-w-3xl">
              <div className="mb-5 flex flex-wrap items-center gap-2"><Badge className="border-cyan-300/25 bg-cyan-300/10 text-cyan-200">COMPANION APP</Badge><span className="text-xs text-slate-500">schema-backed · private workspace</span></div>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">Think like the adversary. <span className="text-cyan-300">Defend like the operator.</span></h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">Sentinel Atlas turns behavior notes into an auditable chain: ATT&amp;CK hypothesis, likely objective, expected telemetry, detection gap, and a safe next test.</p>
              <div className="mt-7 flex flex-wrap gap-3 text-xs text-slate-400"><span className="inline-flex items-center gap-2"><Database className="h-3.5 w-3.5 text-cyan-300" />Own database</span><span className="inline-flex items-center gap-2"><BrainCircuit className="h-3.5 w-3.5 text-cyan-300" />Structured AI output</span><span className="inline-flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5 text-cyan-300" />Safety-gated</span></div>
            </div>
            <div className="hero-orbit" aria-hidden="true"><div /><div /><div /></div>
          </section>

          <section id="game" className="game-panel overflow-hidden rounded-[28px] border border-violet-300/20 bg-gradient-to-br from-violet-300/[0.08] via-white/[0.025] to-cyan-300/[0.06] shadow-2xl shadow-black/20">
            <div className="flex flex-col gap-6 border-b border-white/10 p-6 sm:p-8 lg:flex-row lg:items-start lg:justify-between"><div><div className="mb-3 flex flex-wrap items-center gap-2"><Badge className="border-violet-300/25 bg-violet-300/10 text-violet-200">CYBER-DEFENSE ROGUELIKE</Badge><span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">investigate · map · defend · quiz</span></div><h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">The Labyrinth of Evidence</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">The instructor creates a bounded case. You connect evidence, choose a mitigation, challenge certainty, and earn unlocks for understanding—not button mashing.</p></div><div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3"><div className="text-right"><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Player status</p><p className="mt-1 text-lg font-semibold text-white">Level {gameResult?.progress?.level || gameProgress.data?.level || 1}</p></div><div className="h-10 w-px bg-white/10" /><div><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">XP</p><p className="mt-1 text-lg font-semibold text-cyan-200">{gameResult?.progress?.xp || gameProgress.data?.xp || 0}</p></div></div></div>
            <div className="grid gap-6 p-6 sm:p-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">{gameScenario ? <><div className="space-y-5"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Chapter 01 · {gameScenario.chapter}</p><h3 className="mt-2 text-2xl font-semibold text-white">{gameScenario.title}</h3></div><span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[10px] text-slate-500">RUN 01</span></div><div className="rounded-2xl border border-white/10 bg-black/15 p-5"><div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-500"><Radar className="h-3.5 w-3.5 text-violet-200" />Mission briefing</div><p className="text-sm leading-6 text-slate-300">{gameScenario.briefing}</p></div><div><div className="mb-3 flex items-center justify-between"><p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Map the evidence connections</p><span className="font-mono text-[10px] text-slate-600">+50 each</span></div><div className="flex flex-wrap gap-2">{gameScenario.edges.map(edge => <button key={edge} type="button" onClick={() => toggleEdge(edge)} className={`rounded-xl border px-3 py-2 text-left text-xs transition ${selectedEdges.includes(edge) ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/25 hover:text-slate-200"}`}>{edge}</button>)}</div></div><div className="rounded-xl border border-white/10 bg-black/10 p-4"><p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Evidence nodes</p><div className="flex flex-wrap gap-2">{gameScenario.nodes.map(node => <span key={node} className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-xs text-violet-100"><span className="h-1.5 w-1.5 rounded-full bg-violet-200" />{node}</span>)}</div></div></div><div className="space-y-5"><div className="rounded-2xl border border-white/10 bg-black/15 p-5"><div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-amber-200"><BrainCircuit className="h-3.5 w-3.5" />Instructor challenge</div><p className="text-base font-medium text-slate-100">{gameScenario.quiz.question}</p><div className="mt-4 grid gap-2">{gameScenario.quiz.options.map((option, index) => <button key={option} type="button" onClick={() => setQuizAnswer(index)} className={`rounded-xl border px-3 py-3 text-left text-sm transition ${quizAnswer === index ? "border-amber-200/40 bg-amber-200/10 text-amber-100" : "border-white/10 text-slate-400 hover:border-white/25 hover:text-slate-200"}`}>{String.fromCharCode(65 + index)}. {option}</button>)}</div></div><div className="rounded-2xl border border-white/10 bg-black/15 p-5"><div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-emerald-200"><ShieldCheck className="h-3.5 w-3.5" />Choose your mitigation</div><div className="grid gap-2">{gameScenario.mitigationOptions.map(option => <button key={option} type="button" onClick={() => setMitigation(option)} className={`rounded-xl border px-3 py-3 text-left text-sm transition ${mitigation === option ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100" : "border-white/10 text-slate-400 hover:border-white/25 hover:text-slate-200"}`}>{option}</button>)}</div></div><Button onClick={submitGameRun} disabled={submitGame.isPending || quizAnswer === null || !mitigation} className="h-12 w-full bg-violet-200 text-[#191024] hover:bg-violet-100">{submitGame.isPending ? "Evaluating your run…" : <>Submit run for evaluation <ArrowUpRight className="ml-2 h-4 w-4" /></>}</Button>{gameResult && <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-5"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-cyan-100">Run evaluated</p><span className="text-2xl font-semibold text-white">+{gameResult.score} XP</span></div><div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs"><span className="rounded-lg bg-black/15 p-2 text-slate-400">Map <b className="block text-slate-100">{gameResult.mappingScore}</b></span><span className="rounded-lg bg-black/15 p-2 text-slate-400">Quiz <b className="block text-slate-100">{gameResult.quizScore}</b></span><span className="rounded-lg bg-black/15 p-2 text-slate-400">Mitigate <b className="block text-slate-100">{gameResult.mitigationScore}</b></span></div><p className="mt-4 text-sm leading-6 text-slate-300">{gameResult.explanation}</p>{gameResult.progress ? <p className="mt-3 text-xs text-cyan-200">Unlocked: {gameResult.progress.unlocked.join(" · ")}</p> : <p className="mt-3 text-xs text-slate-500">Sign in to persist XP and unlocks across runs.</p>}</div>}</div></> : <div className="p-8 text-sm text-slate-500">Loading the first scenario…</div>}</div>
          </section>

          <section id="simulate" className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <Card className="border-amber-200/15 bg-amber-200/[0.035] shadow-2xl shadow-black/20">
              <CardHeader className="border-b border-white/10 pb-5"><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-amber-200"><FlaskConical className="h-3.5 w-3.5" />Synthetic lab</div><CardTitle className="text-xl text-white">Simulate, observe, contain</CardTitle></CardHeader>
              <CardContent className="space-y-5 pt-6"><p className="text-sm leading-6 text-slate-400">Run a deterministic fixture inspired by a known ATT&amp;CK behavior. Nothing is downloaded, executed, persisted outside this app, or sent to a real network.</p><div className="space-y-2"><label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Scenario</label><Select value={scenario} onValueChange={value => setScenario(value as typeof scenario)}><SelectTrigger className="border-white/10 bg-black/20 text-slate-100"><SelectValue /></SelectTrigger><SelectContent className="border-white/10 bg-[#111d2d] text-slate-100">{catalog.data?.map(item => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select></div><div className="rounded-xl border border-white/10 bg-black/10 p-4"><p className="text-xs uppercase tracking-[0.14em] text-slate-500">Objective</p><p className="mt-2 text-sm leading-6 text-slate-300">{catalog.data?.find(item => item.id === scenario)?.objective || "Loading scenario catalog…"}</p></div><Button onClick={() => runSimulation.mutate({ scenario })} disabled={runSimulation.isPending || !catalog.data?.length} className="h-11 w-full bg-amber-200 text-[#281b05] hover:bg-amber-100">{runSimulation.isPending ? <><span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-[#281b05]/30 border-t-[#281b05]" />Running inert fixture…</> : <><Play className="mr-2 h-4 w-4" />Run safe simulation</>}</Button><div className="flex items-start gap-2 text-xs leading-5 text-slate-500"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-200" />The zombie vault stores only failure metadata and safe snapshots. It never replays a failed payload.</div></CardContent>
            </Card>
            <Card className="border-white/10 bg-[#0b1727] shadow-2xl shadow-black/20"><CardHeader className="border-b border-white/10 pb-5"><div className="flex items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-emerald-200"><Workflow className="h-3.5 w-3.5" />Purple-team coordinator</div><CardTitle className="text-xl text-white">Telemetry comparison</CardTitle></div>{simulation && <Badge className={simulation.detectionResult === "detected" ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200" : "border-amber-200/25 bg-amber-200/10 text-amber-100"}>{simulation.detectionResult}</Badge>}</div></CardHeader><CardContent className="pt-6">{simulation ? <div className="space-y-5 text-sm"><div className="flex items-center gap-3 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.06] p-4"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" /><div><p className="font-medium text-slate-100">{simulation.label}</p><p className="mt-1 text-xs text-slate-500">{simulation.technique}</p></div></div><div className="grid gap-4 sm:grid-cols-2"><ResultBlock label="Expected telemetry" items={simulation.expectedTelemetry} /><ResultBlock label="Observed telemetry" items={simulation.observedTelemetry} /></div><ResultBlock label="Containment state" text={simulation.containment} accent="emerald" /><ResultBlock label="Next experiment" text={simulation.nextStep} accent="amber" /><div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4 text-xs text-slate-500"><span className="inline-flex items-center gap-2"><PauseCircle className="h-4 w-4 text-cyan-300" />Fail-closed boundary active</span><span className="inline-flex items-center gap-2"><Ban className="h-4 w-4 text-cyan-300" />No code executed</span></div></div> : <div className="flex min-h-[320px] flex-col items-center justify-center text-center"><div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4"><FlaskConical className="h-9 w-9 text-amber-200" /></div><p className="text-lg font-medium text-slate-200">No simulation run yet.</p><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Choose a synthetic fixture to compare expected and observed telemetry without launching an attack.</p></div>}</CardContent></Card>
          </section>

          <section id="analyze" className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <Card className="border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20">
              <CardHeader className="border-b border-white/10 pb-5"><div className="flex items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-cyan-300"><Sparkles className="h-3.5 w-3.5" />Reasoning input</div><CardTitle className="text-xl text-white">What did you observe?</CardTitle></div><span className="rounded-lg border border-white/10 px-2 py-1 font-mono text-[10px] text-slate-500">MAX 1,800</span></div></CardHeader>
              <CardContent className="space-y-5 pt-6">
                <div className="space-y-2"><label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Reasoning mode</label><Select value={mode} onValueChange={value => setMode(value as typeof mode)}><SelectTrigger className="border-white/10 bg-black/20 text-slate-100"><SelectValue /></SelectTrigger><SelectContent className="border-white/10 bg-[#111d2d] text-slate-100">{modes.map(item => <SelectItem key={item.value} value={item.value}>{item.label} <span className="ml-2 text-xs text-slate-500">— {item.hint}</span></SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><div className="flex items-center justify-between"><label htmlFor="observation" className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Observed behavior or exercise note</label><span className="font-mono text-[10px] text-slate-600">{observation.length}/1800</span></div><Textarea id="observation" value={observation} onChange={event => setObservation(event.target.value)} placeholder="Example: A benign test script created a scheduled task that launches a signed system binary at logon." className="min-h-[190px] resize-y border-white/10 bg-black/20 text-slate-100 placeholder:text-slate-600 focus-visible:ring-cyan-300/50" /></div>
                <Button onClick={submit} disabled={analyze.isPending || observation.trim().length < 10} className="h-11 w-full bg-cyan-300 text-[#06202a] hover:bg-cyan-200">{analyze.isPending ? <><span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-[#06202a]/30 border-t-[#06202a]" />Building evidence chain…</> : <>Analyze safely <ArrowUpRight className="ml-2 h-4 w-4" /></>}</Button>
                <p className="text-xs leading-5 text-slate-500">Input is treated as a behavior description, not an executable artifact. No samples are downloaded, executed, or modified.</p>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-[#0b1727] shadow-2xl shadow-black/20">
              <CardHeader className="border-b border-white/10 pb-5"><div className="flex items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-amber-200"><Radar className="h-3.5 w-3.5" />Analysis output</div><CardTitle className="text-xl text-white">{result ? "Evidence chain" : "Ready for a note"}</CardTitle></div>{result && <Badge className={`border ${confidenceTone(result.confidence)}`}>{result.confidence}</Badge>}</div></CardHeader>
              <CardContent className="pt-6">{result ? <div className="space-y-5 text-sm"><div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] p-4 leading-6 text-slate-200">{result.summary}</div><div className="grid gap-4 sm:grid-cols-2"><ResultBlock label="ATT&CK hypothesis" items={result.techniques} chips /><ResultBlock label="Likely objective" text={result.objective} /></div><ResultBlock label="Expected telemetry" items={result.telemetry} /><ResultBlock label="Detection gap to review" text={result.detectionGap} accent="amber" /><ResultBlock label="Safe purple-team test" text={result.safeTest} accent="emerald" /><div className="flex items-center gap-2 border-t border-white/10 pt-4 text-xs text-slate-500"><CheckCircle2 className="h-4 w-4 text-emerald-300" />Validated output · persisted to your workspace{result.id ? ` · record ${result.id}` : ""}</div></div> : <div className="flex min-h-[390px] flex-col items-center justify-center text-center"><div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4"><BrainCircuit className="h-9 w-9 text-cyan-300" /></div><p className="text-lg font-medium text-slate-200">Your structured reasoning chain will appear here.</p><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Give Sentinel Atlas a concise behavior note to see the hypothesis, telemetry, and defensive next move.</p></div>}</CardContent>
            </Card>
          </section>

          <section id="boundaries" className="grid gap-4 md:grid-cols-3"><Boundary icon={<LockKeyhole />} title="No live execution" text="Malware is never downloaded, executed, or modified here." /><Boundary icon={<ShieldCheck />} title="Authorized exercises" text="Tests are framed for isolated, approved purple-team environments." /><Boundary icon={<Database />} title="Evidence trail" text="Each result is schema-backed with confidence and validation status." /></section>

          <section id="history" className="space-y-4"><div className="flex items-end justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-cyan-300"><History className="h-3.5 w-3.5" />Workspace history</div><h2 className="text-2xl font-semibold text-white">Recent analyses</h2></div>{!isAuthenticated && <Button variant="ghost" size="sm" onClick={startLogin} className="text-slate-400 hover:text-white"><LogIn className="mr-2 h-4 w-4" />Sign in to save history</Button>}</div>{isAuthenticated ? <div className="grid gap-3">{recent.isLoading ? <div className="rounded-xl border border-white/10 p-5 text-sm text-slate-500">Loading your records…</div> : recent.data?.length ? recent.data.map(item => <button key={item.id} onClick={() => setObservation(item.observation)} className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-cyan-300/30 hover:bg-white/[0.06]"><div className="flex items-center justify-between gap-4"><span className="text-sm font-medium text-slate-200 group-hover:text-cyan-200">{item.summary}</span><Badge variant="outline" className={`shrink-0 border ${confidenceTone(item.confidence as Result["confidence"])}`}>{item.confidence}</Badge></div><div className="mt-2 flex items-center gap-2 text-xs text-slate-500"><span className="capitalize">{item.mode}</span><span>·</span><span>{new Date(item.createdAt).toLocaleString()}</span></div></button>) : <div className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-slate-500">No saved analyses yet. Run your first defensive note above.</div>}</div> : <Alert className="border-white/10 bg-white/[0.03] text-slate-300"><History className="h-4 w-4" /><AlertTitle className="text-slate-200">Private history is optional</AlertTitle><AlertDescription className="text-slate-500">Analyze without signing in, or sign in to associate records with your workspace.</AlertDescription></Alert>}</section>
        </div>
      </main>
      <footer className="mx-auto flex max-w-[1440px] flex-col gap-2 border-t border-white/10 px-5 py-8 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between lg:px-10"><span>Sentinel Atlas · defensive research companion</span><span className="inline-flex items-center gap-2"><TriangleAlert className="h-3.5 w-3.5" />Human review remains part of the loop</span></footer>
    </div>
  );
}

function ResultBlock({ label, text, items, chips, accent }: { label: string; text?: string; items?: readonly string[]; chips?: boolean; accent?: "amber" | "emerald" }) {
  return <div className={`rounded-xl border p-4 ${accent === "amber" ? "border-amber-200/20 bg-amber-200/[0.04]" : accent === "emerald" ? "border-emerald-300/20 bg-emerald-300/[0.04]" : "border-white/10 bg-black/10"}`}><p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>{items ? <div className={chips ? "flex flex-wrap gap-2" : "space-y-2"}>{items.map((item, index) => chips ? <span key={index} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-xs text-cyan-100">{item}</span> : <p key={index} className="flex gap-2 leading-5 text-slate-300"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />{item}</p>)}</div> : <p className="leading-6 text-slate-300">{text}</p>}</div>;
}

function Boundary({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-300">{icon}</div><p className="text-sm font-medium text-slate-200">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>;
}
