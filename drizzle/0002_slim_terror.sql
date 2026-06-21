ALTER TABLE "documents" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "ingestion_queue" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_queue" ADD CONSTRAINT "ingestion_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;