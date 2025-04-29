// routes/profile.js

import { Router } from 'express';
import bcrypt from 'bcrypt';

const router = Router();
const SALT_ROUNDS = 10;

router.get('/', async (req, res) => {
    console.log('GET /api/profile: Получен запрос на профиль. ID сессии:', req.sessionID);
    if (!req.session.userId) {
        console.log('Неавторизованный запрос к /api/profile');
        return res.status(401).json({ error: 'Не авторизовано' });
    }

    try {
        const db = req.db;
        const user = await db.get('SELECT * FROM users WHERE id = ?', [req.session.userId]);
        if (!user) {
            console.log('Пользователь не найден для ID:', req.session.userId);
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        console.log('Профиль пользователя найден:', user);
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
        console.error('Ошибка при загрузке профиля:', err);
        res.status(500).json({ error: 'Ошибка сервера при загрузке профиля' });
    }
});

router.put('/', async (req, res) => {
    console.log('PUT /api/profile: Получен запрос на обновление профиля. ID сессии:', req.sessionID);
    if (!req.session.userId) {
        console.log('Неавторизованный запрос к /api/profile');
        return res.status(401).json({ error: 'Не авторизовано' });
    }

    const { fullName, city, gender, email, phone, address, profileImage, password } = req.body;

    // Валидация входных данных
    if (!fullName || !city || !email) {
        return res.status(400).json({ error: 'Поля fullName, city и email обов’язкові' });
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ error: 'Некоректний email' });
    }

    if (password && password.length < 6) {
        return res.status(400).json({ error: 'Пароль має містити мінімум 6 символів' });
    }

    try {
        const db = req.db;
        const user = await db.get('SELECT * FROM users WHERE id = ?', [req.session.userId]);
        if (!user) {
            console.log('Пользователь не найден для ID:', req.session.userId);
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        // Проверяем, не занят ли email другим пользователем
        const existingUser = await db.get(
            'SELECT * FROM users WHERE email = ? AND id != ?',
            [email, req.session.userId]
        );
        if (existingUser) {
            return res.status(400).json({ error: 'Користувач із таким email уже існує' });
        }

        // Если передан новый пароль, хешируем его
        let hashedPassword = user.password;
        if (password) {
            hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        }

        // Используем текущее значение profileImage, если новое не передано
        const updatedProfileImage = profileImage !== undefined ? profileImage : user.profileImage;

        // Обновляем данные пользователя
        await db.run(
            `UPDATE users SET 
                fullName = ?, 
                city = ?, 
                gender = ?, 
                email = ?, 
                phone = ?, 
                address = ?, 
                profileImage = ?,
                password = ?
            WHERE id = ?`,
            [fullName, city, gender || user.gender, email, phone || '', address || '', updatedProfileImage, hashedPassword, req.session.userId]
        );

        const updatedUser = await db.get('SELECT * FROM users WHERE id = ?', [req.session.userId]);
        console.log('Профиль обновлен:', updatedUser);
        res.json({
            id: updatedUser.id,
            username: updatedUser.username,
            role: updatedUser.role,
            fullName: updatedUser.fullName,
            city: updatedUser.city,
            gender: updatedUser.gender,
            email: updatedUser.email,
            createdAt: updatedUser.created_at,
            workHours: updatedUser.workHours || '0',
            phone: updatedUser.phone || '',
            address: updatedUser.address || '',
            profileImage: updatedUser.profileImage || ''
        });
    } catch (err) {
        console.error('Ошибка при обновлении профиля:', err);
        res.status(500).json({ error: 'Ошибка сервера при обновлении профиля' });
    }
});

export default router;