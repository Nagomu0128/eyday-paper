ALTER TABLE `profile` ADD `domains_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `profile` ADD `organizations_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `profile` ADD `avoid_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `profile` ADD `goal` text;