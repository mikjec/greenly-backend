CREATE TABLE `care_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`plant_id` int NOT NULL,
	`task_type_id` int NOT NULL,
	`completed_at` timestamp NOT NULL DEFAULT (now()),
	`notes` text,
	CONSTRAINT `care_history_id` PRIMARY KEY(`id`)
);

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

CREATE TABLE `optimization_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`plant_id` int,
	`schedule_id` int,
	`plant_name` varchar(255) NOT NULL,
	`microclimate_name` varchar(255) NOT NULL,
	`previous_date` datetime NOT NULL,
	`new_date` datetime NOT NULL,
	`reason` text NOT NULL,
	`source` varchar(20) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `optimization_history_id` PRIMARY KEY(`id`)
);

CREATE TABLE `plant_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`plant_id` int NOT NULL,
	`image_url` varchar(500) NOT NULL,
	`uploaded_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `plant_images_id` PRIMARY KEY(`id`)
);

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

CREATE TABLE `push_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` varchar(255) NOT NULL,
	`auth` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `push_subscriptions_id` PRIMARY KEY(`id`)
);

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

CREATE TABLE `task_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`label` varchar(255) NOT NULL,
	CONSTRAINT `task_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `task_types_key_unique` UNIQUE(`key`)
);

CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);

ALTER TABLE `care_history` ADD CONSTRAINT `care_history_plant_id_plants_id_fk` FOREIGN KEY (`plant_id`) REFERENCES `plants`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `care_history` ADD CONSTRAINT `care_history_task_type_id_task_types_id_fk` FOREIGN KEY (`task_type_id`) REFERENCES `task_types`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `microclimates` ADD CONSTRAINT `microclimates_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `optimization_history` ADD CONSTRAINT `optimization_history_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `optimization_history` ADD CONSTRAINT `optimization_history_plant_id_plants_id_fk` FOREIGN KEY (`plant_id`) REFERENCES `plants`(`id`) ON DELETE set null ON UPDATE no action;
ALTER TABLE `optimization_history` ADD CONSTRAINT `optimization_history_schedule_id_schedules_id_fk` FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE set null ON UPDATE no action;
ALTER TABLE `plant_images` ADD CONSTRAINT `plant_images_plant_id_plants_id_fk` FOREIGN KEY (`plant_id`) REFERENCES `plants`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `plants` ADD CONSTRAINT `plants_microclimate_id_microclimates_id_fk` FOREIGN KEY (`microclimate_id`) REFERENCES `microclimates`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `push_subscriptions` ADD CONSTRAINT `push_subscriptions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_plant_id_plants_id_fk` FOREIGN KEY (`plant_id`) REFERENCES `plants`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_task_type_id_task_types_id_fk` FOREIGN KEY (`task_type_id`) REFERENCES `task_types`(`id`) ON DELETE cascade ON UPDATE no action;
CREATE INDEX `optimization_history_user_id_idx` ON `optimization_history` (`user_id`,`id`);
CREATE INDEX `push_subscriptions_user_id_idx` ON `push_subscriptions` (`user_id`);
