import express from 'express';
const router = express.Router();

// Middleware для перевірки авторизації
const checkAuth = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Не авторизован' });
    }
    next();
};

// Middleware для перевірки прав доступу (лише для admin і manager)
const checkAdminOrManager = async (req, res, next) => {
    try {
        const user = await req.db.get('SELECT role FROM users WHERE id = ?', [req.session.userId]);
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            return res.status(403).json({ error: 'Доступ заборонений: потрібні права адміністратора або менеджера' });
        }
        next();
    } catch (err) {
        console.error('Помилка при отриманні ролі користувача:', err.message);
        return res.status(500).json({ error: 'Помилка сервера' });
    }
};

// Ендпоінт для перевірки авторизації
router.get('/check-auth', checkAuth, async (req, res) => {
    try {
        const user = await req.db.get('SELECT id, username, role FROM users WHERE id = ?', [req.session.userId]);
        if (!user) {
            return res.status(401).json({ error: 'Користувач не знайдений' });
        }
        return res.status(200).json(user);
    } catch (err) {
        console.error('Помилка при отриманні користувача:', err.message);
        return res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Ендпоінт для отримання списку користувачів (доступно для всіх ролей)
router.get('/users', checkAuth, async (req, res) => {
    try {
        const { date, category } = req.query;
        let query = 'SELECT * FROM users';
        const params = [];

        if (date) {
            query += ' WHERE created_at LIKE ?';
            params.push(`${date}%`);
        }

        const rows = await req.db.all(query, params);
        res.status(200).json(rows);
    } catch (err) {
        console.error('Помилка запиту users:', err.message);
        return res.status(500).json({ error: 'Помилка завантаження користувачів' });
    }
});

// Ендпоінт для отримання записів про техобслуговування (доступно для всіх ролей)
router.get('/maintenance', checkAuth, async (req, res) => {
    try {
        const { date, category } = req.query;
        let query = 'SELECT * FROM maintenance_records';
        const params = [];

        if (date) {
            query += ' WHERE date LIKE ?';
            params.push(`${date}%`);
        }

        const rows = await req.db.all(query, params);
        res.status(200).json(rows);
    } catch (err) {
        console.error('Помилка запиту maintenance:', err.message);
        return res.status(500).json({ error: 'Помилка завантаження записів про техобслуговування' });
    }
});

// Новый эндпоинт для получения записей истории обслуживания (maintenance_history)
router.get('/maintenance/history', checkAuth, async (req, res) => {
    try {
        const { date, category } = req.query;
        let query = 'SELECT * FROM maintenance_history WHERE user_id = ?';
        const params = [req.session.userId];

        if (date) {
            query += ' AND date LIKE ?';
            params.push(`${date}%`);
        }

        const user = await req.db.get('SELECT role FROM users WHERE id = ?', [req.session.userId]);
        if (user && (user.role === 'admin' || user.role === 'manager')) {
            // Для админов и менеджеров показываем все записи
            query = query.replace('WHERE user_id = ?', '');
            params.shift();
        }

        const rows = await req.db.all(query, params);
        console.log('GET /api/maintenance/history (effectiveness): Записи найдено:', rows);
        res.status(200).json(rows);
    } catch (err) {
        console.error('Помилка запиту maintenance_history:', err.message);
        return res.status(500).json({ error: 'Помилка завантаження історії обслуговування' });
    }
});

// Ендпоінт для отримання даних про мотогодини (доступно для всіх ролей)
router.get('/moto_time', checkAuth, async (req, res) => {
    try {
        const { date, category } = req.query;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoISO = thirtyDaysAgo.toISOString().split('T')[0];

        let query = 'SELECT * FROM moto_time WHERE date >= ?';
        const params = [thirtyDaysAgoISO];

        if (date) {
            query += ' AND date LIKE ?';
            params.push(`${date}%`);
        }

        const user = await req.db.get('SELECT role FROM users WHERE id = ?', [req.session.userId]);
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            query += ' AND user_id = ?';
            params.push(req.session.userId);
        }

        const rows = await req.db.all(query, params);
        console.log('GET /api/moto_time (effectiveness): Записи знайдено:', rows);
        res.status(200).json(rows);
    } catch (err) {
        console.error('Помилка запиту moto_time:', err.message);
        return res.status(500).json({ error: 'Помилка завантаження даних про мотогодини' });
    }
});

// Ендпоінт для отримання даних про контракти (доступно для всіх ролей)
router.get('/contracts', checkAuth, async (req, res) => {
    try {
        const { date, category } = req.query;
        let query = 'SELECT * FROM contracts';
        const params = [];

        if (date) {
            query += ' WHERE date LIKE ?';
            params.push(`${date}%`);
        }

        const rows = await req.db.all(query, params);
        res.status(200).json(rows);
    } catch (err) {
        console.error('Помилка запиту contracts:', err.message);
        return res.status(500).json({ error: 'Помилка завантаження даних про контракти' });
    }
});

// Новий ендпоінт для створення контракту (доступно лише для admin і manager)
router.post('/contracts', checkAuth, checkAdminOrManager, async (req, res) => {
    try {
        const {
            number, name, party, date, endDate, amount, status,
            equipmentType, region, notes, paymentTerms, deliveryTerms,
            contractDuration, responsiblePerson, userId, createdByRole
        } = req.body;

        const query = `
            INSERT INTO contracts (
                number, name, party, date, endDate, amount, status,
                equipmentType, region, notes, paymentTerms, deliveryTerms,
                contractDuration, responsiblePerson, userId, createdByRole, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `;
        const params = [
            number, name, party, date, endDate, amount, status,
            equipmentType, region, notes, paymentTerms, deliveryTerms,
            contractDuration, responsiblePerson, userId, createdByRole
        ];

        const result = await req.db.run(query, params);
        res.status(201).json({ message: 'Контракт успішно створено', contractId: result.lastID });
    } catch (err) {
        console.error('Помилка при створенні контракту:', err.message);
        return res.status(500).json({ error: 'Помилка створення контракту' });
    }
});

export default router;