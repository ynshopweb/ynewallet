/**
 * modals.js
 * ------------------------------------------------------------
 * Buka/tutup modal (transaksi, aset, goal, celebration) dan
 * pengaturan tipe transaksi (income/expense/transfer/goal).
 * ------------------------------------------------------------
 */
        window.openModal = function(id) {
            document.getElementById(id).classList.remove('hidden');
            if (id === 'modal-transaction') {
                // Populate Account dropdowns
                const accSelect = document.getElementById('tx-account');
                const targetSelect = document.getElementById('tx-account-target');
                const goalSelect = document.getElementById('tx-goal-id');

                const assetOptions = window.appState.assets.map(a => `<option value="${a.name}">${a.name} (Rp ${Number(a.balance).toLocaleString('id-ID')})</option>`).join('');
                accSelect.innerHTML = assetOptions;
                targetSelect.innerHTML = assetOptions;

                goalSelect.innerHTML = window.appState.goals.map(g => `<option value="${g.id}">${g.icon} ${g.name} (Goal Target)</option>`).join('');
                
                document.getElementById('tx-date').value = new Date().toISOString().slice(0, 10);
                window.setTxType('income');
            }
        };

        window.closeModal = function(id) {
            document.getElementById(id).classList.add('hidden');
        };

        window.setTxType = function(type) {
            document.getElementById('tx-type-value').value = type;
            document.querySelectorAll('.tx-type-btn').forEach(b => {
                b.classList.remove('bg-white', 'shadow-sm', 'text-brand-600');
            });
            document.getElementById(`tx-type-${type}`).classList.add('bg-white', 'shadow-sm', 'text-brand-600');

            const transferBox = document.getElementById('tx-transfer-target-container');
            const goalBox = document.getElementById('tx-goal-select-container');
            const catContainer = document.getElementById('tx-category-container');
            const catSelect = document.getElementById('tx-category');

            transferBox.classList.add('hidden');
            goalBox.classList.add('hidden');
            catContainer.classList.remove('hidden');

            if (type === 'income') {
                catSelect.innerHTML = `
                    <option value="Gaji Guru">Gaji Guru</option>
                    <option value="Toko">Toko / Usaha</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Invitasi">Invitasi</option>
                    <option value="Affiliate">Affiliate</option>
                    <option value="Bonus">Bonus</option>
                    <option value="Lainnya">Lainnya</option>
                `;
            } else if (type === 'expense') {
                catSelect.innerHTML = `
                    <option value="Makanan">Makanan</option>
                    <option value="Transportasi">Transportasi</option>
                    <option value="Belanja">Belanja</option>
                    <option value="Tagihan">Tagihan</option>
                    <option value="Rumah">Rumah</option>
                    <option value="Pendidikan">Pendidikan</option>
                    <option value="Hiburan">Hiburan</option>
                    <option value="Kebutuhan pribadi">Kebutuhan Pribadi</option>
                    <option value="Kebutuhan toko">Kebutuhan Toko</option>
                    <option value="Kesehatan">Kesehatan</option>
                    <option value="Lainnya">Lainnya</option>
                `;
            } else if (type === 'transfer') {
                transferBox.classList.remove('hidden');
                catContainer.classList.add('hidden');
            } else if (type === 'goal') {
                goalBox.classList.remove('hidden');
                catContainer.classList.add('hidden');
            }
        };

