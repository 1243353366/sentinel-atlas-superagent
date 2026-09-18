import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getPlayerProgress, getRecentSimulations, getRecentThreatAnalyses, saveEvaluationRecord, saveGameRun, saveSimulation, saveThreatAnalysis, saveZombieQuarantine } from "./db";

const modeSchema = z.enum(["analyst", "adversary", "defender", "detection", "auditor"]);
const inputSchema = z.object({
  mode: modeSchema,
  observation: z.string().trim().min(10).max(1800),
});

const restrictedPatterns = [
  /deploy\s+(malware|ransomware|payload)/i,
  /steal\s+(credentials|passwords|tokens)/i,
  /evad(e|ing)\s+(detection|law enforcement|monitoring)/i,
  /lateral\s+movement\s+(against|into)\s+(production|real|third)/i,
  /exfiltrat(e|ion).*real/i,
  /bypass\s+(edr|antivirus|security controls)/i,
];

const reasoningSystem = `You are Sentinel Atlas, an evidence-grounded defensive security analyst.

Hard boundaries:
- Analyze behavior descriptions, telemetry, reports, and synthetic exercise notes only.
- Never provide malware, persistence, credential theft, evasion, lateral movement, exfiltration, or unauthorized-access instructions.
- Never recommend executing live malware. Recommend only benign, authorized, isolated emulation.
- If the note asks for harmful operational help, return a restricted safety response.
- Do not invent facts, sources, hashes, or ATT&CK mappings. Use candidate wording when evidence is incomplete.
- Keep the answer useful to defenders: map behavior, state uncertainty, name expected telemetry, and identify a detection gap.

Return JSON that matches the requested schema exactly.`;

const outputSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    techniques: { type: "array", items: { type: "string" } },
    objective: { type: "string" },
    telemetry: { type: "array", items: { type: "string" } },
    detectionGap: { type: "string" },
    safeTest: { type: "string" },
    confidence: { type: "string", enum: ["SUPPORTED", "CANDIDATE", "UNMAPPED", "RESTRICTED"] },
  },
  required: ["summary", "techniques", "objective", "telemetry", "detectionGap", "safeTest", "confidence"],
  additionalProperties: false,
} as const;

const scenarioSchema = z.enum(["decoy_document", "suspicious_login", "dns_beacon", "scheduled_task"]);
const SCENARIOS = {
  decoy_document: {
    label: "Decoy document interaction",
    objective: "Measure whether a human interaction with a synthetic suspicious document is visible and contained.",
    technique: "T1204.002 User Execution: Malicious File (synthetic)",
    expected: ["decoy opened event", "document hash and signer", "user and host context", "endpoint control response"],
    observed: ["synthetic decoy-open event", "known-safe fixture hash", "training-user context", "no external network access"],
    detection: "detected" as const,
  },
  suspicious_login: {
    label: "Suspicious login prompt",
    objective: "Test whether an unusual authentication prompt produces useful identity and endpoint telemetry.",
    technique: "T1056.002 Input Capture: GUI Input Capture (simulation only)",
    expected: ["prompt display event", "identity-provider audit event", "user response", "device posture"],
    observed: ["synthetic prompt display", "no credential capture", "training-user dismissal", "device posture recorded"],
    detection: "partial" as const,
  },
  dns_beacon: {
    label: "Non-routable DNS beacon fixture",
    objective: "Evaluate DNS visibility without contacting an external command-and-control service.",
    technique: "T1071.004 DNS (non-routable fixture)",
    expected: ["resolver query", "query entropy and volume", "originating process", "domain reputation result"],
    observed: ["fixed lab-resolver query", "non-routable test name", "synthetic process identifier", "no internet egress"],
    detection: "detected" as const,
  },
  scheduled_task: {
    label: "Scheduled task persistence fixture",
    objective: "Test visibility for a benign scheduled-task lifecycle and cleanup verification.",
    technique: "T1053.005 Scheduled Task/Job: Scheduled Task (benign fixture)",
    expected: ["task creation", "parent process", "trigger and principal", "task removal confirmation"],
    observed: ["synthetic task-create event", "approved test harness identity", "logon trigger metadata", "cleanup verified"],
    detection: "detected" as const,
  },
} as const;

