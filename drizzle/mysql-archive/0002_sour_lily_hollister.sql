ALTER TABLE `getEvenProfiles` MODIFY COLUMN `createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `getEvenProfiles` MODIFY COLUMN `updatedAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `getEvenReceipts` MODIFY COLUMN `createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);