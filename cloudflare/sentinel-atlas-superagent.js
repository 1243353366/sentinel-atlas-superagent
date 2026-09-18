const VERSION = "v1";
const MAX_BODY = 16_384;
const MAX_STEPS = 6;

const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "access-control-allow-origin": "*",
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

const toolRegistry = {
  analyze: {
    permission: "read:observation",
    run(input) {
      const observation = String(input.observation || "").trim();
      if (observation.length < 10 || observation.length > 1800) throw new Error("observation must be between 10 and 1800 characters");
      const terms = [...new Set((observation.toLowerCase().match(/\b(process|file|task|login|dns|network|telemetry|endpoint|user|host)\b/g) || []))].sort();
      return { summary: "Candidate evidence extracted without asserting compromise.", entities: terms.map(value => ({ type: "term", value })), confidence: terms.length ? "candidate" : "uncertain" };
    },
  },
  evaluate: {
    permission: "read:evidence",
    run(input) {
      if (!Array.isArray(input.expected) || !Array.isArray(input.observed)) throw new Error("expected and observed arrays are required");
      const expected = [...new Set(input.expected.map(String))];
      const observed = new Set(input.observed.map(String));
      const matchedEvidence = expected.filter(value => observed.has(value));
      const missingEvidence = expected.filter(value => !observed.has(value));
      return { verdict: missingEvidence.length ? (matchedEvidence.length ? "uncertain" : "unsupported") : "supported", matchedEvidence, missingEvidence };
    },
  },
  telemetry: {
    permission: "read:telemetry",
    run(input) {
      if (!Array.isArray(input.events) || input.events.length > 500) throw new Error("events must be an array of at most 500 items");
      const byType = {};
      for (const event of input.events) {
        const type = typeof event === "object" && event ? String(event.type || "unknown") : "invalid";
        byType[type] = (byType[type] || 0) + 1;
      }
      return { eventCount: input.events.length, byType };
    },
  },
  graph: {
    permission: "read:evidence",
    run(input) {
      if (!Array.isArray(input.events) || input.events.length > 500) throw new Error("events must be an array of at most 500 items");
      const nodes = new Map();
      const edges = [];
      for (const event of input.events) {
        if (!event || typeof event !== "object") continue;
        const id = String(event.id || "event-unknown");
        nodes.set(id, { id, type: String(event.type || "event") });
        if (event.parent) {
          const parent = String(event.parent);
          if (!nodes.has(parent)) nodes.set(parent, { id: parent, type: "parent" });
          edges.push({ from: parent, to: id, relation: String(event.relation || "related") });
        }
      }
      return { nodes: [...nodes.values()], edges };
    },
  },
};

function provenance(requestId, tool) {
  return { requestId, tool, version: VERSION, execution: "read-only", authority: "no permission escalation" };
}

function policy(toolName) {
  const tool = toolRegistry[toolName];
  if (!tool) return { decision: "deny", reason: "tool_not_registered" };
  return { decision: "allow", permission: tool.permission };
}

async function readJson(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY) throw new Error("request body too large");
  const payload = await request.json();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("request must be a JSON object");
  return payload;
}

async function runAgent(input) {
  const objective = String(input.objective || "").trim();
  if (objective.length < 10 || objective.length > 1200) throw new Error("objective must be between 10 and 1200 characters");
  const requestedSteps = Number(input.maxSteps || 3);
  const maxSteps = Math.min(MAX_STEPS, Math.max(1, Number.isFinite(requestedSteps) ? requestedSteps : 3));
  const taskId = String(input.taskId || crypto.randomUUID());
  const state = { taskId, objective, constraints: ["read-only", "synthetic evidence only", "no permission escalation", "no external network calls"], plan: [], currentStep: 0, observations: [], evidence: [], hypotheses: [], toolHistory: [], uncertainties: [], budget: { maxSteps, maxRuntimeMs: 5000 }, status: "running", version: VERSION };
  const observation = String(input.observation || objective).slice(0, 1800);
  state.plan = ["extract evidence", "evaluate uncertainty", "terminate with provenance"];
  while (state.currentStep < maxSteps) {
    state.currentStep += 1;
    const toolName = state.currentStep === 1 ? "analyze" : "evaluate";
    const decision = policy(toolName);
    state.toolHistory.push({ step: state.currentStep, tool: toolName, policy: decision });
    if (decision.decision !== "allow") {
      state.status = "blocked";
      state.uncertainties.push("policy denied tool");
      break;
    }
    try {
      const result = toolRegistry[toolName].run(toolName === "analyze" ? { observation } : { expected: ["process", "telemetry"], observed: state.observations });
      state.observations.push({ tool: toolName, result });
      if (toolName === "analyze") state.evidence.push(...(result.entities || []));
      if (toolName === "evaluate") {
        state.hypotheses.push({ verdict: result.verdict, missingEvidence: result.missingEvidence });
        state.status = result.verdict === "supported" ? "completed" : "completed_with_uncertainty";
        break;
      }
    } catch (error) {
      state.status = "failed_closed";
      state.uncertainties.push(String(error.message || "tool failure"));
      break;
    }
  }
  if (state.status === "running") state.status = "completed_with_uncertainty";
  state.provenance = { runtime: "cloudflare-worker", version: VERSION, policy: "fixed code; no learned permissions" };
  return state;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method === "GET" && url.pathname === "/") return json({ name: "Sentinel Atlas Superagent", version: VERSION, status: "online", mode: "bounded-read-only", endpoints: ["/health", "/tools", "/agent/run"] });
    if (request.method === "GET" && url.pathname === "/health") return json({ status: "ok", runtime: "cloudflare-worker", version: VERSION, policy: "fail-closed" });
    if (request.method === "GET" && url.pathname === "/tools") return json({ version: VERSION, tools: Object.entries(toolRegistry).map(([name, tool]) => ({ name, permission: tool.permission, execution: "read-only" })) });
    if (request.method === "POST" && url.pathname === "/agent/run") {
      try {
        const input = await readJson(request);
        return json(await runAgent(input));
      } catch (error) {
        return json({ error: "invalid_or_failed_request", message: String(error.message || "request rejected"), version: VERSION, policy: "fail-closed" }, 400);
      }
    }
    return json({ error: "not_found", version: VERSION }, 404);
  },
};
