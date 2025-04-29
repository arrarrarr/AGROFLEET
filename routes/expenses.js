// routes/expenses.js
import express from 'express';
const router = express.Router();

// Список допустимих типів витрат у нижньому регістрі
const VALID_EXPENSE_TYPES = [
    'пальне',
    'технічне обслуговування та ремонт',
    'запчастини',
    'зарплата операторів/механіків',
    'оренда техніки',
    'страхування',
    'транспортні витрати',
    'інші витрати'
];

// Middleware для перевірки авторизації
const authenticate = (req, res, next) => {
    if (!req.session.userId) {
        console.log('Неавторизований запит:', req.url);
        return res.status(401).json({ error: 'Не авторизован' });
    }
    next();
};

// Middleware для перевірки ролі (admin або manager)
const restrictToAdminOrManager = async (req, res, next) => {
    const db = req.db;
    const userId = req.session.userId;

    try {
        const user = await db.get('SELECT role FROM users WHERE id = ?', [userId]);
        if (!user) {
            console.log(`Користувач з id=${userId} не знайдено`);
            return res.status(404).json({ error: 'Користувач не знайдено' });
        }

        if (user.role !== 'admin' && user.role !== 'manager') {
            console.log(`Користувач з id=${userId} і роллю ${user.role} намагався виконати заборонену дію: ${req.method} ${req.url}`);
            return res.status(403).json({ error: 'Доступ заборонено. Потрібна роль admin або manager.' });
        }

        req.userRole = user.role; // Зберігаємо роль для використання в маршрутах
        next();
    } catch (err) {
        console.error('Помилка при перевірці ролі користувача:', err.message);
        res.status(500).json({ error: 'Помилка сервера при перевірці ролі.' });
    }
};

// Middleware для отримання ролі користувача
const getUserRole = async (req, res, next) => {
    const db = req.db;
    const userId = req.session.userId;

    try {
        const user = await db.get('SELECT role FROM users WHERE id = ?', [userId]);
        if (!user) {
            console.log(`Користувач з id=${userId} не знайдено`);
            return res.status(404).json({ error: 'Користувач не знайдено' });
        }
        req.userRole = user.role;
        next();
    } catch (err) {
        console.error('Помилка при отриманні ролі користувача:', err.message);
        res.status(500).json({ error: 'Помилка сервера при отриманні ролі.' });
    }
};

