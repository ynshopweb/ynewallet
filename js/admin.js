/**
 * admin.js
 * ------------------------------------------------------------
 * window.handleAdminCreateUser(): submit form "Tambah User Baru".
 * Mengirim Firebase ID Token milik user yang SEDANG login (calon
 * admin) ke api/admin/create-user.js. Server yang menentukan apakah
 * uid tersebut benar-benar admin (lihat ADMIN_UIDS di server) —
 * frontend TIDAK melakukan pengecekan admin apa pun, jadi tombol ini
 * memang sengaja terlihat oleh semua user (bukan celah keamanan,
 * karena penolakan sesungguhnya terjadi di server).
 *
 * User baru yang berhasil dibuat TIDAK langsung diberi data apa pun.
 * Begitu mereka login pertama kali, js/auth.js yang akan membuatkan
 * dokumen Firestore kosong (Rp0) untuk mereka secara otomatis.
 * ------------------------------------------------------------
 */
import { showToast } from './ui-utils.js';

function setAdminSubmitLoading(isLoading) {
    const btn = document.getElementById('admin-add-user-submit-btn');
    btn.disabled = isLoading;
    btn.innerText = isLoading ? 'Membuat...' : 'Buat User';
}

function showAdminError(message) {
    const el = document.getElementById('admin-add-user-error');
    el.innerText = message;
    el.classList.remove('hidden');
}

function clearAdminError() {
    const el = document.getElementById('admin-add-user-error');
    el.classList.add('hidden');
    el.innerText = '';
}

window.handleAdminCreateUser = async function(e) {
    e.preventDefault();
    clearAdminError();

    if (!window.currentUser) {
        showAdminError('Sesi tidak valid, silakan login ulang.');
        return;
    }

    const newEmail = document.getElementById('admin-new-user-email').value.trim();
    const newPassword = document.getElementById('admin-new-user-password').value;

    setAdminSubmitLoading(true);
    try {
        const idToken = await window.currentUser.getIdToken();
        const res = await fetch('/api/admin/create-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ newEmail, newPassword })
        });
        const payload = await res.json().catch(() => null);

        if (!res.ok || !payload || !payload.ok) {
            showAdminError((payload && payload.error) || 'Gagal membuat user baru.');
            return;
        }

        showToast(`User ${payload.email} berhasil dibuat. Mereka mulai dari Rp0 saat login pertama kali.`);
        document.getElementById('form-admin-add-user').reset();
        window.closeModal('modal-admin-add-user');
    } catch (err) {
        console.error('Admin create-user error:', err);
        showAdminError('Terjadi kesalahan. Coba lagi beberapa saat lagi.');
    } finally {
        setAdminSubmitLoading(false);
    }
};
