// Файл: passwordCache.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt'); // Для шифрования паролей

// Middleware для проверки авторизации
const authenticate = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Не авторизований' });
    }
    next();
};

// Создаём таблицу для кэширования паролей, если она не существует
const initPasswordCacheTable = async (db) => {
    await db.run(`
        CREATE TABLE IF NOT EXISTS password_cache (
            userId INTEGER PRIMARY KEY,
            cachedPassword TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        )
    `);
};

// Получение зашифрованного пароля из кэша
router.get('/', authenticate, async (req, res) => {
    try {
        const userId = req.session.userId;
        const cachedPassword = await req.db.get(
            `SELECT cachedPassword FROM password_cache WHERE userId = ?`,
            [userId]
        );

        if (!cachedPassword) {
            return res.status(404).json({ error: 'Кешований пароль не знайдено' });
        }

        res.status(200).json({ cachedPassword: cachedPassword.cachedPassword });
    } catch (error) {
        console.error('Помилка при отриманні кешованого пароля:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Сохранение зашифрованного пароля в кэш
router.post('/', authenticate, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Пароль не вказано' });
        }

        // Шифруем пароль перед сохранением
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const updatedAt = new Date().toISOString();

        // Проверяем, есть ли уже запись для этого пользователя
        const existingCache = await req.db.get(
            `SELECT * FROM password_cache WHERE userId = ?`,
            [userId]
        );

        if (existingCache) {
            // Обновляем существующий кэш
            await req.db.run(
                `UPDATE password_cache SET cachedPassword = ?, updatedAt = ? WHERE userId = ?`,
                [hashedPassword, updatedAt, userId]
            );
        } else {
            // Создаём новую запись
            await req.db.run(
                `INSERT INTO password_cache (userId, cachedPassword, updatedAt) VALUES (?, ?, ?)`,
                [userId, hashedPassword, updatedAt]
            );
        }

        res.status(200).json({ message: 'Пароль успішно кешовано' });
    } catch (error) {
        console.error('Помилка при кешуванні пароля:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Удаление кэшированного пароля
router.delete('/', authenticate, async (req, res) => {
    try {
        const userId = req.session.userId;

        await req.db.run(
            `DELETE FROM password_cache WHERE userId = ?`,
            [userId]
        );

        res.status(200).json({ message: 'Кешований пароль видалено' });
    } catch (error) {
        console.error('Помилка при видаленні кешованого пароля:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

module.exports = (db) => {
    initPasswordCacheTable(db);
    return router;
};