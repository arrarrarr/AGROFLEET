// Файл: public/notifications.js (Фронтенд - клиентская часть)

// Функция для отображения модального окна
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
}

// Функция для отображения уведомлений (всплывающих сообщений)
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Функция для загрузки уведомлений
async function loadNotifications() {
    const notificationsList = document.getElementById('notificationsList');
    const messageIconNav = document.getElementById('messageIconNav');
    const notificationBadgeNav = document.getElementById('notificationBadgeNav');
    const messageIconProfile = document.getElementById('messageIconProfile');
    const notificationBadgeProfile = document.getElementById('notificationBadgeProfile');

    if (!notificationsList) {
        console.warn('Элемент с id="notificationsList" не найден');
        return;
    }

    notificationsList.innerHTML = '<p>Завантаження сповіщень...</p>';

    try {
        const userResponse = await fetch('http://localhost:3000/api/auth/check-auth', {
            method: 'GET',
            credentials: 'include'
        });
        if (!userResponse.ok) {
            console.error('Помилка при перевірці авторизації:', userResponse.status);
            throw new Error('Не авторизований');
        }
        const userData = await userResponse.json();
        console.log('Поточний користувач:', userData);

        if (userData.role === 'unauthorized') {
            console.log('Користувач не авторизований при завантаженні сповіщень, відкриваємо authModal');
            showModal('authModal');
            notificationsList.innerHTML = '<p>Будь ласка, увійдіть, щоб переглянути сповіщення.</p>';
            updateMessageIcons(messageIconNav, notificationBadgeNav, messageIconProfile, notificationBadgeProfile, false, 0);
            return;
        }

        const userRole = userData.role;
        const userId = userData.id;

        if (!userRole || (userRole !== 'manager' && userRole !== 'admin' && userRole !== 'user')) {
            notificationsList.innerHTML = '<p>Сповіщення доступні лише для користувачів, менеджерів та адміністраторів.</p>';
            updateMessageIcons(messageIconNav, notificationBadgeNav, messageIconProfile, notificationBadgeProfile, false, 0);
            return;
        }

        const response = await fetch('http://localhost:3000/api/notifications', {
            method: 'GET',
            credentials: 'include'
        });
        console.log('Ответ от /api/notifications:', response.status, response.statusText);
        if (!response.ok) {
            const error = await response.json();
            console.log('Помилка завантаження сповіщень:', error);
            notificationsList.innerHTML = `<p>Помилка завантаження сповіщень: ${error.error || 'Невідома помилка'}</p>`;
            throw new Error(error.error || 'Помилка завантаження сповіщень');
        }
        const data = await response.json();
        console.log('Отримані сповіщення:', data);

        let notifications = Array.isArray(data) ? data : data.notifications || [];
        console.log('Полученные уведомления (до фильтрации):', notifications);

        if (userRole === 'user') {
            notifications = notifications.filter(notification => notification.userId === userId);
        }

        const uniqueNotifications = [];
        const seenOrders = new Set();
        for (const notification of notifications) {
            if (!seenOrders.has(notification.relatedId)) {
                seenOrders.add(notification.relatedId);
                uniqueNotifications.push(notification);
            }
        }
        notifications = uniqueNotifications;
        console.log('Полученные уведомления (после уникализации):', notifications);

        notifications.sort((a, b) => {
            const dateA = new Date(a.created_at);
            const dateB = new Date(b.created_at);
            return dateB - dateA;
        });

        console.log('Полученные уведомления (после сортировки):', notifications);

        if (notifications.length === 0) {
            notificationsList.innerHTML = '<p>Немає сповіщень.</p>';
            updateMessageIcons(messageIconNav, notificationBadgeNav, messageIconProfile, notificationBadgeProfile, false, 0);
        } else {
            notificationsList.innerHTML = `
                <div class="notification-block">
                    <h3>Список сповіщень</h3>
                    ${notifications.map(notification => {
                        const createdAt = notification.created_at ? new Date(notification.created_at + 'Z') : null;
                        const formattedDate = createdAt && !isNaN(createdAt) ? createdAt.toLocaleDateString('uk-UA') : 'Дата не вказана';
                        const orderNumber = notification.relatedId || 'невідомий';
                        const userName = notification.user?.fullName || 'Невідомий користувач';
                        const totalAmount = notification.order && notification.order.totalAmount != null ? notification.order.totalAmount.toLocaleString('uk-UA') : '0';
                        const email = notification.user?.email || 'невідомий';
                        const phone = notification.user?.phone || 'невідомий';
                        const address = notification.user?.address || 'невідома';
                        const city = notification.user?.city || 'невідоме';
                        const rentalStart = notification.order && notification.order.rentalStart ? new Date(notification.order.rentalStart).toLocaleDateString('uk-UA') : 'невідомо';
                        const rentalEnd = notification.order && notification.order.rentalEnd ? new Date(notification.order.rentalEnd).toLocaleDateString('uk-UA') : 'невідомо';

                        let items = [];
                        if (notification.order && notification.order.items) {
                            if (typeof notification.order.items === 'string') {
                                try {
                                    items = JSON.parse(notification.order.items);
                                } catch (err) {
                                    console.error(`Ошибка парсинга items для уведомления ${notification.id}:`, err.message);
                                    items = [];
                                }
                            } else if (Array.isArray(notification.order.items)) {
                                items = notification.order.items;
                            }
                        }
                        const equipment = items.length > 0 ? items.map(item => `${item.name} (Кількість: ${item.quantity})`).join(', ') : 'Техніка не вказана';

                        console.log(`Уведомление ${notification.id}:`, { city, address });

                        if (userRole === 'user') {
                            return `
                                <div class="notification-item">
                                    <div class="notification-content">
                                        <p>Ваше замовлення №${orderNumber} очікує на підтвердження менеджера.</p>
                                        <p>Техніка: ${equipment}.</p>
                                        <p>Період оренди: ${rentalStart} – ${rentalEnd}.</p>
                                        <p>Дата доставки: ${rentalStart}.</p>
                                        <p>Місто: ${city}.</p>
                                        <p>Адреса: ${address}.</p>
                                        <p>Заявлена сута: ${totalAmount} грн.</p>
                                    </div>
                                    <div class="notification-actions">
                                        <button class="action-button cancel-button" data-order-id="${notification.relatedId || ''}" onclick="cancelOrder(${notification.id}, '${notification.relatedId || ''}')">Скасувати замовлення</button>
                                    </div>
                                </div>
                            `;
                        } else {
                            return `
                                <div class="notification-item">
                                    <div class="notification-content">
                                        <p>Нове замовлення №${orderNumber} для користувача ${userName}.</p>
                                        <p>Дата створення: ${formattedDate}.</p>
                                        <p>Техніка: ${equipment}.</p>
                                        <p>Період оренди: ${rentalStart} – ${rentalEnd}.</p>
                                        <p>Дата доставки: ${rentalStart}.</p>
                                        <p>Email користувача: ${email}.</p>
                                        <p>Телефон користувача: ${phone}.</p>
                                        <p>Місто: ${city}.</p>
                                        <p>Адреса доставки: ${address}.</p>
                                        <p>Заявлена сута: ${totalAmount} грн.</p>
                                    </div>
                                    <div class="notification-actions">
                                        <button class="action-button confirm-button" data-order-id="${notification.relatedId || ''}" onclick="confirmOrder(${notification.id}, '${notification.relatedId || ''}')">Підтвердити</button>
                                        <button class="action-button decline-button" data-order-id="${notification.relatedId || ''}" onclick="declineOrder(${notification.id}, '${notification.relatedId || ''}')">Відмовити</button>
                                    </div>
                                </div>
                            `;
                        }
                    }).join('')}
                </div>
            `;
            updateMessageIcons(messageIconNav, notificationBadgeNav, messageIconProfile, notificationBadgeProfile, true, notifications.length);
        }
    } catch (err) {
        console.error('Помилка завантаження сповіщень:', err);
        notificationsList.innerHTML = '<p>Помилка завантаження сповіщень.</p>';
        updateMessageIcons(messageIconNav, notificationBadgeNav, messageIconProfile, notificationBadgeProfile, false, 0);
    }
}

