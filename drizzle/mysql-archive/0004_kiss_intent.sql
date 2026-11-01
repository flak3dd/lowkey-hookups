-- Collapse Hook up / Date / Chat into a single Kiss intent.
-- Widen first so existing rows stay valid, convert them, then narrow.
ALTER TABLE `getEvenProbes` MODIFY COLUMN `intent` enum('Hook up','Date','Chat','Kiss') NOT NULL;--> statement-breakpoint
ALTER TABLE `getEvenProfiles` MODIFY COLUMN `intent` enum('Hook up','Date','Chat','Kiss') NOT NULL;--> statement-breakpoint
ALTER TABLE `getEvenReceipts` MODIFY COLUMN `intent` enum('Hook up','Date','Chat','Kiss') NOT NULL;--> statement-breakpoint
ALTER TABLE `getEvenThreads` MODIFY COLUMN `intent` enum('Hook up','Date','Chat','Kiss') NOT NULL;--> statement-breakpoint
UPDATE `getEvenProbes` SET `intent` = 'Kiss';--> statement-breakpoint
UPDATE `getEvenProfiles` SET `intent` = 'Kiss';--> statement-breakpoint
UPDATE `getEvenReceipts` SET `intent` = 'Kiss';--> statement-breakpoint
UPDATE `getEvenThreads` SET `intent` = 'Kiss';--> statement-breakpoint
ALTER TABLE `getEvenProbes` MODIFY COLUMN `intent` enum('Kiss') NOT NULL;--> statement-breakpoint
ALTER TABLE `getEvenProfiles` MODIFY COLUMN `intent` enum('Kiss') NOT NULL;--> statement-breakpoint
ALTER TABLE `getEvenReceipts` MODIFY COLUMN `intent` enum('Kiss') NOT NULL;--> statement-breakpoint
ALTER TABLE `getEvenThreads` MODIFY COLUMN `intent` enum('Kiss') NOT NULL;