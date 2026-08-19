/**
 * crud-actions.js
 * ------------------------------------------------------------
 * Aksi hapus (asset, goal, transaction, liability, budget,
 * freelance) dan tambah cepat via prompt() (liability, budget,
 * freelance, recurring). Logika TIDAK diubah.
 * ------------------------------------------------------------
 */
import { showToast } from './ui-utils.js';

        window.deleteAsset = function(id) {
            window.appState.assets = window.appState.assets.filter(a => a.id !== id);
            window.saveState();
            showToast('Aset telah dihapus');
        };

        window.deleteGoal = function(id) {
            window.appState.goals = window.appState.goals.filter(g => g.id !== id);
            window.saveState();
            showToast('Goal telah dihapus');
        };

        window.deleteTransaction = function(id) {
            window.appState.transactions = window.appState.transactions.filter(t => t.id !== id);
            window.saveState();
            showToast('Transaksi dihapus');
        };

        window.deleteLiability = function(id) {
            window.appState.liabilities = window.appState.liabilities.filter(l => l.id !== id);
            window.saveState();
            showToast('Kewajiban dihapus');
        };

        window.addLiabilityPrompt = function() {
            const name = prompt("Nama Kewajiban/Hutang (misal: Cicilan Motor):");
            if (!name) return;
            const amount = Number(prompt("Nominal Sisa Hutang (Rp):", "1000000"));
            if (!amount) return;

            window.appState.liabilities.push({ id: 'liab-' + Date.now(), name, amount, notes: 'Direct add' });
            window.saveState();
            showToast('Liabilities baru dicatat');
        };

        window.addBudgetPrompt = function() {
            const category = prompt("Kategori Budget (misal: Makanan / Belanja / Transportasi):");
            if (!category) return;
            const allocated = Number(prompt("Batas Budget Bulanan (Rp):", "1000000"));
            if (!allocated) return;

            const existing = window.appState.budgets.find(b => b.category === category);
            if (existing) {
                existing.allocated = allocated;
            } else {
                window.appState.budgets.push({ category, allocated });
            }
            window.saveState();
            showToast('Budget diset!');
        };

        window.deleteBudget = function(category) {
            window.appState.budgets = window.appState.budgets.filter(b => b.category !== category);
            window.saveState();
            showToast('Budget dihapus');
        };

        window.addFreelancePrompt = function() {
            const project = prompt("Nama Project Freelance:");
            if (!project) return;
            const client = prompt("Nama Client:");
            const amount = Number(prompt("Nominal Project (Rp):", "1000000"));
            const status = prompt("Status (Paid / DP / Pending):", "Paid");

            window.appState.freelance.push({
                id: 'fl-' + Date.now(),
                project,
                client: client || 'General',
                amount,
                status: status || 'Paid',
                date: new Date().toISOString().slice(0, 10)
            });
            window.saveState();
            showToast('Project freelance berhasil ditambahkan');
        };

        window.deleteFreelance = function(id) {
            window.appState.freelance = window.appState.freelance.filter(f => f.id !== id);
            window.saveState();
            showToast('Project dihapus');
        };

        window.addRecurringPrompt = function() {
            const name = prompt("Nama Rutin (misal: Gaji Guru / Internet):");
            if (!name) return;
            const amount = Number(prompt("Nominal (Rp):", "500000"));
            const day = prompt("Tanggal Rutin Tiap Bulan (1-31):", "25");
            const type = prompt("Tipe (income / expense):", "income");

            window.appState.recurring.push({
                id: 'rec-' + Date.now(),
                name,
                amount,
                day,
                type: type || 'income',
                account: 'BCA Utama'
            });
            window.saveState();
            showToast('Transaksi rutin berhasil ditambahkan');
        };

