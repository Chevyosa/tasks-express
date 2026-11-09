# Implementation Plan: Personal To Do List API

This file is the implementation guide for this repository. Work through the phases in order, preserving the API and database decisions below unless the project owner changes them. Do not read `.env` or run database queries without the owner's explicit direction. Planning and local code changes do not require database access.

## Goal and scope

Build a personal task-management backend using Express.js, JavaScript (CommonJS), and MySQL with direct SQL. Use a Controller and Routes structure. Do not add an ORM, login, authentication, or user ownership model.

The API supports creating, listing, reading, editing, completing/reopening, and deleting tasks. The initial API is intended for one person's use and has no authentication; do not expose it publicly without revisiting access protection.

## Current repository context

- Express 5 is already listed in `package.json`.
- The package uses CommonJS (`"type": "commonjs"`).
- `controllers/` and `routes/` directories exist.
- Add the remaining files as needed; inspect the repository before each implementation phase.
- Never inspect or print `.env`. Keep it out of version control. Use a placeholder-only `.env.example` instead.
- Ask the owner before accessing an existing database or running queries against it.

## Target structure

```text
tasks-express/
├── app.js                     # Express app and middleware registration
├── server.js                  # configuration, DB startup, listen, graceful shutdown
├── config/
│   └── database.js            # mysql2/promise pool
├── controllers/
│   └── taskController.js      # HTTP request/response handling
├── middleware/
│   ├── errorHandler.js
│   └── notFound.js
├── routes/
│   └── taskRoutes.js
├── services/
│   └── taskService.js         # parameterized SQL and task persistence
├── utils/
│   └── asyncHandler.js        # only if useful with Express 5 handlers
├── database/
│   └── schema.sql             # explicit initial schema; never auto-run at boot
├── .env.example               # variable names and non-secret examples only
└── package.json
```

Keep controllers focused on HTTP concerns and validation. Keep SQL in the service/data-access layer. Routes should map URLs to controller methods. Centralize 404 and error responses.

## Initial data model

Create a single `tasks` table using InnoDB and `utf8mb4`:

| Column | Suggested type | Rules |
| --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | Primary key, auto increment |
| `title` | `VARCHAR(200)` | Required |
| `description` | `TEXT` | Nullable |
| `status` | `ENUM('pending','in_progress','completed')` | Required, default `pending` |
| `priority` | `ENUM('low','medium','high')` | Required, default `medium` |
| `due_at` | `DATETIME` | Nullable |
| `completed_at` | `DATETIME` | Nullable; set when completed and clear when reopened |
| `created_at` | `DATETIME` | Required creation time |
| `updated_at` | `DATETIME` | Required; update on task changes |

Add indexes for `status` and `due_at`. Use permanent deletion in the first version. Keep schema creation in `database/schema.sql`; do not mutate a database automatically during application startup. If the owner has an existing database, ask before inspecting or querying it and adapt only after permission.

## API contract

Use `/api/v1` as the API prefix.

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/v1/tasks` | List tasks with filters and pagination |
| `GET` | `/api/v1/tasks/:id` | Get one task |
| `POST` | `/api/v1/tasks` | Create a task |
| `PATCH` | `/api/v1/tasks/:id` | Partially update task fields |
| `PATCH` | `/api/v1/tasks/:id/status` | Change status and completion timestamp |
| `DELETE` | `/api/v1/tasks/:id` | Permanently delete a task |

List query parameters: `status`, `priority`, `q`, `due_before`, `due_after`, `page`, and `limit`. Validate all parameters and impose a reasonable maximum page size. `q` searches task title and, if useful, description. Sort predictably, for example newest first, with a stable ID tie-breaker.

Creation requires `title`; it may include `description`, `priority`, and `due_at`. Status changes accept only the three defined status values. Setting status to `completed` sets `completed_at`; changing to another status clears it. `PATCH` must distinguish omitted fields from explicit `null` so nullable values can be cleared.

## Validation and response conventions

- Trim `title`; require a non-empty string with a maximum of 200 characters.
- Validate `description` as a string or `null`.
- Validate `status` and `priority` against the allowed values above.
- Validate date/time input and document its expected timezone/format. Use a consistent UTC policy in storage and API serialization.
- Require positive integer IDs, page numbers, and limits.
- Bound search string length and reject malformed filters.
- Bind all user-provided SQL values with `mysql2` placeholders. Never concatenate user input into SQL. Build optional filter clauses only from validated, fixed SQL fragments.

Return JSON consistently, e.g. `{ "data": { ...task } }`. List responses should include pagination metadata. Error responses should include a stable error code and readable message, without leaking SQL, credentials, stack traces, or internal database details.

Suggested HTTP statuses: `201` on creation, `200` on reads/updates, `204` on successful deletion, `400` for invalid input, `404` for missing task/route, and `500` for unexpected failures. A delete or update for a nonexistent ID returns `404`.

## Configuration and database connection

Add `mysql2` and `dotenv` if they are not already installed. Read configuration from environment variables such as `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `PORT`. Validate required settings at startup without printing secret values. Use a `mysql2/promise` connection pool. Handle pool errors safely and close the HTTP server and pool on termination signals.

`.env.example` may document variable names with harmless placeholders. Do not read `.env`, copy its values, print it, or commit it. Ensure `.env` is ignored by Git.

## Implementation phases

1. **Inspect and confirm repository state.** Review project files and Git status without opening `.env`. Preserve unrelated user changes. Confirm the existing Node/CommonJS setup.
2. **Finalize contract and schema.** Use the defaults in this document unless the owner changes them. Write `database/schema.sql`; do not connect to an existing database without explicit permission.
3. **Set up configuration and entry points.** Add dependencies, `.env.example`, `config/database.js`, `app.js`, and `server.js`. Ensure startup fails clearly when required configuration is absent.
4. **Implement task persistence.** Add parameterized SQL operations for list/detail/create/update/status/delete. Keep SQL out of route declarations and controllers.
5. **Implement routes and controllers.** Add request validation, consistent responses, correct HTTP statuses, and missing-record behavior.
6. **Add middleware and lifecycle handling.** Add JSON parsing, not-found handling, centralized error handling, and graceful server/pool shutdown.
7. **Document operation.** Document setup, environment variable names, applying schema manually, endpoint behavior, filters, request/response examples, and date/time policy. Do not include secrets.
8. **Verify.** When implementation work is requested, verify CRUD, filtering, validation, not-found cases, and database failure handling using an appropriate local/test database. Do not run queries against the owner's existing database unless explicitly authorized.

## Decisions to revisit only if requirements change

- Status values: `pending`, `in_progress`, `completed`.
- Priority values: `low`, `medium`, `high`.
- Deletion: permanent delete.
- Database access: no inspection or queries without explicit owner approval.
- Authentication: none for the initial personal-use version.

If the owner changes one of these decisions, update this document and keep schema, validation, API behavior, and documentation aligned.
