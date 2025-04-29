export function initializeInventory() {
    console.log('Инициализация inventory.js...');

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupInventory);
    } else {
        setupInventory();
    }

    function setupInventory() {
        console.log('Настройка inventory...');

        const addBtn = document.getElementById('addInventoryBtn');
        const exportBtn = document.getElementById('exportInventoryBtn');
        const orderHistoryIcon = document.getElementById('orderHistoryIcon');
        const modal = document.getElementById('inventoryModal');
        const orderHistoryModal = document.getElementById('orderHistoryModal');
        const closeBtn = document.querySelectorAll('.close-button');
        const form = document.getElementById('inventoryForm');
        const grid = document.getElementById('inventory-grid');
        const modalTitle = document.getElementById('modalTitle');
        const filterDate = document.getElementById('filter-date');
        const partNameSelect = document.getElementById('part-name');
        const minLevelInput = document.getElementById('min-level');
        const orderHistoryContent = document.getElementById('order-history-content');

        let inventory = [];
        let orders = [];
        let editId = null;
        let userRole = null;
        let currentUserId = null;
        let currentUserName = null;

        const SPARE_PARTS = {
            'Паливний насос': { minLevel: 5, price: 5000 },
            'Масляний фільтр': { minLevel: 10, price: 300 },
            'Повітряний фільтр': { minLevel: 8, price: 350 },
            'Гідравлічний насос': { minLevel: 3, price: 7000 },
            'Ремінь приводу': { minLevel: 15, price: 200 },
            'Шина для трактора': { minLevel: 4, price: 12000 },
            'Акумулятор': { minLevel: 2, price: 3500 },
            'Моторне масло': { minLevel: 20, price: 250 },
            'Гідравлічне масло': { minLevel: 15, price: 200 },
            'Трансмісійне масло': { minLevel: 10, price: 220 },
            'Дизельне пальне': { minLevel: 200, price: 56.84 },
            'Пальне': { minLevel: 50, price: 55.53 },
            'трактор Dongler': { minLevel: 1, price: 12000 }
        };

        const formatNumberWithSpaces = (number) => {
            return number.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        };

        const formatDate = (dateString) => {
            const date = new Date(dateString);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return isNaN(date) ? 'Невідома дата' : `${day}.${month}.${year}`;
        };

        const loadUserProfile = async () => {
            try {
                grid.innerHTML = '<p>Завантаження профілю...</p>';
                const response = await fetch('/api/auth/check-auth', { credentials: 'include' });
                if (!response.ok) {
                    throw new Error('Не вдалося авторизуватися. Переадресація...');
                }
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('Отримано некоректний формат відповіді від сервера');
                }
                const user = await response.json();
                userRole = user.role;
                currentUserId = user.id;
                currentUserName = user.fullName || user.username || 'Невідомий';
                if (userRole === 'user') {
                    addBtn.style.display = 'none';
                    if (exportBtn) exportBtn.style.display = 'none';
                    if (orderHistoryIcon) orderHistoryIcon.style.display = 'none';
                }
            } catch (error) {
                console.error('Помилка завантаження профілю:', error);
                grid.innerHTML = `<p>${error.message}</p>`;
                setTimeout(() => window.location.href = '/profile.html', 2000);
                throw error;
            }
        };

        const fetchInventory = async (filters = {}) => {
            try {
                grid.innerHTML = '<p>Завантаження запасів...</p>';
                const params = new URLSearchParams({ ...filters });
                const response = await fetch(`/api/inventory?${params.toString()}`, { credentials: 'include' });
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || 'Помилка завантаження запасів');
                }
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('Отримано некоректний формат відповіді від сервера');
                }
                const result = await response.json();
                inventory = result.data || [];

                // Логируем данные для отладки
                console.log('Полученные данные инвентаря:', inventory);

                // Проверяем на дубликаты
                const uniqueNames = new Set(inventory.map(item => item.name));
                if (uniqueNames.size < inventory.length) {
                    console.warn('Обнаружены дубликаты в данных инвентаря:', inventory);
                    // Фильтруем дубликаты, оставляя последнюю запись для каждого имени
                    const uniqueInventory = [];
                    const seenNames = new Set();
                    for (let i = inventory.length - 1; i >= 0; i--) {
                        if (!seenNames.has(inventory[i].name)) {
                            uniqueInventory.push(inventory[i]);
                            seenNames.add(inventory[i].name);
                        }
                    }
                    inventory = uniqueInventory.reverse();
                }

                renderGrid(inventory);
            } catch (error) {
                console.error('Помилка завантаження запасів:', error);
                grid.innerHTML = `<p>Не вдалося завантажити запаси: ${error.message}. Спробуйте оновити сторінку.</p>`;
            }
        };

        const fetchOrderHistory = async () => {
            try {
                orderHistoryContent.innerHTML = '<p>Завантаження історії замовлень...</p>';
                const response = await fetch('/api/inventory/expenses', { credentials: 'include' });
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || 'Помилка завантаження історії замовлень');
                }
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('Отримано некоректний формат відповіді від сервера');
                }
                const result = await response.json();
                orders = result.data || [];
                renderOrderHistory(orders);
            } catch (error) {
                console.error('Помилка завантаження історії:', error);
                orderHistoryContent.innerHTML = `<p>Не вдалося завантажити історію: ${error.message}</p>`;
            }
        };

        const deleteOrder = async (id) => {
            if (!confirm('Ви впевнені, що хочете видалити цей запис з історії замовлень?')) return;
            try {
                const response = await fetch(`/api/inventory/expenses/${id}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || 'Помилка видалення запису');
                }
                fetchOrderHistory();
            } catch (error) {
                console.error('Помилка видалення запису:', error);
                alert(`Помилка: ${error.message}`);
            }
        };

        const renderOrderHistory = (orders) => {
            orderHistoryContent.innerHTML = '';
            if (!orders.length) {
                orderHistoryContent.innerHTML = '<p>Історія замовлень відсутня.</p>';
                return;
            }

            orders.forEach(order => {
                const orderItem = document.createElement('div');
                orderItem.className = 'expense-card';
                orderItem.innerHTML = `
                    <h3><i class="fas fa-shopping-cart"></i> ${order.name}</h3>
                    <p><i class="fas fa-cubes"></i> Кількість: ${order.quantity}</p>
                    <p><i class="fas fa-money-bill-wave"></i> Загальна сума: ${formatNumberWithSpaces(order.total_cost)} UAH</p>
                    <p><i class="fas fa-calendar-alt"></i> Дата: ${formatDate(order.date)}</p>
                    <p><i class="fas fa-user"></i> Відповідальний: ${order.responsible}</p>
                    <p><i class="fas fa-sticky-note"></i> Примітки: ${order.notes || 'Немає'}</p>
                    ${(userRole === 'admin' || (userRole === 'manager' && order.user_id === currentUserId)) ? 
                        `<button class="expense-delete-btn" data-id="${order.id}"><i class="fas fa-trash"></i></button>` : ''}
                `;
                orderHistoryContent.appendChild(orderItem);
            });

            document.querySelectorAll('.expense-delete-btn').forEach(btn => {
                btn.addEventListener('click', () => deleteOrder(btn.dataset.id));
            });
        };

        const renderGrid = (data) => {
            grid.innerHTML = '';
            if (!data.length) {
                grid.innerHTML = userRole === 'user'
                    ? '<p>У вас поки що немає запасів. Зверніться до менеджера.</p>'
                    : '<p>Запаси відсутні. Додайте нові запаси за допомогою кнопки вище.</p>';
                return;
            }

            data.forEach(item => {
                const card = document.createElement('div');
                const status = item.quantity <= item.min_level ? 'Низький рівень' : 'Норма';
                const totalItemCost = item.quantity * item.pricePerUnit;

                let iconClass = 'fas fa-tools';
                if (item.name.includes('трактор')) {
                    iconClass = 'fas fa-tractor';
                } else if (item.name.includes('насос')) {
                    iconClass = 'fas fa-tint';
                }

                card.className = `expense-card ${status === 'Низький рівень' ? 'low-stock' : ''}`;
                card.innerHTML = `
                    <h3><i class="${iconClass}"></i> ${item.name}</h3>
                    <p><i class="fas fa-cubes"></i> Кількість: ${item.quantity}</p>
                    <p><i class="fas fa-exclamation-triangle"></i> Мінімальний рівень: ${item.min_level}</p>
                    <p><i class="fas fa-money-bill-wave"></i> Сума: ${formatNumberWithSpaces(totalItemCost)} UAH</p>
                    <p><i class="fas fa-calendar-alt"></i> Дата: ${formatDate(item.update_date)}</p>
                    <div class="actions">
                        ${(userRole === 'admin' || (userRole === 'manager' && item.user_id === currentUserId)) ?
                            `<button class="edit-btn" data-id="${item.id}"><i class="fas fa-edit"></i></button>
                             <button class="delete-btn" data-id="${item.id}"><i class="fas fa-trash"></i></button>` : ''}
                    </div>
                `;
                grid.appendChild(card);
            });

            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', () => openModal(btn.dataset.id));
            });

            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', () => deleteInventory(btn.dataset.id));
            });
        };

        const getFilters = () => {
            const filters = {};
            if (filterDate.value) filters.date = filterDate.value;
            return filters;
        };

        const populatePartNameOptions = () => {
            partNameSelect.innerHTML = '<option value="">Оберіть запас</option>';
            Object.keys(SPARE_PARTS).forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                partNameSelect.appendChild(option);
            });
        };

        const updateMinLevel = () => {
            const selectedName = partNameSelect.value;
            if (selectedName && SPARE_PARTS[selectedName]) {
                minLevelInput.value = SPARE_PARTS[selectedName].minLevel;
            } else {
                minLevelInput.value = '';
            }
        };

        const openModal = (id = null) => {
            console.log('Открытие модального окна, id:', id);
            editId = id;
            if (id) {
                const item = inventory.find(i => i.id === parseInt(id));
                if (!item) return;
                modalTitle.textContent = 'Редагувати запас';
                partNameSelect.value = item.name;
                updateMinLevel();
                form.quantity.value = item.quantity;
                form['responsible-person'].value = item.responsible;
                form['update-time'].value = item.update_date;
                form.notes.value = item.notes || '';
            } else {
                modalTitle.textContent = 'Додати запас';
                form.reset();
                form['update-time'].value = new Date().toISOString().split('T')[0];
                form['responsible-person'].value = currentUserName;
                partNameSelect.value = '';
                minLevelInput.value = '';
            }
            modal.style.display = 'flex';
        };

        const openOrderHistoryModal = () => {
            console.log('Открытие модального окна истории заказов');
            orderHistoryModal.style.display = 'flex';
            fetchOrderHistory();
        };

        const closeModal = () => {
            console.log('Закрытие модального окна');
            modal.style.display = 'none';
            orderHistoryModal.style.display = 'none';
            editId = null;
            form.reset();
            partNameSelect.value = '';
            minLevelInput.value = '';
        };

        const saveInventory = async (e) => {
            e.preventDefault();
            const name = partNameSelect.value;
            if (!name || !SPARE_PARTS[name]) {
                alert('Будь ласка, оберіть назву запаса.');
                return;
            }

            const quantity = parseInt(form.quantity.value);
            if (isNaN(quantity) || quantity < 0) {
                alert('Кількість повинна бути невід’ємним числом.');
                return;
            }

            const responsible = form['responsible-person'].value.trim();
            if (responsible.length < 2) {
                alert('Відповідальна особа повинна мати принаймні 2 символи.');
                return;
            }

            const update_date = form['update-time'].value;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(update_date)) {
                alert('Дата оновлення повинна бути у форматі YYYY-MM-DD.');
                return;
            }

            const item = {
                name,
                quantity,
                min_level: SPARE_PARTS[name].minLevel,
                responsible,
                update_date,
                notes: form.notes.value.trim(),
                pricePerUnit: SPARE_PARTS[name].price
            };

            try {
                // Сохраняем/обновляем запас
                const method = editId ? 'PUT' : 'POST';
                const url = editId ? `/api/inventory/${editId}` : '/api/inventory';
                const response = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item),
                    credentials: 'include'
                });

                if (!response.ok) {
                    let errorMessage = 'Помилка сервера';
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.errors?.join('; ') || errorData.error || `Помилка ${editId ? 'редагування' : 'додавання'} запаса`;
                    } catch {
                        errorMessage = 'Отримано некоректний формат відповіді від сервера';
                    }
                    throw new Error(errorMessage);
                }

                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('Отримано некоректний формат відповіді від сервера');
                }

                const updatedItem = await response.json();
                if (updatedItem.quantity <= updatedItem.min_level) {
                    alert(`Увага: Низький рівень запаса "${updatedItem.name}"! Кількість: ${updatedItem.quantity}, Мінімальний рівень: ${updatedItem.min_level}`);
                }

                closeModal();
                fetchInventory(getFilters());
            } catch (error) {
                console.error('Помилка збереження:', error);
                alert(`Помилка: ${error.message}`);
            }
        };

        const deleteInventory = async (id) => {
            if (!confirm('Ви впевнені, що хочете видалити цей запас?')) return;
            try {
                const response = await fetch(`/api/inventory/${id}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || 'Помилка видалення запаса');
                }
                fetchInventory(getFilters());
            } catch (error) {
                console.error('Помилка видалення:', error);
                alert(`Помилка: ${error.message}`);
            }
        };

        const exportToExcel = () => {
            if (userRole === 'user') {
                alert('У вас немає прав для експорту історії замовлень.');
                return;
            }

            const fileName = `Історія_замовлень_${new Date().toISOString().split('T')[0]}`;
            const wsData = orders.map(order => ({
                "Назва": order.name,
                "Кількість": order.quantity,
                "Вартість за одиницю (UAH)": formatNumberWithSpaces(order.price_per_unit),
                "Загальна сума (UAH)": formatNumberWithSpaces(order.total_cost),
                "Відповідальна особа": order.responsible,
                "Дата": formatDate(order.date),
                "Примітки": order.notes || ''
            }));

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, "Історія замовлень");
            XLSX.writeFile(wb, `${fileName}.xlsx`);
        };

        loadUserProfile().then(() => {
            populatePartNameOptions();
            fetchInventory();
        }).catch(error => {
            console.error('Помилка ініціалізації:', error);
        });

        if (addBtn) {
            addBtn.addEventListener('click', () => {
                console.log('Клик по кнопке Додати запас');
                openModal();
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', exportToExcel);
        }

        if (orderHistoryIcon) {
            orderHistoryIcon.addEventListener('click', openOrderHistoryModal);
        }

        closeBtn.forEach(btn => {
            btn.addEventListener('click', closeModal);
        });

        if (form) {
            form.addEventListener('submit', saveInventory);
        }

        if (filterDate) {
            filterDate.addEventListener('change', () => {
                fetchInventory(getFilters());
            });
        }

        if (partNameSelect) {
            partNameSelect.addEventListener('change', updateMinLevel);
        }

        window.addEventListener('click', (e) => {
            if (e.target === modal || e.target === orderHistoryModal) closeModal();
        });
    }
}