document.addEventListener('DOMContentLoaded', () => {
    const addBtn = document.getElementById('addHistoryBtn');
    const modal = document.getElementById('historyModal');
    const closeBtn = document.querySelector('.close-button');
    const form = document.getElementById('historyForm');
    const grid = document.getElementById('history-grid');
    const modalTitle = document.getElementById('modalTitle');
    const dateFilter = document.getElementById('dateFilter');
    const typeFilter = document.getElementById('typeFilter');
    let records = [];
    let editId = null;
    let userRole = null;
    let ws;

    function showToast(message, isError = false) {
        const toast = document.createElement('div');
        toast.className = `toast ${isError ? 'error' : ''}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }

    function connectWebSocket() {
        ws = new WebSocket('ws://localhost:3000/ws');
        ws.onopen = () => console.log('WebSocket підключено');
        ws.onmessage = async (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'historyUpdated') {
                const newRecord = message.record;
                const reminder = await fetchReminder(newRecord.reminder_id);
                newRecord.reminder_label = reminder ? reminder.text : null;
                const index = records.findIndex(r => r.id === newRecord.id);
                if (index !== -1) {
                    records[index] = newRecord;
                } else {
                    records.push(newRecord);
                }
                renderRecords(records);
            } else if (message.type === 'historyDeleted') {
                records = records.filter(r => r.id !== parseInt(message.id));
                renderRecords(records);
            }
        };
        ws.onclose = () => {
            console.log('WebSocket відключено, повторне підключення через 5 секунд...');
            setTimeout(connectWebSocket, 5000);
        };
        ws.onerror = (error) => console.error('Помилка WebSocket:', error);
    }

    connectWebSocket();

    async function fetchReminder(reminderId) {
        if (!reminderId) return null;
        try {
            const response = await fetch(`/api/maintenance/reminders/${reminderId}`, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error('Помилка при отриманні нагадування:', error.message);
            return null;
        }
    }

    const checkAuth = async () => {
        try {
            const response = await fetch('/api/auth/check-auth', { credentials: 'include' });
            if (!response.ok) {
                throw new Error('Не авторизований');
            }
            const user = await response.json();
            userRole = user.role;
            if (userRole === 'user') {
                addBtn.style.display = 'none';
            }
        } catch (error) {
            console.error('Помилка авторизації:', error);
            window.location.href = '/profile.html';
        }
    };

    async function loadRecords(filters = {}) {
        try {
            grid.innerHTML = '<p>Завантаження записів...</p>';
            const query = new URLSearchParams(filters).toString();
            const response = await fetch(`/api/maintenance/history${query ? `?${query}` : ''}`, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    window.location.href = '/profile.html?authRequired=true';
                    return;
                }
                const errorData = await response.json();
                throw new Error(errorData.error || 'Помилка при завантаженні історії');
            }

            records = await response.json();
            for (let record of records) {
                const reminder = await fetchReminder(record.reminder_id);
                record.reminder_label = reminder ? reminder.text : null;
            }
            renderRecords(records);
        } catch (error) {
            console.error('Помилка завантаження історії:', error.message);
            grid.innerHTML = `<p>Помилка: ${error.message}. Спробуйте оновити сторінку.</p>`;
        }
    }

    function renderRecords(data) {
        grid.innerHTML = '';
        if (!data.length) {
            grid.innerHTML = userRole === 'user'
                ? '<p>У вас поки що немає записів історії.</p>'
                : '<p>Записів історії не знайдено</p>';
            return;
        }

        data.forEach(record => {
            const card = document.createElement('div');
            card.className = 'history-card noto-sans-regular';
            card.dataset.id = record.id;
            // Визначаємо заголовок: "Техогляд" або "Ремонт" на основі record.type
            const cardTitle = record.type === 'Техогляд' ? 'Техогляд' : record.type === 'Ремонт' ? 'Ремонт' : record.type;
            card.innerHTML = `
                <h3>${cardTitle}</h3>
                <p><i class="fas fa-calendar-alt"></i> <span>Дата: ${record.date}</span></p>
                ${record.reminder_label ? `<p><i class="fas fa-bell"></i> <span>Нагадування: ${record.reminder_label}</span></p>` : ''}
                <p><i class="fas fa-comment"></i> <span>Опис: ${record.description}</span></p>
                <p><i class="fas fa-user"></i> <span>Відповідальний: ${record.responsible}</span></p>
                <div class="action-buttons">
                    ${userRole === 'admin' || userRole === 'manager' ? `
                        <button class="edit-btn noto-sans-regular" data-id="${record.id}" data-text="${encodeURIComponent(record.reminder_label || record.type)}">
                            <i class="fas fa-edit"></i> Редагувати
                        </button>
                        <button class="delete-btn noto-sans-regular" data-id="${record.id}">
                            <i class="fas fa-trash"></i> Видалити
                        </button>
                    ` : ''}
                </div>
            `;
            grid.appendChild(card);
        });

        document.querySelectorAll('.history-card').forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            setTimeout(() => {
                card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 100);
        });

        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const text = btn.getAttribute('data-text');
                window.location.href = `/maintenance_reminders.html?editId=${id}&text=${text}`;
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                deleteRecord(id);
            });
        });
    }

    function editRecord(id) {
        if (userRole === 'user') {
            showToast('Немає прав', true);
            return;
        }
        editId = id;
        const record = records.find(r => r.id == id);
        if (!record) return;

        modalTitle.innerHTML = '<i class="fas fa-tools"></i> Редагувати запис';
        form.date.value = record.date;
        form.type.value = record.type;
        form.description.value = record.description;
        form.responsible.value = record.responsible;
        modal.style.display = 'flex';
        modal.style.animation = 'scaleUp 0.5s ease';
    }

    async function deleteRecord(id) {
        if (userRole === 'user') {
            showToast('Немає прав', true);
            return;
        }
        if (!confirm('Ви впевнені, що хочете видалити цей запис?')) {
            return;
        }

        try {
            const response = await fetch(`/api/maintenance/history/${id}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    window.location.href = '/profile.html?authRequired=true';
                    return;
                }
                const errorData = await response.json();
                throw new Error(errorData.error || 'Помилка при видаленні запису');
            }

            showToast('Запис успішно видалено!');
            await loadRecords({ date: dateFilter.value, type: typeFilter.value });
        } catch (error) {
            console.error('Помилка при видаленні запису:', error.message);
            showToast(`Не вдалося видалити запис: ${error.message}`, true);
        }
    }

    addBtn.addEventListener('click', () => {
        if (userRole !== 'admin' && userRole !== 'manager') {
            showToast('Немає прав', true);
            return;
        }
        editId = null;
        modalTitle.innerHTML = '<i class="fas fa-tools"></i> Додати запис';
        form.reset();
        modal.style.display = 'flex';
        modal.style.animation = 'scaleUp 0.5s ease';
    });

    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        modal.style.animation = '';
        form.reset();
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            modal.style.animation = '';
            form.reset();
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (userRole !== 'admin' && userRole !== 'manager') {
            showToast('Немає прав', true);
            return;
        }

        const record = {
            date: form.date.value,
            type: form.type.value,
            description: form.description.value.trim(),
            responsible: form.responsible.value.trim(),
        };

        if (!record.date || !record.type || !record.description || !record.responsible) {
            showToast('Будь ласка, заповніть усі поля!', true);
            return;
        }

        try {
            const url = editId ? `/api/maintenance/history/${editId}` : '/api/maintenance/history';
            const method = editId ? 'PUT' : 'POST';
            const response = await fetch(url, {
                method,
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(record),
            });

            if (!response.ok) {
                if (response.status === 401) {
                    window.location.href = '/profile.html?authRequired=true';
                    return;
                }
                const errorData = await response.json();
                throw new Error(errorData.error || 'Помилка при створенні/оновленні запису');
            }

            showToast(editId ? 'Запис успішно оновлено!' : 'Запис успішно додано!');
            modal.style.display = 'none';
            modal.style.animation = '';
            form.reset();
            await loadRecords({ date: dateFilter.value, type: typeFilter.value });
        } catch (error) {
            console.error('Помилка при створенні/оновленні запису:', error.message);
            showToast(`Помилка: ${error.message}`, true);
        }
    });

    dateFilter.addEventListener('change', () => {
        const filters = {};
        if (dateFilter.value) filters.date = dateFilter.value;
        if (typeFilter.value) filters.type = typeFilter.value;
        loadRecords(filters);
    });

    typeFilter.addEventListener('change', () => {
        const filters = {};
        if (dateFilter.value) filters.date = dateFilter.value;
        if (typeFilter.value) filters.type = typeFilter.value;
        loadRecords(filters);
    });

    checkAuth().then(() => loadRecords());
});