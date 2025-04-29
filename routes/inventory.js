import express from 'express';

const router = express.Router();

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

const validateInventory = (item) => {
    const errors = [];
    if (!item.name || typeof item.name !== 'string' || !SPARE_PARTS[item.name]) {
        errors.push('Назва запаса повинна бути одним із визначених типів');
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 0) {
        errors.push('Кількість повинна бути невід’ємним цілим числом');
    }
    if (!item.responsible || typeof item.responsible !== 'string' || item.responsible.trim().length < 2) {
        errors.push('Відповідальна особа повинна бути рядком довжиною не менше 2 символів');
    }
    if (!item.update_date || !/^\d{4}-\d{2}-\d{2}$/.test(item.update_date)) {
        errors.push('Дата оновлення повинна бути у форматі YYYY-MM-DD');
    }
    if (item.notes && typeof item.notes !== 'string') {
        errors.push('Примітки повинні бути рядком');
    }
    return errors;
};

const checkPermissions = async (req, res, next) => {
    const userId = req.session.userId;
    if (!userId) {
        return res.status(401).json({ error: 'Необхідна авторизація' });
    }
    const user = await req.db.get('SELECT role FROM users WHERE id = ?', [userId]);
    if (!user) {
        return res.status(404).json({ error: 'Користувача не знайдено' });
    }
    req.userRole = user.role;
    req.currentUserId = userId;
    next();
};

