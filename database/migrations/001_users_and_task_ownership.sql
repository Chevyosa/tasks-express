-- Migration 001: add users and task ownership to a database created from the original schema.
-- Run manually, step by step, after taking a backup. The application never runs migrations.

USE sistem_tugas;

-- Step 1: users table.
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  token_version INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 2: nullable owner column so existing rows stay valid for now.
ALTER TABLE tasks ADD COLUMN user_id BIGINT UNSIGNED NULL AFTER id;

-- Step 3: existing tasks need an owner.
--   a) Start the API and register the owning account via POST /api/v1/auth/register.
--   b) Find its id:   SELECT id, email FROM users;
--   c) Assign tasks:  UPDATE tasks SET user_id = <owner id> WHERE user_id IS NULL;
--   (Or delete unowned tasks: DELETE FROM tasks WHERE user_id IS NULL;)
-- Step 4 fails while any task still has user_id NULL.

-- Step 4: enforce ownership.
ALTER TABLE tasks
  MODIFY COLUMN user_id BIGINT UNSIGNED NOT NULL,
  ADD INDEX idx_tasks_user_created (user_id, created_at, id),
  ADD CONSTRAINT fk_tasks_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
