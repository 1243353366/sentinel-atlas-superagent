CREATE TABLE `simulations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`scenario` enum('decoy_document','suspicious_login','dns_beacon','scheduled_task') NOT NULL,
	`objective` text NOT NULL,
	`expectedTelemetry` text NOT NULL,
	`observedTelemetry` text NOT NULL,
	`status` enum('completed','paused','blocked') NOT NULL,
	`detectionResult` enum('detected','partial','missed','not_run') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `simulations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `zombie_quarantine` (
	`id` int AUTO_INCREMENT NOT NULL,
	`simulationId` int,
	`reason` varchar(255) NOT NULL,
	`payloadHash` varchar(128) NOT NULL,
	`safeSnapshot` text NOT NULL,
	`status` enum('quarantined','released','discarded') NOT NULL DEFAULT 'quarantined',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `zombie_quarantine_id` PRIMARY KEY(`id`)
);
