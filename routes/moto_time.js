import express from 'express';
const router = express.Router();

// Валідація вхідних даних
const validateMotoTimeRecord = (record) => {
    const errors = [];

    if (!record.equipment || typeof record.equipment !== 'string') {
        errors.push('equipment должен быть строкой');
    }
    if (!record.hours || typeof record.hours !== 'number' || record.hours <= 0) {
        errors.push('hours должен быть положительным числом');
    }
    if (!record.date || !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
        errors.push('date должен быть в формате YYYY-MM-DD');
    }
    if (!record.work_type || typeof record.work_type !== 'string') {
        errors.push('work_type должен быть строкой');
    }
    if (record.notes && typeof record.notes !== 'string') {
        errors.push('notes должен быть строкой');
    }
    if (record.fuel_consumed && (typeof record.fuel_consumed !== 'number' || record.fuel_consumed < 0)) {
        errors.push('fuel_consumed должен быть неотрицательным числом');
    }
    if (record.oil_consumed && (typeof record.oil_consumed !== 'number' || record.oil_consumed < 0)) {
        errors.push('oil_consumed должен быть неотрицательным числом');
    }
    if (record.land_processed && (typeof record.land_processed !== 'number' || record.land_processed < 0)) {
        errors.push('land_processed должен быть неотрицательным числом');
    }
    if (!record.operator || typeof record.operator !== 'string') {
        errors.push('operator должен быть строкой');
    }

    return errors;
};

// Middleware для проверки прав admin/manager
const checkAdminOrManager = async (req, res, next) => {
    try {
        const user = await req.db.get('SELECT role FROM users WHERE id = ?', [req.session.userId]);
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            return res.status(403).json({ error: 'Доступ заборонений: потрібні права адміністратора або менеджера' });
        }
        next();
    } catch (err) {
        console.error('Помилка при перевірці ролі:', err.message);
        res.status(500).json({ error: 'Помилка сервера' });
    }
};

// Отримання всіх записів moto_time (для admin/manager — все, для остальных — только свои)
router.get('/', async (req, res) => {
    try {
        console.log('GET /api/moto_time: Обробка запиту. ID користувача:', req.session.userId);
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoISO = thirtyDaysAgo.toISOString().split('T')[0]; // Формат YYYY-MM-DD

        let query = 'SELECT * FROM moto_time WHERE date >= ?';
        const params = [thirtyDaysAgoISO];

        // Проверяем роль пользователя
        const user = await req.db.get('SELECT role FROM users WHERE id = ?', [req.session.userId]);
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            // Для обычных пользователей фильтруем по user_id
            query += ' AND user_id = ?';
            params.push(req.session.userId);
        }

        const records = await req.db.all(query, params);
        console.log('GET /api/moto_time: Записи знайдено:', records);
        res.json(records);
    } catch (err) {
        console.error('GET /api/moto_time: Помилка при отриманні записів moto_time:', err.message);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Додавання нової записи в moto_time
router.post('/', async (req, res) => {
    const user_id = req.session.userId;

    if (!user_id) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { equipment, hours, date, work_type, notes, fuel_consumed, oil_consumed, land_processed, operator } = req.body;

    // Валідація
    const errors = validateMotoTimeRecord(req.body);
    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }

    try {
        const result = await req.db.run(
            `INSERT INTO moto_time (user_id, equipment, hours, date, work_type, notes, fuel_consumed, oil_consumed, land_processed, operator) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [user_id, equipment, hours, date, work_type, notes, fuel_consumed, oil_consumed, land_processed, operator]
        );

        const newRecord = {
            id: result.lastID,
            user_id,
            equipment,
            hours,
            date,
            work_type,
            notes,
            fuel_consumed,
            oil_consumed,
            land_processed,
            operator
        };
        res.status(201).json(newRecord);
    } catch (err) {
        console.error('Ошибка при добавлении записи в moto_time:', err.message);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Оновлення записи в moto_time
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const user_id = req.session.userId;

    if (!user_id) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { equipment, hours, date, work_type, notes, fuel_consumed, oil_consumed, land_processed, operator } = req.body;

    // Валідація
    const errors = validateMotoTimeRecord(req.body);
    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }

    try {
        const result = await req.db.run(
            `UPDATE moto_time 
             SET user_id = ?, equipment = ?, hours = ?, date = ?, work_type = ?, notes = ?, fuel_consumed = ?, oil_consumed = ?, land_processed = ?, operator = ? 
             WHERE id = ? AND user_id = ?`,
            [user_id, equipment, hours, date, work_type, notes, fuel_consumed, oil_consumed, land_processed, operator, id, user_id]
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Запись не найдена' });
        }

        res.json({ message: 'Запись обновлена' });
    } catch (err) {
        console.error('Ошибка при обновлении записи в moto_time:', err.message);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Видалення записи з moto_time
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const user_id = req.session.userId;

    if (!user_id) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const result = await req.db.run('DELETE FROM moto_time WHERE id = ? AND user_id = ?', [id, user_id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Запись не найдена' });
        }
        res.json({ message: 'Запись удалена' });
    } catch (err) {
        console.error('Ошибка при удалении записи из moto_time:', err.message);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

export default router;