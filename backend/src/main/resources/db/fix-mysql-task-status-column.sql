-- Run if you still see: Data truncated for column 'status' when setting IN_REVIEW / IN_PROGRESS, etc.
-- Usually an old ENUM or VARCHAR(10) on MySQL — Hibernate ddl-auto rarely fixes ENUMs alone.

ALTER TABLE task MODIFY COLUMN status VARCHAR(32) NULL;
ALTER TABLE task MODIFY COLUMN priority VARCHAR(16) NULL;
