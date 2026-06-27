CREATE TABLE `qa_session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`paper_id` text NOT NULL,
	`title` text DEFAULT '新しいチャット' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`paper_id`) REFERENCES `paper`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `qa_session_user_paper_idx` ON `qa_session` (`user_id`,`paper_id`);--> statement-breakpoint
ALTER TABLE `qa_message` ADD `session_id` text REFERENCES qa_session(id);--> statement-breakpoint
CREATE INDEX `qa_user_session_idx` ON `qa_message` (`user_id`,`session_id`);