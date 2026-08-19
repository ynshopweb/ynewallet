/**
 * state.js
 * ------------------------------------------------------------
 * MODEL & DATA LAYER
 * - DEFAULT_STATE: struktur data awal — SEMUA KOSONG (tidak ada dummy
 *   data lagi). Dipakai sebagai starting point untuk user baru;
 *   semua isian datang murni dari input user sendiri.
 * - window.appState: state aplikasi yang aktif (load dari localStorage
 *   sebagai cache, lalu ditimpa data user dari Firestore oleh auth.js
 *   begitu login berhasil)
 * - window.saveState(): persist ke localStorage + sync ke Firestore
 *   (dokumen: users/{uid}/app_data/main, uid dari window.currentUser
 *   yang diisi oleh auth.js)
 * ------------------------------------------------------------
 */
        import { db } from './firebase-config.js';
        import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        // Default Initial State: kosong — data akan mulai murni dari input user
        const DEFAULT_STATE = {
            assets: [],
            liabilities: [],
            goals: [],
            budgets: [],
            transactions: [],
            freelance: [],
            recurring: []
        };

        window.appState = JSON.parse(localStorage.getItem('YN_MONEY_STATE')) || DEFAULT_STATE;

        // Save State: localStorage (cache instan) + Firestore (sumber utama per-user)
        window.saveState = function() {
            localStorage.setItem('YN_MONEY_STATE', JSON.stringify(window.appState));
            if (window.currentUser) {
                const userDocRef = doc(db, 'users', window.currentUser.uid, 'app_data', 'main');
                setDoc(userDocRef, window.appState, { merge: true }).catch(err => console.error("Firebase sync err:", err));
            }
            window.renderCurrentTab();
        };

