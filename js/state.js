/**
 * state.js
 * ------------------------------------------------------------
 * MODEL & DATA LAYER
 * - DEFAULT_STATE: struktur data awal — SEMUA KOSONG (tidak ada dummy
 *   data lagi). Dipakai sebagai starting point untuk user baru;
 *   semua isian datang murni dari input user sendiri.
 * - window.appState: state aplikasi yang aktif untuk user yang SEDANG
 *   login. Di-load dari Firestore oleh auth.js begitu login berhasil
 *   (cache localStorage HANYA dipakai untuk mempercepat render awal
 *   sebelum Firestore selesai fetch, dan di-scope PER-UID supaya
 *   tidak pernah tercampur antar akun di browser/device yang sama).
 * - window.saveState(): persist ke localStorage (cache, per-uid) +
 *   sync ke Firestore (dokumen: users/{uid}/app_data/main, uid dari
 *   window.currentUser yang diisi oleh auth.js)
 * ------------------------------------------------------------
 */
        import { db } from './firebase-config.js';
        import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        // Default Initial State: kosong — data akan mulai murni dari input user
        // workspaceName & onboardingCompleted: null/false secara sengaja —
        // JANGAN PERNAH diisi otomatis dengan nama default apa pun (mis.
        // "YN Money"). Nama wallet WAJIB diisi user sendiri lewat form
        // onboarding (js/onboarding.js) sebelum Dashboard ditampilkan.
        const DEFAULT_STATE = {
            workspaceName: null,
            onboardingCompleted: false,
            assets: [],
            liabilities: [],
            goals: [],
            budgets: [],
            transactions: [],
            freelance: [],
            recurring: []
        };

        // PENTING: selalu deep-clone DEFAULT_STATE, JANGAN PERNAH pakai
        // reference-nya langsung sebagai window.appState. Kalau reference
        // langsung dipakai, push/mutasi array (assets.push(...), dst) akan
        // ikut mengubah objek DEFAULT_STATE itu sendiri — bisa bocor ke
        // user lain yang kebetulan memakai fallback yang sama di sesi lain.
        function cloneDefaultState() {
            return JSON.parse(JSON.stringify(DEFAULT_STATE));
        }

        // Key localStorage cache di-scope PER-UID (bukan satu key global lagi)
        // supaya di device/browser yang dipakai bergantian oleh beberapa akun
        // (mis. HP kasir toko, laptop bersama), cache user A tidak pernah
        // "kebaca" sebagai starting point untuk user B.
        function localCacheKey(uid) {
            return `YN_MONEY_STATE_${uid}`;
        }

        // Sebelum ada user manapun yang login (mis. saat auth-screen tampil),
        // appState default-nya kosong bersih — BUKAN dibaca dari key lama
        // `YN_MONEY_STATE` yang tidak per-user (sengaja tidak dipakai lagi
        // supaya tidak ada jalur bocor data lintas akun).
        window.appState = cloneDefaultState();

        // Dipanggil auth.js: reset total ke state kosong (dipakai sebelum
        // memuat data user yang baru login, dan saat logout) supaya tidak
        // ada jeda render dengan data user sebelumnya yang masih menempel.
        window.resetAppState = function() {
            window.appState = cloneDefaultState();
        };

        // Dipanggil auth.js: coba baca cache localStorage MILIK uid ini saja.
        // Return null kalau belum ada cache untuk uid tsb (mis. device baru).
        window.loadLocalStateCache = function(uid) {
            try {
                const raw = localStorage.getItem(localCacheKey(uid));
                return raw ? JSON.parse(raw) : null;
            } catch (err) {
                console.error('Gagal membaca cache lokal:', err);
                return null;
            }
        };

        // Save State: localStorage (cache instan, per-uid) + Firestore (sumber
        // utama per-user). Kalau tidak ada user yang login, hanya berjalan di
        // memori (tidak pernah ditulis ke localStorage tanpa uid yang jelas).
        window.saveState = function() {
            if (window.currentUser) {
                localStorage.setItem(localCacheKey(window.currentUser.uid), JSON.stringify(window.appState));
                const userDocRef = doc(db, 'users', window.currentUser.uid, 'app_data', 'main');
                setDoc(userDocRef, window.appState, { merge: true }).catch(err => console.error("Firebase sync err:", err));
            }
            window.renderCurrentTab();
        };

        export { cloneDefaultState };

