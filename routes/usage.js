import express from 'express';
const router = express.Router();

// Список допустимых категорий техники
const VALID_EQUIPMENT_CLASSES = [
    'Трактор',
    'Комбайн',
    'Сівалка',
    'Плуг',
    'Культиватор',
    'Обприскувач'
];

// Middleware для проверки авторизации
const authenticate = (req, res, next) => {
    if (!req.session.userId) {
        console.log('Неавторизованный запрос:', req.url);
        return res.status(401).json({ error: 'Не авторизован' });
    }
    next();
};

// Middleware для получения роли пользователя
const getUserRole = async (req, res, next) => {
    const db = req.db;
    const userId = req.session.userId;
    try {
        const user = await db.get(`SELECT role FROM users WHERE id = ?`, [userId]);
        if (!user) {
            console.log(`Пользователь с id=${userId} не найден`);
            return res.status(404).json({ error: 'Пользователь не найден.' });
        }
        req.userRole = user.role;
        next();
    } catch (err) {
        console.error('Ошибка при получении роли пользователя:', err.message);
        res.status(500).json({ error: 'Ошибка сервера при получении роли пользователя.' });
    }
};

// Middleware для проверки прав доступа
const checkPermissions = (action) => async (req, res, next) => {
    const userRole = req.userRole;
    const userId = req.session.userId;

    // Определяем права для каждой роли
    const permissions = {
        admin: {
            canCreate: true,
            canEdit: true,
            canEditAll: true, // Может редактировать все записи
            canDelete: true,
            canExport: true
        },
        manager: {
            canCreate: true,
            canEdit: true,
            canEditAll: false, // Может редактировать только записи менеджеров
            canDelete: true, // Менеджеры могут удалять свои записи
            canExport: true
        },
        user: {
            canCreate: false,
            canEdit: false,
            canEditAll: false,
            canDelete: false,
            canExport: false
        }
    };

    const userPermissions = permissions[userRole];

    // Проверка прав для создания
    if (action === 'create' && !userPermissions.canCreate) {
        console.log(`Пользователь с ролью ${userRole} пытался создать запись`);
        return res.status(403).json({ error: 'У вас немає прав для створення записів' });
    }

    // Проверка прав для редактирования или удаления
    if (action === 'edit' || action === 'delete') {
        if (!userPermissions.canEdit) {
            console.log(`Пользователь с ролью ${userRole} пытался редактировать/удалить запись`);
            return res.status(403).json({ error: 'У вас немає прав для редагування або видалення записів' });
        }

        const recordId = req.params.id;
        const record = await req.db.get(
            `SELECT user_id, createdByRole FROM usage_records WHERE id = ?`,
            [recordId]
        );

        if (!record) {
            console.log(`Запись с id=${recordId} не найдена`);
            return res.status(404).json({ error: 'Запись не найдена.' });
        }

        // Админ может редактировать всё
        if (userRole === 'admin') {
            return next();
        }

        // Менеджер может редактировать только записи других менеджеров
        if (userRole === 'manager') {
            if (record.createdByRole === 'admin') {
                console.log(`Менеджер с id=${userId} пытался редактировать запись админа id=${recordId}`);
                return res.status(403).json({ error: 'Менеджери не можуть редагувати записи адмінів' });
            }
            if (record.createdByRole === 'manager') {
                return next(); // Менеджер может редактировать записи других менеджеров
            }
        }

        // Если пользователь — не админ и не менеджер, или запись не принадлежит менеджеру
        return res.status(403).json({ error: 'У вас немає прав для редагування або видалення цієї записи' });
    }

    // Проверка прав для экспорта
    if (action === 'export' && !userPermissions.canExport) {
        console.log(`Пользователь с ролью ${userRole} пытался экспортировать запись`);
        return res.status(403).json({ error: 'У вас немає прав для експорту записів' });
    }

    next();
};

