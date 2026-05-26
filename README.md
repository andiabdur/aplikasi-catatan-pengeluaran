# Catatan Pengeluaran Keluarga

Aplikasi web mobile-first untuk mencatat pengeluaran keluarga. Pengganti Google Sheets — input cepat, dashboard real-time, multi-user, bisa di-install di HP (PWA).

## Fitur MVP (Phase 1)

- 🔐 **Login email + password** (no email confirmation — instant)
- 👨‍👩‍👧 **Multi-user shared household** — Anda & istri input ke 1 database keluarga
- ⚡ **Form input cepat** — date default hari ini, kategori "sering dipakai", chip +5rb/+10rb, format Rupiah otomatis
- 📊 **Dashboard bulanan** — sisa uang, progress bar per kategori, alert warna kuning/merah saat budget mau habis
- 🔍 **History + filter** — search by kebutuhan, filter kategori & rentang tanggal, total auto-hitung
- 🎨 **Editable kategori & budget** — tambah/hapus kategori, ubah budget bulanan kapan saja
- 📱 **PWA** — Install ke home screen iPhone/Android, dipakai seperti aplikasi asli
- 🔒 **Row-Level Security** — data Anda terisolasi di Postgres, hanya member keluarga yang bisa baca

## Tech Stack

- **Next.js 15** (App Router) + TypeScript + Tailwind CSS
- **Supabase** — Postgres + Auth + RLS
- **Recharts** — visualisasi (untuk Phase 2)
- **Vercel** — hosting (free tier)

---

## Setup (sekali saja, ~10 menit)

### 1. Buat project Supabase (2 menit)

1. Buka https://supabase.com/dashboard → **New project**
2. Nama project: `family-expense` (bebas), region: **Singapore**, set password DB (simpan)
3. Tunggu provisioning ~1 menit
4. Di sidebar: **SQL Editor** → **New query**
5. Copy semua isi file [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) → paste → **Run**
   - Ini bikin semua tabel, RLS policies, dan trigger auto-seed kategori saat user baru daftar
6. **PENTING — disable email confirmation:** sidebar **Authentication** → **Providers** → klik **Email** → matikan toggle **"Confirm email"** → Save.
   - Tanpa ini, signup nunggu klik link konfirmasi (kena rate limit Supabase free tier).
7. Di sidebar: **Project Settings** → **API** → catat 2 hal:
   - **Project URL** (mis: `https://abcdefgh.supabase.co`)
   - **anon public key** (string panjang dimulai `eyJ...`)

### 2. Setup environment lokal

```bash
cp .env.example .env.local
```

Edit `.env.local`, isi 2 nilai dari step di atas:

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

### 3. Jalankan lokal

```bash
npm install   # kalau belum
npm run dev
```

Buka http://localhost:3000 → masukkan email → cek inbox → klik magic link → langsung masuk.

**Yang terjadi saat first login:** trigger SQL otomatis bikin household baru untuk Anda + seed 10 kategori (Tagihan, Kebutuhan Anak, dst) + budget June 2026 sesuai sheet Anda.

### 4. Ajak istri join household yang sama

Sementara: Setelah istri sign-up, dia akan punya household sendiri. Untuk merge ke household Anda, jalankan di Supabase SQL Editor:

```sql
-- Cari household_id istri & user_id istri
select hm.household_id, hm.user_id, u.email
from household_members hm join auth.users u on u.id = hm.user_id;

-- Pindahkan istri ke household Anda
update household_members
set household_id = '<household-id-anda>'
where user_id = '<user-id-istri>';

-- Hapus household kosong milik istri
delete from households where id = '<household-id-istri-yang-kosong>';
```

(Phase 2 akan ada UI "invite anggota" supaya nggak perlu SQL manual.)

---

## Deploy ke Vercel (~5 menit)

### Via Vercel CLI (interaktif, paling aman)

```bash
npx vercel login          # buka browser, login
npx vercel                # ikuti prompt, pilih scope (akun Anda)
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel --prod
```

Setelah deploy, **balik ke Supabase**:
- **Authentication** → **URL Configuration**
- Site URL: `https://nama-app-anda.vercel.app`
- Redirect URLs: `https://nama-app-anda.vercel.app/auth/callback`

---

## Install ke HP (PWA)

**iPhone:** Buka URL di Safari → tombol Share → "Add to Home Screen"

**Android:** Buka URL di Chrome → menu titik tiga → "Install app"

Setelah install, ikon tampil di home screen seperti app native. Buka — langsung ke form input.

---

## Roadmap

### Phase 2 — Visualisasi & Import
- Pie chart breakdown kategori
- Line chart trend 6 bulan
- Bar chart per minggu
- Import CSV dari Google Sheets (data historis)
- Budget alert (push notif kalau kategori > 80%)

### Phase 3 — AI Receipt Scanning
- Upload foto struk → Claude Vision (claude-sonnet-4-6) ekstrak items + harga + suggested kategori
- Bulk insert (1 struk = banyak item, sekali tap)
- Auto-tagging berdasarkan toko (Indomaret → Kebutuhan Rumah Tangga, dll)

### Phase 4 — Lanjutan
- Invite anggota via link (gantikan SQL manual)
- Export Excel per bulan / per tahun
- Recurring expenses (tagihan listrik tiap tanggal 5)
- Tabungan tracker (rekening + target)
- Multi-currency

---

## Struktur Folder

```
src/
├── app/                     # Next.js App Router
│   ├── page.tsx             # Dashboard
│   ├── add/                 # Form input
│   ├── history/             # Riwayat + filter
│   ├── settings/            # Kategori, budget, income
│   ├── login/               # Magic link login
│   └── auth/callback/       # Supabase OAuth callback
├── components/              # UI components
├── lib/
│   ├── supabase/            # Client + server + middleware
│   ├── format.ts            # IDR formatter
│   ├── types.ts             # TypeScript types
│   └── utils.ts             # cn() helper
└── middleware.ts            # Auth gate
supabase/migrations/         # SQL schema
public/                      # Static assets + PWA manifest
```

---

## Troubleshooting

**"Email rate limit exceeded"** — Supabase free SMTP cuma boleh ~2 email/jam. **Solusi:** Authentication → Providers → Email → matikan **Confirm email** → Save. App ini pakai email+password tanpa konfirmasi, jadi nggak butuh email sama sekali.

**"Invalid login credentials"** — Anda klik "Masuk" padahal belum daftar, atau password salah. Klik "Daftar" dulu di bawah form.

**Tabel kosong setelah login** — Cek SQL Editor: `select * from household_members;`. Kalau kosong, trigger belum jalan. Re-run migration.

**Deploy Vercel error: env not set** — `vercel env add` lalu re-deploy dengan `vercel --prod --force`.

---

Dibuat untuk Andi & keluarga 🏡
