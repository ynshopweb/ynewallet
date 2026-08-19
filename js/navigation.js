/**
 * navigation.js
 * ------------------------------------------------------------
 * Tab switching & sidebar/bottom-nav active state.
 * Depends on window.renderCurrentTab() dari render.js (dipanggil via window).
 * ------------------------------------------------------------
 */
        // NAVIGATION LOGIC
        window.currentTab = 'dashboard';

        window.switchTab = function(tabName) {
            window.currentTab = tabName;
            
            // Update active sidebar styles
            document.querySelectorAll('.nav-item').forEach(el => {
                el.classList.remove('bg-brand-50', 'text-brand-600');
                el.classList.add('text-slate-600');
            });
            const activeNav = document.getElementById(`nav-${tabName}`);
            if (activeNav) {
                activeNav.classList.add('bg-brand-50', 'text-brand-600');
                activeNav.classList.remove('text-slate-600');
            }

            // Update mobile active styles
            document.querySelectorAll('.mob-nav').forEach(el => {
                el.classList.remove('text-brand-600');
                el.classList.add('text-slate-400');
            });
            const activeMobNav = document.getElementById(`mob-${tabName}`);
            if (activeMobNav) {
                activeMobNav.classList.add('text-brand-600');
                activeMobNav.classList.remove('text-slate-400');
            }

            // Update Header Titles
            const titles = {
                dashboard: ['Dashboard Overview', "How am I doing with my money?"],
                assets: ['My Assets & Net Worth', 'Kelola semua dompet, bank, e-wallet & utang'],
                goals: ['Financial Goals', 'Tabungan khusus untuk mimpi dan target terbesarmu'],
                budget: ['My Monthly Budget', 'Atur batas pengeluaran per kategori agar tidak overbudget'],
                transactions: ['Transactions History', 'Lacak semua aliran masuk, keluar, transfer, & tabungan'],
                income: ['Income Management', 'Sumber pemasukan gaji, usaha, & freelance'],
                expenses: ['Expense Tracking', 'Analisis ke mana saja uangmu digunakan'],
                business: ['Business Money Tracker', 'Pantau arus kas usaha & toko onlinemu'],
                freelance: ['Freelance Tracker', 'Kelola project, client, & status pembayaran'],
                savingplan: ['Saving Plan & Allocation', 'Rencana alokasi tabungan bulanan yang realistis'],
                recurring: ['Recurring Transactions', 'Pengeluaran & Pemasukan rutin bulanan']
            };

            if (titles[tabName]) {
                document.getElementById('page-title').innerText = titles[tabName][0];
                document.getElementById('page-subtitle').innerText = titles[tabName][1];
            }

            window.renderCurrentTab();
        };

