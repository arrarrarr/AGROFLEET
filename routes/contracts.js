// routes/contracts.js
import { Router } from 'express';
import { checkAuth, checkAdminOrManager } from './auth.js';

const router = Router();

// Middleware для логирования сессии
const logSessionAndUser = (req, res, next) => {
    console.log('Логирование сессии в /api/contracts:');
    console.log('Session ID:', req.sessionID);
    console.log('Session Data:', req.session);
    console.log('Cookies:', req.headers.cookie);
    console.log('User ID from session:', req.session.userId);
    console.log('User Role from session:', req.session.userRole);
    next();
};

// Применяем middleware для всех маршрутов
router.use(logSessionAndUser);

// Получение всех контрактов
router.get('/', checkAuth, async (req, res) => {
    try {
        const db = req.db;
        if (!db) {
            console.error('База даних не ініціалізована');
            return res.status(500).json({ error: 'Серверна помилка: база даних не ініціалізована' });
        }

        const userId = req.session.userId;
        const userRole = req.session.userRole;

        if (!userId || !userRole) {
            console.error('Помилка: userId або userRole відсутні в сесії');
            return res.status(401).json({ error: 'Користувач не авторизований' });
        }

        let contracts;
        if (userRole === 'admin' || userRole === 'manager') {
            contracts = await db.all('SELECT * FROM contracts');
            console.log(`GET /api/contracts: Завантажено ${contracts.length} контрактів для ${userRole} (ID: ${userId})`);
            console.log('Усі контракти:', contracts);
        } else {
            contracts = await db.all('SELECT * FROM contracts WHERE userId = ?', [userId]);
            console.log(`GET /api/contracts: Завантажено ${contracts.length} контрактів для user (ID: ${userId})`);
            console.log('Відфільтровані контракти для user:', contracts);
        }

        res.json(contracts);
    } catch (err) {
        console.error('Помилка при отриманні контрактів:', err.message, err.stack);
        res.status(500).json({ error: 'Помилка сервера при отриманні контрактів' });
    }
});

// Получение контракта по ID
router.get('/:id', checkAuth, async (req, res) => {
    try {
        const db = req.db;
        if (!db) {
            console.error('База даних не ініціалізована');
            return res.status(500).json({ error: 'Серверна помилка: база даних не ініціалізована' });
        }

        const contractId = req.params.id;
        const userId = req.session.userId;
        const userRole = req.session.userRole;

        let contract;
        if (userRole === 'admin' || userRole === 'manager') {
            contract = await db.get('SELECT * FROM contracts WHERE id = ?', [contractId]);
        } else {
            contract = await db.get('SELECT * FROM contracts WHERE id = ? AND userId = ?', [contractId, userId]);
        }

        if (!contract) {
            console.log(`GET /api/contracts/${contractId}: Контракт не знайдений для користувача ${userId}`);
            return res.status(404).json({ error: 'Контракт не знайдений' });
        }

        console.log(`GET /api/contracts/${contractId}: Контракт знайдений для користувача ${userId}`);
        res.json(contract);
    } catch (err) {
        console.error(`Помилка при отриманні контракту ${req.params.id}:`, err.message, err.stack);
        res.status(500).json({ error: 'Помилка сервера при отриманні контракту' });
    }
});

