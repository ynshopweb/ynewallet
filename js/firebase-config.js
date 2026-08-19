/**
 * firebase-config.js
 * ------------------------------------------------------------
 * Konfigurasi project Firebase (ynwallet) + inisialisasi instance
 * app/auth/db yang dipakai bersama oleh auth.js dan state.js.
 * ------------------------------------------------------------
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBKoe4dYdqtpXtLSmCF6QrMdh-JGoYW3A8",
    authDomain: "ynwallet.firebaseapp.com",
    projectId: "ynwallet",
    storageBucket: "ynwallet.firebasestorage.app",
    messagingSenderId: "740860572289",
    appId: "1:740860572289:web:9f67c536ae50d7f62fd380",
    measurementId: "G-SL1KS8K43X"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
