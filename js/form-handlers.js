/**
 * form-handlers.js
 * ------------------------------------------------------------
 * Handler submit form (transaksi, aset, goal) + helper
 * openAddMoneyToGoal(). Logika perhitungan saldo/goal TIDAK diubah.
 * ------------------------------------------------------------
 */
import { showToast, triggerCelebration } from './ui-utils.js';

        window.handleSaveTransaction = function(e) {
            e.preventDefault();
            const type = document.getElementById('tx-type-value').value;
            const amount = Number(document.getElementById('tx-amount').value);
            const accountName = document.getElementById('tx-account').value;
            const date = document.getElementById('tx-date').value;
            const notes = document.getElementById('tx-notes').value;

            const account = window.appState.assets.find(a => a.name === accountName);

            if (type === 'income') {
                const category = document.getElementById('tx-category').value;
                if (account) account.balance += amount;
                window.appState.transactions.push({ id: 'tx-' + Date.now(), type, amount, account: accountName, category, date, notes });
                showToast('Pemasukan berhasil dicatat! 💰');
            } else if (type === 'expense') {
                const category = document.getElementById('tx-category').value;
                if (account) account.balance -= amount;
                window.appState.transactions.push({ id: 'tx-' + Date.now(), type, amount, account: accountName, category, date, notes });
                showToast('Pengeluaran berhasil dicatat! 💸');
            } else if (type === 'transfer') {
                const targetName = document.getElementById('tx-account-target').value;
                if (accountName === targetName) {
                    showToast('Akun tujuan transfer tidak boleh sama!', true);
                    return;
                }
                const targetAccount = window.appState.assets.find(a => a.name === targetName);
                if (account && targetAccount) {
                    account.balance -= amount;
                    targetAccount.balance += amount;
                }
                window.appState.transactions.push({ id: 'tx-' + Date.now(), type, amount, account: `${accountName} ➔ ${targetName}`, category: 'Transfer Asset', date, notes });
                showToast('Transfer antar aset berhasil! 🔄 Net worth tetap sama.');
            } else if (type === 'goal') {
                const goalId = document.getElementById('tx-goal-id').value;
                const goal = window.appState.goals.find(g => g.id === goalId);
                if (goal) {
                    goal.current += amount;
                    window.appState.transactions.push({ id: 'tx-' + Date.now(), type, amount, account: accountName, category: 'Goal Contribution', goalId, date, notes });
                    showToast(`Berhasil menambahkan Rp ${amount.toLocaleString('id-ID')} ke goal ${goal.name}! 🎯`);

                    // Check if 100% completed!
                    if (goal.current >= goal.target) {
                        triggerCelebration(goal);
                    }
                }
            }

            window.saveState();
            closeModal('modal-transaction');
        };

        window.openAddMoneyToGoal = function(goalId) {
            openModal('modal-transaction');
            window.setTxType('goal');
            document.getElementById('tx-goal-id').value = goalId;
        };

        window.handleSaveAsset = function(e) {
            e.preventDefault();
            const name = document.getElementById('asset-name').value;
            const type = document.getElementById('asset-type').value;
            const balance = Number(document.getElementById('asset-balance').value);
            const notes = document.getElementById('asset-notes').value;

            window.appState.assets.push({
                id: 'ast-' + Date.now(),
                name,
                type,
                balance,
                notes
            });
            window.saveState();
            closeModal('modal-asset');
            showToast('Aset baru berhasil ditambahkan! 🏦');
        };

        window.handleSaveGoal = function(e) {
            e.preventDefault();
            const icon = document.getElementById('goal-icon').value;
            const name = document.getElementById('goal-name').value;
            const target = Number(document.getElementById('goal-target').value);
            const current = Number(document.getElementById('goal-current').value);
            const deadline = document.getElementById('goal-deadline').value;
            const priority = document.getElementById('goal-priority').value;
            const category = document.getElementById('goal-category').value;
            const notes = document.getElementById('goal-notes').value;

            window.appState.goals.push({
                id: 'gl-' + Date.now(),
                icon,
                name,
                target,
                current,
                deadline,
                priority,
                category,
                notes
            });
            window.saveState();
            closeModal('modal-goal');
            showToast('Goal finansial baru berhasil dibuat! 🎯');
        };

