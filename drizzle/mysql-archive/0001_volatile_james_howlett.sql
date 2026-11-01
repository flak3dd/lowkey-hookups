-- Resumable additive migration: MySQL DDL is not rolled back on a partial failure.
CREATE TABLE IF NOT EXISTS `getEvenBlocks` (
	`id` varchar(36) NOT NULL,
	`ownerUserId` int NOT NULL,
	`blockedUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `getEvenBlocks_id` PRIMARY KEY(`id`),
	CONSTRAINT `getEvenBlocks_owner_blocked_unique` UNIQUE(`ownerUserId`,`blockedUserId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `getEvenMessages` (
	`id` varchar(36) NOT NULL,
	`threadId` varchar(36) NOT NULL,
	`senderUserId` int NOT NULL,
	`clientId` varchar(96) NOT NULL,
	`payloadCiphertext` mediumtext NOT NULL,
	`suppressedForUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `getEvenMessages_id` PRIMARY KEY(`id`),
	CONSTRAINT `getEvenMessages_thread_sender_client_unique` UNIQUE(`threadId`,`senderUserId`,`clientId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `getEvenProbes` (
	`id` varchar(36) NOT NULL,
	`receiptId` varchar(36) NOT NULL,
	`recipientUserId` int NOT NULL,
	`recipientProfileId` varchar(36) NOT NULL,
	`recipientIncarnationId` varchar(36) NOT NULL,
	`senderUserId` int NOT NULL,
	`senderProfileId` varchar(36) NOT NULL,
	`intent` enum('Hook up','Date','Chat') NOT NULL,
	`mode` enum('anonymous','named') NOT NULL,
	`identityCiphertext` mediumtext,
	`state` enum('open','ignored','accepted','blocked') NOT NULL DEFAULT 'open',
	`threadId` varchar(36),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `getEvenProbes_id` PRIMARY KEY(`id`),
	CONSTRAINT `getEvenProbes_receipt_unique` UNIQUE(`receiptId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `getEvenProfiles` (
	`id` varchar(36) NOT NULL,
	`ownerUserId` int NOT NULL,
	`incarnationId` varchar(36) NOT NULL,
	`phoneHmac` varchar(64) NOT NULL,
	`phoneBoundAt` timestamp(3) NOT NULL,
	`intent` enum('Hook up','Date','Chat') NOT NULL,
	`payloadCiphertext` mediumtext NOT NULL,
	`createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updatedAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `getEvenProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `getEvenProfiles_ownerUserId_unique` UNIQUE(`ownerUserId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `getEvenReceipts` (
	`id` varchar(36) NOT NULL,
	`senderUserId` int NOT NULL,
	`senderProfileId` varchar(36) NOT NULL,
	`clientId` varchar(96) NOT NULL,
	`targetPhoneHmac` varchar(64) NOT NULL,
	`intent` enum('Hook up','Date','Chat') NOT NULL,
	`mode` enum('anonymous','named') NOT NULL,
	`payloadCiphertext` mediumtext NOT NULL,
	`routingStatus` enum('pending','processing','processed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`routedAt` timestamp(3),
	CONSTRAINT `getEvenReceipts_id` PRIMARY KEY(`id`),
	CONSTRAINT `getEvenReceipts_sender_client_unique` UNIQUE(`senderUserId`,`clientId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `getEvenReports` (
	`id` varchar(36) NOT NULL,
	`reporterUserId` int NOT NULL,
	`subjectType` enum('probe','thread') NOT NULL,
	`subjectId` varchar(36) NOT NULL,
	`reason` varchar(240) NOT NULL,
	`includeContent` boolean NOT NULL DEFAULT false,
	`evidenceCiphertext` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `getEvenReports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `getEvenThreads` (
	`id` varchar(36) NOT NULL,
	`intent` enum('Hook up','Date','Chat') NOT NULL,
	`participantAUserId` int NOT NULL,
	`participantBUserId` int NOT NULL,
	`participantAIdentityCiphertext` mediumtext,
	`participantBIdentityCiphertext` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `getEvenThreads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `authFlows` (
	`flowId` varchar(128) NOT NULL,
	`verifierHash` varchar(64) NOT NULL,
	`redirectUri` varchar(2048) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `authFlows_flowId` PRIMARY KEY(`flowId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `revokedSessions` (
	`tokenHash` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `revokedSessions_tokenHash` PRIMARY KEY(`tokenHash`)
);
--> statement-breakpoint
CREATE INDEX `getEvenBlocks_owner_created_idx` ON `getEvenBlocks` (`ownerUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `getEvenMessages_thread_created_idx` ON `getEvenMessages` (`threadId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `getEvenProbes_recipient_state_expiry_idx` ON `getEvenProbes` (`recipientUserId`,`state`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `getEvenProfiles_phoneHmac_idx` ON `getEvenProfiles` (`phoneHmac`);--> statement-breakpoint
CREATE INDEX `getEvenReceipts_sender_created_idx` ON `getEvenReceipts` (`senderUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `getEvenReceipts_route_idx` ON `getEvenReceipts` (`routingStatus`,`createdAt`);--> statement-breakpoint
CREATE INDEX `getEvenReports_reporter_created_idx` ON `getEvenReports` (`reporterUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `getEvenThreads_participantA_updated_idx` ON `getEvenThreads` (`participantAUserId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `getEvenThreads_participantB_updated_idx` ON `getEvenThreads` (`participantBUserId`,`updatedAt`);
