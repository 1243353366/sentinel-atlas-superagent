CREATE TABLE `threat_analyses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`mode` enum('analyst','adversary','defender','detection','auditor') NOT NULL,
	`observation` text NOT NULL,
	`summary` text NOT NULL,
	`techniques` text NOT NULL,
	`objective` text NOT NULL,
	`telemetry` text NOT NULL,
	`detectionGap` text NOT NULL,
	`safeTest` text NOT NULL,
	`confidence` enum('SUPPORTED','CANDIDATE','UNMAPPED','RESTRICTED') NOT NULL,
	`validationStatus` varchar(64) NOT NULL DEFAULT 'validated',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `threat_analyses_id` PRIMARY KEY(`id`)
);
