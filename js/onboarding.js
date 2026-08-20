/**
 * onboarding.js
 * ------------------------------------------------------------
 * - window.handleOnboardingSubmit(): form "Yuk buat ruang keuangan
 *   kamu" yang tampil sekali di first login (atau untuk user lama
 *   yang belum punya workspaceName). Setelah valid: simpan
 *   workspaceName + onboardingCompleted:true, lalu serahkan ke
 *   auth.js (window.showAppShellAfterOnboarding) untuk pindah ke
 *   Dashboard.
 * - window.openRenameWorkspaceModal() / handleRenameWorkspaceSubmit():
 *   "Nama ini bisa kamu ubah kapan saja" — modal kecil di sidebar
 *   untuk ganti nama wallet setelah onboarding selesai.
 * ------------------------------------------------------------
 */
import { validateWorkspaceName, applyWorkspaceBranding } from './workspace.js';
import { showToast } from './ui-utils.js';

function showFieldError(elId, message) {
    const el = document.getElementById(elId);
    el.innerText = message;
    el.classList.remove('hidden');
}
function clearFieldError(elId) {
    const el = document.getElementById(elId);
    el.classList.add('hidden');
    el.innerText = '';
}

window.handleOnboardingSubmit = function(e) {
    e.preventDefault();
    clearFieldError('onboarding-error');

    const rawValue = document.getElementById('onboarding-workspace-name').value;
    const result = validateWorkspaceName(rawValue);

    if (!result.valid) {
        showFieldError('onboarding-error', result.error);
        return;
    }

    // Simpan workspaceName + onboardingCompleted. window.saveState() yang
    // sudah ada menangani sync ke localStorage (cache per-uid) & Firestore
    // (merge: true, jadi data lain milik user ini tidak tersentuh).
    window.appState.workspaceName = result.value;
    window.appState.onboardingCompleted = true;
    window.saveState();

    document.getElementById('form-onboarding').reset();

    if (typeof window.showAppShellAfterOnboarding === 'function') {
        window.showAppShellAfterOnboarding();
    }
};

window.openRenameWorkspaceModal = function() {
    const input = document.getElementById('rename-workspace-input');
    input.value = (window.appState && window.appState.workspaceName) || '';
    clearFieldError('rename-workspace-error');
    window.openModal('modal-rename-workspace');
};

window.handleRenameWorkspaceSubmit = function(e) {
    e.preventDefault();
    clearFieldError('rename-workspace-error');

    const rawValue = document.getElementById('rename-workspace-input').value;
    const result = validateWorkspaceName(rawValue);

    if (!result.valid) {
        showFieldError('rename-workspace-error', result.error);
        return;
    }

    window.appState.workspaceName = result.value;
    window.saveState();
    applyWorkspaceBranding();
    window.closeModal('modal-rename-workspace');
    showToast('Nama wallet berhasil diubah ✨');
};
