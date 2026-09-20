CREATE TABLE `care_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`plant_id` int NOT NULL,
	`task_type_id` int NOT NULL,
	`completed_at` timestamp NOT NULL DEFAULT (now()),
	`notes` text,
	CONSTRAINT `care_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `microclimates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`environment_type` varchar(50) NOT NULL,
	`weather_source` varchar(255),
	`location` varchar(255),
	`temperature` decimal(5,2),
	`humidity` decimal(5,2),
	`light_level` varchar(100),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `microclimates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `plant_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`plant_id` int NOT NULL,
	`image_url` varchar(500) NOT NULL,
	`uploaded_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `plant_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `plants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`microclimate_id` int NOT NULL,
	`external_species_id` varchar(255),
	`nickname` varchar(255) NOT NULL,
	`location_description` varchar(255),
	`added_at` timestamp NOT NULL DEFAULT (now()),
	`archived_at` datetime,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `plants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`plant_id` int NOT NULL,
	`task_type_id` int NOT NULL,
	`frequency_days` int NOT NULL,
	`next_due_date` datetime NOT NULL,
	`last_completed_at` datetime,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`label` varchar(255) NOT NULL,
	CONSTRAINT `task_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `task_types_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `care_history` ADD CONSTRAINT `care_history_plant_id_plants_id_fk` FOREIGN KEY (`plant_id`) REFERENCES `plants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `care_history` ADD CONSTRAINT `care_history_task_type_id_task_types_id_fk` FOREIGN KEY (`task_type_id`) REFERENCES `task_types`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `microclimates` ADD CONSTRAINT `microclimates_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `plant_images` ADD CONSTRAINT `plant_images_plant_id_plants_id_fk` FOREIGN KEY (`plant_id`) REFERENCES `plants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `plants` ADD CONSTRAINT `plants_microclimate_id_microclimates_id_fk` FOREIGN KEY (`microclimate_id`) REFERENCES `microclimates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_plant_id_plants_id_fk` FOREIGN KEY (`plant_id`) REFERENCES `plants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_task_type_id_task_types_id_fk` FOREIGN KEY (`task_type_id`) REFERENCES `task_types`(`id`) ON DELETE cascade ON UPDATE no action;