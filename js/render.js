/**
 * render.js
 * ------------------------------------------------------------
 * window.renderCurrentTab(): satu-satunya fungsi yang menyusun
 * seluruh konten <main id="main-view"> berdasarkan window.currentTab
 * (dashboard, assets, goals, budget, transactions, income, expenses,
 * business, freelance, savingplan, recurring). Logika & markup TIDAK
 * diubah dari versi asli, hanya dipindahkan ke file ini.
 * ------------------------------------------------------------
 */
import { renderTransactionItem, renderMoneyFlowChart } from './render-helpers.js';

        window.renderCurrentTab = function() {
            const container = document.getElementById('main-view');
            
            // Financial Calculations
            const totalAssets = window.appState.assets.reduce((sum, a) => sum + Number(a.balance), 0);
            const totalLiabilities = window.appState.liabilities.reduce((sum, l) => sum + Number(l.amount), 0);
            const netWorth = totalAssets - totalLiabilities;
            const totalReservedGoals = window.appState.goals.reduce((sum, g) => sum + Number(g.current), 0);
            const availableMoney = totalAssets - totalReservedGoals;

            // Monthly stats
            const currentMonth = new Date().toISOString().slice(0, 7);
            const monthlyTxs = window.appState.transactions.filter(t => t.date && t.date.startsWith(currentMonth));
            const monthlyIncome = monthlyTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
            const monthlyExpense = monthlyTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
            const monthlySaved = monthlyTxs.filter(t => t.type === 'goal').reduce((sum, t) => sum + Number(t.amount), 0);

            if (window.currentTab === 'dashboard') {
                container.innerHTML = `
                    <!-- Top Wealth Header Banner -->
                    <div class="bg-gradient-to-r from-brand-600 via-brand-500 to-pink-500 rounded-3xl p-6 text-white shadow-xl shadow-pink-200 relative overflow-hidden">
                        <div class="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
                        <div class="relative z-10 space-y-1">
                            <span class="text-xs font-semibold uppercase tracking-wider text-pink-100">TOTAL KEKAYAAN (NET WORTH)</span>
                            <div class="text-3xl md:text-4xl font-extrabold tracking-tight">Rp ${netWorth.toLocaleString('id-ID')}</div>
                            <div class="flex items-center gap-2 pt-2 text-xs font-medium text-pink-100">
                                <span class="bg-white/20 px-2 py-0.5 rounded-full text-white font-bold"><i class="fa-solid fa-arrow-trend-up"></i> +Rp ${monthlyIncome.toLocaleString('id-ID')}</span>
                                <span>pemasukan bulan ini</span>
                            </div>
                        </div>
                    </div>

                    <!-- 4 Summary Cards -->
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div class="bg-white rounded-2xl p-4 border border-pink-100 shadow-sm space-y-1">
                            <div class="flex items-center justify-between text-slate-400">
                                <span class="text-xs font-semibold">Total Balance</span>
                                <i class="fa-solid fa-wallet text-brand-500"></i>
                            </div>
                            <p class="text-base md:text-lg font-bold text-slate-900">Rp ${totalAssets.toLocaleString('id-ID')}</p>
                            <p class="text-[10px] text-slate-400">Tersedia: Rp ${availableMoney.toLocaleString('id-ID')}</p>
                        </div>

                        <div class="bg-white rounded-2xl p-4 border border-pink-100 shadow-sm space-y-1">
                            <div class="flex items-center justify-between text-slate-400">
                                <span class="text-xs font-semibold">Income</span>
                                <i class="fa-solid fa-circle-arrow-down text-emerald-500"></i>
                            </div>
                            <p class="text-base md:text-lg font-bold text-emerald-600">Rp ${monthlyIncome.toLocaleString('id-ID')}</p>
                            <p class="text-[10px] text-emerald-600/80">Bulan Ini</p>
                        </div>

                        <div class="bg-white rounded-2xl p-4 border border-pink-100 shadow-sm space-y-1">
                            <div class="flex items-center justify-between text-slate-400">
                                <span class="text-xs font-semibold">Expenses</span>
                                <i class="fa-solid fa-circle-arrow-up text-rose-500"></i>
                            </div>
                            <p class="text-base md:text-lg font-bold text-rose-600">Rp ${monthlyExpense.toLocaleString('id-ID')}</p>
                            <p class="text-[10px] text-rose-600/80">Bulan Ini</p>
                        </div>

                        <div class="bg-white rounded-2xl p-4 border border-pink-100 shadow-sm space-y-1">
                            <div class="flex items-center justify-between text-slate-400">
                                <span class="text-xs font-semibold">Saved for Goals</span>
                                <i class="fa-solid fa-piggy-bank text-amber-500"></i>
                            </div>
                            <p class="text-base md:text-lg font-bold text-amber-600">Rp ${totalReservedGoals.toLocaleString('id-ID')}</p>
                            <p class="text-[10px] text-amber-600/80">Dialokasikan</p>
                        </div>
                    </div>

                    <!-- FINANCIAL HEALTH INDICATOR -->
                    <div class="bg-white rounded-2xl p-5 border border-pink-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-2xl ${monthlyExpense <= monthlyIncome * 0.8 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'} flex items-center justify-center text-xl font-bold">
                                <i class="fa-solid ${monthlyExpense <= monthlyIncome * 0.8 ? 'fa-heart-circle-check' : 'fa-triangle-exclamation'}"></i>
                            </div>
                            <div>
                                <div class="flex items-center gap-2">
                                    <h4 class="font-bold text-slate-800 text-sm">FINANCIAL HEALTH:</h4>
                                    <span class="text-xs px-2.5 py-0.5 rounded-full font-bold ${monthlyExpense <= monthlyIncome * 0.8 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
                                        ${monthlyExpense <= monthlyIncome * 0.8 ? 'Good Condition ✅' : 'Needs Attention ⚠️'}
                                    </span>
                                </div>
                                <p class="text-xs text-slate-500 mt-0.5">
                                    ${monthlyExpense <= monthlyIncome * 0.8 
                                        ? 'Pengeluaran bulan ini terjaga dalam batas aman. Kamu berhasil menyisihkan tabungan untuk goals!' 
                                        : 'Pengeluaran mendekati atau melebihi pemasukan bulan ini. Tinjau kembali budget pengeluaranmu.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Charts & Goals Grid -->
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <!-- Money Flow Chart -->
                        <div class="lg:col-span-2 bg-white rounded-2xl p-5 border border-pink-100 shadow-sm">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="font-bold text-slate-800 text-sm">Money Flow Overview</h3>
                                <span class="text-xs text-slate-400">Income vs Expense</span>
                            </div>
                            <div class="h-56 relative">
                                <canvas id="chart-money-flow"></canvas>
                            </div>
                        </div>

                        <!-- Top Goals Overview -->
                        <div class="bg-white rounded-2xl p-5 border border-pink-100 shadow-sm flex flex-col justify-between">
                            <div>
                                <div class="flex items-center justify-between mb-4">
                                    <h3 class="font-bold text-slate-800 text-sm">Priority Goals</h3>
                                    <button onclick="switchTab('goals')" class="text-xs font-bold text-brand-600 hover:underline">View All</button>
                                </div>
                                <div class="space-y-4">
                                    ${window.appState.goals.slice(0, 3).map(g => {
                                        const pct = Math.min(100, Math.round((g.current / g.target) * 100));
                                        return `
                                            <div class="space-y-1.5">
                                                <div class="flex justify-between items-center text-xs">
                                                    <span class="font-bold text-slate-700">${g.icon} ${g.name}</span>
                                                    <span class="font-bold text-brand-600">${pct}%</span>
                                                </div>
                                                <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                                    <div class="bg-brand-500 h-2.5 rounded-full" style="width: ${pct}%"></div>
                                                </div>
                                                <div class="flex justify-between text-[10px] text-slate-400">
                                                    <span>Rp ${Number(g.current).toLocaleString('id-ID')}</span>
                                                    <span>Target Rp ${Number(g.target).toLocaleString('id-ID')}</span>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                            <button onclick="openModal('modal-goal')" class="mt-4 w-full py-2 bg-pink-50 text-brand-600 hover:bg-pink-100 font-bold text-xs rounded-xl transition-all">
                                + Create New Goal
                            </button>
                        </div>
                    </div>

                    <!-- Assets & Recent Transactions Grid -->
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <!-- My Assets Summary -->
                        <div class="bg-white rounded-2xl p-5 border border-pink-100 shadow-sm space-y-3">
                            <div class="flex justify-between items-center">
                                <h3 class="font-bold text-slate-800 text-sm">My Assets</h3>
                                <button onclick="switchTab('assets')" class="text-xs font-bold text-brand-600 hover:underline">Kelola</button>
                            </div>
                            <div class="space-y-2.5">
                                ${window.appState.assets.map(a => `
                                    <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                                        <div class="flex items-center gap-2.5">
                                            <div class="w-7 h-7 rounded-lg bg-pink-100 text-brand-600 font-bold flex items-center justify-center text-xs">
                                                <i class="fa-solid fa-vault"></i>
                                            </div>
                                            <div>
                                                <p class="font-bold text-slate-800">${a.name}</p>
                                                <p class="text-[10px] text-slate-400">${a.type}</p>
                                            </div>
                                        </div>
                                        <span class="font-bold text-slate-800">Rp ${Number(a.balance).toLocaleString('id-ID')}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Recent Transactions -->
                        <div class="lg:col-span-2 bg-white rounded-2xl p-5 border border-pink-100 shadow-sm space-y-3">
                            <div class="flex justify-between items-center">
                                <h3 class="font-bold text-slate-800 text-sm">Recent Transactions</h3>
                                <button onclick="switchTab('transactions')" class="text-xs font-bold text-brand-600 hover:underline">Lihat Semua</button>
                            </div>
                            <div class="space-y-2">
                                ${window.appState.transactions.length === 0 ? `
                                    <div class="text-center py-6 text-slate-400 text-xs">
                                        Your money story starts here. <br>
                                        <button onclick="openModal('modal-transaction')" class="mt-2 text-brand-600 font-bold hover:underline">+ Add First Transaction</button>
                                    </div>
                                ` : window.appState.transactions.slice(-4).reverse().map(t => renderTransactionItem(t)).join('')}
                            </div>
                        </div>
                    </div>
                `;

                setTimeout(() => renderMoneyFlowChart(), 50);
            } 
            else if (window.currentTab === 'assets') {
                container.innerHTML = `
                    <!-- Net Worth Summary Box -->
                    <div class="bg-white rounded-3xl p-6 border border-pink-100 shadow-sm space-y-4">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-2">
                            <div>
                                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">NET WORTH FORMULA</span>
                                <h3 class="text-2xl font-extrabold text-slate-800">Total Assets - Total Liabilities = <span class="text-brand-600">Rp ${netWorth.toLocaleString('id-ID')}</span></h3>
                            </div>
                            <button onclick="openModal('modal-asset')" class="bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-all self-start">
                                + Tambah Aset
                            </button>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            <div class="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                                <span class="text-emerald-700 font-semibold">Total Assets</span>
                                <p class="text-xl font-bold text-emerald-800 mt-1">Rp ${totalAssets.toLocaleString('id-ID')}</p>
                            </div>
                            <div class="p-4 rounded-2xl bg-rose-50 border border-rose-100">
                                <span class="text-rose-700 font-semibold">Total Liabilities (Hutang)</span>
                                <p class="text-xl font-bold text-rose-800 mt-1">Rp ${totalLiabilities.toLocaleString('id-ID')}</p>
                            </div>
                            <div class="p-4 rounded-2xl bg-pink-50 border border-pink-100">
                                <span class="text-brand-700 font-semibold">Reserved for Goals</span>
                                <p class="text-xl font-bold text-brand-800 mt-1">Rp ${totalReservedGoals.toLocaleString('id-ID')}</p>
                                <p class="text-[10px] text-brand-600 mt-1">Available Money: Rp ${availableMoney.toLocaleString('id-ID')}</p>
                            </div>
                        </div>
                    </div>

                    <!-- ASSET LISTING -->
                    <div class="space-y-3">
                        <div class="flex justify-between items-center">
                            <h3 class="font-bold text-slate-800 text-base">Daftar Sumber Aset</h3>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            ${window.appState.assets.map(a => `
                                <div class="bg-white rounded-2xl p-4 border border-pink-100 shadow-sm flex items-center justify-between">
                                    <div class="space-y-1">
                                        <div class="flex items-center gap-2">
                                            <span class="text-xs px-2 py-0.5 rounded-md font-bold bg-pink-100 text-brand-700">${a.type}</span>
                                            <h4 class="font-bold text-slate-800 text-sm">${a.name}</h4>
                                        </div>
                                        <p class="text-xs text-slate-400">${a.notes || 'Tanpa catatan'}</p>
                                    </div>
                                    <div class="text-right">
                                        <p class="text-base font-bold text-slate-800">Rp ${Number(a.balance).toLocaleString('id-ID')}</p>
                                        <button onclick="deleteAsset('${a.id}')" class="text-slate-300 hover:text-rose-500 text-xs mt-1 transition-colors"><i class="fa-solid fa-trash-can"></i> Hapus</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- LIABILITIES LISTING -->
                    <div class="bg-white rounded-3xl p-6 border border-pink-100 shadow-sm space-y-4">
                        <div class="flex justify-between items-center border-b pb-3 border-slate-100">
                            <div>
                                <h3 class="font-bold text-slate-800 text-base">Hutang & Kewajiban (Liabilities)</h3>
                                <p class="text-xs text-slate-400">Mengurangi perhitungan total Net Worth</p>
                            </div>
                            <button onclick="addLiabilityPrompt()" class="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition-all">
                                + Tambah Kewajiban
                            </button>
                        </div>
                        <div class="space-y-2">
                            ${window.appState.liabilities.map(l => `
                                <div class="flex justify-between items-center p-3 rounded-xl bg-slate-50 text-xs">
                                    <div>
                                        <p class="font-bold text-slate-800">${l.name}</p>
                                        <p class="text-[10px] text-slate-400">${l.notes}</p>
                                    </div>
                                    <div class="text-right">
                                        <span class="font-bold text-rose-600">Rp ${Number(l.amount).toLocaleString('id-ID')}</span>
                                        <button onclick="deleteLiability('${l.id}')" class="text-slate-400 hover:text-rose-500 ml-3"><i class="fa-solid fa-xmark"></i></button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
            else if (window.currentTab === 'goals') {
                container.innerHTML = `
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h3 class="font-extrabold text-slate-900 text-xl">My Financial Goals</h3>
                            <p class="text-xs text-slate-500">Kelola dan alokasikan tabungan untuk target masa depanmu</p>
                        </div>
                        <button onclick="openModal('modal-goal')" class="bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all self-start">
                            + Create Goal Baru
                        </button>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        ${window.appState.goals.length === 0 ? `
                            <div class="col-span-full bg-white rounded-3xl p-8 text-center border border-pink-100 space-y-3">
                                <div class="text-4xl">🎯</div>
                                <h4 class="font-bold text-slate-800">What are you saving for?</h4>
                                <p class="text-xs text-slate-400">Mulai buat financial goal pertamamu seperti liburan, HP baru, atau dana darurat.</p>
                                <button onclick="openModal('modal-goal')" class="bg-brand-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md">+ Create Goal</button>
                            </div>
                        ` : window.appState.goals.map(g => {
                            const pct = Math.min(100, Math.round((g.current / g.target) * 100));
                            const remaining = Math.max(0, g.target - g.current);
                            
                            // Calculate monthly recommendation
                            const now = new Date();
                            const dl = new Date(g.deadline);
                            const monthsLeft = Math.max(1, (dl.getFullYear() - now.getFullYear()) * 12 + (dl.getMonth() - now.getMonth()));
                            const monthlyNeed = Math.round(remaining / monthsLeft);

                            const priorityColors = {
                                High: 'bg-rose-100 text-rose-700',
                                Medium: 'bg-amber-100 text-amber-700',
                                Low: 'bg-emerald-100 text-emerald-700'
                            };

                            return `
                                <div class="bg-white rounded-3xl p-5 border border-pink-100 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-all relative overflow-hidden">
                                    <div class="space-y-3">
                                        <div class="flex items-start justify-between">
                                            <div class="flex items-center gap-3">
                                                <div class="w-12 h-12 rounded-2xl bg-pink-50 flex items-center justify-center text-2xl border border-pink-100">
                                                    ${g.icon}
                                                </div>
                                                <div>
                                                    <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${priorityColors[g.priority] || 'bg-slate-100'}">${g.priority} Priority</span>
                                                    <h4 class="font-bold text-slate-800 text-base leading-snug">${g.name}</h4>
                                                    <span class="text-[10px] text-slate-400">${g.category}</span>
                                                </div>
                                            </div>
                                            <button onclick="deleteGoal('${g.id}')" class="text-slate-300 hover:text-rose-500"><i class="fa-solid fa-trash-can text-xs"></i></button>
                                        </div>

                                        <!-- Progress Bar -->
                                        <div class="space-y-1">
                                            <div class="flex justify-between text-xs font-bold">
                                                <span class="text-slate-600">Progress</span>
                                                <span class="text-brand-600">${pct}%</span>
                                            </div>
                                            <div class="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-100">
                                                <div class="bg-gradient-to-r from-brand-500 to-pink-400 h-2 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                                            </div>
                                            <div class="flex justify-between text-[11px] text-slate-500 pt-1">
                                                <span>Terkumpul: <b>Rp ${Number(g.current).toLocaleString('id-ID')}</b></span>
                                                <span>Target: <b>Rp ${Number(g.target).toLocaleString('id-ID')}</b></span>
                                            </div>
                                        </div>

                                        <!-- Recommendation Box -->
                                        ${pct < 100 ? `
                                            <div class="bg-pink-50/60 rounded-xl p-2.5 text-[11px] text-slate-600 border border-pink-100 space-y-0.5">
                                                <p class="text-brand-700 font-semibold"><i class="fa-solid fa-calculator"></i> Saving Recommendation:</p>
                                                <p>Tabung ~ <b>Rp ${monthlyNeed.toLocaleString('id-ID')}/bulan</b> untuk capai target (${monthsLeft} bln lagi).</p>
                                            </div>
                                        ` : `
                                            <div class="bg-emerald-50 rounded-xl p-2.5 text-xs text-emerald-700 font-bold border border-emerald-100 text-center">
                                                🎉 Goal Achieved! Target Terpenuhi
                                            </div>
                                        `}
                                    </div>

                                    <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                                        <div class="text-[10px] text-slate-400">
                                            Deadline: <br><b class="text-slate-600">${g.deadline}</b>
                                        </div>
                                        <button onclick="openAddMoneyToGoal('${g.id}')" class="bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-md transition-all">
                                            + Add Money
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            }
            else if (window.currentTab === 'budget') {
                container.innerHTML = `
                    <div class="bg-white rounded-3xl p-6 border border-pink-100 shadow-sm space-y-4">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <h3 class="font-extrabold text-slate-800 text-lg">Batas Budget Bulanan</h3>
                                <p class="text-xs text-slate-400">Pastikan pengeluaranmu tidak melebihi alokasi</p>
                            </div>
                            <button onclick="addBudgetPrompt()" class="bg-brand-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-md hover:bg-brand-600 transition-all self-start">
                                + Set Budget Kategori
                            </button>
                        </div>

                        <div class="space-y-4 pt-2">
                            ${window.appState.budgets.map(b => {
                                // calculate total spent for this category this month
                                const spent = monthlyTxs.filter(t => t.type === 'expense' && t.category === b.category).reduce((s, t) => s + Number(t.amount), 0);
                                const pct = Math.min(100, Math.round((spent / b.allocated) * 100));
                                const isOver = spent > b.allocated;
                                const isWarning = spent >= b.allocated * 0.8 && !isOver;

                                return `
                                    <div class="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                                        <div class="flex justify-between items-center text-xs">
                                            <div class="flex items-center gap-2">
                                                <span class="font-bold text-slate-800 text-sm">${b.category}</span>
                                                ${isOver ? `<span class="bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full text-[10px]">Over Budget!</span>` : ''}
                                                ${isWarning ? `<span class="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full text-[10px]">Warning 80%</span>` : ''}
                                            </div>
                                            <span class="font-bold text-slate-700">Rp ${spent.toLocaleString('id-ID')} / Rp ${Number(b.allocated).toLocaleString('id-ID')}</span>
                                        </div>

                                        <div class="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                            <div class="h-2.5 rounded-full ${isOver ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-brand-500'}" style="width: ${pct}%"></div>
                                        </div>

                                        <div class="flex justify-between text-[10px] text-slate-400">
                                            <span>Sisa Budget: <b>Rp ${Math.max(0, b.allocated - spent).toLocaleString('id-ID')}</b></span>
                                            <button onclick="deleteBudget('${b.category}')" class="text-slate-400 hover:text-rose-500">Hapus Budget</button>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }
            else if (window.currentTab === 'transactions') {
                container.innerHTML = `
                    <div class="bg-white rounded-3xl p-6 border border-pink-100 shadow-sm space-y-4">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <h3 class="font-extrabold text-slate-800 text-lg">Semua Transaksi</h3>
                            <button onclick="openModal('modal-transaction')" class="bg-brand-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md hover:bg-brand-600">
                                + Catat Transaksi
                            </button>
                        </div>

                        <div class="space-y-2">
                            ${window.appState.transactions.length === 0 ? `
                                <div class="text-center py-8 text-slate-400 text-xs">Belum ada catatan transaksi.</div>
                            ` : window.appState.transactions.slice().reverse().map(t => renderTransactionItem(t, true)).join('')}
                        </div>
                    </div>
                `;
            }
            else if (window.currentTab === 'income') {
                container.innerHTML = `
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div class="bg-white rounded-3xl p-6 border border-pink-100 shadow-sm space-y-2">
                            <span class="text-xs font-bold text-slate-400 uppercase">Total Income Bulan Ini</span>
                            <div class="text-2xl font-extrabold text-emerald-600">Rp ${monthlyIncome.toLocaleString('id-ID')}</div>
                            <p class="text-xs text-slate-500">Sumber dari Gaji, Toko, Freelance, & Lainnya</p>
                        </div>

                        <div class="md:col-span-2 bg-white rounded-3xl p-6 border border-pink-100 shadow-sm space-y-4">
                            <h3 class="font-bold text-slate-800 text-sm">Pemasukan Terbaru</h3>
                            <div class="space-y-2">
                                ${window.appState.transactions.filter(t => t.type === 'income').slice(-5).reverse().map(t => renderTransactionItem(t)).join('')}
                            </div>
                        </div>
                    </div>
                `;
            }
            else if (window.currentTab === 'expenses') {
                container.innerHTML = `
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div class="bg-white rounded-3xl p-6 border border-pink-100 shadow-sm space-y-2">
                            <span class="text-xs font-bold text-slate-400 uppercase">Total Expense Bulan Ini</span>
                            <div class="text-2xl font-extrabold text-rose-600">Rp ${monthlyExpense.toLocaleString('id-ID')}</div>
                            <p class="text-xs text-slate-500"> Where did my money go?</p>
                        </div>

                        <div class="md:col-span-2 bg-white rounded-3xl p-6 border border-pink-100 shadow-sm space-y-4">
                            <h3 class="font-bold text-slate-800 text-sm">Pengeluaran Terbaru</h3>
                            <div class="space-y-2">
                                ${window.appState.transactions.filter(t => t.type === 'expense').slice(-5).reverse().map(t => renderTransactionItem(t)).join('')}
                            </div>
                        </div>
                    </div>
                `;
            }
            else if (window.currentTab === 'business') {
                const businessAsset = window.appState.assets.find(a => a.type === 'Business');
                const busBalance = businessAsset ? Number(businessAsset.balance) : 0;

                container.innerHTML = `
                    <div class="bg-white rounded-3xl p-6 border border-pink-100 shadow-sm space-y-4">
                        <div class="flex justify-between items-center">
                            <div>
                                <h3 class="font-extrabold text-slate-800 text-lg">Business / Kas Usaha</h3>
                                <p class="text-xs text-slate-400">Pencatatan saldo dan transaksi terpisah untuk usaha/toko</p>
                            </div>
                            <span class="bg-pink-100 text-brand-700 text-xs font-bold px-3 py-1 rounded-full">Saldo Kas Toko: Rp ${busBalance.toLocaleString('id-ID')}</span>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2">
                            <div class="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                <span class="text-slate-500 font-semibold">Total Pemasukan Toko</span>
                                <p class="text-lg font-bold text-emerald-600 mt-1">Rp ${window.appState.transactions.filter(t => t.category === 'Toko' && t.type === 'income').reduce((s,t) => s + Number(t.amount), 0).toLocaleString('id-ID')}</p>
                            </div>
                            <div class="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                <span class="text-slate-500 font-semibold">Pengeluaran Usaha</span>
                                <p class="text-lg font-bold text-rose-600 mt-1">Rp ${window.appState.transactions.filter(t => t.category === 'Kebutuhan toko' && t.type === 'expense').reduce((s,t) => s + Number(t.amount), 0).toLocaleString('id-ID')}</p>
                            </div>
                            <div class="p-4 rounded-2xl bg-pink-50 border border-pink-100">
                                <span class="text-brand-700 font-semibold">Status Aset Usaha</span>
                                <p class="text-xs text-brand-800 mt-1">Terhubung langsung ke Total Asset Net Worth.</p>
                            </div>
                        </div>
                    </div>
                `;
            }
            else if (window.currentTab === 'freelance') {
                container.innerHTML = `
                    <div class="bg-white rounded-3xl p-6 border border-pink-100 shadow-sm space-y-4">
                        <div class="flex justify-between items-center border-b pb-3 border-slate-100">
                            <div>
                                <h3 class="font-extrabold text-slate-800 text-lg">Freelance Tracker</h3>
                                <p class="text-xs text-slate-400">Pantau project earned vs received</p>
                            </div>
                            <button onclick="addFreelancePrompt()" class="bg-brand-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-md">+ Project Baru</button>
                        </div>

                        <div class="space-y-2">
                            ${window.appState.freelance.map(f => `
                                <div class="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <span class="font-bold text-slate-800 text-sm">${f.project}</span>
                                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${f.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">${f.status}</span>
                                        </div>
                                        <p class="text-[11px] text-slate-400">Client: ${f.client} • Date: ${f.date}</p>
                                    </div>
                                    <div class="text-right">
                                        <p class="font-bold text-slate-800 text-sm">Rp ${Number(f.amount).toLocaleString('id-ID')}</p>
                                        <button onclick="deleteFreelance('${f.id}')" class="text-slate-300 hover:text-rose-500 text-[10px]"><i class="fa-solid fa-trash"></i> Hapus</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
            else if (window.currentTab === 'savingplan') {
                const totalGoalAllocatedMonthly = window.appState.goals.reduce((s, g) => {
                    const remaining = Math.max(0, g.target - g.current);
                    const months = Math.max(1, (new Date(g.deadline).getFullYear() - new Date().getFullYear()) * 12 + (new Date(g.deadline).getMonth() - new Date().getMonth()));
                    return s + Math.round(remaining / months);
                }, 0);

                const monthlyAvailableForSaving = Math.max(0, monthlyIncome - monthlyExpense);

                container.innerHTML = `
                    <div class="bg-white rounded-3xl p-6 border border-pink-100 shadow-sm space-y-4">
                        <h3 class="font-extrabold text-slate-800 text-lg">Saving Plan & Goal Allocation</h3>
                        
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                            <div class="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                                <span class="text-emerald-700 font-semibold">Monthly Income</span>
                                <p class="text-lg font-bold text-emerald-800 mt-1">Rp ${monthlyIncome.toLocaleString('id-ID')}</p>
                            </div>
                            <div class="p-4 rounded-2xl bg-rose-50 border border-rose-100">
                                <span class="text-rose-700 font-semibold">Monthly Expenses</span>
                                <p class="text-lg font-bold text-rose-800 mt-1">Rp ${monthlyExpense.toLocaleString('id-ID')}</p>
                            </div>
                            <div class="p-4 rounded-2xl bg-pink-50 border border-pink-100">
                                <span class="text-brand-700 font-semibold">Available for Saving</span>
                                <p class="text-lg font-bold text-brand-800 mt-1">Rp ${monthlyAvailableForSaving.toLocaleString('id-ID')}</p>
                            </div>
                        </div>

                        <div class="pt-2 space-y-3 border-t border-slate-100">
                            <div class="flex justify-between items-center text-xs">
                                <span class="font-bold text-slate-700">Total Planned Saving Needed for Goals:</span>
                                <span class="font-bold text-brand-600">Rp ${totalGoalAllocatedMonthly.toLocaleString('id-ID')} / month</span>
                            </div>
                            <p class="text-xs text-slate-500">
                                ${monthlyAvailableForSaving >= totalGoalAllocatedMonthly 
                                    ? '✅ Kapasitas menabungmu mencukupi untuk mencapai seluruh Financial Goals tepat waktu!' 
                                    : '⚠️ Catatan: Target tabungan bulanan saat ini melebihi sisa uang bulanan. Pertimbangkan memperpanjang deadline goal atau menekan pengeluaran.'}
                            </p>
                        </div>
                    </div>
                `;
            }
            else if (window.currentTab === 'recurring') {
                container.innerHTML = `
                    <div class="bg-white rounded-3xl p-6 border border-pink-100 shadow-sm space-y-4">
                        <div class="flex justify-between items-center border-b pb-3 border-slate-100">
                            <div>
                                <h3 class="font-extrabold text-slate-800 text-lg">Recurring Transactions</h3>
                                <p class="text-xs text-slate-400">Pemasukan dan pengeluaran rutin otomatis</p>
                            </div>
                            <button onclick="addRecurringPrompt()" class="bg-brand-500 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-md">+ Tambah Rutin</button>
                        </div>
                        <div class="space-y-2">
                            ${window.appState.recurring.map(r => `
                                <div class="flex justify-between items-center p-3 rounded-xl bg-slate-50 text-xs">
                                    <div>
                                        <p class="font-bold text-slate-800">${r.name}</p>
                                        <p class="text-[10px] text-slate-400">Setiap Tanggal ${r.day} • Akun: ${r.account}</p>
                                    </div>
                                    <span class="font-bold ${r.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}">Rp ${Number(r.amount).toLocaleString('id-ID')}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        };

