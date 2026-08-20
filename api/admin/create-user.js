/**
 * api/admin/create-user.js
 * ------------------------------------------------------------
 * Vercel Serverless Function — admin membuat akun user baru.
 *
 * KENAPA TIDAK PAKAI createUserWithEmailAndPassword DI FRONTEND?
 * Firebase Auth Web SDK otomatis meng-switch sesi browser ke user
 * yang BARU dibuat begitu createUserWithEmailAndPassword dipanggil —
 * artinya kalau admin memakainya langsung di client, admin akan
 * ter-logout dari akunnya sendiri dan "menjadi" user baru itu.
 *
 * Function ini menghindari masalah itu dengan memanggil Identity
 * Toolkit REST API (accounts:signUp) DARI SERVER. Ini adalah endpoint
 * yang sama yang dipakai SDK client di balik layar, tapi karena
 * dipanggil dari server (bukan dari instance Firebase Auth di
 * browser admin), sesi login admin di browser sama sekali tidak
 * tersentuh — token hasil signUp untuk user baru langsung dibuang,
 * tidak pernah dipakai untuk apa pun.
 *
 * Alur keamanan:
 *   1. Frontend mengirim Firebase ID Token milik ADMIN yang sedang
 *      login (Authorization: Bearer ...).
 *   2. Token itu diverifikasi ke Firebase Identity Toolkit (server-side).
 *   3. uid hasil verifikasi WAJIB ada di daftar ADMIN_UIDS (env var).
 *      Kalau ADMIN_UIDS belum diset sama sekali, endpoint ini
 *      menolak SEMUA request (fail-closed) — bukan malah mengizinkan
 *      semua orang.
 *   4. Baru setelah lolos, user baru dibuat lewat Identity Toolkit.
 *
 * Function ini SENGAJA tidak menulis apa pun ke Firestore untuk user
 * baru itu. Begitu user baru login pertama kali (dan email-nya sudah
 * dikonfirmasi), js/auth.js yang akan membuatkan dokumen data kosong
 * (Rp0, tanpa transaksi/goal apa pun) secara otomatis — jadi tidak ada
 * dua tempat berbeda yang perlu dijaga konsisten soal "state awal user
 * baru itu apa".
 *
 * Email verifikasi juga otomatis dikirim ke user baru (lihat bagian
 * accounts:sendOobCode di bawah) karena aplikasi ini mewajibkan email
 * terverifikasi sebelum bisa masuk Dashboard.
 * ------------------------------------------------------------
 */

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || "AIzaSyBKoe4dYdqtpXtLSmCF6QrMdh-JGoYW3A8";

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    // --- 1) Verifikasi Firebase ID Token milik pemanggil (calon admin) ---
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
        return res.status(401).json({ ok: false, error: 'Sesi tidak valid, silakan login ulang.' });
    }

    let verifiedUid = null;
    try {
        const lookupRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken })
            }
        );
        const lookupData = await lookupRes.json();
        if (!lookupRes.ok || !lookupData.users || !lookupData.users[0]) {
            return res.status(401).json({ ok: false, error: 'Sesi tidak valid, silakan login ulang.' });
        }
        verifiedUid = lookupData.users[0].localId;
    } catch (err) {
        console.error('Firebase token verification error:', err);
        return res.status(401).json({ ok: false, error: 'Sesi tidak valid, silakan login ulang.' });
    }

    // --- 2) Cek apakah pemanggil ada di daftar admin ---
    // ADMIN_UIDS = daftar UID admin dipisah koma, mis: "uid1,uid2".
    // Ambil UID dari: login sebagai admin di app -> lihat Firebase Console
    // -> Authentication -> Users -> kolom "User UID".
    const adminUids = (process.env.ADMIN_UIDS || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

    if (adminUids.length === 0) {
        console.error('ADMIN_UIDS belum diset — endpoint admin/create-user dinonaktifkan (fail-closed).');
        return res.status(403).json({ ok: false, error: 'Fitur admin belum dikonfigurasi di server. Hubungi developer.' });
    }
    if (!adminUids.includes(verifiedUid)) {
        return res.status(403).json({ ok: false, error: 'Akun ini bukan admin. Akses ditolak.' });
    }

    // --- 3) Validasi input user baru ---
    const body = req.body || {};
    const newEmail = typeof body.newEmail === 'string' ? body.newEmail.trim() : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        return res.status(400).json({ ok: false, error: 'Email tidak valid.' });
    }
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ ok: false, error: 'Password minimal 6 karakter.' });
    }

    // --- 4) Buat user baru lewat Identity Toolkit REST API (server-side) ---
    try {
        const signUpRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: newEmail, password: newPassword, returnSecureToken: true })
            }
        );
        const signUpData = await signUpRes.json();

        if (!signUpRes.ok) {
            const code = signUpData?.error?.message || '';
            const friendly = {
                'EMAIL_EXISTS': 'Email sudah terdaftar.',
                'INVALID_EMAIL': 'Format email tidak valid.',
                'WEAK_PASSWORD : Password should be at least 6 characters': 'Password minimal 6 karakter.',
                'OPERATION_NOT_ALLOWED': 'Metode Email/Password belum diaktifkan di Firebase Auth.'
            };
            console.error('signUp error:', signUpData);
            return res.status(400).json({ ok: false, error: friendly[code] || 'Gagal membuat user baru.' });
        }

        // Sekarang aplikasi WAJIB email terverifikasi sebelum bisa masuk
        // Dashboard (lihat js/auth.js). Karena user ini dibuat lewat REST
        // API server-side (bukan SDK), Firebase TIDAK otomatis mengirim
        // email verifikasi seperti saat user daftar sendiri di form —
        // jadi kita kirim manual di sini lewat accounts:sendOobCode,
        // memakai idToken user baru yang baru saja dikembalikan signUp
        // (idToken ini hanya dipakai sekali untuk request ini, lalu
        // dibuang — tidak pernah disimpan/dikembalikan ke frontend).
        try {
            await fetch(
                `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ requestType: 'VERIFY_EMAIL', idToken: signUpData.idToken })
                }
            );
        } catch (verifyErr) {
            // User-nya tetap berhasil dibuat walau pengiriman email verifikasi
            // gagal (mis. gangguan jaringan sesaat) — jangan gagalkan seluruh
            // request karena ini, cukup dicatat di log server.
            console.error('Gagal mengirim email verifikasi untuk user baru:', verifyErr);
        }

        return res.status(200).json({
            ok: true,
            uid: signUpData.localId,
            email: newEmail
        });
    } catch (err) {
        console.error('Admin create-user handler error:', err);
        return res.status(500).json({ ok: false, error: 'Terjadi kesalahan server. Coba lagi beberapa saat lagi.' });
    }
};
