/**
 * ui-utils.js
 * ------------------------------------------------------------
 * Utilitas UI kecil: showToast() (notifikasi) dan
 * triggerCelebration() (modal + confetti saat goal 100% tercapai).
 * ------------------------------------------------------------
 */
        function showToast(message, isError = false) {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = `p-3.5 px-4 rounded-2xl text-xs font-bold text-white shadow-xl backdrop-blur-md flex items-center gap-2 transition-all duration-300 transform translate-y-2 ${isError ? 'bg-rose-600' : 'bg-slate-900/90 border border-brand-400'}`;
            toast.innerHTML = `<i class="fa-solid ${isError ? 'fa-triangle-exclamation' : 'fa-circle-check text-brand-400'}"></i> ${message}`;
            container.appendChild(toast);

            setTimeout(() => {
                toast.classList.add('opacity-0', '-translate-y-2');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        function triggerCelebration(goal) {
            document.getElementById('celebration-goal-name').innerText = `${goal.icon} ${goal.name}`;
            document.getElementById('celebration-goal-amount').innerText = `Target Rp ${Number(goal.target).toLocaleString('id-ID')} telah 100% tercapai! 🎉`;
            openModal('modal-celebration');

            // Fire confetti
            if (window.confetti) {
                confetti({
                    particleCount: 120,
                    spread: 70,
                    origin: { y: 0.6 }
                });
            }
        }

export { showToast, triggerCelebration };
