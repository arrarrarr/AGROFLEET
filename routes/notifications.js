// Файл: routes/notifications.js (API - серверная часть)

import express from 'express';

const router = express.Router();

// Middleware для проверки авторизации
const authenticate = (req, res, next) => {
    console.log('Middleware authenticate: Session ID:', req.sessionID, 'User ID:', req.session?.userId, 'Cookies:', req.headers.cookie);
    if (!req.session?.userId) {
        console.log('Unauthorized request. Session ID:', req.sessionID, 'User ID:', req.session?.userId);
        return res.status(401).json({ error: 'Не авторизовано' });
    }
    if (!req.db) {
        console.error('Database not initialized in request');
        return res.status(503).json({ error: 'Сервер еще инициализируется, пожалуйста, подождите...' });
    }
    next();
};

// Получение списка сповіщень користувача
router.get('/', authenticate, async (req, res) => {
    const db = req.db;
    const userId = req.session.userId;

    try {
        const notifications = await db.all(
            `SELECT * FROM notifications WHERE userId = ? ORDER BY created_at DESC`,
            [userId]
        );
        console.log(`Notifications fetched for user ${userId}:`, notifications);

        const notificationsWithUsers = await Promise.all(
            notifications.map(async (notification) => {
                let user = null;
                let orderUser = null;

                if (notification.relatedId) {
                    const order = await db.get(
                        `SELECT * FROM orders WHERE id = ?`,
                        [notification.relatedId]
                    );
                    console.log(`Order data for relatedId ${notification.relatedId}:`, order);
                    if (order) {
                        if (order.items && typeof order.items === 'string') {
                            try {
                                order.items = JSON.parse(order.items);
                            } catch (err) {
                                console.error(`Ошибка парсинга items для заказа ${order.id}:`, err.message);
                                order.items = [];
                            }
                        } else if (!Array.isArray(order.items)) {
                            order.items = [];
                        }

                        if (order.user) {
                            console.log(`Парсим order.user для заказа ${order.id}:`, order.user);
                            try {
                                orderUser = typeof order.user === 'string' ? JSON.parse(order.user) : order.user;
                                console.log(`Успешно распарсенный orderUser:`, orderUser);
                            } catch (err) {
                                console.error(`Ошибка парсинга user для заказа ${order.id}:`, err.message);
                                orderUser = null;
                            }
                        } else {
                            console.log(`order.user отсутствует для заказа ${order.id}`);
                        }

                        if (order.userId) {
                            user = await db.get(
                                `SELECT id, fullName, phone, email, username, city, address FROM users WHERE id = ?`,
                                [order.userId]
                            );
                            console.log(`User data for userId ${order.userId}:`, user);
                        }

                        notification.order = order;
                    } else {
                        notification.order = null;
                    }
                } else {
                    notification.order = null;
                }

                notification.user = {
                    id: user?.id || null,
                    fullName: user?.fullName || 'Невідомий користувач',
                    email: user?.email || 'невідомий',
                    phone: user?.phone || 'невідомий',
                    username: user?.username || 'невідомий',
                    city: orderUser?.city || user?.city || 'невідоме',
                    address: orderUser?.address || user?.address || 'невідома',
                };

                console.log(`Итоговый notification.user для уведомления ${notification.id}:`, notification.user);

                return notification;
            })
        );

        console.log(`GET /api/notifications: Сповіщення для користувача ${userId}:`, notificationsWithUsers);
        res.json(notificationsWithUsers);
    } catch (err) {
        console.error('Помилка при отриманні сповіщень:', err.message);
        res.status(500).json({ error: 'Помилка сервера при отриманні сповіщень.' });
    }
});

// Новый эндпоинт: Получение количества непрочитанных уведомлений
router.get('/unread-count', authenticate, async (req, res) => {
    const db = req.db;
    const userId = req.session.userId;

    try {
        const unreadCount = await db.get(
            `SELECT COUNT(*) as count FROM notifications WHERE userId = ? AND isRead = 0`,
            [userId]
        );
        console.log(`GET /api/notifications/unread-count: Количество непрочитанных уведомлений для пользователя ${userId}:`, unreadCount.count);

        res.json({ unreadCount: unreadCount.count });
    } catch (err) {
        console.error('Ошибка при получении количества непрочитанных уведомлений:', err.message);
        res.status(500).json({ error: 'Ошибка сервера при получении количества непрочитанных уведомлений.' });
    }
});

