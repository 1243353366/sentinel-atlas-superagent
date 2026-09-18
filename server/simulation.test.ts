import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function publicCaller() {
  const ctx: TrpcContext = {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

describe("simulation.catalog", () => {
  it("exposes only inert, bounded scenarios", async () => {
    const catalog = await publicCaller().simulation.catalog();
    expect(catalog).toHaveLength(4);
    expect(catalog.map(item => item.id)).toEqual([
      "decoy_document",
      "suspicious_login",
      "dns_beacon",
      "scheduled_task",
    ]);
    expect(catalog.every(item => item.objective.length > 20)).toBe(true);
    expect(catalog.some(item => item.objective.toLowerCase().includes("real network"))).toBe(false);
  });
});

describe("game.submit", () => {
  it("rewards evidence connections and a defensible mitigation without executing code", async () => {
    const result = await publicCaller().game.submit({
      scenarioId: "signal-in-the-noise",
      connections: [
        "Unexpected share→User opens decoy",
        "User opens decoy→Endpoint event",
        "Endpoint event→No network egress",
      ],
      quizAnswer: 1,
      mitigation: "Preserve telemetry and tune the detection",
    });

    expect(result.connectionHits).toBe(3);
    expect(result.correctQuiz).toBe(true);
    expect(result.correctMitigation).toBe(true);
    expect(result.score).toBeGreaterThan(400);
    expect(result.explanation).toContain("does not prove compromise");
  });
});