const GAME_SCENARIOS = [{
  id: "signal-in-the-noise",
  title: "Signal in the Noise",
  chapter: "Evidence Investigation",
  briefing: "A training user opens a synthetic document from an unexpected internal share. The endpoint does not execute code, but three evidence trails appear.",
  nodes: ["Unexpected share", "User opens decoy", "Signed fixture hash", "Endpoint event", "No network egress"],
  edges: ["Unexpected share→User opens decoy", "Unexpected share→Signed fixture hash", "User opens decoy→Signed fixture hash", "User opens decoy→Endpoint event", "Signed fixture hash→Endpoint event", "Endpoint event→No network egress"],
  correctConnections: ["Unexpected share→User opens decoy", "User opens decoy→Endpoint event", "Endpoint event→No network egress"],
  quiz: { question: "Which conclusion is most defensible?", options: ["The host is compromised", "The interaction is observable, but compromise is unproven", "The user is malicious", "The EDR is useless"], answer: 1 },
  mitigation: "Preserve telemetry and tune the detection",
  mitigationOptions: ["Delete the evidence", "Disable all user access", "Preserve telemetry and tune the detection", "Run an unknown payload"],
}];

type AtlasResult = {
  summary: string;
  techniques: string[];
  objective: string;
  telemetry: string[];
  detectionGap: string;
  safeTest: string;
  confidence: "SUPPORTED" | "CANDIDATE" | "UNMAPPED" | "RESTRICTED";
};

function restrictedResult(): AtlasResult {
  return {
    summary: "This request is outside Sentinel Atlas safety scope. I can help analyze defensive evidence or design an authorized, isolated test instead.",
    techniques: ["Not classified"],
    objective: "Safety boundary triggered; no operational guidance provided.",
    telemetry: ["Preserve the original request for review and use approved lab evidence only."],
    detectionGap: "Confirm that the exercise has written authorization, isolated infrastructure, synthetic credentials, and no uncontrolled outbound access.",
    safeTest: "Reframe the request as a benign ATT&CK-mapped emulation with a vendor-approved harness and human review.",
    confidence: "RESTRICTED",
  };
}

function normalizeResult(raw: unknown): AtlasResult {
  const value = (raw && typeof raw === "object" ? raw : {}) as Partial<AtlasResult>;
  const confidence = ["SUPPORTED", "CANDIDATE", "UNMAPPED", "RESTRICTED"].includes(String(value.confidence))
    ? value.confidence as AtlasResult["confidence"] : "UNMAPPED";
  return {
    summary: String(value.summary || "Insufficient evidence for a reliable conclusion.").slice(0, 2200),
    techniques: Array.isArray(value.techniques) ? value.techniques.map(String).slice(0, 8) : ["Unmapped behavior"],
    objective: String(value.objective || "Requires analyst review before classification.").slice(0, 1200),
    telemetry: Array.isArray(value.telemetry) ? value.telemetry.map(String).slice(0, 8) : ["Preserve process, identity, file, network, and control-response evidence."],
    detectionGap: String(value.detectionGap || "What evidence would confirm or falsify this hypothesis?").slice(0, 1200),
    safeTest: String(value.safeTest || "Use a benign reproduction in an isolated, authorized lab only.").slice(0, 1400),
    confidence,
  };
}

