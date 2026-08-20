/**
 * workspace.js
 * ------------------------------------------------------------
 * Personal Workspace Name — setiap user punya nama wallet sendiri
 * (mis. "Naya Money", "Raka Finance", "My Wallet"), BUKAN hardcoded
 * "YN MONEY" untuk semua orang.
 *
 * - validateWorkspaceName(raw): aturan validasi tunggal dipakai
 *   bareng oleh form onboarding (first login) dan modal rename
 *   (ubah nama kapan saja) di js/onboarding.js, supaya aturannya
 *   tidak pernah tidak-konsisten antara dua tempat itu.
 * - applyWorkspaceBranding(): menyalin window.appState.workspaceName
 *   ke semua elemen UI yang menampilkan nama app (sidebar, header
 *   mobile, judul tab browser). Dipanggil auth.js setiap kali data
 *   user selesai dimuat/berubah, dan js/onboarding.js setelah
 *   submit/rename.
 * ------------------------------------------------------------
 */

function validateWorkspaceName(raw) {
    const trimmed = (typeof raw === 'string' ? raw : '').trim();

    if (!trimmed) {
        return { valid: false, error: 'Nama wallet wajib diisi.' };
    }
    if (trimmed.length < 2) {
        return { valid: false, error: 'Nama wallet minimal 2 karakter.' };
    }
    if (trimmed.length > 30) {
        return { valid: false, error: 'Nama wallet maksimal 30 karakter.' };
    }

    return { valid: true, value: trimmed };
}

function applyWorkspaceBranding() {
    const name = window.appState && window.appState.workspaceName;
    if (!name) return; // belum onboarding -> jangan render nama default apa pun

    const initial = name.trim().charAt(0).toUpperCase();

    const sidebarTitle = document.getElementById('workspace-name-display');
    const mobileTitle = document.getElementById('mobile-workspace-name-display');
    const sidebarLogo = document.getElementById('sidebar-logo-initial');
    const mobileLogo = document.getElementById('mobile-logo-initial');

    if (sidebarTitle) sidebarTitle.innerText = name;
    if (mobileTitle) mobileTitle.innerText = name;
    if (sidebarLogo) sidebarLogo.innerText = initial;
    if (mobileLogo) mobileLogo.innerText = initial;

    document.title = `${name} — YN WALLET`;
}

export { validateWorkspaceName, applyWorkspaceBranding };
