# Tasks Express API

Backend daftar tugas pribadi dengan Express.js, JavaScript, dan MySQL menggunakan SQL langsung (tanpa ORM). API versi pertama tidak memakai login atau autentikasi.

## Menjalankan

1. Siapkan MySQL lokal dan database `sistem_tugas`.
2. Salin `.env.example` menjadi `.env`, lalu isi konfigurasi MySQL lokal Anda. Jangan commit `.env`.
3. Jalankan `database/schema.sql` pada MySQL untuk membuat database (bila belum ada) dan tabel `tasks`.
4. Jalankan `npm install`, lalu `npm start` (atau `npm run dev` saat pengembangan).
5. API tersedia di `http://localhost:3000`; health check: `GET /health`.

## Endpoint

Semua endpoint data menggunakan prefix `/api/v1/tasks`.

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/api/v1/tasks` | Daftar dengan `status`, `priority`, `q`, `due_after`, `due_before`, `page`, `limit` |
| GET | `/api/v1/tasks/:id` | Detail tugas |
| POST | `/api/v1/tasks` | Buat tugas |
| PATCH | `/api/v1/tasks/:id` | Ubah `title`, `description`, `priority`, atau `due_at` |
| PATCH | `/api/v1/tasks/:id/status` | Ubah status |
| DELETE | `/api/v1/tasks/:id` | Hapus permanen |

Status: `pending`, `in_progress`, `completed`. Prioritas: `low`, `medium`, `high`. Pagination default `page=1&limit=20`, maksimum limit 100. Tanggal menerima ISO 8601, misalnya `2026-11-09T14:30:00+07:00`; tanggal disimpan sebagai UTC. Field nullable dapat dikosongkan dengan `null` saat PATCH.

Contoh pembuatan:

```json
{
  "title": "Selesaikan laporan",
  "description": "Kirim sebelum Jumat",
  "priority": "high",
  "due_at": "2026-11-13T17:00:00+07:00"
}
```

Daftar mengembalikan `{ "data": [...], "meta": { "page": 1, "limit": 20, "total": 1, "total_pages": 1 } }`. Respons sukses tunggal menggunakan `{ "data": { ... } }`; error menggunakan `{ "error": { "code": "...", "message": "..." } }`.

API belum memiliki autentikasi dan sebaiknya hanya diakses dari mesin/jaringan pribadi.
