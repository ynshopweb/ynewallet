# YN MONEY — Struktur Terpisah

Project ini adalah hasil pemisahan file `index.html` (single-file) menjadi
beberapa file sesuai fungsinya. **Tidak ada satupun logika, model data,
kalkulasi, atau markup yang diubah** — isi setiap fungsi dipindahkan
apa adanya, hanya lokasinya yang berubah.

## Struktur folder

```
yn-money/
├── index.html                 Struktur halaman (sidebar, header, tab
│                               container, seluruh modal) + link ke CSS/JS
├── css/
│   └── style.css               Custom CSS (di luar utility Tailwind)
└── js/
    ├── main.js                 Entry point — import semua modul + init awal
    ├── state.js                 MODEL: DEFAULT_STATE, window.appState,
    │                            window.saveState(), init & sync Firebase
    ├── navigation.js            window.currentTab, window.switchTab()
    ├── render.js                window.renderCurrentTab() — merender
    │                            konten tiap tab (dashboard, assets, goals,
    │                            budget, transactions, income, expenses,
    │                            business, freelance, savingplan, recurring)
    ├── render-helpers.js        renderTransactionItem(), renderMoneyFlowChart()
    ├── modals.js                openModal(), closeModal(), setTxType()
    ├── form-handlers.js         handleSaveTransaction(), handleSaveAsset(),
    │                            handleSaveGoal(), openAddMoneyToGoal()
    ├── crud-actions.js          Semua delete*() dan add*Prompt()
    ├── ui-utils.js              showToast(), triggerCelebration()
    ├── firebase-config.js       Config & init Firebase (project ynwallet)
    └── auth.js                  Register/Login/Logout email & password,
                                  gate #auth-screen vs #app-shell, load &
                                  live-sync data user dari Firestore
```

## Auth Email & Password (Firebase)

Project sudah disambungkan ke Firebase project **ynwallet**. Yang perlu
kamu pastikan di [Firebase Console](https://console.firebase.google.com/project/ynwallet):

1. **Authentication → Sign-in method → Email/Password** harus **Enabled**.
2. **Firestore Database** sudah dibuat (mode Native, bukan Datastore).
3. **Firestore → Rules**, pakai rule berikut supaya user hanya bisa
   baca/tulis data miliknya sendiri:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

Struktur data di Firestore: setiap user punya satu dokumen di
`users/{uid}/app_data/main` yang isinya persis sama dengan `window.appState`
(assets, liabilities, goals, budgets, transactions, freelance, recurring).
Saat pertama kali register, dokumen ini otomatis dibuat dari `DEFAULT_STATE`.

**Catatan keamanan**: `apiKey` Firebase yang ada di `firebase-config.js`
memang aman untuk ditaruh di kode frontend (ini normal untuk semua app
Firebase, bukan secret) — yang benar-benar menjaga keamanan data adalah
Firestore Security Rules di atas, jadi jangan sampai rules-nya kelewatan
di-set ke `allow read, write: if true`.

## YN AI — asisten keuangan via chat

Fitur baru: tombol mengambang **✨ YN AI** (kanan bawah, hanya muncul
setelah login) yang membuka chat panel. User bisa mengetik bahasa
natural seperti *"tadi makan ayam 25 ribu pakai cash"*, dan YN AI akan
menampilkan **draft** transaksi untuk dikonfirmasi — bukan langsung
menyimpannya.

### File yang terlibat

```
api/
  └── ai/
      └── chat.js          Vercel Serverless Function — otak YN AI (OpenAI),
                            girang jalan HANYA di server, verifikasi
                            Firebase ID Token, tidak pernah menulis ke
                            Firestore
js/
  ├── ai-context.js         Hitung ringkasan keuangan kecil (bukan
                             seluruh database) untuk dikirim sebagai
                             context ke AI
  └── ai-chat.js             UI chat, kirim/terima pesan, render draft
                              card, dan penyimpanan draft ke Firestore
                              (logika simpan sengaja ditulis mengikuti
                              persis form-handlers.js supaya perilakunya
                              identik dengan input manual)
```

### Alur data (WAJIB dipahami sebelum ubah-ubah)

```
User mengetik di chat
      ↓
js/ai-chat.js  → kirim { message, history, context, clientUserId }
                 + Firebase ID Token (Authorization: Bearer ...)
      ↓
api/ai/chat.js → verifikasi ID Token ke Firebase (server-side)
               → panggil OpenAI (API key HANYA di server)
               → balikin draft terstruktur (JSON), TIDAK menulis Firestore
      ↓
js/ai-chat.js  → render draft card [Batal] [Simpan]
      ↓
User klik "Simpan" / "Buat Goal"
      ↓
js/ai-chat.js  → window.appState diubah + window.saveState()
               → (jalur yang SAMA dengan form manual: localStorage +
                  Firestore users/{uid}/app_data/main)
```

AI **tidak pernah** mengarang akun atau goal yang tidak ada — daftar
akun & goal milik user dikirim sebagai context, dan system prompt di
`api/ai/chat.js` melarang AI menebak akun/nominal yang tidak disebutkan
user. Kalau informasi kurang, AI akan bertanya balik dulu.

### Setup sebelum deploy

1. Punya API key dari [platform.openai.com](https://platform.openai.com/api-keys).
2. Di **Vercel → Project Settings → Environment Variables**, tambahkan:
   - `OPENAI_API_KEY` = API key OpenAI kamu (lihat `.env.example`)
3. Redeploy project (env var baru baru aktif setelah deploy ulang).
4. Untuk testing lokal, install [Vercel CLI](https://vercel.com/docs/cli)
   lalu jalankan `vercel dev` (ini juga menjalankan `/api/ai/chat.js`
   sebagai serverless function lokal, tidak cukup pakai
   `python3 -m http.server` karena itu tidak menjalankan API routes).

### Batasan model saat ini (v1)

- Riwayat chat (`aiHistory`) hanya disimpan di memori tab browser saat
  itu (maks 8 pesan terakhir dikirim sebagai context) — reload halaman
  akan mengosongkan riwayat chat, tapi transaksi yang **sudah**
  dikonfirmasi tetap tersimpan seperti biasa di Firestore.
- Voice input pakai Web Speech API bawaan browser (Chrome/Edge paling
  stabil); kalau browser tidak mendukung, tombol microphone otomatis
  disembunyikan.

## Cara menjalankan

File JS memakai ES Modules (`import`/`export`) dan `<script type="module">`
karena `state.js` meng-import Firebase SDK. Browser **memblokir** module
script yang di-load langsung dari `file://` (kebijakan CORS bawaan
browser), jadi project ini harus dijalankan lewat local server, bukan
double-click index.html. Contoh cara paling gampang:

```bash
cd yn-money
python3 -m http.server 8000
# lalu buka http://localhost:8000 di browser
```

Atau pakai extension "Live Server" di VS Code.

## Alur ketergantungan antar modul

```
main.js
 ├─ state.js            (tidak bergantung file lain)
 ├─ navigation.js        → memanggil window.renderCurrentTab (dari render.js)
 ├─ render.js            → import render-helpers.js
 ├─ modals.js             (tidak bergantung file lain)
 ├─ form-handlers.js     → import ui-utils.js
 └─ crud-actions.js      → import ui-utils.js
```

Semua fungsi yang dipanggil langsung dari atribut `onclick`/`onsubmit`
di `index.html` (mis. `switchTab()`, `openModal()`, `handleSaveGoal()`,
`deleteAsset()`, dst.) tetap didaftarkan ke `window.*` persis seperti
versi aslinya, jadi HTML-nya tidak perlu diubah sama sekali.