// Вспомогательная функция для обновления иконок сообщений
function updateMessageIcons(messageIconNav, notificationBadgeNav, messageIconProfile, notificationBadgeProfile, hasNotifications, count) {
    if (hasNotifications) {
        if (messageIconNav) {
            messageIconNav.classList.remove('fa-envelope-open');
            messageIconNav.classList.add('fa-envelope', 'active');
        }
        if (notificationBadgeNav) {
            notificationBadgeNav.style.display = 'flex';
            notificationBadgeNav.textContent = count;
        }
        if (messageIconProfile) {
            messageIconProfile.classList.remove('fa-envelope-open');
            messageIconProfile.classList.add('fa-envelope', 'active');
        }
        if (notificationBadgeProfile) {
            notificationBadgeProfile.style.display = 'flex';
            notificationBadgeProfile.textContent = count;
        }
    } else {
        if (messageIconNav) {
            messageIconNav.classList.remove('fa-envelope', 'active');
            messageIconNav.classList.add('fa-envelope-open');
        }
        if (notificationBadgeNav) {
            notificationBadgeNav.style.display = 'none';
            notificationBadgeNav.textContent = '0';
        }
        if (messageIconProfile) {
            messageIconProfile.classList.remove('fa-envelope', 'active');
            messageIconProfile.classList.add('fa-envelope-open');
        }
        if (notificationBadgeProfile) {
            notificationBadgeProfile.style.display = 'none';
            notificationBadgeProfile.textContent = '0';
        }
    }
}

