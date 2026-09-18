CREATE TABLE `evaluation_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`source` varchar(64) NOT NULL,
	`scenarioId` varchar(64) NOT NULL,
	`agentEvaluation` text NOT NULL,
	`evidenceJson` text NOT NULL,
	`verdict` enum('supported','uncertain','unsupported') NOT NULL,
	`regressionStatus` enum('pending','passed','failed') NOT NULL DEFAULT 'pending',
	`provenanceJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evaluation_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `learning_candidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`evaluationId` int,
	`problem` text NOT NULL,
	`proposedChange` text NOT NULL,
	`regressionPassed` int NOT NULL DEFAULT 0,
	`regressionFailed` int NOT NULL DEFAULT 0,
	`status` enum('pending','rejected','promoted') NOT NULL DEFAULT 'pending',
	`humanApproved` int NOT NULL DEFAULT 0,
	`provenanceJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `learning_candidates_id` PRIMARY KEY(`id`)
);
