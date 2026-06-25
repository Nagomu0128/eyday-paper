CREATE TABLE `chunk` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`paper_id` text NOT NULL,
	`idx` integer NOT NULL,
	`section` text,
	`page` integer,
	`vector_id` text,
	`char_len` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`paper_id`) REFERENCES `paper`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chunk_user_paper_idx` ON `chunk` (`user_id`,`paper_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `chunk_paper_idx_uq` ON `chunk` (`paper_id`,`idx`);--> statement-breakpoint
CREATE TABLE `folder` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`auto_generated` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `folder_user_parent_idx` ON `folder` (`user_id`,`parent_id`);--> statement-breakpoint
CREATE TABLE `note` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`paper_id` text NOT NULL,
	`kind` text NOT NULL,
	`range_json` text,
	`body` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`paper_id`) REFERENCES `paper`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `note_user_paper_idx` ON `note` (`user_id`,`paper_id`);--> statement-breakpoint
CREATE TABLE `paper` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`authors_json` text DEFAULT '[]' NOT NULL,
	`year` integer,
	`venue` text,
	`doi` text,
	`arxiv_id` text,
	`source_url` text,
	`abstract` text,
	`lang_detected` text,
	`status` text DEFAULT 'unread' NOT NULL,
	`readability_hint` text,
	`primary_folder_id` text,
	`pdf_r2_key` text,
	`text_r2_key` text,
	`added_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`primary_folder_id`) REFERENCES `folder`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `paper_user_added_idx` ON `paper` (`user_id`,`added_at`);--> statement-breakpoint
CREATE INDEX `paper_user_status_idx` ON `paper` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `paper_user_folder_idx` ON `paper` (`user_id`,`primary_folder_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `paper_user_arxiv_uq` ON `paper` (`user_id`,`arxiv_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `paper_user_doi_uq` ON `paper` (`user_id`,`doi`);--> statement-breakpoint
CREATE TABLE `paper_tag` (
	`paper_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`paper_id`, `tag_id`),
	FOREIGN KEY (`paper_id`) REFERENCES `paper`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `paper_tag_tag_idx` ON `paper_tag` (`tag_id`);--> statement-breakpoint
CREATE TABLE `profile` (
	`user_id` text PRIMARY KEY NOT NULL,
	`interests_json` text DEFAULT '[]' NOT NULL,
	`level` text,
	`readability` text,
	`output_lang` text DEFAULT 'ja' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `qa_message` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`paper_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`paper_id`) REFERENCES `paper`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `qa_user_paper_idx` ON `qa_message` (`user_id`,`paper_id`);--> statement-breakpoint
CREATE TABLE `suggestion` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`external_id` text NOT NULL,
	`source` text NOT NULL,
	`title` text NOT NULL,
	`authors_json` text DEFAULT '[]' NOT NULL,
	`year` integer,
	`url` text,
	`kind` text NOT NULL,
	`score` real DEFAULT 0 NOT NULL,
	`reason` text,
	`status` text DEFAULT 'suggested' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `suggestion_user_kind_idx` ON `suggestion` (`user_id`,`kind`);--> statement-breakpoint
CREATE INDEX `suggestion_user_status_idx` ON `suggestion` (`user_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `suggestion_user_external_uq` ON `suggestion` (`user_id`,`source`,`external_id`);--> statement-breakpoint
CREATE TABLE `tag` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_user_name_kind_uq` ON `tag` (`user_id`,`name`,`kind`);