async function runAtlas(input: z.infer<typeof inputSchema>): Promise<AtlasResult> {
  if (restrictedPatterns.some((pattern) => pattern.test(input.observation))) return restrictedResult();

  const response = await invokeLLM({
    messages: [
      { role: "system", content: reasoningSystem },
      { role: "user", content: `Reasoning mode: ${input.mode}\nObserved behavior or exercise note:\n${input.observation}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "sentinel_atlas_result", strict: true, schema: outputSchema },
    },
  });
  const content = response.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content : JSON.stringify(content || {});
  return normalizeResult(JSON.parse(text));
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  atlas: router({
    analyze: publicProcedure.input(inputSchema).mutation(async ({ input, ctx }) => {
      const result = await runAtlas(input);
      const id = await saveThreatAnalysis({
        userId: ctx.user?.id ?? null,
        mode: input.mode,
        observation: input.observation,
        summary: result.summary,
        techniques: JSON.stringify(result.techniques),
        objective: result.objective,
        telemetry: JSON.stringify(result.telemetry),
        detectionGap: result.detectionGap,
        safeTest: result.safeTest,
        confidence: result.confidence,
        validationStatus: result.confidence === "RESTRICTED" ? "blocked" : "validated",
      });
      return { ...result, id };
    }),
    recent: protectedProcedure.query(({ ctx }) => getRecentThreatAnalyses(ctx.user.id)),
  }),
  simulation: router({
    catalog: publicProcedure.query(() => Object.entries(SCENARIOS).map(([id, scenario]) => ({ id, label: scenario.label, objective: scenario.objective, technique: scenario.technique }))),
    run: publicProcedure.input(z.object({ scenario: scenarioSchema })).mutation(async ({ input, ctx }) => {
      const scenario = SCENARIOS[input.scenario];
      const blocked = false; // The catalog contains synthetic fixtures only; no code or samples are executed.
      const status = blocked ? "blocked" as const : "completed" as const;
      const detectionResult = blocked ? "not_run" as const : scenario.detection;
      const id = await saveSimulation({
        userId: ctx.user?.id ?? null,
        scenario: input.scenario,
        objective: scenario.objective,
        expectedTelemetry: JSON.stringify(scenario.expected),
        observedTelemetry: JSON.stringify(scenario.observed),
        status,
        detectionResult,
      });
      const quarantineId = blocked ? await saveZombieQuarantine({ simulationId: id, reason: "Policy gate blocked execution", payloadHash: "synthetic-no-payload", safeSnapshot: "No executable payload was created; simulation state only." }) : null;
      return {
        id,
        quarantineId,
        scenario: input.scenario,
        label: scenario.label,
        technique: scenario.technique,
        objective: scenario.objective,
        expectedTelemetry: scenario.expected,
        observedTelemetry: scenario.observed,
        status,
        detectionResult,
        containment: "fail-closed: synthetic exercise only; no process, sample, or network action was executed",
        nextStep: scenario.detection === "detected" ? "Repeat with one controlled variable changed and compare telemetry." : "Review missing telemetry and require human approval before any next exercise.",
      };
    }),
    recent: protectedProcedure.query(({ ctx }) => getRecentSimulations(ctx.user.id)),
  }),
  game: router({
    catalog: publicProcedure.query(() => GAME_SCENARIOS.map(({ correctConnections: _correctConnections, mitigation: _mitigation, quiz, ...scenario }) => ({ ...scenario, quiz: { question: quiz.question, options: quiz.options } }))),
    progress: protectedProcedure.query(({ ctx }) => getPlayerProgress(ctx.user.id)),
    submit: publicProcedure.input(z.object({
      scenarioId: z.string(),
      connections: z.array(z.string()).max(10),
      quizAnswer: z.number().int().min(0).max(10),
      mitigation: z.string().max(300),
    })).mutation(async ({ input, ctx }) => {
      const scenario = GAME_SCENARIOS.find(item => item.id === input.scenarioId);
      if (!scenario) throw new Error("Unknown training scenario");
      const connectionHits = input.connections.filter(connection => scenario.correctConnections.includes(connection)).length;
      const mappingScore = Math.min(150, connectionHits * 50);
      const quizScore = input.quizAnswer === scenario.quiz.answer ? 150 : -50;
      const mitigationScore = input.mitigation === scenario.mitigation ? 200 : 0;
      const epistemicBonus = input.quizAnswer === scenario.quiz.answer && input.mitigation !== scenario.mitigation ? 25 : 0;
      const score = Math.max(0, 25 + mappingScore + quizScore + mitigationScore + epistemicBonus);
      const progress = await saveGameRun(ctx.user?.id ?? null, { scenarioId: input.scenarioId, score, quizScore, mappingScore, mitigationScore, resultJson: JSON.stringify({ connectionHits, epistemicBonus }) });
      const correctQuiz = input.quizAnswer === scenario.quiz.answer;
      const correctMitigation = input.mitigation === scenario.mitigation;
      const evaluationId = await saveEvaluationRecord(ctx.user?.id ?? null, { scenarioId: input.scenarioId, agentEvaluation: "Independent evaluator: compare evidence connections, quiz reasoning, and mitigation choice; do not infer compromise without supporting telemetry.", evidenceJson: JSON.stringify({ connectionHits, totalConnections: scenario.correctConnections.length, correctQuiz, correctMitigation }), verdict: correctQuiz && connectionHits >= 2 ? "supported" : "uncertain", provenanceJson: JSON.stringify({ source: "training_game", scenarioId: input.scenarioId, policy: "no new permissions; no code execution" }) });
      return { score, mappingScore, quizScore, mitigationScore, epistemicBonus, connectionHits, totalConnections: scenario.correctConnections.length, correctQuiz, correctMitigation, evaluationId, explanation: "Evidence supports an observable interaction and endpoint event, but it does not prove compromise. Preserve provenance, compare expected and observed telemetry, and avoid unsupported certainty.", progress };
    }),
  }),
});

export type AppRouter = typeof appRouter;