const createLowStockNotification = async (db, item, userId) => {
    if (item.quantity <= item.min_level) {
        const message = `Низький рівень запасу: ${item.name}. Кількість: ${item.quantity}, Мінімальний рівень: ${item.min_level}`;
        await db.run(
            `INSERT INTO notifications (userId, message, type, relatedId, icon, isRead) VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, message, 'low_stock', item.id, 'fa-exclamation-triangle', 0]
        );
        console.log(`Створено повідомлення: ${message}`);
    }
};

const createExpenseFromInventory = async (db, item, userId) => {
    const pricePerUnit = SPARE_PARTS[item.name].price;
    const totalCost = item.quantity * pricePerUnit;

    // Всегда создаем новую запись в expenses без проверки существующих
    await db.run(
        `INSERT INTO expenses (user_id, name, quantity, price_per_unit, total_cost, date, responsible, notes, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, item.name, item.quantity, pricePerUnit, totalCost, item.update_date, item.responsible, item.notes || '', 'inventory']
    );
    console.log(`Створено запис витрат: ${item.name}, Кількість: ${item.quantity}, Загальна вартість: ${totalCost} грн`);
};

// GET /api/inventory - Отримання списку запасів
router.get('/', checkPermissions, async (req, res) => {
    try {
        const { name, date, page = 1, limit = 10, sortBy = 'update_date', sortOrder = 'DESC' } = req.query;
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM inventory WHERE 1=1';
        const params = [];

        if (name) {
            query += ' AND name = ?';
            params.push(name);
        }
        if (date) {
            query += ' AND update_date = ?';
            params.push(date);
        }

        if (req.userRole === 'user') {
            query += ' AND user_id = ?';
            params.push(req.currentUserId);
        }

        const validSortFields = ['name', 'quantity', 'update_date'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'update_date';
        const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${sortField} ${sortDirection}`;

        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const inventory = await req.db.all(query, params);

        const enrichedInventory = inventory.map(item => ({
            ...item,
            pricePerUnit: SPARE_PARTS[item.name].price
        }));

        let countQuery = 'SELECT COUNT(*) as total FROM inventory WHERE 1=1';
        const countParams = [];
        if (name) {
            countQuery += ' AND name = ?';
            countParams.push(name);
        }
        if (date) {
            countQuery += ' AND update_date = ?';
            countParams.push(date);
        }
        if (req.userRole === 'user') {
            countQuery += ' AND user_id = ?';
            countParams.push(req.currentUserId);
        }
        const { total } = await req.db.get(countQuery, countParams);

        res.json({
            data: enrichedInventory,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Помилка при отриманні списку запасів:', err.message);
        res.status(500).json({ error: 'Помилка сервера при отриманні списку запасів' });
    }
});

// POST /api/inventory - Створення нового запаса
router.post('/', checkPermissions, async (req, res) => {
    try {
        if (req.userRole !== 'admin' && req.userRole !== 'manager') {
            return res.status(403).json({ error: 'Недостатньо прав для створення запаса' });
        }

        const item = {
            name: req.body.name,
            quantity: parseInt(req.body.quantity),
            min_level: SPARE_PARTS[req.body.name]?.minLevel,
            responsible: req.body.responsible,
            update_date: req.body.update_date,
            notes: req.body.notes || ''
        };

        const errors = validateInventory(item);
        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }

        // Создаем запись в expenses
        await createExpenseFromInventory(req.db, item, req.currentUserId);

        // Создаем или обновляем запись в inventory
        const existingItem = await req.db.get(
            'SELECT * FROM inventory WHERE name = ? AND user_id = ?',
            [item.name, req.currentUserId]
        );

        let newItem;
        if (existingItem) {
            const newQuantity = existingItem.quantity + item.quantity;
            await req.db.run(
                `UPDATE inventory SET quantity = ?, responsible = ?, update_date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [newQuantity, item.responsible, item.update_date, item.notes, existingItem.id]
            );
            newItem = await req.db.get('SELECT * FROM inventory WHERE id = ?', [existingItem.id]);
        } else {
            const result = await req.db.run(
                `INSERT INTO inventory (user_id, name, quantity, min_level, responsible, update_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [req.currentUserId, item.name, item.quantity, item.min_level, item.responsible, item.update_date, item.notes]
            );
            newItem = await req.db.get('SELECT * FROM inventory WHERE id = ?', [result.lastID]);
        }

        await createLowStockNotification(req.db, newItem, req.currentUserId);
        newItem.pricePerUnit = SPARE_PARTS[newItem.name].price;

        res.status(201).json(newItem);
    } catch (err) {
        console.error('Помилка при створенні/оновленні запаса:', err.message);
        res.status(500).json({ error: 'Помилка сервера при створенні/оновленні запаса' });
    }
});

// PUT /api/inventory/:id - Оновлення запаса
router.put('/:id', checkPermissions, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existingItem = await req.db.get('SELECT * FROM inventory WHERE id = ?', [id]);
        if (!existingItem) {
            return res.status(404).json({ error: 'Запас не знайдено' });
        }

        if (req.userRole !== 'admin' && (req.userRole === 'manager' && existingItem.user_id !== req.currentUserId)) {
            return res.status(403).json({ error: 'Недостатньо прав для редагування цього запаса' });
        }

        const item = {
            name: req.body.name,
            quantity: parseInt(req.body.quantity),
            min_level: SPARE_PARTS[req.body.name]?.minLevel,
            responsible: req.body.responsible,
            update_date: req.body.update_date,
            notes: req.body.notes || ''
        };

        const errors = validateInventory(item);
        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }

        // Создаем новую запись в expenses вместо обновления
        await createExpenseFromInventory(req.db, item, req.currentUserId);

        // Обновляем запись в inventory
        const duplicateItem = await req.db.get(
            'SELECT * FROM inventory WHERE name = ? AND user_id = ? AND id != ?',
            [item.name, req.currentUserId, id]
        );

        let updatedItem;
        if (duplicateItem) {
            const newQuantity = duplicateItem.quantity + item.quantity;
            await req.db.run(
                `UPDATE inventory SET quantity = ?, responsible = ?, update_date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [newQuantity, item.responsible, item.update_date, item.notes, duplicateItem.id]
            );
            await req.db.run('DELETE FROM inventory WHERE id = ?', [id]);
            updatedItem = await req.db.get('SELECT * FROM inventory WHERE id = ?', [duplicateItem.id]);
        } else {
            await req.db.run(
                `UPDATE inventory SET name = ?, quantity = ?, min_level = ?, responsible = ?, update_date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [item.name, item.quantity, item.min_level, item.responsible, item.update_date, item.notes, id]
            );
            updatedItem = await req.db.get('SELECT * FROM inventory WHERE id = ?', [id]);
        }

        await createLowStockNotification(req.db, updatedItem, req.currentUserId);
        updatedItem.pricePerUnit = SPARE_PARTS[updatedItem.name].price;
        res.json(updatedItem);
    } catch (err) {
        console.error('Помилка при оновленні запаса:', err.message);
        res.status(500).json({ error: 'Помилка сервера при оновленні запаса' });
    }
});

// DELETE /api/inventory/:id - Видалення запаса
router.delete('/:id', checkPermissions, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existingItem = await req.db.get('SELECT * FROM inventory WHERE id = ?', [id]);
        if (!existingItem) {
            return res.status(404).json({ error: 'Запас не знайдено' });
        }

        if (req.userRole !== 'admin' && (req.userRole === 'manager' && existingItem.user_id !== req.currentUserId)) {
            return res.status(403).json({ error: 'Недостатньо прав для видалення цього запаса' });
        }

        await req.db.run('DELETE FROM inventory WHERE id = ?', [id]);
        // Не удаляем записи в expenses, так как они нужны для истории
        await req.db.run('DELETE FROM notifications WHERE type = ? AND relatedId = ?', ['low_stock', id]);

        res.status(204).send();
    } catch (err) {
        console.error('Помилка при видаленні запаса:', err.message);
        res.status(500).json({ error: 'Помилка сервера при видаленні запаса' });
    }
});

// GET /api/inventory/expenses - Отримання списку витрат
router.get('/expenses', checkPermissions, async (req, res) => {
    try {
        const { name, date, page = 1, limit = 10, sortBy = 'date', sortOrder = 'DESC' } = req.query;
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM expenses WHERE 1=1';
        const params = [];

        if (name) {
            query += ' AND name = ?';
            params.push(name);
        }
        if (date) {
            query += ' AND date = ?';
            params.push(date);
        }

        if (req.userRole === 'user') {
            query += ' AND user_id = ?';
            params.push(req.currentUserId);
        }

        const validSortFields = ['name', 'quantity', 'total_cost', 'date'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'date';
        const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${sortField} ${sortDirection}`;

        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const expenses = await req.db.all(query, params);

        let countQuery = 'SELECT COUNT(*) as total FROM expenses WHERE 1=1';
        const countParams = [];
        if (name) {
            countQuery += ' AND name = ?';
            countParams.push(name);
        }
        if (date) {
            countQuery += ' AND date = ?';
            countParams.push(date);
        }
        if (req.userRole === 'user') {
            countQuery += ' AND user_id = ?';
            countParams.push(req.currentUserId);
        }
        const { total } = await req.db.get(countQuery, countParams);

        res.json({
            data: expenses,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Помилка при отриманні списку витрат:', err.message);
        res.status(500).json({ error: 'Помилка сервера при отриманні списку витрат' });
    }
});

// POST /api/inventory/expenses - Створення запису витрат
router.post('/expenses', checkPermissions, async (req, res) => {
    try {
        if (req.userRole !== 'admin' && req.userRole !== 'manager') {
            return res.status(403).json({ error: 'Недостатньо прав для створення запису витрат' });
        }

        const item = {
            name: req.body.name,
            quantity: parseInt(req.body.quantity),
            price_per_unit: req.body.price_per_unit,
            total_cost: req.body.total_cost,
            responsible: req.body.responsible,
            date: req.body.date,
            notes: req.body.notes || ''
        };

        const errors = validateInventory({
            ...item,
            update_date: item.date,
            min_level: SPARE_PARTS[item.name]?.minLevel
        });
        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }

        const result = await req.db.run(
            `INSERT INTO expenses (user_id, name, quantity, price_per_unit, total_cost, date, responsible, notes, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.currentUserId, item.name, item.quantity, item.price_per_unit, item.total_cost, item.date, item.responsible, item.notes, 'inventory']
        );

        const newExpense = await req.db.get('SELECT * FROM expenses WHERE id = ?', [result.lastID]);
        res.status(201).json(newExpense);
    } catch (err) {
        console.error('Помилка при створенні запису витрат:', err.message);
        res.status(500).json({ error: 'Помилка сервера при створенні запису витрат' });
    }
});

// DELETE /api/inventory/expenses/:id - Видалення запису витрат
router.delete('/expenses/:id', checkPermissions, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existingExpense = await req.db.get('SELECT * FROM expenses WHERE id = ?', [id]);
        if (!existingExpense) {
            return res.status(404).json({ error: 'Запис витрат не знайдено' });
        }

        if (req.userRole !== 'admin' && (req.userRole === 'manager' && existingExpense.user_id !== req.currentUserId)) {
            return res.status(403).json({ error: 'Недостатньо прав для видалення цього запису' });
        }

        await req.db.run('DELETE FROM expenses WHERE id = ?', [id]);
        res.status(204).send();
    } catch (err) {
        console.error('Помилка при видаленні запису витрат:', err.message);
        res.status(500).json({ error: 'Помилка сервера при видаленні запису витрат' });
    }
});

export default router;