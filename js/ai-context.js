/**
 * ai-context.js
 * ------------------------------------------------------------
 * Membangun "context" kecil yang dikirim ke backend YN AI:
 * - daftar akun (nama saja, agar AI tidak pernah mengarang akun)
 * - daftar goal (id + nama, agar AI bisa mencocokkan goal_contribution)
 * - ringkasan keuangan (bukan seluruh transaksi!) untuk menjawab
 *   pertanyaan finansial
 *
 * Sengaja TIDAK mengirim seluruh window.appState.transactions ke
 * server — hanya angka-angka hasil kalkulasi, sesuai prinsip
 * "jangan kirim seluruh database ke AI".
 * ------------------------------------------------------------
 */

function buildFinancialContext() {
    const state = window.appState;
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    const totalAssets = state.assets.reduce((s, a) => s + Number(a.balance || 0), 0);
    const totalLiabilities = (state.liabilities || []).reduce((s, l) => s + Number(l.amount || 0), 0);
    const netWorth = totalAssets - totalLiabilities;

    const thisMonthTx = state.transactions.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === y && d.getMonth() === m;
    });

    const monthlyIncome = thisMonthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
    const monthlyExpense = thisMonthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);

    const expenseByCategory = {};
    thisMonthTx.filter(t => t.type === 'expense').forEach(t => {
        expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + Number(t.amount || 0);
    });
    let topExpenseCategory = null;
    let topExpenseAmount = 0;
    Object.entries(expenseByCategory).forEach(([cat, amt]) => {
        if (amt > topExpenseAmount) {
            topExpenseCategory = cat;
            topExpenseAmount = amt;
        }
    });

    return {
        today: now.toISOString().slice(0, 10),
        accounts: state.assets.map(a => ({ name: a.name, type: a.type, balance: a.balance })),
        goals: state.goals.map(g => ({ id: g.id, name: g.name, target: g.target, current: g.current, deadline: g.deadline })),
        financialSummary: {
            totalAssets,
            totalLiabilities,
            netWorth,
            monthlyIncome,
            monthlyExpense,
            monthlySavings: monthlyIncome - monthlyExpense,
            monthlyTransactionCount: thisMonthTx.length,
            topExpenseCategory,
            topExpenseAmount,
            topExpenseCategoryPercentOfMonthlyExpense: monthlyExpense > 0 && topExpenseAmount > 0
                ? Number(((topExpenseAmount / monthlyExpense) * 100).toFixed(1))
                : 0
        }
    };
}

export { buildFinancialContext };
