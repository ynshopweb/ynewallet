/**
 * ai-chat.js
 * ------------------------------------------------------------
 * UI & logika chat YN AI.
 *
 * PENTING soal alur data:
 * - Setiap pesan user dikirim ke /api/ai/chat bersama Firebase ID
 *   Token (bukti login) + ringkasan keuangan kecil dari ai-context.js.
 * - Backend HANYA mengembalikan draft terstruktur (JSON) — TIDAK
 *   pernah menulis ke Firestore.
 * - Penyimpanan sesungguhnya baru terjadi di sini, di frontend,
 *   HANYA setelah user klik "Simpan"/"Buat Goal", dan logikanya
 *   sengaja ditulis ulang persis mengikuti window.handleSaveTransaction
 *   / window.handleSaveGoal di form-handlers.js supaya perilakunya
 *   identik dengan input manual (tidak ada logika ganda yang beda).
 * ------------------------------------------------------------
 */
import { showToast, triggerCelebration } from './ui-utils.js';
import { buildFinancialContext } from './ai-context.js';

let aiHistory = [];      // { role: 'user' | 'assistant', content: string } — max 8 terakhir
const aiDrafts = {};     // draftId -> draft object, dihapus setelah disimpan/dibatalkan
let aiSending = false;

function showFlex(el) { el.classList.remove('hidden'); el.classList.add('flex'); }
function hideFlex(el) { el.classList.remove('flex'); el.classList.add('hidden'); }

function fmtRupiah(n) {
    return 'Rp' + Number(n || 0).toLocaleString('id-ID');
}

function fmtDateID(dateStr) {
    if (!dateStr) return '-';
    try {
        return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
        return dateStr;
    }
}

function scrollAiToBottom() {
    const box = document.getElementById('ai-messages');
    box.scrollTop = box.scrollHeight;
}

function appendRaw(html) {
    const box = document.getElementById('ai-messages');
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    const node = wrap.firstElementChild;
    box.appendChild(node);
    scrollAiToBottom();
    return node;
}

// ---------- Panel open/close ----------

window.toggleAiPanel = function() {
    const panel = document.getElementById('ai-panel');
    if (panel.classList.contains('hidden')) {
        showFlex(panel);
        if (!document.getElementById('ai-messages').dataset.greeted) {
            renderAssistantBubble('Hai! Mau mencatat transaksi, cek keuangan, atau bikin goal baru? Tulis aja pakai bahasa sehari-hari ✨');
            document.getElementById('ai-messages').dataset.greeted = '1';
        }
        setTimeout(() => document.getElementById('ai-input')?.focus(), 100);
    } else {
        hideFlex(panel);
    }
};

// ---------- Bubbles ----------

function renderUserBubble(text) {
    appendRaw(`
        <div class="flex justify-end">
            <div class="max-w-[80%] bg-brand-500 text-white text-sm rounded-2xl rounded-br-sm px-4 py-2.5 shadow-sm">
                ${escapeHtml(text)}
            </div>
        </div>
    `);
}

function renderAssistantBubble(text) {
    appendRaw(`
        <div class="flex justify-start">
            <div class="max-w-[85%] bg-white border border-pink-100 text-slate-700 text-sm rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm">
                ${escapeHtml(text)}
            </div>
        </div>
    `);
}

function renderThinkingBubble() {
    return appendRaw(`
        <div class="flex justify-start" id="ai-thinking-bubble">
            <div class="bg-white border border-pink-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-1.5">
                <span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span>
            </div>
        </div>
    `);
}

function removeThinkingBubble() {
    document.getElementById('ai-thinking-bubble')?.remove();
}

function escapeHtml(str) {
    const d = document.createElement('div');
    d.innerText = str;
    return d.innerHTML;
}

// ---------- Quick account suggestion buttons (saat akun belum diketahui) ----------

function renderAccountQuickPicker() {
    const accounts = window.appState.assets;
    if (!accounts.length) return;
    const buttons = accounts.map(a =>
        `<button onclick="aiQuickAnswer('${a.name.replace(/'/g, "\\'")}')" class="px-3 py-1.5 rounded-full bg-pink-50 hover:bg-pink-100 text-brand-700 text-xs font-semibold border border-pink-100 transition-colors">${a.name}</button>`
    ).join('');
    appendRaw(`<div class="flex flex-wrap gap-2 pl-1">${buttons}</div>`);
}