// GET /api/usage - Получение всех записей об использовании
router.get('/', authenticate, getUserRole, async (req, res) => {
    const db = req.db;
    const userId = req.session.userId;
    const userRole = req.userRole;
    const { date, equipmentClass } = req.query;

    try {
        let query = `
            SELECT usage_records.*, users.fullName 
            FROM usage_records 
            LEFT JOIN users ON usage_records.user_id = users.id
        `;
        const params = [];

        if (date) {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(date)) {
                console.log('Некорректный формат даты в фильтре:', date);
                return res.status(400).json({ error: 'Поле date должно быть в формате YYYY-MM-DD.' });
            }
            query += params.length ? ` AND usage_records.date = ?` : ` WHERE usage_records.date = ?`;
            params.push(date);
        }

        if (equipmentClass) {
            if (!VALID_EQUIPMENT_CLASSES.includes(equipmentClass)) {
                console.log('Недопустимый класс техники:', equipmentClass);
                return res.status(400).json({ error: 'Недопустимый класс техники.' });
            }
            query += params.length ? ` AND usage_records.equipment_class = ?` : ` WHERE usage_records.equipment_class = ?`;
            params.push(equipmentClass);
        }

        const records = await db.all(query, params);
        res.json(records);
    } catch (err) {
        console.error('Ошибка при получении записей об использовании:', err.message);
        res.status(500).json({ error: 'Ошибка сервера при получении записей.' });
    }
});

// GET /api/usage/:id - Получение записи по ID
router.get('/:id', authenticate, getUserRole, async (req, res) => {
    const db = req.db;
    const userId = req.session.userId;
    const userRole = req.userRole;
    const { id } = req.params;

    if (!Number.isInteger(Number(id))) {
        console.log('Некорректный ID записи:', id);
        return res.status(400).json({ error: 'ID должен быть целым числом.' });
    }

    try {
        const query = `
            SELECT usage_records.*, users.fullName 
            FROM usage_records 
            LEFT JOIN users ON usage_records.user_id = users.id 
            WHERE usage_records.id = ?
        `;
        const params = [id];

        const record = await db.get(query, params);
        if (!record) {
            console.log(`Запись с id=${id} не найдена`);
            return res.status(404).json({ error: 'Запись не найдена.' });
        }
        res.json(record);
    } catch (err) {
        console.error('Ошибка при получении записи:', err.message);
        res.status(500).json({ error: 'Ошибка сервера при получении записи.' });
    }
});