// Функция для пометки уведомлений как прочитанных
async function markNotificationsAsRead() {
    try {
        const response = await fetch('http://localhost:3000/api/notifications/mark-read', {
            method: 'PUT',
            credentials: 'include'
        });
        if (!response.ok) {
            const error = await response.json();
            console.log('Помилка при позначенні сповіщень як прочитаних:', error);
            throw new Error(error.error || 'Помилка при позначенні сповіщень');
        }
        console.log('Сповіщення позначені як прочитані');
        loadNotifications();
    } catch (error) {
        console.error('Помилка:', error);
        showNotification('Сталася помилка при позначенні сповіщень.');
    }
}

// Функция для подтверждения заказа
window.confirmOrder = async (notificationId, relatedId) => {
    if (!relatedId) {
        showNotification('Помилка: ID замовлення не вказано.');
        return;
    }

    try {
        // Отправляем запрос на сервер для подтверждения заказа и сохранения данных для договора
        const response = await fetch('http://localhost:3000/api/notifications/confirm-to-contract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notificationId }),
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            console.log('Помилка підтвердження замовлення:', error);
            throw new Error(error.error || 'Помилка підтвердження замовлення');
        }

        const responseData = await response.json();
        console.log('Ответ от /api/notifications/confirm-to-contract:', responseData);

        // Обновляем статус заказа
        const confirmOrderResponse = await fetch(`http://localhost:3000/api/orders/${relatedId}/confirm`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });

        if (!confirmOrderResponse.ok) {
            const error = await confirmOrderResponse.json();
            console.log('Помилка підтвердження замовлення:', error);
            throw new Error(error.error || 'Помилка підтвердження замовлення');
        }

        showNotification('Замовлення успішно підтверджено! Переходимо до створення договору.');

        // Перенаправляем на страницу управления договорами
        window.location.href = '/contract_management.html?autoOpenModal=true';
    } catch (error) {
        console.error('Помилка:', error);
        showNotification('Сталася помилка при підтвердженні замовлення.');
    }
};

// Функция для отклонения заказа
window.declineOrder = async (notificationId, relatedId) => {
    if (!relatedId) {
        showNotification('Помилка: ID замовлення не вказано.');
        return;
    }

    try {
        const response = await fetch(`http://localhost:3000/api/orders/${relatedId}/decline`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        console.log(`Ответ от /api/orders/${relatedId}/decline:`, response.status, response.statusText);
        if (!response.ok) {
            const error = await response.json();
            console.log('Помилка відхилення замовлення:', error);
            throw new Error(error.error || 'Помилка відхилення замовлення');
        }

        // Удаляем уведомление
        await deleteNotification(notificationId);
        showNotification('Замовлення відхилено.');
        loadNotifications(); // Обновляем список уведомлений
    } catch (error) {
        console.error('Помилка:', error);
        showNotification('Сталася помилка при відхиленні замовлення.');
    }
};

// Функция для отмены заказа пользователем
window.cancelOrder = async (notificationId, relatedId) => {
    if (!relatedId) {
        showNotification('Помилка: ID замовлення не вказано.');
        return;
    }

    try {
        const response = await fetch(`http://localhost:3000/api/orders/${relatedId}/cancel`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        console.log(`Ответ от /api/orders/${relatedId}/cancel:`, response.status, response.statusText);
        if (!response.ok) {
            const error = await response.json();
            console.log('Помилка скасування замовлення:', error);
            throw new Error(error.error || 'Помилка скасування замовлення');
        }

        // Удаляем уведомление
        await deleteNotification(notificationId);
        showNotification('Замовлення успішно скасовано.');
        loadNotifications(); // Обновляем список уведомлений
    } catch (error) {
        console.error('Помилка:', error);
        showNotification('Сталася помилка при скасуванні замовлення.');
    }
};

// Удаление уведомления
async function deleteNotification(notificationId) {
    try {
        const response = await fetch(`http://localhost:3000/api/notifications/${notificationId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        console.log(`Ответ от /api/notifications/${notificationId}:`, response.status, response.statusText);
        if (!response.ok) {
            const error = await response.json();
            console.log('Помилка видалення сповіщення:', error);
            throw new Error(error.error || 'Помилка видалення сповіщення');
        }

        loadNotifications();
    } catch (error) {
        console.error('Помилка:', error);
        showNotification('Сталася помилка при видаленні сповіщення.');
    }
}

// Инициализация уведомлений при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const messageIconNav = document.getElementById('messageIconNav');
    if (messageIconNav) {
        messageIconNav.addEventListener('click', () => {
            showModal('notificationsModal');
            loadNotifications();
        });
    }

    document.addEventListener('click', (event) => {
        if (event.target.id === 'messageIconProfile') {
            showModal('notificationsModal');
            loadNotifications();
        }
    });

    // Автоматическая загрузка уведомлений для обновления иконок
    loadNotifications();
});