window.aiQuickAnswer = function(text) {
    document.getElementById('ai-input').value = text;
    window.handleAiSubmit(new Event('submit'));
};

// ---------- Draft cards ----------

function typeIcon(type) {
    if (type === 'expense') return '💸';
    if (type === 'income') return '💰';
    if (type === 'transfer') return '🔄';
    if (type === 'goal_contribution') return '🎯';
    return '💳';
}
function typeLabel(type) {
    if (type === 'expense') return 'Pengeluaran';
    if (type === 'income') return 'Pemasukan';
    if (type === 'transfer') return 'Transfer';
    if (type === 'goal_contribution') return 'Kontribusi Goal';
    return type;
}

function renderTransactionDraftCard(tx) {
    const draftId = 'draft-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    aiDrafts[draftId] = { kind: 'transaction', data: tx };

    let detailRows = '';
    if (tx.type === 'transfer') {
        detailRows = `
            <p class="text-xs text-slate-500">Dari <span class="font-bold text-slate-700">${escapeHtml(tx.fromAccount)}</span> ➔ <span class="font-bold text-slate-700">${escapeHtml(tx.toAccount)}</span></p>`;
    } else {
        detailRows = `
            <p class="text-xs text-slate-500">${escapeHtml(tx.category || '-')}</p>
            <p class="text-xs text-slate-500">💳 ${escapeHtml(tx.account || '-')}</p>`;
    }

    appendRaw(`
        <div class="flex justify-start">
            <div id="${draftId}" class="max-w-[88%] w-full bg-white border border-pink-200 rounded-2xl rounded-bl-sm p-4 shadow-sm space-y-2">
                <p class="text-xs font-bold text-brand-600">${typeIcon(tx.type)} ${typeLabel(tx.type)}</p>
                <p class="text-xl font-extrabold text-slate-800">${fmtRupiah(tx.amount)}</p>
                ${detailRows}
                <p class="text-xs text-slate-400">📅 ${fmtDateID(tx.date)}</p>
                <div class="flex gap-2 pt-1">
                    <button onclick="cancelAiDraft('${draftId}')" class="flex-1 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-colors">Batal</button>
                    <button onclick="confirmAiDraft('${draftId}')" class="flex-1 py-2 rounded-xl bg-brand-500 text-white text-xs font-bold hover:bg-brand-600 shadow-sm shadow-pink-200 transition-colors">✓ Simpan</button>
                </div>
            </div>
        </div>
    `);
}

function renderGoalDraftCard(goal) {
    const draftId = 'draft-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    aiDrafts[draftId] = { kind: 'goal', data: goal };

    appendRaw(`
        <div class="flex justify-start">
            <div id="${draftId}" class="max-w-[88%] w-full bg-white border border-pink-200 rounded-2xl rounded-bl-sm p-4 shadow-sm space-y-2">
                <p class="text-xs font-bold text-brand-600">🎯 New Goal</p>
                <p class="text-base font-extrabold text-slate-800">${goal.icon || '🎯'} ${escapeHtml(goal.name)}</p>
                <p class="text-xs text-slate-500">Target: <span class="font-bold text-slate-700">${fmtRupiah(goal.target)}</span></p>
                <p class="text-xs text-slate-500">Deadline: <span class="font-bold text-slate-700">${fmtDateID(goal.deadline)}</span></p>
                <p class="text-xs text-slate-500">Estimasi nabung/bulan: <span class="font-bold text-slate-700">${fmtRupiah(goal.estimated_monthly_saving)}</span></p>
                <div class="flex gap-2 pt-1">
                    <button onclick="cancelAiDraft('${draftId}')" class="flex-1 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-colors">Batal</button>
                    <button onclick="confirmAiDraft('${draftId}')" class="flex-1 py-2 rounded-xl bg-brand-500 text-white text-xs font-bold hover:bg-brand-600 shadow-sm shadow-pink-200 transition-colors">Buat Goal</button>
                </div>
            </div>
        </div>
    `);
}