// POST /api/usage - Создание новой записи
router.post('/', authenticate, getUserRole, checkPermissions('create'), async (req, res) => {
    const db = req.db;
    const userId = req.session.userId;
    const userRole = req.userRole;
    const { equipment, equipmentClass, period, hours, fuel, status, date } = req.body;

    console.log('Получен POST-запрос для создания записи:', req.body);

    // Валидация входных данных для создания записи
    if (!equipment || !equipmentClass || !period || !hours || !fuel || !status || !date) {
        console.log('Недостаточно данных для создания записи:', req.body);
        return res.status(400).json({ error: 'Все поля обязательны: equipment, equipmentClass, period, hours, fuel, status, date.' });
    }

    if (!VALID_EQUIPMENT_CLASSES.includes(equipmentClass)) {
        console.log('Недопустимый класс техники:', equipmentClass);
        return res.status(400).json({ error: 'Недопустимый класс техники.' });
    }

    if (typeof hours !== 'number' || hours < 0) {
        console.log('Некорректное значение hours:', hours);
        return res.status(400).json({ error: 'Поле hours должно быть положительным числом.' });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
        console.log('Некорректный формат даты:', date);
        return res.status(400).json({ error: 'Поле date должно быть в формате YYYY-MM-DD.' });
    }

    try {
        const result = await db.run(
            `INSERT INTO usage_records (user_id, equipment, equipment_class, period, hours, fuel, status, date, createdByRole)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, equipment, equipmentClass, period, hours, fuel, status, date, userRole]
        );

        const newRecord = await db.get(
            `SELECT usage_records.*, users.fullName 
             FROM usage_records 
             LEFT JOIN users ON usage_records.user_id = users.id 
             WHERE usage_records.id = ?`,
            [result.lastID]
        );
        console.log('Создана новая запись:', newRecord);
        res.status(201).json(newRecord);
    } catch (err) {
        console.error('Ошибка при добавлении записи:', err.message);
        if (err.message.includes('SQLITE_CONSTRAINT')) {
            res.status(400).json({ error: 'Ошибка базы данных: нарушение ограничений (например, уникальности). Проверьте входные данные.' });
        } else {
            res.status(500).json({ error: 'Ошибка сервера при добавлении записи.' });
        }
    }
});

// PUT /api/usage/:id - Обновление записи
router.put('/:id', authenticate, getUserRole, checkPermissions('edit'), async (req, res) => {
    const db = req.db;
    const userId = req.session.userId;
    const userRole = req.userRole;
    const { id } = req.params;
    const { equipment, equipmentClass, period, hours, fuel, status, date } = req.body;

    console.log('Получен PUT-запрос для id:', id, 'с данными:', req.body);

    if (!Number.isInteger(Number(id))) {
        console.log('Некорректный ID записи:', id);
        return res.status(400).json({ error: 'ID должен быть целым числом.' });
    }

    try {
        // Формируем запрос на обновление только для тех полей, которые были отправлены
        const updates = [];
        const params = [];

        if (equipment !== undefined && equipment !== '') {
            updates.push('equipment = ?');
            params.push(equipment);
        }
        if (equipmentClass !== undefined && equipmentClass !== '') {
            if (!VALID_EQUIPMENT_CLASSES.includes(equipmentClass)) {
                console.log('Недопустимый класс техники:', equipmentClass);
                return res.status(400).json({ error: 'Недопустимый класс техники.' });
            }
            updates.push('equipment_class = ?');
            params.push(equipmentClass);
        }
        if (period !== undefined && period !== '') {
            updates.push('period = ?');
            params.push(period);
        }
        if (hours !== undefined && hours !== '') {
            if (typeof hours !== 'number' || hours < 0) {
                console.log('Некорректное значение hours:', hours);
                return res.status(400).json({ error: 'Поле hours должно быть положительным числом.' });
            }
            updates.push('hours = ?');
            params.push(hours);
        }
        if (fuel !== undefined && fuel !== '') {
            updates.push('fuel = ?');
            params.push(fuel);
        }
        if (status !== undefined && status !== '') {
            updates.push('status = ?');
            params.push(status);
        }
        if (date !== undefined && date !== '') {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(date)) {
                console.log('Некорректный формат даты:', date);
                return res.status(400).json({ error: 'Поле date должно быть в формате YYYY-MM-DD.' });
            }
            updates.push('date = ?');
            params.push(date);
        }

        if (updates.length === 0) {
            console.log('Нет данных для обновления записи:', req.body);
            return res.status(400).json({ error: 'Необходимо указать хотя бы одно поле для обновления.' });
        }

        params.push(id);
        const updateQuery = `UPDATE usage_records SET ${updates.join(', ')} WHERE id = ?`;
        console.log('SQL-запрос для обновления:', updateQuery, 'с параметрами:', params);
        await db.run(updateQuery, params);

        const updatedRecord = await db.get(
            `SELECT usage_records.*, users.fullName 
             FROM usage_records 
             LEFT JOIN users ON usage_records.user_id = users.id 
             WHERE usage_records.id = ?`,
            [id]
        );
        console.log('Обновлена запись:', updatedRecord);
        res.json(updatedRecord);
    } catch (err) {
        console.error('Ошибка при обновлении записи:', err.message);
        if (err.message.includes('SQLITE_CONSTRAINT')) {
            res.status(400).json({ error: 'Ошибка базы данных: нарушение ограничений (например, уникальности). Проверьте входные данные.' });
        } else {
            res.status(500).json({ error: 'Ошибка сервера при обновлении записи.' });
        }
    }
});

// DELETE /api/usage/:id - Удаление записи
router.delete('/:id', authenticate, getUserRole, checkPermissions('delete'), async (req, res) => {
    const db = req.db;
    const userId = req.session.userId;
    const userRole = req.userRole;
    const { id } = req.params;

    if (!Number.isInteger(Number(id))) {
        console.log('Некорректный ID записи:', id);
        return res.status(400).json({ error: 'ID должен быть целым числом.' });
    }

    try {
        await db.run(`DELETE FROM usage_records WHERE id = ?`, [id]);
        console.log(`Запись с id=${id} удалена пользователем userId=${userId}`);
        res.status(204).send();
    } catch (err) {
        console.error('Ошибка при удалении записи:', err.message);
        res.status(500).json({ error: 'Ошибка сервера при удалении записи.' });
    }
});

export default router;