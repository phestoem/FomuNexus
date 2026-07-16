-- Add an optimistic concurrency token so stale intake requests cannot overwrite newer answers.
ALTER TABLE "FormSession"
ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