// GET /api/expenses - Отримання всіх записів про витрати
router.get('/', authenticate, getUserRole, async (req, res) => {
    const db = req.db;
    const userId = req.session.userId;
    const userRole = req.userRole;
    const { expenseType, period, day, week, month, halfyear, year, startDate, endDate } = req.query;

    try {
        // Отладка: выведем все значения expense_type в базе
        const allExpenseTypes = await db.all('SELECT DISTINCT expense_type FROM expense_records');
        console.log('Все уникальные expense_type в базе:', allExpenseTypes);

        let query = `
            SELECT expense_records.*, users.fullName 
            FROM expense_records 
            LEFT JOIN users ON expense_records.user_id = users.id
            WHERE 1=1
        `;
        const params = [];

        // Фильтрация по типу расходов
        if (expenseType) {
            const normalizedExpenseType = expenseType.toLowerCase().trim(); // Удаляем пробелы
            if (!VALID_EXPENSE_TYPES.includes(normalizedExpenseType)) {
                console.log('Недопустимий тип витрат:', expenseType);
                return res.status(400).json({ error: 'Недопустимий тип витрат.' });
            }
            query += ` AND LOWER(expense_records.expense_type) = ?`;
            params.push(normalizedExpenseType);
        }

        // Фильтрация по периоду
        if (period && period !== 'all') {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (period === 'day' && day) {
                if (!dateRegex.test(day)) {
                    console.log('Некоректний формат дати у фільтрі (day):', day);
                    return res.status(400).json({ error: 'Поле day має бути у форматі YYYY-MM-DD.' });
                }
                query += ` AND expense_records.expense_date = ?`;
                params.push(day);
            } else if (period === 'week' && week) {
                const weekRegex = /^\d{4}-W\d{2}$/;
                if (!weekRegex.test(week)) {
                    console.log('Некоректний формат тижня у фільтрі (week):', week);
                    return res.status(400).json({ error: 'Поле week має бути у форматі YYYY-W##.' });
                }
                const [year, weekNum] = week.split('-W');
                const weekNumber = parseInt(weekNum, 10);
                const firstDayOfYear = new Date(year, 0, 1);
                const daysOffset = (firstDayOfYear.getDay() || 7) - 1; // Смещение для понедельника
                const startDate = new Date(year, 0, 1 + (weekNumber - 1) * 7 - daysOffset);
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + 6);
                query += ` AND expense_records.expense_date BETWEEN ? AND ?`;
                params.push(startDate.toISOString().split('T')[0]);
                params.push(endDate.toISOString().split('T')[0]);
                console.log(`Фильтрация по неделе ${week}: с ${startDate.toISOString().split('T')[0]} по ${endDate.toISOString().split('T')[0]}`);
            } else if (period === 'month' && month) {
                const monthRegex = /^\d{4}-\d{2}$/;
                if (!monthRegex.test(month)) {
                    console.log('Некоректний формат місяця у фільтрі (month):', month);
                    return res.status(400).json({ error: 'Поле month має бути у форматі YYYY-MM.' });
                }
                const [year, monthNum] = month.split('-');
                const startDate = new Date(year, monthNum - 1, 1);
                const endDate = new Date(year, monthNum, 0);
                query += ` AND expense_records.expense_date BETWEEN ? AND ?`;
                params.push(startDate.toISOString().split('T')[0]);
                params.push(endDate.toISOString().split('T')[0]);
            } else if (period === 'halfyear' && halfyear) {
                const halfyearRegex = /^\d{4}-[1-2]$/;
                if (!halfyearRegex.test(halfyear)) {
                    console.log('Некоректний формат півріччя у фільтрі (halfyear):', halfyear);
                    return res.status(400).json({ error: 'Поле halfyear має бути у форматі YYYY-1 або YYYY-2.' });
                }
                const [year, half] = halfyear.split('-');
                const startDate = new Date(year, half === '1' ? 0 : 6, 1);
                const endDate = new Date(year, half === '1' ? 5 : 11, half === '1' ? 30 : 31);
                query += ` AND expense_records.expense_date BETWEEN ? AND ?`;
                params.push(startDate.toISOString().split('T')[0]);
                params.push(endDate.toISOString().split('T')[0]);
            } else if (period === 'year' && year) {
                const yearRegex = /^\d{4}$/;
                if (!yearRegex.test(year)) {
                    console.log('Некоректний формат року у фільтрі (year):', year);
                    return res.status(400).json({ error: 'Поле year має бути у форматі YYYY.' });
                }
                const startDate = new Date(year, 0, 1);
                const endDate = new Date(year, 11, 31);
                query += ` AND expense_records.expense_date BETWEEN ? AND ?`;
                params.push(startDate.toISOString().split('T')[0]);
                params.push(endDate.toISOString().split('T')[0]);
            } else if (period === 'custom' && startDate && endDate) {
                if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
                    console.log('Некоректний формат дат у фільтрі (startDate/endDate):', startDate, endDate);
                    return res.status(400).json({ error: 'Поля startDate і endDate мають бути у форматі YYYY-MM-DD.' });
                }
                query += ` AND expense_records.expense_date BETWEEN ? AND ?`;
                params.push(startDate);
                params.push(endDate);
            }
        }

        // Добавим фильтрацию по user_id для ролей, отличных от admin
        if (userRole !== 'admin') {
            query += ` AND expense_records.user_id = ?`;
            params.push(userId);
        }

        console.log('Виконуємо запит:', query, 'з параметрами:', params);
        const records = await db.all(query, params);
        records.forEach(record => {
            record.id = Number(record.id);
        });
        console.log('Отримані записи:', records);
        res.json(records);
    } catch (err) {
        console.error('Помилка при отриманні записів про витрати:', err.message);
        res.status(500).json({ error: 'Помилка сервера при отриманні записів.' });
    }
});

// GET /api/expenses/:id - Отримання запису за ID
router.get('/:id', authenticate, getUserRole, async (req, res) => {
    const db = req.db;
    const userId = req.session.userId;
    const userRole = req.userRole;
    const { id } = req.params;

    if (!Number.isInteger(Number(id))) {
        console.log('Некоректний ID запису:', id);
        return res.status(400).json({ error: 'ID має бути цілим числом.' });
    }

    try {
        let query = `
            SELECT expense_records.*, users.fullName 
            FROM expense_records 
            LEFT JOIN users ON expense_records.user_id = users.id 
            WHERE expense_records.id = ?
        `;
        const params = [id];

        if (userRole !== 'admin') {
            query += ` AND expense_records.user_id = ?`;
            params.push(userId);
        }

        const record = await db.get(query, params);
        if (!record) {
            console.log(`Запис з id=${id} не знайдено`);
            return res.status(404).json({ error: 'Запис не знайдено.' });
        }
        record.id = Number(record.id);
        res.json(record);
    } catch (err) {
        console.error('Помилка при отриманні запису:', err.message);
        res.status(500).json({ error: 'Помилка сервера при отриманні запису.' });
    }
});