// Позначення всех сповіщень як прочитаних
router.put('/mark-read', authenticate, async (req, res) => {
    const db = req.db;
    const userId = req.session.userId;

    try {
        const result = await db.run(
            `UPDATE notifications SET isRead = 1 WHERE userId = ? AND isRead = 0`,
            [userId]
        );
        console.log(`PUT /api/notifications/mark-read: Усі сповіщення позначені як прочитані для користувача ${userId}. Changes:`, result.changes);

        res.json({ message: 'Усі сповіщення позначені як прочитані.' });
    } catch (err) {
        console.error('Помилка при позначенні всех сповіщень як прочитаних:', err.message);
        res.status(500).json({ error: 'Помилка сервера при позначенні сповіщень.' });
    }
});

// Позначення одного сповіщення як прочитаного
router.put('/:id/read', authenticate, async (req, res) => {
    const db = req.db;
    const userId = req.session.userId;
    const { id } = req.params;

    try {
        const notification = await db.get(
            `SELECT * FROM notifications WHERE id = ? AND userId = ?`,
            [id, userId]
        );

        if (!notification) {
            console.log(`PUT /api/notifications/${id}/read: Сповіщення з ID ${id} не знайдено для користувача ${userId}.`);
            return res.status(404).json({ error: 'Сповіщення не знайдено.' });
        }

        const result = await db.run(
            `UPDATE notifications SET isRead = 1 WHERE id = ?`,
            [id]
        );
        console.log(`PUT /api/notifications/${id}/read: Сповіщення з ID ${id} позначено як прочитане для користувача ${userId}. Changes:`, result.changes);

        res.json({ message: 'Сповіщення позначено як прочитане.' });
    } catch (err) {
        console.error('Помилка при позначенні сповіщення як прочитаного:', err.message);
        res.status(500).json({ error: 'Помилка сервера при позначенні сповіщення.' });
    }
});

// Видалення сповіщення
router.delete('/:id', authenticate, async (req, res) => {
    const db = req.db;
    const userId = req.session.userId;
    const { id } = req.params;

    try {
        const notification = await db.get(
            `SELECT * FROM notifications WHERE id = ? AND userId = ?`,
            [id, userId]
        );

        if (!notification) {
            console.log(`DELETE /api/notifications/${id}: Сповіщення з ID ${id} не знайдено для користувача ${userId}.`);
            return res.status(404).json({ error: 'Сповіщення не знайдено.' });
        }

        const result = await db.run(
            `DELETE FROM notifications WHERE id = ?`,
            [id]
        );
        console.log(`DELETE /api/notifications/${id}: Сповіщення з ID ${id} видалено для користувача ${userId}. Changes:`, result.changes);

        res.json({ message: 'Сповіщення видалено.' });
    } catch (err) {
        console.error('Помилка при видаленні сповіщення:', err.message);
        res.status(500).json({ error: 'Помилка сервера при видаленні сповіщення.' });
    }
});

// Очистка всех уведомлений пользователя
router.delete('/clear-all', authenticate, async (req, res) => {
    const db = req.db;
    const userId = req.session.userId;

    try {
        const result = await db.run(`DELETE FROM notifications WHERE userId = ?`, [userId]);
        console.log(`DELETE /api/notifications/clear-all: Усі сповіщення видалено для користувача ${userId}. Changes:`, result.changes);

        res.json({ message: 'Усі сповіщення видалено.' });
    } catch (err) {
        console.error('Помилка при очищенні сповіщень:', err.message);
        res.status(500).json({ error: 'Помилка сервера при очищенні сповіщень.' });
    }
});

