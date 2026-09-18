CREATE TABLE `game_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`scenarioId` varchar(64) NOT NULL,
	`score` int NOT NULL,
	`quizScore` int NOT NULL,
	`mappingScore` int NOT NULL,
	`mitigationScore` int NOT NULL,
	`resultJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `game_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `player_progress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`xp` int NOT NULL DEFAULT 0,
	`level` int NOT NULL DEFAULT 1,
	`unlocked` text NOT NULL,
	`correctAnswers` int NOT NULL DEFAULT 0,
	`gamesPlayed` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `player_progress_id` PRIMARY KEY(`id`),
	CONSTRAINT `player_progress_userId_unique` UNIQUE(`userId`)
);