// POST /api/expenses - Створення нової записи
router.post('/', authenticate, restrictToAdminOrManager, async (req, res) => {
    const db = req.db;
    const userId = req.session.userId;
    const { equipmentName, expenseType, expenseAmount, expenseDate } = req.body;

    console.log('Отриманий POST-запит для створення запису про витрату:', req.body);
    console.log('Створює користувач з userId:', userId);

    try {
        const user = await db.get('SELECT id, role, fullName FROM users WHERE id = ?', [userId]);
        if (!user) {
            console.log('Користувач з userId=', userId, 'не знайдено в базі даних');
            return res.status(404).json({ error: 'Користувач не знайдено.' });
        }
        req.userRole = user.role;
        req.userFullName = user.fullName;
    } catch (err) {
        console.error('Помилка при перевірці існування користувача:', err.message);
        return res.status(500).json({ error: 'Помилка сервера при перевірці користувача.' });
    }

    if (!equipmentName || !expenseType || !expenseAmount || !expenseDate) {
        console.log('Недостатньо даних для створення запису:', req.body);
        return res.status(400).json({ error: 'Усі поля обов’язкові: equipmentName, expenseType, expenseAmount, expenseDate.' });
    }

    const normalizedExpenseType = expenseType.toLowerCase().trim();
    if (!VALID_EXPENSE_TYPES.includes(normalizedExpenseType)) {
        console.log('Недопустимий тип витрат:', expenseType);
        return res.status(400).json({ error: 'Недопустимий тип витрат.' });
    }

    if (typeof expenseAmount !== 'number' || expenseAmount < 0) {
        console.log('Некоректне значення expenseAmount:', expenseAmount);
        return res.status(400).json({ error: 'Поле expenseAmount має бути позитивним числом.' });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(expenseDate)) {
        console.log('Некоректний формат дати:', expenseDate);
        return res.status(400).json({ error: 'Поле expenseDate має бути у форматі YYYY-MM-DD.' });
    }

    try {
        const result = await db.run(
            `INSERT INTO expense_records (user_id, equipment_name, expense_type, expense_amount, expense_date)
             VALUES (?, ?, ?, ?, ?)`,
            [userId, equipmentName, normalizedExpenseType, expenseAmount, expenseDate]
        );

        const newRecord = await db.get(
            `SELECT expense_records.*, users.fullName 
             FROM expense_records 
             LEFT JOIN users ON expense_records.user_id = users.id 
             WHERE expense_records.id = ?`,
            [result.lastID]
        );
        newRecord.id = Number(newRecord.id);
        console.log('Створено новий запис про витрату з id:', result.lastID, 'дані:', newRecord);

        const visibilityInfo = {
            createdBy: req.userFullName,
            visibleTo: 'Усім користувачам'
        };

        res.status(201).json({
            record: newRecord,
            visibility: visibilityInfo
        });
    } catch (err) {
        console.error('Помилка при додаванні запису:', err.message);
        if (err.message.includes('SQLITE_CONSTRAINT')) {
            res.status(400).json({ error: 'Помилка бази даних: порушення обмежень (наприклад, унікальності). Перевірте вхідні дані.' });
        } else {
            res.status(500).json({ error: 'Помилка сервера при додаванні запису.' });
        }
    }
});