// Новый эндпоинт: Сохранение данных уведомления для создания договора
router.post('/confirm-to-contract', authenticate, async (req, res) => {
    const db = req.db;
    const userId = req.session.userId; // ID текущего пользователя (того, кто подтверждает аренду)
    const { notificationId } = req.body;

    try {
        // Находим уведомление
        const notification = await db.get(
            `SELECT * FROM notifications WHERE id = ? AND userId = ?`,
            [notificationId, userId]
        );

        if (!notification) {
            console.log(`POST /api/notifications/confirm-to-contract: Сповіщення з ID ${notificationId} не знайдено для користувача ${userId}.`);
            return res.status(404).json({ error: 'Сповіщення не знайдено.' });
        }

        // Подтягиваем данные текущего пользователя (того, кто подтверждает аренду)
        const currentUser = await db.get(
            `SELECT fullName FROM users WHERE id = ?`,
            [userId]
        );

        if (!currentUser) {
            console.log(`POST /api/notifications/confirm-to-contract: Користувач з ID ${userId} не знайдений.`);
            return res.status(404).json({ error: 'Користувач не знайдений.' });
        }

        // Подтягиваем данные заказа
        let order = null;
        let user = null;
        let orderUser = null;

        if (notification.relatedId) {
            order = await db.get(
                `SELECT * FROM orders WHERE id = ?`,
                [notification.relatedId]
            );
            if (order) {
                // Парсим поле items
                if (order.items && typeof order.items === 'string') {
                    try {
                        order.items = JSON.parse(order.items);
                    } catch (err) {
                        console.error(`Ошибка парсинга items для заказа ${order.id}:`, err.message);
                        order.items = [];
                    }
                } else if (!Array.isArray(order.items)) {
                    order.items = [];
                }

                // Парсим поле user из заказа
                if (order.user) {
                    try {
                        orderUser = typeof order.user === 'string' ? JSON.parse(order.user) : order.user;
                    } catch (err) {
                        console.error(`Ошибка парсинга user для заказа ${order.id}:`, err.message);
                        orderUser = null;
                    }
                }

                // Подтягиваем данные пользователя из таблицы users
                if (order.userId) {
                    user = await db.get(
                        `SELECT id, fullName, phone, email, username, city, address FROM users WHERE id = ?`,
                        [order.userId]
                    );
                }
            }
        }

        // Формируем данные для договора
        const contractData = {
            userId: order?.userId || null, // Додаємо userId до contractData
            number: `ORDER-${notification.relatedId}`,
            name: `Договір для замовлення #${notification.relatedId}`,
            party: user?.fullName || 'Невідомий користувач',
            date: order?.rentalStart ? new Date(order.rentalStart).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            endDate: order?.rentalEnd ? new Date(order.rentalEnd).toISOString().split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            amount: order?.totalAmount || 0,
            status: 'active',
            equipmentType: order?.items?.map(item => item.name).join(', ') || 'Невідома техніка',
            region: orderUser?.city || user?.city || 'Невідомий регіон',
            notes: `Замовлення #${notification.relatedId}`,
            paymentTerms: 'Оплата протягом 10 діб',
            deliveryTerms: `Доставка до ${orderUser?.address || user?.address || 'невідомої адреси'}`,
            contractDuration: order?.rentalStart && order?.rentalEnd ? `${Math.ceil((new Date(order.rentalEnd) - new Date(order.rentalStart)) / (1000 * 60 * 60 * 24)) + 1} днів` : '30 днів',
            responsiblePerson: currentUser.fullName || 'Невідомий' // Используем имя текущего пользователя
        };

        // Сохраняем данные в сессии вместе с notificationId
        req.session.pendingContractData = {
            ...contractData,
            notificationId // Сохраняем ID уведомления в сессии
        };
        console.log(`POST /api/notifications/confirm-to-contract: Данные сохранены в сессии для пользователя ${userId}:`, req.session.pendingContractData);

        res.json({ message: 'Дані збережено, перенаправлення на створення договору.' });
    } catch (err) {
        console.error('Помилка при обробці сповіщення для створення договору:', err.message);
        res.status(500).json({ error: 'Помилка сервера при обробці сповіщення.' });
    }
});

// Новый эндпоинт: Получение данных для автозаполнения формы договора
router.get('/pending-contract', authenticate, async (req, res) => {
    try {
        const contractData = req.session.pendingContractData || null;
        if (!contractData) {
            console.log(`GET /api/notifications/pending-contract: Дані для створення договору відсутні в сесії для користувача ${req.session.userId}.`);
            return res.status(404).json({ error: 'Дані для створення договору не знайдено.' });
        }

        console.log(`GET /api/notifications/pending-contract: Дані для створення договору повернуто для користувача ${req.session.userId}:`, contractData);

        res.json(contractData);
    } catch (err) {
        console.error('Помилка при отриманні даних для створення договору:', err.message);
        res.status(500).json({ error: 'Помилка сервера при отриманні даних.' });
    }
});

export default router;