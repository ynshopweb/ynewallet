/**
 * render-helpers.js
 * ------------------------------------------------------------
 * Fungsi bantu rendering yang dipakai lintas tab:
 * - renderTransactionItem(): markup satu baris transaksi
 * - renderMoneyFlowChart(): chart.js untuk grafik Income vs Expense
 * ------------------------------------------------------------
 */
        function renderTransactionItem(t, showDelete = false) {
            let badgeColor = 'bg-emerald-100 text-emerald-700';
            let icon = 'fa-arrow-down';
            let prefix = '+';

            if (t.type === 'expense') {
                badgeColor = 'bg-rose-100 text-rose-700';
                icon = 'fa-arrow-up';
                prefix = '-';
            } else if (t.type === 'transfer') {
                badgeColor = 'bg-blue-100 text-blue-700';
                icon = 'fa-right-left';
                prefix = '';
            } else if (t.type === 'goal') {
                badgeColor = 'bg-pink-100 text-brand-700';
                icon = 'fa-piggy-bank';
                prefix = '';
            }

            return `
                <div class="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-pink-50/50 transition-colors border border-slate-100 text-xs">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-xl ${badgeColor} flex items-center justify-center font-bold">
                            <i class="fa-solid ${icon}"></i>
                        </div>
                        <div>
                            <p class="font-bold text-slate-800">${t.category || t.type.toUpperCase()}</p>
                            <p class="text-[10px] text-slate-400">${t.date} • ${t.account} ${t.notes ? `• ${t.notes}` : ''}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="font-bold text-sm ${t.type === 'income' ? 'text-emerald-600' : t.type === 'expense' ? 'text-rose-600' : 'text-slate-800'}">
                            ${prefix}Rp ${Number(t.amount).toLocaleString('id-ID')}
                        </span>
                        ${showDelete ? `
                            <button onclick="deleteTransaction('${t.id}')" class="text-slate-300 hover:text-rose-500 ml-2"><i class="fa-solid fa-xmark"></i></button>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        let moneyFlowChartInstance = null;
        function renderMoneyFlowChart() {
            const ctx = document.getElementById('chart-money-flow');
            if (!ctx) return;

            if (moneyFlowChartInstance) {
                moneyFlowChartInstance.destroy();
            }

            // Calculate mock 6 month dataset or actuals
            moneyFlowChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Mei', 'Jun', 'Jul', 'Ags'],
                    datasets: [
                        {
                            label: 'Income',
                            data: [5000000, 5200000, 4800000, window.appState.transactions.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0)],
                            backgroundColor: '#10b981',
                            borderRadius: 6
                        },
                        {
                            label: 'Expense',
                            data: [3100000, 2900000, 3400000, window.appState.transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0)],
                            backgroundColor: '#f43f5e',
                            borderRadius: 6
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }

export { renderTransactionItem, renderMoneyFlowChart };