// PUT /api/expenses/:id - Оновлення запису
router.put('/:id', authenticate, restrictToAdminOrManager, async (req, res) => {
    const db = req.db;
    const userId = req.session.userId;
    const userRole = req.userRole;
    const { id } = req.params;
    const { equipmentName, expenseType, expenseAmount, expenseDate } = req.body;

    console.log('Отриманий PUT-запит для id:', id, 'з даними:', req.body);

    if (!Number.isInteger(Number(id))) {
        console.log('Некоректний ID запису:', id);
        return res.status(400).json({ error: 'ID має бути цілим числом.' });
    }

    try {
        const existingRecord = await db.get(
            `SELECT * FROM expense_records WHERE id = ?`,
            [id]
        );
        if (!existingRecord) {
            console.log(`Запис з id=${id} не знайдено`);
            return res.status(404).json({ error: 'Запис не знайдено.' });
        }

        if (userRole === 'manager' && existingRecord.user_id !== userId) {
            console.log(`Менеджер з id=${userId} намагався редагувати чужий запис id=${id}`);
            return res.status(403).json({ error: 'У вас немає прав для редагування цього запису.' });
        }

        const updates = [];
        const params = [];

        if (equipmentName !== undefined && equipmentName !== '') {
            updates.push('equipment_name = ?');
            params.push(equipmentName);
        }
        if (expenseType !== undefined && expenseType !== '') {
            const normalizedExpenseType = expenseType.toLowerCase().trim();
            if (!VALID_EXPENSE_TYPES.includes(normalizedExpenseType)) {
                console.log('Недопустимий тип витрат:', expenseType);
                return res.status(400).json({ error: 'Недопустимий тип витрат.' });
            }
            updates.push('expense_type = ?');
            params.push(normalizedExpenseType);
        }
        if (expenseAmount !== undefined && expenseAmount !== '') {
            if (typeof expenseAmount !== 'number' || expenseAmount < 0) {
                console.log('Некоректне значення expenseAmount:', expenseAmount);
                return res.status(400).json({ error: 'Поле expenseAmount має бути позитивним числом.' });
            }
            updates.push('expense_amount = ?');
            params.push(expenseAmount);
        }
        if (expenseDate !== undefined && expenseDate !== '') {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(expenseDate)) {
                console.log('Некоректний формат дати:', expenseDate);
                return res.status(400).json({ error: 'Поле expenseDate має бути у форматі YYYY-MM-DD.' });
            }
            updates.push('expense_date = ?');
            params.push(expenseDate);
        }

        if (updates.length === 0) {
            console.log('Немає даних для оновлення запису:', req.body);
            return res.status(400).json({ error: 'Необхідно вказати хоча б одне поле для оновлення.' });
        }

        params.push(id);
        const updateQuery = `UPDATE expense_records SET ${updates.join(', ')} WHERE id = ?`;
        console.log('SQL-запит для оновлення:', updateQuery, 'з параметрами:', params);
        await db.run(updateQuery, params);

        const updatedRecord = await db.get(
            `SELECT expense_records.*, users.fullName 
             FROM expense_records 
             LEFT JOIN users ON expense_records.user_id = users.id 
             WHERE expense_records.id = ?`,
            [id]
        );
        updatedRecord.id = Number(updatedRecord.id);
        console.log('Оновлено запис про витрату:', updatedRecord);
        res.json(updatedRecord);
    } catch (err) {
        console.error('Помилка при оновленні запису:', err.message);
        if (err.message.includes('SQLITE_CONSTRAINT')) {
            res.status(400).json({ error: 'Помилка бази даних: порушення обмежень (наприклад, унікальності). Перевірте вхідні дані.' });
        } else {
            res.status(500).json({ error: 'Помилка сервера при оновленні запису.' });
        }
    }
});

// DELETE /api/expenses/:id - Видалення запису
router.delete('/:id', authenticate, restrictToAdminOrManager, async (req, res) => {
    const db = req.db;
    const userId = req.session.userId;
    const userRole = req.userRole;
    const { id } = req.params;

    if (!Number.isInteger(Number(id))) {
        console.log('Некоректний ID запису:', id);
        return res.status(400).json({ error: 'ID має бути цілим числом.' });
    }

    try {
        const existingRecord = await db.get(
            `SELECT * FROM expense_records WHERE id = ?`,
            [id]
        );
        if (!existingRecord) {
            console.log(`Запис з id=${id} не знайдено`);
            return res.status(404).json({ error: 'Запис не знайдено.' });
        }

        if (userRole === 'manager' && existingRecord.user_id !== userId) {
            console.log(`Менеджер з id=${userId} намагався видалити чужий запис id=${id}`);
            return res.status(403).json({ error: 'У вас немає прав для видалення цього запису.' });
        }

        await db.run(`DELETE FROM expense_records WHERE id = ?`, [id]);
        console.log(`Запис з id=${id} видалено користувачем userId=${userId}`);
        res.status(204).send();
    } catch (err) {
        console.error('Помилка при видаленні запису:', err.message);
        res.status(500).json({ error: 'Помилка сервера при видаленні запису.' });
    }
});

export default router;