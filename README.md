# Tasks Express API

Backend daftar tugas multi-user dengan Express.js, JavaScript, dan MySQL menggunakan SQL langsung (tanpa ORM). Autentikasi memakai JWT Bearer token. Setiap user hanya bisa mengakses task miliknya sendiri. Kontrol keamanan mengacu pada OWASP Top 10:2025 (lihat `AGENTS.md`).

## Menjalankan

1. Siapkan MySQL lokal.
2. Salin `.env.example` menjadi `.env` lalu isi konfigurasinya. Jangan commit `.env`.
   - `JWT_SECRET` wajib diisi, minimal 32 karakter. Buat dengan:
     `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`
3. Buat skema database (manual, tidak dijalankan otomatis saat start):
   - **Instalasi baru:** jalankan `database/schema.sql`.
   - **Database lama (sebelum ada auth):** jalankan `database/migrations/001_users_and_task_ownership.sql` langkah demi langkah sesuai komentar di dalamnya. Task lama harus diberi pemilik sebelum langkah 4.
4. Jalankan `npm install`, lalu `npm start` (atau `npm run dev`).
5. API tersedia di `http://localhost:3000`. Health check: `GET /health`.

Kalau konfigurasi tidak valid atau database tidak bisa dihubungi, server berhenti dengan pesan singkat dan exit code 1.

| Variabel | Keterangan |
| --- | --- |
| `PORT` | Port HTTP (default 3000) |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Koneksi MySQL |
| `JWT_SECRET` | Rahasia penandatangan token, minimal 32 karakter |
| `JWT_EXPIRES_IN` | Masa berlaku token, misalnya `15m`, `1h` (default), `1d`. Rentangnya 1 menit sampai 1 hari |
| `TRUST_PROXY` | `false` (default) kalau client terhubung langsung, `1` kalau ada satu reverse proxy |

## Test

- `npm test`: unit test dan HTTP test yang tidak butuh database.
- `npm run audit`: cek kerentanan dependency.

## Autentikasi

| Method | Path | Keterangan |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | Daftar. Body `{ "email", "password" }`. Password 12–128 karakter |
| POST | `/api/v1/auth/login` | Login. Body `{ "email", "password" }` |
| GET | `/api/v1/auth/me` | Data user yang sedang login (butuh token) |
| POST | `/api/v1/auth/logout` | Mencabut **semua** token milik user (butuh token) |

Respons register (`201`) dan login (`200`):

```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "user": { "id": 1, "email": "kamu@example.com", "created_at": "2026-11-10T08:00:00Z" }
  }
}
```

Kirim token di setiap request ke `/api/v1/tasks`:

```text
Authorization: Bearer <token>
```

Tidak ada refresh token. Kalau token kedaluwarsa, login ulang.

## Endpoint task

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/api/v1/tasks` | Daftar task milik sendiri. Filter: `status`, `priority`, `q`, `due_after`, `due_before`, `page`, `limit` |
| GET | `/api/v1/tasks/:id` | Detail task |
| POST | `/api/v1/tasks` | Buat task |
| PATCH | `/api/v1/tasks/:id` | Ubah `title`, `description`, `priority`, atau `due_at` |
| PATCH | `/api/v1/tasks/:id/status` | Ubah status: `{ "status": "completed" }` |
| DELETE | `/api/v1/tasks/:id` | Hapus permanen |

- Status: `pending`, `in_progress`, `completed`. Prioritas: `low`, `medium`, `high`.
- Pagination default `page=1&limit=20`, limit maksimal 100. Urutan dari yang terbaru.
- `q` mencari di title dan description (maksimal 100 karakter).
- Field nullable dapat dikosongkan dengan `null` saat PATCH.
- Task milik user lain dibalas `404`, sama seperti task yang tidak ada.

### Tanggal

Input memakai format ISO 8601, salah satu dari:
- `2026-11-13`: tanggal saja, dianggap UTC. Untuk `due_before`, artinya sampai akhir hari itu (23:59:59 UTC).
- `2026-11-13T17:00:00+07:00` atau `2026-11-13T10:00:00Z`: zona waktu wajib ditulis.

Tanggal yang tidak ada (misalnya `2026-02-31`) ditolak. Semua tanggal disimpan dalam UTC dan dikembalikan sebagai `2026-11-13T10:00:00Z`.

Contoh pembuatan:

```json
{
  "title": "Selesaikan laporan",
  "description": "Kirim sebelum Jumat",
  "priority": "high",
  "due_at": "2026-11-13T17:00:00+07:00"
}
```

Format respons:
- Daftar: `{ "data": [...], "meta": { "page": 1, "limit": 20, "total": 1, "total_pages": 1 } }`.
- Item tunggal: `{ "data": { ... } }`.

## Error

Format: `{ "error": { "code": "...", "message": "..." } }`.

| Status | Contoh code |
| --- | --- |
| 400 | `INVALID_JSON`, `INVALID_BODY`, `INVALID_TITLE`, `INVALID_DATE`, `INVALID_EMAIL`, `INVALID_PASSWORD`, `INVALID_PARAMETER`, `EMPTY_UPDATE` |
| 401 | `UNAUTHORIZED` (token tidak ada, tidak valid, kedaluwarsa, atau sudah dicabut), `INVALID_CREDENTIALS` |
| 404 | `TASK_NOT_FOUND`, `NOT_FOUND` |
| 409 | `EMAIL_TAKEN` |
| 413 | `PAYLOAD_TOO_LARGE` |
| 429 | `TOO_MANY_REQUESTS`: login 10×/15 menit, register 5×/jam, API 300×/15 menit per IP |
| 500 | `INTERNAL_ERROR` |

## Catatan keamanan

- Jalankan API di belakang **HTTPS** (reverse proxy seperti Nginx/Caddy) dan set `TRUST_PROXY=1`, supaya token tidak dikirim lewat koneksi yang tidak terenkripsi dan rate limit membaca IP yang benar.
- Rate limit disimpan di memori, jadi hanya akurat untuk satu proses.
- CORS tidak diaktifkan. Kalau nanti ada frontend browser di domain lain, tambahkan CORS dengan allowlist origin yang spesifik.
- Register membalas `409` kalau email sudah dipakai. Ini memungkinkan pengecekan apakah suatu email terdaftar, dan diterima sebagai konsekuensi registrasi terbuka tanpa verifikasi email. Risikonya dikurangi dengan rate limit.
- Log keamanan (login, register, logout, token ditolak) dicetak ke stdout/stderr sebagai JSON, tanpa password atau token.
