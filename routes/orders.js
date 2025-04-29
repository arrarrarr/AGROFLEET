// Файл: orders.js

import express from 'express';

const router = express.Router();

export default function createOrdersRouter(sendOrderToManager) {
    // Middleware для проверки авторизации
    const authenticate = (req, res, next) => {
        if (!req.session || !req.session.userId) {
            console.log('Неавторизований запит до /api/orders:', req.url);
            return res.status(401).json({ error: 'Не авторизовано' });
        }
        next();
    };

    // Создание заказа
    router.post('/', authenticate, async (req, res) => {
        try {
            console.log('POST /api/orders: Начало обработки запроса', {
                userId: req.session.userId,
                timestamp: new Date().toISOString(),
                body: req.body
            });

            const { items, status, rentalStart, rentalEnd, deliveryDate, totalAmount, user } = req.body;

            // Валидация данных
            if (!items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ error: 'Список техніки не може бути порожнім' });
            }
            if (!status || !rentalStart || !rentalEnd || !deliveryDate || !totalAmount || !user) {
                return res.status(400).json({ error: 'Необхідно заповнити усі поля' });
            }
            if (!user.fullName || !user.email || !user.phone || !user.city || !user.address) {
                return res.status(400).json({ error: 'Усі поля користувача (ПІБ, email, телефон, місто, адреса) обов’язкові' });
            }

            // Получаем данные пользователя из базы данных
            const orderingUser = await req.db.get('SELECT * FROM users WHERE id = ?', [req.session.userId]);
            if (!orderingUser) {
                throw new Error('Користувач, який зробив замовлення, не знайдений');
            }

            // Формируем объект пользователя
            const orderUser = {
                fullName: user.fullName,
                email: user.email,
                phone: user.phone,
                city: user.city,
                address: user.address,
                id: orderingUser.id,
            };

            // Проверяем, существует ли заказ с такими же данными
            const existingOrder = await req.db.get(
                `SELECT id FROM orders WHERE userId = ? AND items = ? AND rentalStart = ? AND rentalEnd = ? AND deliveryDate = ? AND status = 'pending'`,
                [req.session.userId, JSON.stringify(items), rentalStart, rentalEnd, deliveryDate]
            );

            if (existingOrder) {
                console.log(`Заказ с такими данными уже существует: orderId=${existingOrder.id}`);
                return res.status(400).json({ error: 'Замовлення з такими даними вже існує', orderId: existingOrder.id });
            }

            // Сохраняем заказ в базе данных
            const result = await req.db.run(
                `INSERT INTO orders (userId, items, status, rentalStart, rentalEnd, deliveryDate, totalAmount, user, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    req.session.userId,
                    JSON.stringify(items),
                    status,
                    rentalStart,
                    rentalEnd,
                    deliveryDate,
                    totalAmount,
                    JSON.stringify(orderUser),
                    `Замовлення від ${orderUser.fullName} (${orderUser.email})`
                ]
            );

            const orderId = result.lastID;
            console.log('Новый заказ создан:', { orderId, userId: req.session.userId, user: JSON.stringify(orderUser) });

            // Находим всех менеджеров и админов, исключая дубликаты
            const managers = await req.db.all('SELECT DISTINCT * FROM users WHERE role = ? OR role = ?', ['manager', 'admin']);
            if (managers.length === 0) {
                console.warn('Менеджери не знайдені для сповіщення');
            }

            // Создаём уведомления для всех менеджеров, кроме самого пользователя
            for (const manager of managers) {
                if (manager.id === req.session.userId) {
                    console.log(`Пропускаємо створення сповіщення для менеджера ${manager.fullName}, оскільки він є замовником`);
                    continue;
                }

                let message = `Нове замовлення №${orderId} для користувача ${orderUser.fullName}: ${items.map(item => `${item.name} (Кількість: ${item.quantity})`).join(', ')}. Період оренди: ${rentalStart} - ${rentalEnd}. Дата доставки: ${deliveryDate}. Загальна сума: ${totalAmount} грн. Email користувача: ${orderUser.email}. Телефон користувача: ${orderUser.phone}.`;

                if (orderUser.city && orderUser.city !== 'невідоме') {
                    message += ` Місто користувача: ${orderUser.city}.`;
                }
                if (orderUser.address && orderUser.address !== 'невідома') {
                    message += ` Адреса користувача: ${orderUser.address}.`;
                }

                // Проверяем, существует ли такое уведомление
                const existingNotification = await req.db.get(
                    `SELECT id FROM notifications WHERE userId = ? AND message = ? AND relatedId = ?`,
                    [manager.id, message, orderId]
                );

                if (!existingNotification) {
                    await req.db.run(
                        `INSERT INTO notifications (userId, message, icon, relatedId, isRead) VALUES (?, ?, ?, ?, ?)`,
                        [manager.id, message, 'fas fa-shopping-cart', orderId, 0]
                    );
                    console.log(`Сповіщення створено для менеджера ${manager.fullName}: ${message}`);
                } else {
                    console.log(`Сповіщення для менеджера ${manager.fullName} вже існує, пропускаємо`);
                }

                // Отправляем email менеджеру
                try {
                    await sendOrderToManager({
                        managerEmail: manager.email,
                        orderId,
                        userFullName: orderUser.fullName,
                        userEmail: orderUser.email,
                        userPhone: orderUser.phone,
                        userCity: orderUser.city,
                        userAddress: orderUser.address,
                        items: items.map(item => `${item.name} (Кількість: ${item.quantity})`).join(', '),
                        rentalStart,
                        rentalEnd,
                        deliveryDate,
                        totalAmount
                    });
                    console.log(`Email надіслано менеджеру ${manager.fullName} (${manager.email})`);
                } catch (emailError) {
                    console.error(`Помилка при відправці email менеджеру ${manager.fullName}:`, emailError.message);
                }
            }

            // Создаём уведомление для пользователя
            let userMessage = `Ваше замовлення №${orderId} очікує на підтвердження менеджера. Техніка: ${items.map(item => `${item.name} (Кількість: ${item.quantity})`).join(', ')}. Період оренди: ${rentalStart} - ${rentalEnd}. Дата доставки: ${deliveryDate}. Загальна сума: ${totalAmount} грн.`;
            if (orderUser.city && orderUser.city !== 'невідоме') {
                userMessage += ` Місто: ${orderUser.city}.`;
            }
            if (orderUser.address && orderUser.address !== 'невідома') {
                userMessage += ` Адреса: ${orderUser.address}.`;
            }

            // Проверяем, существует ли такое уведомление для пользователя
            const existingUserNotification = await req.db.get(
                `SELECT id FROM notifications WHERE userId = ? AND message = ? AND relatedId = ?`,
                [req.session.userId, userMessage, orderId]
            );

            if (!existingUserNotification) {
                await req.db.run(
                    `INSERT INTO notifications (userId, message, icon, relatedId, isRead) VALUES (?, ?, ?, ?, ?)`,
                    [req.session.userId, userMessage, 'fas fa-shopping-cart', orderId, 0]
                );
                console.log(`Сповіщення створено для користувача ${orderUser.fullName}: ${userMessage}`);
            } else {
                console.log(`Сповіщення для користувача ${orderUser.fullName} вже існує, пропускаємо`);
            }

            res.status(201).json({ orderId });
        } catch (error) {
            console.error('Ошибка при создании заказа:', error);
            res.status(500).json({ error: 'Помилка при створенні замовлення' });
        }
    });

    // Получение заказов текущего пользователя
    router.get('/', authenticate, async (req, res) => {
        try {
            const orders = await req.db.all(
                `SELECT * FROM orders WHERE userId = ?`,
                [req.session.userId]
            );
            res.status(200).json(orders.map(order => ({
                ...order,
                items: JSON.parse(order.items),
                user: order.user ? JSON.parse(order.user) : null
            })));
        } catch (error) {
            console.error('Ошибка при получении заказов:', error);
            res.status(500).json({ error: 'Помилка при отриманні замовлень' });
        }
    });

    // Получение всех заказов (для менеджера)
    router.get('/all', authenticate, async (req, res) => {
        try {
            const user = await req.db.get('SELECT role FROM users WHERE id = ?', [req.session.userId]);
            if (!user) {
                return res.status(404).json({ error: 'Користувач не знайдений' });
            }

            if (user.role !== 'admin' && user.role !== 'manager') {
                return res.status(403).json({ error: 'Доступ заборонено: потрібна роль менеджера або адміністратора' });
            }

            const orders = await req.db.all(`SELECT * FROM orders`);
            res.status(200).json(orders.map(order => ({
                ...order,
                items: JSON.parse(order.items),
                user: order.user ? JSON.parse(order.user) : null
            })));
        } catch (error) {
            console.error('Ошибка при получении всех заказов:', error);
            res.status(500).json({ error: 'Помилка при отриманні всіх замовлень' });
        }
    });

    // Подтверждение заказа
    router.put('/:id/confirm', authenticate, async (req, res) => {
        try {
            const user = await req.db.get('SELECT role FROM users WHERE id = ?', [req.session.userId]);
            if (!user) {
                return res.status(404).json({ error: 'Користувач не знайдений' });
            }

            if (user.role !== 'admin' && user.role !== 'manager') {
                return res.status(403).json({ error: 'Доступ заборонено: потрібна роль менеджера або адміністратора' });
            }

            const orderId = req.params.id;
            const order = await req.db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
            if (!order) {
                return res.status(404).json({ error: 'Замовлення не знайдено' });
            }

            await req.db.run(
                `UPDATE orders SET status = ? WHERE id = ?`,
                ['confirmed', orderId]
            );

            // Удаляем уведомления, связанные с этим заказом
            await req.db.run(
                `DELETE FROM notifications WHERE relatedId = ?`,
                [orderId]
            );

            res.status(200).json({ message: 'Замовлення підтверджено' });
        } catch (error) {
            console.error('Ошибка при подтверждении заказа:', error);
            res.status(500).json({ error: 'Помилка при підтвердженні замовлення' });
        }
    });

    // Отклонение заказа
    router.put('/:id/decline', authenticate, async (req, res) => {
        try {
            const user = await req.db.get('SELECT role FROM users WHERE id = ?', [req.session.userId]);
            if (!user) {
                return res.status(404).json({ error: 'Користувач не знайдений' });
            }

            if (user.role !== 'admin' && user.role !== 'manager') {
                return res.status(403).json({ error: 'Доступ заборонено: потрібна роль менеджера або адміністратора' });
            }

            const orderId = req.params.id;
            const order = await req.db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
            if (!order) {
                return res.status(404).json({ error: 'Замовлення не знайдено' });
            }

            await req.db.run(
                `UPDATE orders SET status = ? WHERE id = ?`,
                ['declined', orderId]
            );

            // Удаляем уведомления, связанные с этим заказом
            await req.db.run(
                `DELETE FROM notifications WHERE relatedId = ?`,
                [orderId]
            );

            res.status(200).json({ message: 'Замовлення відхилено' });
        } catch (error) {
            console.error('Ошибка при отклонении заказа:', error);
            res.status(500).json({ error: 'Помилка при відхиленні замовлення' });
        }
    });

    // Отмена заказа пользователем
    router.put('/:id/cancel', authenticate, async (req, res) => {
        try {
            const orderId = req.params.id;
            const order = await req.db.get('SELECT * FROM orders WHERE id = ? AND userId = ?', [orderId, req.session.userId]);
            if (!order) {
                return res.status(404).json({ error: 'Замовлення не знайдено або ви не маєте права його скасувати' });
            }

            if (order.status !== 'pending') {
                return res.status(400).json({ error: 'Скасувати можна лише замовлення зі статусом "pending"' });
            }

            await req.db.run(
                `UPDATE orders SET status = ? WHERE id = ?`,
                ['canceled', orderId]
            );

            // Удаляем уведомления, связанные с этим заказом
            await req.db.run(
                `DELETE FROM notifications WHERE relatedId = ?`,
                [orderId]
            );

            res.status(200).json({ message: 'Замовлення скасовано' });
        } catch (error) {
            console.error('Ошибка при отмене заказа:', error);
            res.status(500).json({ error: 'Помилка при скасуванні замовлення' });
        }
    });

    return router;
}