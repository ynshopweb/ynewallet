/**
 * auth.js
 * ------------------------------------------------------------
 * Email & Password authentication (Firebase Auth).
 * - window.handleRegister / window.handleLogin / window.handleLogout
 * - window.toggleAuthMode('login' | 'register') untuk switch form
 * - onAuthStateChanged: gate tampilan antara #auth-screen dan
 *   #app-shell, plus load & live-sync data user dari Firestore
 *   (dokumen: users/{uid}/app_data/main)
 * ------------------------------------------------------------
 */
import { auth, db } from './firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast } from './ui-utils.js';

window.currentUser = null;
let unsubscribeSnapshot = null;

function userDocRef(uid) {
    return doc(db, 'users', uid, 'app_data', 'main');
}

const AUTH_ERROR_MESSAGES = {
    'auth/email-already-in-use': 'Email sudah terdaftar. Coba masuk saja.',
    'auth/invalid-email': 'Format email tidak valid.',
    'auth/weak-password': 'Password minimal 6 karakter.',
    'auth/invalid-credential': 'Email atau password salah.',
    'auth/wrong-password': 'Email atau password salah.',
    'auth/user-not-found': 'Akun belum terdaftar. Coba daftar dulu.',
    'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.',
    'auth/network-request-failed': 'Koneksi bermasalah. Cek internet kamu.'
};

function showAuthError(err) {
    const el = document.getElementById('auth-error');
    el.innerText = AUTH_ERROR_MESSAGES[err.code] || 'Terjadi kesalahan. Coba lagi.';
    el.classList.remove('hidden');
}

function clearAuthError() {
    const el = document.getElementById('auth-error');
    el.classList.add('hidden');
    el.innerText = '';
}

function setAuthLoading(isLoading) {
    const btn = document.getElementById('auth-submit-btn');
    btn.disabled = isLoading;
    btn.innerText = isLoading ? 'Memproses...' : btn.dataset.label;
}

window.handleRegister = async function(e) {
    e.preventDefault();
    clearAuthError();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    setAuthLoading(true);
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        showToast('Akun berhasil dibuat! Selamat datang di YN MONEY 🎉');
    } catch (err) {
        showAuthError(err);
    } finally {
        setAuthLoading(false);
    }
};

window.handleLogin = async function(e) {
    e.preventDefault();
    clearAuthError();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    setAuthLoading(true);
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
        showAuthError(err);
    } finally {
        setAuthLoading(false);
    }
};

window.handleLogout = async function() {
    await signOut(auth);
    showToast('Berhasil logout');
};

window.toggleAuthMode = function(mode) {
    const isLogin = mode === 'login';
    const form = document.getElementById('form-auth');
    const submitBtn = document.getElementById('auth-submit-btn');

    document.getElementById('auth-title').innerText = isLogin ? 'Masuk ke Akun' : 'Buat Akun Baru';
    submitBtn.dataset.label = isLogin ? 'Masuk' : 'Daftar';
    submitBtn.innerText = submitBtn.dataset.label;
    form.onsubmit = isLogin ? window.handleLogin : window.handleRegister;

    document.getElementById('auth-toggle-text').innerHTML = isLogin
        ? `Belum punya akun? <button type="button" onclick="toggleAuthMode('register')" class="text-brand-600 font-bold hover:underline">Daftar di sini</button>`
        : `Sudah punya akun? <button type="button" onclick="toggleAuthMode('login')" class="text-brand-600 font-bold hover:underline">Masuk di sini</button>`;

    clearAuthError();
};

// Helper show/hide yang aman untuk elemen ber-display "flex":
// "hidden" dan "flex" tidak boleh aktif bersamaan (ambigu di cascade Tailwind).
function showFlex(el) {
    el.classList.remove('hidden');
    el.classList.add('flex');
}
function hideFlex(el) {
    el.classList.remove('flex');
    el.classList.add('hidden');
}

onAuthStateChanged(auth, async (user) => {
    const authScreen = document.getElementById('auth-screen');
    const appShell = document.getElementById('app-shell');

    if (user) {
        window.currentUser = user;

        try {
            const ref = userDocRef(user.uid);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                window.appState = snap.data();
            } else {
                // User baru pertama kali login -> simpan state awal (DEFAULT_STATE) ke Firestore
                await setDoc(ref, window.appState);
            }

            if (unsubscribeSnapshot) unsubscribeSnapshot();
            unsubscribeSnapshot = onSnapshot(ref, (snapshot) => {
                if (snapshot.exists()) {
                    window.appState = snapshot.data();
                    window.renderCurrentTab();
                }
            }, (err) => console.error('Firestore sync error:', err));

            document.getElementById('auth-status-text').innerText = 'Cloud Synced ✨';
        } catch (err) {
            console.error('Gagal memuat data user:', err);
            document.getElementById('auth-status-text').innerText = 'Local Session';
        }

        document.getElementById('user-display-name').innerText = user.email;

        hideFlex(authScreen);
        showFlex(appShell);
        window.currentTab = window.currentTab || 'dashboard';
        window.renderCurrentTab();
    } else {
        window.currentUser = null;
        if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
            unsubscribeSnapshot = null;
        }
        hideFlex(appShell);
        showFlex(authScreen);
        document.getElementById('form-auth').reset();
        window.toggleAuthMode('login');
    }
});