// Создание нового контракта
router.post('/', checkAdminOrManager, async (req, res) => {
    try {
        const db = req.db;
        if (!db) {
            console.error('База даних не ініціалізована');
            return res.status(500).json({ error: 'Серверна помилка: база даних не ініціалізована' });
        }

        const {
            number, name, party, date, endDate, amount, status, equipmentType,
            region, notes, paymentTerms, deliveryTerms, contractDuration, responsiblePerson
        } = req.body;

        // Валидация входных данных
        if (!number || !name || !party || !date || !endDate || !amount || !status || !equipmentType || !region) {
            console.log('Помилка валідації: відсутні обов’язкові поля', req.body);
            return res.status(400).json({ error: 'Усі обов’язкові поля мають бути заповнені' });
        }

        const sessionUserId = req.session.userId;
        const userRole = req.session.userRole;

        // Отримуємо userId із pendingContractData
        const pendingContractData = req.session.pendingContractData;
        if (!pendingContractData || !pendingContractData.userId) {
            console.log('Помилка: pendingContractData або userId відсутні в сесії', req.session);
            return res.status(400).json({ error: 'Не вказано користувача для створення контракту. Створіть контракт через сповіщення.' });
        }

        const userId = pendingContractData.userId;

        // Логирование для отладки
        console.log('Дані для створення контракту:', req.body);
        console.log(`Створювач контракту: userId=${sessionUserId}, role=${userRole}`);
        console.log(`Прив’язка контракту до користувача: userId=${userId}`);

        const result = await db.run(
            `INSERT INTO contracts (
                number, name, party, date, endDate, amount, status, equipmentType,
                region, notes, paymentTerms, deliveryTerms, contractDuration, responsiblePerson,
                userId, createdByRole, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                number, name, party, date, endDate, amount, status, equipmentType,
                region, notes, paymentTerms, deliveryTerms, contractDuration, responsiblePerson,
                userId, // Використовуємо userId із pendingContractData
                userRole, new Date().toISOString()
            ]
        );

        const notificationId = req.session.pendingContractData?.notificationId;
        if (notificationId) {
            await db.run(`DELETE FROM notifications WHERE id = ? AND userId = ?`, [notificationId, sessionUserId]);
            console.log(`POST /api/contracts: Сповіщення з ID ${notificationId} видалено після створення договору.`);
            delete req.session.pendingContractData; // Очищаємо після створення
        }

        const newContract = await db.get('SELECT * FROM contracts WHERE id = ?', [result.lastID]);
        console.log(`POST /api/contracts: Створено новий контракт з ID ${result.lastID} користувачем ${sessionUserId}, прив’язаний до userId=${userId}`);
        res.status(201).json(newContract);
    } catch (err) {
        console.error('Помилка при створенні контракту:', err.message, err.stack);
        res.status(500).json({ error: 'Помилка сервера при створенні контракту' });
    }
});

// Обновление контракта
router.put('/:id', checkAdminOrManager, async (req, res) => {
    try {
        const db = req.db;
        if (!db) {
            console.error('База даних не ініціалізована');
            return res.status(500).json({ error: 'Серверна помилка: база даних не ініціалізована' });
        }

        const contractId = req.params.id;
        const userId = req.session.userId;
        const userRole = req.session.userRole;

        let contract;
        if (userRole === 'admin') {
            contract = await db.get('SELECT * FROM contracts WHERE id = ?', [contractId]);
        } else {
            contract = await db.get('SELECT * FROM contracts WHERE id = ? AND userId = ?', [contractId, userId]);
        }

        if (!contract) {
            console.log(`PUT /api/contracts/${contractId}: Контракт не знайдений для користувача ${userId}`);
            return res.status(404).json({ error: 'Контракт не знайдений' });
        }

        const {
            number, name, party, date, endDate, amount, status, equipmentType,
            region, notes, paymentTerms, deliveryTerms, contractDuration, responsiblePerson
        } = req.body;

        await db.run(
            `UPDATE contracts SET
                number = ?, name = ?, party = ?, date = ?, endDate = ?, amount = ?, status = ?,
                equipmentType = ?, region = ?, notes = ?, paymentTerms = ?, deliveryTerms = ?,
                contractDuration = ?, responsiblePerson = ?
            WHERE id = ?`,
            [
                number || contract.number,
                name || contract.name,
                party || contract.party,
                date || contract.date,
                endDate || contract.endDate,
                amount || contract.amount,
                status || contract.status,
                equipmentType || contract.equipmentType,
                region || contract.region,
                notes || contract.notes,
                paymentTerms || contract.paymentTerms,
                deliveryTerms || contract.deliveryTerms,
                contractDuration || contract.contractDuration,
                responsiblePerson || contract.responsiblePerson,
                contractId
            ]
        );

        const updatedContract = await db.get('SELECT * FROM contracts WHERE id = ?', [contractId]);
        console.log(`PUT /api/contracts/${contractId}: Контракт оновлено користувачем ${userId}`);
        res.json(updatedContract);
    } catch (err) {
        console.error(`Помилка при оновленні контракту ${req.params.id}:`, err.message, err.stack);
        res.status(500).json({ error: 'Помилка сервера при оновленні контракту' });
    }
});

// Удаление контракта
router.delete('/:id', checkAdminOrManager, async (req, res) => {
    try {
        const db = req.db;
        if (!db) {
            console.error('База даних не ініціалізована');
            return res.status(500).json({ error: 'Серверна помилка: база даних не ініціалізована' });
        }

        const contractId = req.params.id;
        const userId = req.session.userId;
        const userRole = req.session.userRole;

        let contract;
        if (userRole === 'admin') {
            contract = await db.get('SELECT * FROM contracts WHERE id = ?', [contractId]);
        } else {
            contract = await db.get('SELECT * FROM contracts WHERE id = ? AND userId = ?', [contractId, userId]);
        }

        if (!contract) {
            console.log(`DELETE /api/contracts/${contractId}: Контракт не знайдений для користувача ${userId}`);
            return res.status(404).json({ error: 'Контракт не знайдений' });
        }

        await db.run('DELETE FROM contracts WHERE id = ?', [contractId]);
        console.log(`DELETE /api/contracts/${contractId}: Контракт видалено користувачем ${userId}`);
        res.json({ message: 'Контракт успішно видалено' });
    } catch (err) {
        console.error(`Помилка при видаленні контракту ${req.params.id}:`, err.message, err.stack);
        res.status(500).json({ error: 'Помилка сервера при видаленні контракту' });
    }
});

export default router;