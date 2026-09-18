import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { evaluationRecords, gameRuns, InsertSimulation, InsertThreatAnalysis, InsertUser, playerProgress, simulations, threatAnalyses, users, zombieQuarantine } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined || user.openId === ENV.ownerOpenId) {
    values.role = user.role ?? "admin";
    updateSet.role = values.role;
  }
  values.lastSignedIn ??= new Date();
  updateSet.lastSignedIn ??= values.lastSignedIn;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function saveThreatAnalysis(input: InsertThreatAnalysis) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(threatAnalyses).values(input);
  return Number(result[0].insertId);
}

export async function getRecentThreatAnalyses(userId: number, limit = 8) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: threatAnalyses.id,
    mode: threatAnalyses.mode,
    observation: threatAnalyses.observation,
    summary: threatAnalyses.summary,
    confidence: threatAnalyses.confidence,
    createdAt: threatAnalyses.createdAt,
  }).from(threatAnalyses)
    .where(eq(threatAnalyses.userId, userId))
    .orderBy(desc(threatAnalyses.createdAt))
    .limit(limit);
}

export async function saveSimulation(input: InsertSimulation) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(simulations).values(input);
  return Number(result[0].insertId);
}

export async function saveZombieQuarantine(input: typeof zombieQuarantine.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(zombieQuarantine).values(input);
  return Number(result[0].insertId);
}

export async function getRecentSimulations(userId: number, limit = 8) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: simulations.id,
    scenario: simulations.scenario,
    status: simulations.status,
    detectionResult: simulations.detectionResult,
    objective: simulations.objective,
    createdAt: simulations.createdAt,
  }).from(simulations)
    .where(eq(simulations.userId, userId))
    .orderBy(desc(simulations.createdAt))
    .limit(limit);
}

export async function getPlayerProgress(userId: number) {
  const db = await getDb();
  if (!db) return { xp: 0, level: 1, unlocked: ["Evidence Investigation"], correctAnswers: 0, gamesPlayed: 0 };
  const rows = await db.select().from(playerProgress).where(eq(playerProgress.userId, userId)).limit(1);
  const row = rows[0];
  if (!row) return { xp: 0, level: 1, unlocked: ["Evidence Investigation"], correctAnswers: 0, gamesPlayed: 0 };
  let unlocked: string[] = ["Evidence Investigation"];
  try { unlocked = JSON.parse(row.unlocked); } catch {}
  return { ...row, unlocked };
}

export async function saveGameRun(userId: number | null, input: { scenarioId: string; score: number; quizScore: number; mappingScore: number; mitigationScore: number; resultJson: string }) {
  const db = await getDb();
  if (!db || !userId) return null;
  const current = await getPlayerProgress(userId);
  const xp = current.xp + input.score;
  const level = Math.min(10, Math.floor(xp / 250) + 1);
  const unlocks = ["Evidence Investigation"];
  if (level >= 2) unlocks.push("ATT&CK Mapping");
  if (level >= 3) unlocks.push("Purple-Team Scenarios");
  if (level >= 4) unlocks.push("Deception Lab");
  if (level >= 5) unlocks.push("Adaptive Adversary");
  if (level >= 6) unlocks.push("AI Guardrail Testing");
  if (level >= 7) unlocks.push("Multi-Agent Exercises");
  if (level >= 8) unlocks.push("Build Your Own Scenario");
  if (level >= 9) unlocks.push("Advanced Telemetry");
  if (level >= 10) unlocks.push("Researcher Mode");
  await db.insert(gameRuns).values({ userId, ...input });
  await db.insert(playerProgress).values({ userId, xp, level, unlocked: JSON.stringify(unlocks), correctAnswers: current.correctAnswers + (input.quizScore > 0 ? 1 : 0), gamesPlayed: current.gamesPlayed + 1 }).onDuplicateKeyUpdate({ set: { xp, level, unlocked: JSON.stringify(unlocks), correctAnswers: current.correctAnswers + (input.quizScore > 0 ? 1 : 0), gamesPlayed: current.gamesPlayed + 1 } });
  return { xp, level, unlocked: unlocks, correctAnswers: current.correctAnswers + (input.quizScore > 0 ? 1 : 0), gamesPlayed: current.gamesPlayed + 1 };
}

export async function saveEvaluationRecord(userId: number | null, input: { scenarioId: string; agentEvaluation: string; evidenceJson: string; verdict: "supported" | "uncertain" | "unsupported"; provenanceJson: string }) {
  const db = await getDb();
  if (!db || !userId) return null;
  const result = await db.insert(evaluationRecords).values({ userId, source: "training_game", ...input, regressionStatus: "pending" });
  return Number(result[0].insertId);
}