function markDraftResolved(draftId, label) {
    const el = document.getElementById(draftId);
    if (!el) return;
    const btnRow = el.querySelector('.flex.gap-2.pt-1');
    if (btnRow) btnRow.outerHTML = `<p class="text-xs font-bold ${label.startsWith('✓') ? 'text-emerald-600' : 'text-slate-400'} pt-1">${label}</p>`;
}

window.cancelAiDraft = function(draftId) {
    delete aiDrafts[draftId];
    markDraftResolved(draftId, 'Dibatalkan');
};

window.confirmAiDraft = function(draftId) {
    const draft = aiDrafts[draftId];
    if (!draft) return;

    if (draft.kind === 'transaction') {
        const ok = saveAiTransaction(draft.data);
        if (ok === false) return; // error sudah ditoast di dalam saveAiTransaction
        markDraftResolved(draftId, '✓ Tersimpan');
    } else if (draft.kind === 'goal') {
        saveAiGoal(draft.data);
        markDraftResolved(draftId, '✓ Goal dibuat');
    }
    delete aiDrafts[draftId];
};

// ---------- Save logic (mirror form-handlers.js) ----------

function saveAiTransaction(tx) {
    const amount = Number(tx.amount);
    const date = tx.date || new Date().toISOString().slice(0, 10);
    const notes = tx.description || '';

    if (tx.type === 'income') {
        const account = window.appState.assets.find(a => a.name === tx.account);
        if (account) account.balance += amount;
        window.appState.transactions.push({ id: 'tx-' + Date.now(), type: 'income', amount, account: tx.account, category: tx.category || 'Lainnya', date, notes });
        showToast('Pemasukan berhasil dicatat! 💰');
    } else if (tx.type === 'expense') {
        const account = window.appState.assets.find(a => a.name === tx.account);
        if (account) account.balance -= amount;
        window.appState.transactions.push({ id: 'tx-' + Date.now(), type: 'expense', amount, account: tx.account, category: tx.category || 'Lainnya', date, notes });
        showToast('Pengeluaran berhasil dicatat! 💸');
    } else if (tx.type === 'transfer') {
        if (tx.fromAccount === tx.toAccount) {
            showToast('Akun tujuan transfer tidak boleh sama!', true);
            return false;
        }
        const fromAccount = window.appState.assets.find(a => a.name === tx.fromAccount);
        const toAccount = window.appState.assets.find(a => a.name === tx.toAccount);
        if (fromAccount && toAccount) {
            fromAccount.balance -= amount;
            toAccount.balance += amount;
        }
        window.appState.transactions.push({ id: 'tx-' + Date.now(), type: 'transfer', amount, account: `${tx.fromAccount} ➔ ${tx.toAccount}`, category: 'Transfer Asset', date, notes });
        showToast('Transfer antar aset berhasil! 🔄 Net worth tetap sama.');
    } else if (tx.type === 'goal_contribution') {
        const goal = window.appState.goals.find(g => g.id === tx.goalId);
        if (goal) {
            goal.current += amount;
            window.appState.transactions.push({ id: 'tx-' + Date.now(), type: 'goal', amount, account: tx.account, category: 'Goal Contribution', goalId: tx.goalId, date, notes });
            showToast(`Berhasil menambahkan ${fmtRupiah(amount)} ke goal ${goal.name}! 🎯`);
            if (goal.current >= goal.target) triggerCelebration(goal);
        }
    }

    window.saveState();
    return true;
}

function saveAiGoal(goal) {
    window.appState.goals.push({
        id: 'gl-' + Date.now(),
        icon: goal.icon || '🎯',
        name: goal.name,
        target: Number(goal.target),
        current: 0,
        deadline: goal.deadline,
        priority: 'Medium',
        category: 'Lainnya',
        notes: 'Dibuat lewat YN AI'
    });
    window.saveState();
    showToast('Goal finansial baru berhasil dibuat! 🎯');
}

// ---------- Kirim pesan ke backend ----------

