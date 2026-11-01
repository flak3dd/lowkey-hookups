CREATE TABLE `getEvenBatches` (
	`id` varchar(36) NOT NULL,
	`senderUserId` int NOT NULL,
	`clientId` varchar(96) NOT NULL,
	`inputFingerprint` varchar(64) NOT NULL,
	`submittedCount` int NOT NULL,
	`createdAt` timestamp(3) NOT NULL,
	CONSTRAINT `getEvenBatches_id` PRIMARY KEY(`id`),
	CONSTRAINT `getEvenBatches_sender_client_unique` UNIQUE(`senderUserId`,`clientId`)
);
--> statement-breakpoint
CREATE INDEX `getEvenBatches_sender_created_idx` ON `getEvenBatches` (`senderUserId`,`createdAt`);