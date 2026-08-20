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
import { cloneDefaultState } from './state.js';
import { applyWorkspaceBranding } from './workspace.js';

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
        showToast('Akun berhasil dibuat! Yuk atur wallet kamu 🎉');
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

// Dipanggil onboarding.js setelah form "Mulai Mengelola →" berhasil
// disimpan (workspaceName + onboardingCompleted:true) -> pindah dari
// onboarding-screen ke Dashboard yang sudah pakai nama wallet baru.
window.showAppShellAfterOnboarding = function() {
    hideFlex(document.getElementById('onboarding-screen'));
    showFlex(document.getElementById('app-shell'));
    window.currentTab = window.currentTab || 'dashboard';
    applyWorkspaceBranding();
    window.renderCurrentTab();
};

onAuthStateChanged(auth, async (user) => {
    const authScreen = document.getElementById('auth-screen');
    const appShell = document.getElementById('app-shell');
    const onboardingScreen = document.getElementById('onboarding-screen');

    if (user) {
        window.currentUser = user;

        // PENTING: reset dulu ke state kosong SEBELUM memuat apa pun.
        // Ini mencegah render sekejap (atau, kalau terjadi error di bawah)
        // menampilkan sisa data user sebelumnya yang masih menempel di
        // window.appState pada sesi browser yang sama.
        window.resetAppState();

        // Cache lokal instan HANYA milik uid ini (key sudah di-scope per-uid
        // di state.js) — aman dipakai sebagai starting point sementara
        // sambil menunggu Firestore, karena tidak mungkin berisi data akun lain.
        const localCache = window.loadLocalStateCache(user.uid);
        if (localCache) {
            window.appState = localCache;
            window.renderCurrentTab();
        }

        try {
            const ref = userDocRef(user.uid);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                window.appState = snap.data();
            } else {
                // User baru pertama kali login -> HARUS mulai benar-benar kosong
                // (Rp0, tanpa transaksi/goal/aset apa pun, workspaceName juga
                // masih null — TIDAK diisi otomatis dengan nama default apa
                // pun). Sengaja memakai state kosong baru, BUKAN window.appState
                // yang sedang aktif, supaya tidak mungkin ada sisa data (dari
                // cache lokal atau sesi user lain di device yang sama) ikut
                // ter-inherit oleh user baru ini.
                window.appState = cloneDefaultState();
                await setDoc(ref, window.appState);
            }

            if (unsubscribeSnapshot) unsubscribeSnapshot();
            unsubscribeSnapshot = onSnapshot(ref, (snapshot) => {
                if (snapshot.exists()) {
                    window.appState = snapshot.data();
                    applyWorkspaceBranding();
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

        // Onboarding wajib tampil kalau user (baru ATAU lama) belum punya
        // workspaceName yang valid + onboardingCompleted:true. User lama
        // yang datanya sudah lengkap TIDAK diganggu — langsung ke Dashboard.
        const needsOnboarding = !window.appState.workspaceName || !window.appState.onboardingCompleted;

        if (needsOnboarding) {
            hideFlex(appShell);
            showFlex(onboardingScreen);
        } else {
            hideFlex(onboardingScreen);
            showFlex(appShell);
            window.currentTab = window.currentTab || 'dashboard';
            applyWorkspaceBranding();
            window.renderCurrentTab();
        }
    } else {
        window.currentUser = null;
        // Bersihkan state di memori supaya sesi berikutnya (login user lain
        // di device yang sama) mulai dari nol, bukan dari sisa data user ini.
        window.resetAppState();
        if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
            unsubscribeSnapshot = null;
        }
        hideFlex(appShell);
        hideFlex(onboardingScreen);
        showFlex(authScreen);
        document.getElementById('form-auth').reset();
        window.toggleAuthMode('login');
    }
});
