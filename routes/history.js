import express from 'express';

const router = express.Router();

function ensureDb(req, res, next) {
    if (!req.db) {
        return res.status(500).json({ error: 'База даних не ініціалізована' });
    }
    next();
}

function ensureAuthenticated(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Не авторизован' });
    }
    next();
}

router.get('/', ensureDb, ensureAuthenticated, async (req, res) => {
    try {
        const historyRecords = await req.db.all(
            `SELECT * FROM maintenance_history WHERE user_id = ? ORDER BY created_at DESC`,
            [req.session.userId]
        );
        res.json(historyRecords);
    } catch (err) {
        console.error('Помилка при отриманні історії:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/', ensureDb, ensureAuthenticated, async (req, res) => {
    const { date, type, description, responsible, reminder_id } = req.body;
    const userId = req.session.userId;

    if (!date || !type || !description || !responsible) {
        return res.status(400).json({ error: 'Усі поля обов’язкові.' });
    }

    try {
        const result = await req.db.run(
            `INSERT INTO maintenance_history (user_id, date, type, description, responsible, reminder_id) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, date, type, description, responsible, reminder_id || null]
        );
        const newRecord = await req.db.get(
            `SELECT * FROM maintenance_history WHERE id = ?`,
            [result.lastID]
        );

        const wss = req.app.get('wss');
        if (wss && wss.clients) {
            wss.clients.forEach(client => {
                if (client.readyState === client.OPEN) {
                    client.send(JSON.stringify({ type: 'historyUpdated', record: newRecord }));
                }
            });
        } else {
            console.warn('WebSocket-сервер недоступний для відправки historyUpdated');
        }

        res.status(201).json(newRecord);
    } catch (err) {
        console.error('Помилка при додаванні запису в історію:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', ensureDb, ensureAuthenticated, async (req, res) => {
    const { date, type, description, responsible, reminder_id } = req.body;
    try {
        const record = await req.db.get(
            `SELECT * FROM maintenance_history WHERE id = ? AND user_id = ?`,
            [req.params.id, req.session.userId]
        );
        if (!record) {
            return res.status(404).json({ error: 'Запис не знайдено' });
        }

        await req.db.run(
            `UPDATE maintenance_history SET date = ?, type = ?, description = ?, responsible = ?, reminder_id = ? 
             WHERE id = ? AND user_id = ?`,
            [date || record.date, type || record.type, description || record.description, responsible || record.responsible, reminder_id !== undefined ? reminder_id : record.reminder_id, req.params.id, req.session.userId]
        );

        const updatedRecord = await req.db.get(
            `SELECT * FROM maintenance_history WHERE id = ? AND user_id = ?`,
            [req.params.id, req.session.userId]
        );

        const wss = req.app.get('wss');
        if (wss && wss.clients) {
            wss.clients.forEach(client => {
                if (client.readyState === client.OPEN) {
                    client.send(JSON.stringify({ type: 'historyUpdated', record: updatedRecord }));
                }
            });
        } else {
            console.warn('WebSocket-сервер недоступний для відправки historyUpdated');
        }

        res.status(200).json(updatedRecord);
    } catch (err) {
        console.error('Помилка при оновленні запису:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', ensureDb, ensureAuthenticated, async (req, res) => {
    try {
        const record = await req.db.get(
            `SELECT * FROM maintenance_history WHERE id = ? AND user_id = ?`,
            [req.params.id, req.session.userId]
        );
        if (!record) {
            return res.status(404).json({ error: 'Запис не знайдено' });
        }

        await req.db.run(
            `DELETE FROM maintenance_history WHERE id = ? AND user_id = ?`,
            [req.params.id, req.session.userId]
        );

        const wss = req.app.get('wss');
        if (wss && wss.clients) {
            wss.clients.forEach(client => {
                if (client.readyState === client.OPEN) {
                    client.send(JSON.stringify({ type: 'historyDeleted', id: req.params.id }));
                }
            });
        } else {
            console.warn('WebSocket-сервер недоступний для відправки historyDeleted');
        }

        res.status(204).send();
    } catch (err) {
        console.error('Помилка при видаленні запису:', err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;