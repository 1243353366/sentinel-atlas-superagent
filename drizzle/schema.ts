import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const threatAnalyses = mysqlTable("threat_analyses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  mode: mysqlEnum("mode", ["analyst", "adversary", "defender", "detection", "auditor"]).notNull(),
  observation: text("observation").notNull(),
  summary: text("summary").notNull(),
  techniques: text("techniques").notNull(),
  objective: text("objective").notNull(),
  telemetry: text("telemetry").notNull(),
  detectionGap: text("detectionGap").notNull(),
  safeTest: text("safeTest").notNull(),
  confidence: mysqlEnum("confidence", ["SUPPORTED", "CANDIDATE", "UNMAPPED", "RESTRICTED"]).notNull(),
  validationStatus: varchar("validationStatus", { length: 64 }).notNull().default("validated"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const simulations = mysqlTable("simulations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  scenario: mysqlEnum("scenario", ["decoy_document", "suspicious_login", "dns_beacon", "scheduled_task"]).notNull(),
  objective: text("objective").notNull(),
  expectedTelemetry: text("expectedTelemetry").notNull(),
  observedTelemetry: text("observedTelemetry").notNull(),
  status: mysqlEnum("status", ["completed", "paused", "blocked"]).notNull(),
  detectionResult: mysqlEnum("detectionResult", ["detected", "partial", "missed", "not_run"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const zombieQuarantine = mysqlTable("zombie_quarantine", {
  id: int("id").autoincrement().primaryKey(),
  simulationId: int("simulationId"),
  reason: varchar("reason", { length: 255 }).notNull(),
  payloadHash: varchar("payloadHash", { length: 128 }).notNull(),
  safeSnapshot: text("safeSnapshot").notNull(),
  status: mysqlEnum("status", ["quarantined", "released", "discarded"]).notNull().default("quarantined"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const playerProgress = mysqlTable("player_progress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  xp: int("xp").notNull().default(0),
  level: int("level").notNull().default(1),
  unlocked: text("unlocked").notNull(),
  correctAnswers: int("correctAnswers").notNull().default(0),
  gamesPlayed: int("gamesPlayed").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const gameRuns = mysqlTable("game_runs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  scenarioId: varchar("scenarioId", { length: 64 }).notNull(),
  score: int("score").notNull(),
  quizScore: int("quizScore").notNull(),
  mappingScore: int("mappingScore").notNull(),
  mitigationScore: int("mitigationScore").notNull(),
  resultJson: text("resultJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const evaluationRecords = mysqlTable("evaluation_records", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  source: varchar("source", { length: 64 }).notNull(),
  scenarioId: varchar("scenarioId", { length: 64 }).notNull(),
  agentEvaluation: text("agentEvaluation").notNull(),
  evidenceJson: text("evidenceJson").notNull(),
  verdict: mysqlEnum("verdict", ["supported", "uncertain", "unsupported"]).notNull(),
  regressionStatus: mysqlEnum("regressionStatus", ["pending", "passed", "failed"]).notNull().default("pending"),
  provenanceJson: text("provenanceJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const learningCandidates = mysqlTable("learning_candidates", {
  id: int("id").autoincrement().primaryKey(),
  evaluationId: int("evaluationId"),
  problem: text("problem").notNull(),
  proposedChange: text("proposedChange").notNull(),
  regressionPassed: int("regressionPassed").notNull().default(0),
  regressionFailed: int("regressionFailed").notNull().default(0),
  status: mysqlEnum("status", ["pending", "rejected", "promoted"]).notNull().default("pending"),
  humanApproved: int("humanApproved").notNull().default(0),
  provenanceJson: text("provenanceJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ThreatAnalysis = typeof threatAnalyses.$inferSelect;
export type InsertThreatAnalysis = typeof threatAnalyses.$inferInsert;
export type Simulation = typeof simulations.$inferSelect;
export type InsertSimulation = typeof simulations.$inferInsert;
export type PlayerProgress = typeof playerProgress.$inferSelect;
export type GameRun = typeof gameRuns.$inferSelect;
export type EvaluationRecord = typeof evaluationRecords.$inferSelect;
export type LearningCandidate = typeof learningCandidates.$inferSelect;
