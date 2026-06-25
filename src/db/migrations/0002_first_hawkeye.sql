CREATE TABLE `chunk_vector` (
	`chunk_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`paper_id` text NOT NULL,
	`chunk_idx` integer NOT NULL,
	`section` text,
	`embedding` text NOT NULL,
	FOREIGN KEY (`chunk_id`) REFERENCES `chunk`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`paper_id`) REFERENCES `paper`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chunk_vector_user_paper_idx` ON `chunk_vector` (`user_id`,`paper_id`);