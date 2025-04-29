import { notoSansBase64 } from '/public/fonts.js';

document.addEventListener('DOMContentLoaded', () => {
    const addBtn = document.getElementById('addContractBtn');
    const modal = document.getElementById('contractModal');
    const closeBtn = document.querySelector('.close-button');
    const form = document.getElementById('contractForm');
    const grid = document.getElementById('contractsGrid');
    const modalTitle = document.getElementById('modalTitle');
    const dateFilter = document.getElementById('contractDateFilter');
    const statusFilter = document.getElementById('contractStatusFilter');

    let contracts = [];
    let editId = null;
    let userRole = null;
    let currentUserId = null;

    const loadUserProfile = async () => {
        try {
            grid.innerHTML = '<p>Завантаження профілю...</p>';
            console.log('Завантаження профілю користувача...');
            const response = await fetch('/api/auth/check-auth', { credentials: 'include' });
            console.log('Відповідь від /api/auth/check-auth:', response.status, response.statusText);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Не вдалося авторизуватися. Переадресація... Статус: ${response.status}, Текст: ${errorText}`);
            }
            const user = await response.json();
            console.log('Дані користувача:', user);
            userRole = user.role;
            currentUserId = user.id;
            console.log(`Користувач ініціалізований: userRole=${userRole}, currentUserId=${currentUserId}`);
            if (userRole === 'user') {
                addBtn.style.display = 'none';
            }
        } catch (error) {
            console.error('Помилка:', error);
            grid.innerHTML = `<p>${error.message}</p>`;
            setTimeout(() => {
                window.location.href = '/profile.html';
            }, 2000);
            throw error;
        }
    };

    const fetchContracts = async (filters = {}) => {
        try {
            grid.innerHTML = '<p>Завантаження договорів...</p>';
            console.log('Завантаження контрактів з фільтрами:', filters);
            const query = new URLSearchParams(filters).toString();
            const response = await fetch(`/api/contracts${query ? `?${query}` : ''}`, { credentials: 'include' });
            console.log('Відповідь від /api/contracts:', response.status, response.statusText);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Помилка завантаження договорів: ${errorText}`);
            }
            contracts = await response.json();
            console.log('Отримано контракти:', contracts);

            if (userRole === 'user') {
                contracts = contracts.filter(c => c.userId === currentUserId);
                console.log('Відфільтровано контракти для user:', contracts);
            }

            filterContracts();
        } catch (error) {
            console.error('Помилка:', error);
            grid.innerHTML = '<p>Не вдалося завантажити договори. Спробуйте оновити сторінку.</p>';
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return isNaN(date) ? 'Невідома дата' : date.toISOString().split('T')[0];
    };

    const formatNumber = (number) => {
        return Number(number).toLocaleString('ru-RU', { useGrouping: true });
    };

    const renderGrid = (data) => {
        grid.innerHTML = '';
        if (!data.length) {
            grid.innerHTML = userRole === 'user'
                ? '<p>У вас поки що немає договорів. Зверніться до менеджера для створення договору.</p>'
                : '<p>Договорів не знайдено</p>';
            return;
        }
        data.forEach(c => {
            const card = document.createElement('div');
            card.className = 'contract-card noto-sans-regular';
            card.innerHTML = `
                <h3>Договір №${c.number}</h3>
                <p><i class="fas fa-user"></i> <span>Орендар: ${c.party}</span></p>
                <p><i class="fas fa-money-bill-wave"></i> <span>Сума: ${formatNumber(c.amount)} UAH</span></p>
                <p><i class="fas fa-tractor"></i> <span>Тип техніки: ${c.equipmentType}</span></p>
                <p><i class="fas fa-map-marker-alt"></i> <span>Регіон: ${c.region}</span></p>
                <p><i class="fas fa-calendar-alt"></i> <span>Дата: ${formatDate(c.date)}</span></p>
                <p><i class="fas fa-info-circle"></i> <span>Статус: ${
                    c.status === 'active' ? 'Активний' :
                    c.status === 'completed' ? 'Виконано' : 'Розірвано'
                }</span></p>
                <div class="contract-actions">
                    ${
                        userRole === 'admin' || (userRole === 'manager' && c.userId === currentUserId)
                        ? `
                            <button class="edit-btn noto-sans-regular">
                                <i class="fas fa-edit"></i> Редагувати
                            </button>
                            <button class="delete-btn noto-sans-regular">
                                <i class="fas fa-trash"></i> Видалити
                            </button>
                            <button class="export-btn noto-sans-regular">
                                <i class="fas fa-file-pdf"></i> PDF
                            </button>
                        `
                        : `
                            <button class="export-btn noto-sans-regular">
                                <i class="fas fa-file-pdf"></i> PDF
                            </button>
                        `
                    }
                </div>
            `;
            if (userRole === 'admin' || (userRole === 'manager' && c.userId === currentUserId)) {
                card.querySelector('.edit-btn')?.addEventListener('click', () => editContract(c.id));
                card.querySelector('.delete-btn')?.addEventListener('click', () => deleteContract(c.id));
            }
            card.querySelector('.export-btn')?.addEventListener('click', () => exportToPDF(c.id));
            grid.appendChild(card);
        });
    };

    const filterContracts = () => {
        let filtered = [...contracts];
        if (dateFilter.value) filtered = filtered.filter(c => c.date === dateFilter.value);
        if (statusFilter.value) filtered = filtered.filter(c => c.status === statusFilter.value);
        renderGrid(filtered);
    };

    const editContract = (id) => {
        if (userRole === 'user') {
            alert('Немає прав');
            return;
        }
        const c = contracts.find(item => item.id === id);
        if (c.userId !== currentUserId && userRole !== 'admin') {
            alert('Немає прав');
            return;
        }
        editId = id;
        modalTitle.textContent = 'Редагувати договір';
        form.contractNumber.value = c.number;
        form.contractName.value = c.name;
        form.contractParty.value = c.party;
        form.contractDate.value = c.date;
        form.contractEndDate.value = c.endDate;
        form.contractAmount.value = c.amount;
        form.contractStatus.value = c.status;
        form.equipmentType.value = c.equipmentType;
        form.region.value = c.region;
        form.contractNotes.value = c.notes;
        form.paymentTerms.value = c.paymentTerms || '';
        form.deliveryTerms.value = c.deliveryTerms || '';
        form.contractDuration.value = c.contractDuration || '';
        form.responsiblePerson.value = c.responsiblePerson || '';
        modal.style.display = 'flex';
    };

    const deleteContract = async (id) => {
        if (userRole === 'user') {
            alert('Немає прав');
            return;
        }
        if (!confirm('Ви впевнені?')) return;
        try {
            const response = await fetch(`/api/contracts/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Помилка видалення');
            fetchContracts({ date: dateFilter.value, status: statusFilter.value });
            alert('Договір видалено');
        } catch (error) {
            console.error('Помилка:', error);
            alert('Помилка: ' + error.message);
        }
    };

    const exportToPDF = (id) => {
        const contract = contracts.find(c => c.id === id);
        if (!window.jspdf) {
            alert('Бібліотека jsPDF не завантажена');
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        try {
            doc.addFileToVFS("NotoSans-Regular.ttf", notoSansBase64);
            doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
            doc.setFont("NotoSans", "normal");
        } catch (error) {
            console.error('Помилка завантаження шрифту:', error);
            doc.setFont("Helvetica", "normal");
        }

        // Налаштування параметрів сторінки
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 10;
        const lineHeight = 10;
        const maxLineWidth = pageWidth - 2 * margin;
        let yPosition = margin;

        // Функція для перевірки переповнення сторінки
        const checkPageOverflow = (currentY, spaceNeeded) => {
            if (currentY + spaceNeeded > pageHeight - margin) {
                doc.addPage();
                return margin;
            }
            return currentY;
        };

        // Функція для додавання тексту з переносом
        const addWrappedText = (text, x, y, maxWidth) => {
            const lines = doc.splitTextToSize(text, maxWidth);
            for (let i = 0; i < lines.length; i++) {
                y = checkPageOverflow(y, lineHeight);
                doc.text(lines[i], x, y);
                y += lineHeight;
            }
            return y;
        };

        // Заголовок договору
        yPosition = checkPageOverflow(yPosition, lineHeight * 2);
        doc.setFontSize(14);
        doc.text(`ДОГОВІР ОРЕНДИ ТЕХНІКИ № ${contract.number}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += lineHeight * 2;

        // Місто і дата
        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.setFontSize(12);
        doc.text(`м. ${contract.region || 'Невідоме місто'}`, margin, yPosition);
        yPosition += lineHeight;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.text(`${formatDate(contract.date)}`, margin, yPosition);
        yPosition += lineHeight * 2;

        // 1. Сторони договору
        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.setFontSize(14);
        doc.text('1. Сторони договору', margin, yPosition);
        yPosition += lineHeight;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.setFontSize(12);
        doc.text('Орендодавець: ТОВ "Агрофірма"', margin, yPosition);
        yPosition += lineHeight;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.text('адреса: вул. Центральна, 1, м. Київ', margin, yPosition);
        yPosition += lineHeight;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.text('код ЄДРПОУ: 12345678', margin, yPosition);
        yPosition += lineHeight;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.text('в особі Іванова Івана Івановича,', margin, yPosition);
        yPosition += lineHeight;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.text('діючого на підставі Статуту.', margin, yPosition);
        yPosition += lineHeight * 2;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.text(`Орендар: ${contract.party || 'Невідомий орендар'},`, margin, yPosition);
        yPosition += lineHeight;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.text('адреса: вул. Незалежності, 10, м. Київ,', margin, yPosition);
        yPosition += lineHeight;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.text('код ЄДРПОУ: 87654321,', margin, yPosition);
        yPosition += lineHeight;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.text(`в особі ${contract.responsiblePerson || 'Петрова Петра Петровича'},`, margin, yPosition);
        yPosition += lineHeight;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.text('діючого на підставі Довіреності.', margin, yPosition);
        yPosition += lineHeight * 2;

        // 2. Предмет договору
        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.setFontSize(14);
        doc.text('2. ПРЕДМЕТ ДОГОВОРУ', margin, yPosition);
        yPosition += lineHeight;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.setFontSize(12);
        doc.text('Орендодавець передає в оренду, а Орендар приймає в оренду техніку:', margin, yPosition);
        yPosition += lineHeight * 2;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.text(`Тип техніки: ${contract.equipmentType || 'Невідомий тип'}`, margin, yPosition);
        yPosition += lineHeight;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.text('Марка: ТМ', margin, yPosition);
        yPosition += lineHeight;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.text('Рік випуску: 2020', margin, yPosition);
        yPosition += lineHeight;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.text('Ідентифікаційний номер: 123456', margin, yPosition);
        yPosition += lineHeight * 2;

        // 3. Умови оренди
        const sectionSpaceNeeded = lineHeight * 4;
        if (yPosition + sectionSpaceNeeded > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
        } else {
            yPosition += lineHeight;
        }

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.setFontSize(14);
        doc.text('3. УМОВИ ОРЕНДИ', margin, yPosition);
        yPosition += lineHeight;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.setFontSize(12);
        doc.text(`Термін оренди: з ${formatDate(contract.date)} по ${formatDate(contract.endDate)}`, margin, yPosition);
        yPosition += lineHeight;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.text(`Орендна плата: ${formatNumber(contract.amount)} UAH`, margin, yPosition);
        yPosition += lineHeight * 2;

        // 4. Права і обов'язки сторін
        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.setFontSize(14);
        doc.text('4. ПРАВА І ОБОВ\'ЯЗКИ СТОРІН', margin, yPosition);
        yPosition += lineHeight;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.setFontSize(12);
        doc.text('Орендодавець зобов\'язується:', margin, yPosition);
        yPosition += lineHeight;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.text('Надати техніку в справному стані;', margin, yPosition);
        yPosition += lineHeight;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.text('Забезпечити технічну підтримку при необхідності.', margin, yPosition);
        yPosition += lineHeight * 2;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.text('Орендар зобов\'язується:', margin, yPosition);
        yPosition += lineHeight;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.text('Сплачувати орендну плату в установлені строки;', margin, yPosition);
        yPosition += lineHeight;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.text('Утримувати техніку в належному стані та вести облік її використання.', margin, yPosition);
        yPosition += lineHeight * 2;

        // 5. Відповідальність сторін
        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.setFontSize(14);
        doc.text('5. ВІДПОВІДАЛЬНІСТЬ СТОРІН', margin, yPosition);
        yPosition += lineHeight;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.setFontSize(12);
        yPosition = addWrappedText('У разі невиконання або неналежного виконання умов договору сторони несуть відповідальність відповідно до чинного законодавства України.', margin, yPosition, maxLineWidth);
        yPosition += lineHeight;

        // 6. Інші умови
        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.setFontSize(14);
        doc.text('6. ІНШІ УМОВИ', margin, yPosition);
        yPosition += lineHeight;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.setFontSize(12);
        yPosition = addWrappedText('Зміни та доповнення до цього договору оформлюються у письмовій формі.', margin, yPosition, maxLineWidth);
        
        yPosition = checkPageOverflow(yPosition, lineHeight);
        yPosition = addWrappedText('У разі форс-мажору сторони звільняються від відповідальності за невиконання умов цього договору.', margin, yPosition, maxLineWidth);
        yPosition += lineHeight;

        // 7. Прикінцеві положення
        // Принудительно переносим на новую страницу
        doc.addPage();
        yPosition = margin;

        doc.setFontSize(14);
        doc.text('7. ПРИКІНЦЕВІ ПОЛОЖЕННЯ', margin, yPosition);
        yPosition += lineHeight;

        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.setFontSize(12);
        yPosition = addWrappedText('Цей договір укладено у двох примірниках, по одному для кожної сторони,', margin, yPosition, maxLineWidth);
        
        yPosition = checkPageOverflow(yPosition, lineHeight);
        doc.text('і має однакову юридичну силу.', margin, yPosition);
        yPosition += lineHeight;

        // Підписи сторін
        const signatureSpace = lineHeight * 3;
        yPosition = checkPageOverflow(yPosition, signatureSpace);

        doc.setFontSize(14);
        doc.text('Підписи сторін:', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += lineHeight * 2;

        doc.setFontSize(12);
        const leftX = margin;
        const rightX = pageWidth - margin - 50;
        doc.text('Орендодавець     __________', leftX, yPosition);
        doc.text('Орендар     __________', rightX, yPosition);

        doc.save(`Договір_${contract.number}.pdf`);
    };

    addBtn.addEventListener('click', () => {
        if (userRole !== 'admin' && userRole !== 'manager') {
            alert('Немає прав');
            return;
        }
        editId = null;
        modalTitle.textContent = 'Додати договір';
        form.reset();
        modal.style.display = 'flex';
    });

    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (userRole === 'user') {
            alert('Немає прав');
            return;
        }
        const contract = {
            number: form.contractNumber.value,
            name: form.contractName.value,
            party: form.contractParty.value,
            date: form.contractDate.value,
            endDate: form.contractEndDate.value,
            amount: parseFloat(form.contractAmount.value),
            status: form.contractStatus.value,
            equipmentType: form.equipmentType.value,
            region: form.region.value,
            notes: form.contractNotes.value || 'Немає приміток',
            paymentTerms: form.paymentTerms.value || '',
            deliveryTerms: form.deliveryTerms.value || '',
            contractDuration: form.contractDuration.value || '',
            responsiblePerson: form.responsiblePerson.value || ''
        };

        console.log('Дані контракту перед відправкою:', contract);

        try {
            const url = editId ? `/api/contracts/${editId}` : '/api/contracts';
            const method = editId ? 'PUT' : 'POST';
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(contract),
                credentials: 'include'
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Помилка збереження: ${errorText}`);
            }
            modal.style.display = 'none';
            fetchContracts({ date: dateFilter.value, status: statusFilter.value });
            alert(editId ? 'Договір оновлено' : 'Договір створено');
        } catch (error) {
            console.error('Помилка:', error);
            alert('Помилка: ' + error.message);
        }
    });

    const init = async () => {
        try {
            await loadUserProfile();
            if (!userRole) return;
            await fetchContracts();

            const urlParams = new URLSearchParams(window.location.search);
            const autoOpenModal = urlParams.get('autoOpenModal') === 'true';

            if (autoOpenModal && (userRole === 'admin' || userRole === 'manager')) {
                try {
                    const response = await fetch('/api/notifications/pending-contract', { credentials: 'include' });
                    if (!response.ok) {
                        throw new Error('Не вдалося отримати дані для створення договору.');
                    }
                    const contractData = await response.json();

                    editId = null;
                    modalTitle.textContent = 'Додати договір';
                    form.reset();

                    form.contractNumber.value = contractData.number || '';
                    form.contractName.value = contractData.name || '';
                    form.contractParty.value = contractData.party || '';
                    form.contractDate.value = contractData.date || '';
                    form.contractEndDate.value = contractData.endDate || '';
                    form.contractAmount.value = contractData.amount || 0;
                    form.contractStatus.value = contractData.status || 'active';
                    form.equipmentType.value = contractData.equipmentType || '';
                    form.region.value = contractData.region || '';
                    form.paymentTerms.value = contractData.paymentTerms || '';
                    form.deliveryTerms.value = contractData.deliveryTerms || '';
                    form.contractDuration.value = contractData.contractDuration || '';
                    form.responsiblePerson.value = contractData.responsiblePerson || '';
                    form.contractNotes.value = contractData.notes || '';

                    modal.style.display = 'flex';
                } catch (error) {
                    console.error('Помилка при отриманні даних для створення договору:', error);
                    alert('Не вдалося завантажити дані для створення договору.');
                }
            }

            window.addEventListener('autoFillContractForm', (event) => {
                const contractData = event.detail;
                if (contractData && (userRole === 'admin' || userRole === 'manager')) {
                    editId = null;
                    modalTitle.textContent = 'Додати договір';
                    form.reset();

                    form.contractNumber.value = contractData.number || '';
                    form.contractName.value = contractData.name || '';
                    form.contractParty.value = contractData.party || '';
                    form.contractDate.value = contractData.date || '';
                    form.contractEndDate.value = contractData.endDate || '';
                    form.contractAmount.value = contractData.amount || 0;
                    form.contractStatus.value = contractData.status || 'active';
                    form.equipmentType.value = contractData.equipmentType || '';
                    form.region.value = contractData.region || '';
                    form.paymentTerms.value = contractData.paymentTerms || '';
                    form.deliveryTerms.value = contractData.deliveryTerms || '';
                    form.contractDuration.value = contractData.contractDuration || '';
                    form.responsiblePerson.value = contractData.responsiblePerson || '';
                    form.contractNotes.value = contractData.notes || '';

                    modal.style.display = 'flex';
                }
            });
        } catch (error) {
            console.error('Помилка ініціалізації:', error);
            grid.innerHTML = '<p>Помилка ініціалізації. Спробуйте оновити сторінку.</p>';
        }
    };

    dateFilter.addEventListener('change', () => fetchContracts({ date: dateFilter.value, status: statusFilter.value }));
    statusFilter.addEventListener('change', () => fetchContracts({ date: dateFilter.value, status: statusFilter.value }));

    init();
});