// routes/auth.js

import { Router } from 'express';
import bcrypt from 'bcrypt';

const router = Router();

// Количество раундов для хеширования
const SALT_ROUNDS = 10;

// Middleware для проверки авторизации
export const checkAuth = (req, res, next) => {
    console.log('Перевірка авторизації:', req.method, req.url);
    console.log('Cookies:', req.headers.cookie);
    console.log('Session ID:', req.sessionID);
    console.log('Session Data:', req.session);
    if (!req.session.userId) {
        console.log('Неавторизований доступ:', req.method, req.url);
        return res.status(401).json({ error: 'Не авторизовано' });
    }
    console.log('Авторизований доступ:', req.method, req.url, 'ID користувача:', req.session.userId);
    next();
};

// Middleware для проверки прав доступа (admin или manager)
export const checkAdminOrManager = (req, res, next) => {
    const userRole = req.session.userRole;
    if (userRole !== 'admin' && userRole !== 'manager') {
        console.log('Недостаточно прав для', req.method, req.url, 'Роль:', userRole);
        return res.status(403).json({ error: 'Недостатньо прав. Тільки admin або manager можуть виконувати цю дію.' });
    }
    next();
};

// Вход в систему
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(`POST /api/auth/login: Отритано запит на логін:`, { username });

    // Валидация входных данных
    if (!username || !password) {
        return res.status(400).json({ error: 'Логін і пароль обов’язкові' });
    }

    try {
        const db = req.db;
        if (!db) {
            console.error('База даних не ініціалізована');
            return res.status(500).json({ error: 'Серверна помилка: база даних не ініціалізована' });
        }

        const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
        if (tables.length === 0) {
            return res.status(500).json({ error: 'Таблиця users не знайдена в базі даних' });
        }

        const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
        if (!user) {
            console.log('Користувача не знайдено:', username);
            return res.status(401).json({ error: 'Неправильний логін або пароль' });
        }

        // Сравниваем пароль
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            console.log('Неправильний пароль для користувача:', username);
            return res.status(401).json({ error: 'Неправильний логін або пароль' });
        }

        req.session.userId = user.id;
        req.session.userRole = user.role;
        req.session.sessionStartTime = Date.now();
        console.log('Вхід успішний. ID сесії:', req.sessionID, 'ID користувача:', user.id, 'Роль:', user.role);

        res.json({
            id: user.id,
            username: user.username,
            role: user.role,
            fullName: user.fullName,
            city: user.city,
            gender: user.gender,
            email: user.email,
            createdAt: user.created_at,
            workHours: user.workHours || '0',
            phone: user.phone || '',
            address: user.address || '',
            profileImage: user.profileImage || ''
        });
    } catch (err) {
        console.error('Помилка при вході:', err.message, err.stack);
        res.status(500).json({ error: 'Помилка сервера при вході' });
    }
});

// Регистрация нового пользователя
router.post('/register', async (req, res) => {
    console.log('POST /api/auth/register: Запит отриманий');
    const { fullName, city, gender, email, username, password } = req.body;
    console.log(`POST /api/auth/register: Отритано запит на реєстрацію:`, { fullName, city, gender, email, username });

    // Валидация входных данных
    if (!fullName || !city || !gender || !email || !username || !password) {
        return res.status(400).json({ error: 'Усі поля обов’язкові' });
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ error: 'Некоректний email' });
    }

    if (username.length < 3) {
        return res.status(400).json({ error: 'Логін має містити мінімум 3 символи' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Пароль має містити мінімум 6 символів' });
    }

    try {
        const db = req.db;
        if (!db) {
            console.error('База даних не ініціалізована');
            return res.status(500).json({ error: 'Серверна помилка: база даних не ініціалізована' });
        }

        const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
        if (tables.length === 0) {
            console.error('Таблиця users не знайдена в базі даних');
            return res.status(500).json({ error: 'Таблиця users не знайдена в базі даних' });
        }

        const existingUser = await db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
        if (existingUser) {
            if (existingUser.username === username) {
                return res.status(400).json({ error: 'Користувач із таким логіном уже існує' });
            }
            if (existingUser.email === email) {
                return res.status(400).json({ error: 'Користувач із таким email уже існує' });
            }
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const result = await db.run(
            `INSERT INTO users (username, password, role, fullName, city, gender, email, workHours, phone, address, created_at, profileImage)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [username, hashedPassword, 'user', fullName, city, gender, email, '0', '', '', new Date().toISOString(), '']
        );

        const user = await db.get('SELECT * FROM users WHERE id = ?', [result.lastID]);
        req.session.userId = user.id;
        req.session.userRole = user.role;
        req.session.sessionStartTime = Date.now();
        console.log('Реєстрація успішна. ID сесії:', req.sessionID, 'ID користувача:', user.id, 'Роль:', user.role);

        res.json({
            id: user.id,
            username: user.username,
            role: user.role,
            fullName: user.fullName,
            city: user.city,
            gender: user.gender,
            email: user.email,
            createdAt: user.created_at,
            workHours: user.workHours,
            phone: user.phone,
            address: user.address,
            profileImage: user.profileImage
        });
    } catch (err) {
        console.error('Помилка при реєстрації:', err.message, err.stack);
        res.status(500).json({ error: 'Помилка сервера при реєстрації' });
    }
});

// Выход из системы
router.post('/logout', (req, res) => {
    console.log('POST /api/auth/logout: Отритано запит на вихід. ID сесії:', req.sessionID);
    req.session.destroy((err) => {
        if (err) {
            console.error('Помилка при виході:', err.message, err.stack);
            return res.status(500).json({ error: 'Помилка сервера при виході' });
        }
        console.log('Сесію знищено успішно');
        res.json({ message: 'Вихід виконано успішно' });
    });
});

// Проверка авторизации
router.get('/check-auth', async (req, res) => {
    console.log('GET /api/auth/check-auth: Отритано запит на перевірку авторизації. ID сесії:', req.sessionID);
    console.log('Cookies:', req.headers.cookie);
    console.log('Session Data:', req.session);
    try {
        if (!req.db) {
            console.error('База даних не ініціалізована');
            return res.status(500).json({ error: 'Серверна помилка: база даних не ініціалізована' });
        }
        if (!req.session.userId) {
            console.log('Користувач не авторизований');
            return res.status(200).json({ role: 'unauthorized' });
        }

        const user = await req.db.get('SELECT * FROM users WHERE id = ?', [req.session.userId]);
        if (!user) {
            console.log('Користувач не знайдений в базі даних, ID:', req.session.userId);
            return res.status(200).json({ role: 'unauthorized' });
        }

        if (!req.session.userRole) {
            req.session.userRole = user.role;
            console.log('Роль користувача збережена в сесії:', user.role);
        }

        console.log(`GET /api/auth/check-auth: Користувач ${user.id} з роллю ${user.role}`);
        res.status(200).json({
            id: user.id,
            username: user.username,
            role: user.role,
            fullName: user.fullName,
            city: user.city,
            gender: user.gender,
            email: user.email,
            createdAt: user.created_at,
            workHours: user.workHours || '0',
            phone: user.phone || '',
            address: user.address || '',
            profileImage: user.profileImage || ''
        });
    } catch (err) {
        console.error('Помилка при перевірці авторизації:', err.message, err.stack);
        res.status(500).json({ error: 'Помилка сервера при перевірці авторизації' });
    }
});

export default router;