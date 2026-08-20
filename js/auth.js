/**
 * auth.js
 * ------------------------------------------------------------
 * Email & Password authentication (Firebase Auth) + verifikasi email.
 * - window.handleRegister / window.handleLogin / window.handleLogout
 * - window.handleResendVerificationEmail / window.handleCheckEmailVerified
 * - window.toggleAuthMode('login' | 'register') untuk switch form
 * - onAuthStateChanged: gate tampilan antara #auth-screen,
 *   #verify-email-screen, #onboarding-screen, dan #app-shell, plus
 *   load & live-sync data user dari Firestore
 *   (dokumen: users/{uid}/app_data/main)
 *
 * ALUR VERIFIKASI EMAIL:
 *   1. Daftar -> createUserWithEmailAndPassword -> sendEmailVerification
 *      (Firebase mengirim email berisi link konfirmasi ke inbox user).
 *   2. Selama user.emailVerified masih false, user TIDAK PERNAH melihat
 *      onboarding atau Dashboard — hanya #verify-email-screen (bisa
 *      kirim ulang email, atau cek ulang status setelah klik link-nya).
 *      Data Firestore juga sengaja TIDAK dimuat untuk akun yang belum
 *      terverifikasi.
 *   3. Begitu emailVerified true (dicek otomatis tiap login/refresh,
 *      atau manual lewat tombol "Saya Sudah Konfirmasi"), baru masuk
 *      ke alur onboarding/Dashboard seperti biasa.
 * ------------------------------------------------------------
 */
import { auth, db } from './firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendEmailVerification,
    reload
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

// Validasi format email di client SEBELUM hit Firebase — feedback instan,
// bukan pengganti validasi Firebase sendiri (yang tetap jadi sumber
// kebenaran akhir lewat error 'auth/invalid-email').
function isValidEmailFormat(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

    if (!isValidEmailFormat(email)) {
        showAuthError({ code: 'auth/invalid-email' });
        return;
    }

    setAuthLoading(true);
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(cred.user);
        showToast('Akun dibuat! Cek email kamu untuk konfirmasi ✉️');
        // onAuthStateChanged di bawah otomatis mendeteksi user ini
        // (sudah login tapi emailVerified masih false) dan menampilkan
        // #verify-email-screen — tidak perlu redirect manual di sini.
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

// Tombol "Kirim Ulang Email" di #verify-email-screen.
window.handleResendVerificationEmail = async function() {
    if (!auth.currentUser) return;
    const btn = document.getElementById('resend-verification-btn');
    const originalLabel = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Mengirim...';
    try {
        await sendEmailVerification(auth.currentUser);
        showToast('Email verifikasi terkirim ulang ✉️');
    } catch (err) {
        console.error('Resend verification error:', err);
        showToast(AUTH_ERROR_MESSAGES[err.code] || 'Gagal mengirim ulang. Coba lagi beberapa saat lagi.', true);
    } finally {
        btn.disabled = false;
        btn.innerText = originalLabel;
    }
};

// Tombol "Saya Sudah Konfirmasi" di #verify-email-screen — reload profil
// user dari Firebase (bukan dari cache SDK lokal) supaya status
// emailVerified yang dicek benar-benar yang terbaru.
window.handleCheckEmailVerified = async function() {
    if (!auth.currentUser) return;
    const btn = document.getElementById('check-verification-btn');
    const originalLabel = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Mengecek...';
    try {
        await reload(auth.currentUser);
        if (auth.currentUser.emailVerified) {
            showToast('Email berhasil diverifikasi! 🎉');
            await proceedAsVerifiedUser(auth.currentUser);
        } else {
            showToast('Belum terverifikasi. Cek juga folder Spam/Promosi ya.', true);
        }
    } catch (err) {
        console.error('Check verification error:', err);
        showToast('Gagal mengecek status verifikasi. Coba lagi.', true);
    } finally {
        btn.disabled = false;
        btn.innerText = originalLabel;
    }
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

// Alur untuk user yang SUDAH terverifikasi email-nya: muat data Firestore
// (atau buatkan state kosong untuk user baru), lalu arahkan ke
// onboarding-screen atau app-shell tergantung status workspaceName.
// Dipanggil dari onAuthStateChanged (kalau emailVerified sejak awal) dan
// dari handleCheckEmailVerified (begitu status verifikasi baru terkonfirmasi).
async function proceedAsVerifiedUser(user) {
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

    hideFlex(document.getElementById('auth-screen'));
    hideFlex(document.getElementById('verify-email-screen'));

    const appShell = document.getElementById('app-shell');
    const onboardingScreen = document.getElementById('onboarding-screen');

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
}

onAuthStateChanged(auth, async (user) => {
    const authScreen = document.getElementById('auth-screen');
    const appShell = document.getElementById('app-shell');
    const onboardingScreen = document.getElementById('onboarding-screen');
    const verifyEmailScreen = document.getElementById('verify-email-screen');

    if (user) {
        if (!user.emailVerified) {
            // Belum konfirmasi email -> JANGAN muat data apa pun, JANGAN
            // tampilkan onboarding/Dashboard. Hanya layar "cek email kamu".
            window.currentUser = user;
            window.resetAppState();
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
            }
            hideFlex(authScreen);
            hideFlex(appShell);
            hideFlex(onboardingScreen);
            document.getElementById('verify-email-address').innerText = user.email;
            showFlex(verifyEmailScreen);
            return;
        }

        await proceedAsVerifiedUser(user);
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
        hideFlex(verifyEmailScreen);
        showFlex(authScreen);
        document.getElementById('form-auth').reset();
        window.toggleAuthMode('login');
    }
});