window.handleAiSubmit = async function(e) {
    e.preventDefault();
    if (aiSending) return;

    const input = document.getElementById('ai-input');
    const message = input.value.trim();
    if (!message) return;

    if (!window.currentUser) {
        renderAssistantBubble('Sesi kamu sudah habis, coba login ulang ya.');
        return;
    }

    renderUserBubble(message);
    aiHistory.push({ role: 'user', content: message });
    input.value = '';
    aiSending = true;
    document.getElementById('ai-send-btn').disabled = true;
    renderThinkingBubble();

    try {
        const idToken = await window.currentUser.getIdToken();
        const res = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                message,
                history: aiHistory.slice(-8),
                context: buildFinancialContext(),
                clientUserId: window.currentUser.uid
            })
        });

        const payload = await res.json().catch(() => null);
        removeThinkingBubble();

        if (!res.ok || !payload || !payload.ok) {
            const errMsg = (payload && payload.error) || 'YN AI sedang mengalami gangguan. Coba beberapa saat lagi.';
            renderAssistantBubble(errMsg);
            return;
        }

        handleAiResponse(payload.data, message);
    } catch (err) {
        console.error('AI request error:', err);
        removeThinkingBubble();
        renderAssistantBubble('Maaf, aku belum bisa memahami transaksi itu. Coba tulis seperti: "Beli makan 25 ribu pakai cash".');
    } finally {
        aiSending = false;
        document.getElementById('ai-send-btn').disabled = false;
    }
};

function handleAiResponse(data, userMessage) {
    if (!data || !data.intent) {
        renderAssistantBubble('Maaf, aku belum bisa memahami itu. Coba tulis seperti: "beli makan 25 ribu pakai cash".');
        return;
    }

    if (data.intent === 'create_transaction') {
        const tx = data.transaction || {};
        const missing = Array.isArray(data.missing_fields) ? data.missing_fields : [];

        if (missing.length > 0 || tx.amount === null || tx.amount === undefined) {
            renderAssistantBubble(data.reply || 'Boleh dilengkapi dulu detailnya?');
            aiHistory.push({ role: 'assistant', content: data.reply || 'Menanyakan detail transaksi.' });
            if (missing.includes('account')) renderAccountQuickPicker();
            return;
        }

        renderAssistantBubble(data.reply || 'Aku menemukan transaksi ini, cek dulu ya:');
        aiHistory.push({ role: 'assistant', content: data.reply || 'Menampilkan draft transaksi.' });
        renderTransactionDraftCard(tx);
    } else if (data.intent === 'create_goal') {
        const goal = data.goal || {};
        renderAssistantBubble(data.reply || 'Ini draft goal barumu, cek dulu ya:');
        aiHistory.push({ role: 'assistant', content: data.reply || 'Menampilkan draft goal.' });
        renderGoalDraftCard(goal);
    } else if (data.intent === 'financial_question') {
        renderAssistantBubble(data.answer || 'Hmm, aku belum bisa jawab itu sekarang.');
        aiHistory.push({ role: 'assistant', content: data.answer || '' });
    } else {
        // clarification / unknown
        renderAssistantBubble(data.answer || 'Maaf, aku belum bisa memahami transaksi itu. Coba tulis seperti: "Beli makan 25 ribu pakai cash".');
        aiHistory.push({ role: 'assistant', content: data.answer || '' });
    }
}

// ---------- Quick prompts ----------

window.sendAiQuickPrompt = function(text) {
    const panel = document.getElementById('ai-panel');
    if (panel.classList.contains('hidden')) window.toggleAiPanel();
    document.getElementById('ai-input').value = text;
    document.getElementById('ai-input').focus();
};

// ---------- Voice input (Web Speech API, opsional) ----------

(function setupVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return; // browser tidak support -> tombol mic tetap hidden (default HTML)

    const micBtn = document.getElementById('ai-mic-btn');
    if (!micBtn) return;
    micBtn.classList.remove('hidden');

    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let listening = false;

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('ai-input').value = transcript;
    };
    recognition.onend = () => {
        listening = false;
        micBtn.classList.remove('text-rose-500');
    };
    recognition.onerror = () => {
        listening = false;
        micBtn.classList.remove('text-rose-500');
    };

    window.startAiVoiceInput = function() {
        if (listening) {
            recognition.stop();
            return;
        }
        try {
            recognition.start();
            listening = true;
            micBtn.classList.add('text-rose-500');
        } catch (e) {
            // recognition sudah berjalan / tidak diizinkan
        }
    };
})();
