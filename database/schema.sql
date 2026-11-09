CREATE DATABASE IF NOT EXISTS sistem_tugas
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sistem_tugas;

CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  status ENUM('pending', 'in_progress', 'completed') NOT NULL DEFAULT 'pending',
  priority ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  due_at DATETIME NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_tasks_status (status),
  INDEX idx_tasks_due_at (due_at)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
