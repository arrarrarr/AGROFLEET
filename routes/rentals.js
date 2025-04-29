import express from 'express';

const router = express.Router();

// Middleware для проверки базы данных
function ensureDb(req, res, next) {
    if (!req.db) {
        return res.status(500).json({ error: 'База данных не инициализирована' });
    }
    next();
}

// Middleware для проверки авторизации
function ensureAuthenticated(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Не авторизован' });
    }
    next();
}

// Получение всех записей об аренде
router.get('/', ensureDb, ensureAuthenticated, async (req, res) => {
    try {
        const rentals = await req.db.all(`SELECT * FROM rentals`);
        res.json(rentals);
    } catch (err) {
        console.error('Ошибка при получении данных rentals:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Добавление новой аренды
router.post('/', ensureDb, ensureAuthenticated, async (req, res) => {
    const { equipment, client, start_date, end_date } = req.body;
    const userId = req.session.userId;

    if (!equipment || !client || !start_date || !end_date) {
        return res.status(400).json({ error: "Все поля должны быть заполнены." });
    }

    try {
        const result = await req.db.run(
            `INSERT INTO rentals (user_id, equipment, client, start_date, end_date) VALUES (?, ?, ?, ?, ?)`,
            [userId, equipment, client, start_date, end_date]
        );
        const rental = await req.db.get(`SELECT * FROM rentals WHERE id = ?`, [result.lastID]);
        res.status(201).json(rental);
    } catch (err) {
        console.error('Ошибка при добавлении аренды:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Получение аренды по ID
router.get('/:id', ensureDb, ensureAuthenticated, async (req, res) => {
    try {
        const rental = await req.db.get(`SELECT * FROM rentals WHERE id = ?`, [req.params.id]);
        if (!rental) {
            return res.status(404).json({ error: 'Аренда не найдена' });
        }
        res.json(rental);
    } catch (err) {
        console.error('Ошибка при получении аренды:', err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;