// Файл: users.js

import express from 'express';
import bcrypt from 'bcrypt';
import { checkAuth, checkAdminOrManager } from './auth.js'; // Импортируем middleware из auth.js

const router = express.Router();

// Реєстрація нового користувача
router.post('/register', async (req, res) => {
    const { username, password, email, fullName, city, gender, phone } = req.body;

    if (!username || !password || !email) {
        return res.status(400).json({ error: 'Username, password та email обов’язкові' });
    }

    try {
        const existingUser = await req.db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
        if (existingUser) {
            return res.status(400).json({ error: 'Користувач із таким username або email вже існує' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await req.db.run(
            `INSERT INTO users (username, password, email, fullName, city, gender, phone, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [username, hashedPassword, email, fullName || 'Невідомий', city || 'Невідомо', gender || 'Невідомо', phone || 'Невідомо', 'user']
        );

        res.status(201).json({ message: 'Користувач успішно зареєстрований', userId: result.lastID });
    } catch (err) {
        console.error('Помилка при реєстрації:', err.message);
        res.status(500).json({ error: 'Помилка сервера при реєстрації' });
    }
});

// Логін користувача
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username та password обов’язкові' });
    }

    try {
        const user = await req.db.get('SELECT * FROM users WHERE username = ?', [username]);
        if (!user) {
            return res.status(400).json({ error: 'Невірний username або пароль' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ error: 'Невірний username або пароль' });
        }

        req.session.userId = user.id;
        req.session.userRole = user.role;
        res.json({ message: 'Успішний вхід', user: { id: user.id, username: user.username, role: user.role } });
    } catch (err) {
        console.error('Помилка при вході:', err.message);
        res.status(500).json({ error: 'Помилка сервера при вході' });
    }
});

// Логаут користувача
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Помилка при виході' });
        }
        res.json({ message: 'Успішний вихід' });
    });
});

// Отримання даних поточного користувача
router.get('/me', checkAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const user = await req.db.get(
            'SELECT fullName, email, phone, role FROM users WHERE id = ?',
            [userId]
        );
        if (!user) {
            return res.status(404).json({ error: 'Користувача не знайдено' });
        }
        res.json(user);
    } catch (error) {
        console.error('Помилка при отриманні даних користувача:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Получение списка всех пользователей (доступно только для admin и manager)
router.get('/', checkAuth, checkAdminOrManager, async (req, res) => {
    try {
        const db = req.db;
        if (!db) {
            console.error('База даних не ініціалізована');
            return res.status(500).json({ error: 'Серверна помилка: база даних не ініціалізована' });
        }

        const users = await db.all('SELECT id, username, fullName, role, email FROM users');
        console.log(`GET /api/users: Завантажено ${users.length} користувачів для користувача ${req.session.userId}`);
        res.json(users);
    } catch (err) {
        console.error('Помилка при отриманні користувачів:', err.message, err.stack);
        res.status(500).json({ error: 'Помилка сервера при отриманні користувачів' });
    }
});

export default router;