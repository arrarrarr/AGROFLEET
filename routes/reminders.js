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

function determineStatus(dateTime, completed) {
    if (completed) return 'completed';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dateTime);
    dueDate.setHours(0, 0, 0, 0);
    const daysUntilDue = (dueDate - today) / (1000 * 60 * 60 * 24);

    if (daysUntilDue < 0) return 'completed';
    if (daysUntilDue === 0) return 'in_progress';
    return 'planned';
}

async function syncReminderToTask(db, reminder, userId) {
    try {
        console.log('Синхронізація нагадування:', reminder);
        const today = new Date();
        const dueDate = new Date(reminder.dateTime);
        const daysUntilDue = (dueDate - today) / (1000 * 60 * 60 * 24);
        let priority = 3;
        if (daysUntilDue <= 2) priority = 1;
        else if (daysUntilDue <= 7) priority = 2;

        const existingTask = await db.get(
            'SELECT * FROM tasks WHERE reminder_id = ? AND user_id = ?',
            [reminder.id, userId]
        );

        const status = determineStatus(reminder.dateTime, reminder.completed);

        if (existingTask) {
            await db.run(
                'UPDATE tasks SET name = ?, task_type = ?, priority = ?, due_date = ?, status = ? WHERE reminder_id = ? AND user_id = ?',
                [reminder.text, reminder.taskType, priority, dueDate.toISOString().split('T')[0], status, reminder.id, userId]
            );
            console.log(`Задача для нагадування ${reminder.id} оновлена в tasks з типом ${reminder.taskType} і статусом ${status}`);
        } else if (!reminder.completed) {
            await db.run(
                'INSERT INTO tasks (name, task_type, priority, due_date, user_id, reminder_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [reminder.text, reminder.taskType, priority, dueDate.toISOString().split('T')[0], userId, reminder.id, status]
            );
            console.log(`Задача для нагадування ${reminder.id} додана в tasks з типом ${reminder.taskType}`);
        }
    } catch (error) {
        console.error('Помилка при синхронізації нагадування з tasks:', error.message);
        throw error;
    }
}

async function addToMaintenanceHistory(db, reminder, userId, wss) {
    try {
        // Використовуємо просто reminder.text без автоматичного номера
        const reminderLabel = reminder.text;
        const historyRecord = {
            date: new Date(reminder.dateTime).toISOString().split('T')[0],
            type: reminder.taskType === 'maintenance' ? 'Техогляд' : 'Ремонт',
            description: reminder.taskType === 'repair'
                ? `Завершено нагадування ${reminderLabel}: Ремонт техніки ${reminder.equipment}, деталь: ${reminder.repairPart || 'невідомо'}, опис: ${reminder.repairDescription || 'немає'}`
                : `Завершено нагадування ${reminderLabel}: Техогляд техніки ${reminder.equipment}`,
            responsible: reminder.operator || 'Невідомо',
            reminder_id: reminder.id
        };

        const result = await db.run(
            `INSERT INTO maintenance_history (user_id, date, type, description, responsible, reminder_id) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, historyRecord.date, historyRecord.type, historyRecord.description, historyRecord.responsible, historyRecord.reminder_id]
        );

        const newRecord = await db.get(
            `SELECT * FROM maintenance_history WHERE id = ?`,
            [result.lastID]
        );

        if (wss && wss.clients) {
            wss.clients.forEach(client => {
                if (client.readyState === client.OPEN) {
                    client.send(JSON.stringify({ type: 'historyUpdated', record: newRecord }));
                }
            });
            console.log(`Додано запис в історію для нагадування ${reminder.id} і відправлено через WebSocket:`, newRecord);
        } else {
            console.warn('WebSocket-сервер недоступний для відправки historyUpdated');
        }
    } catch (error) {
        console.error('Помилка при додаванні до історії:', error.message);
        throw error;
    }
}

router.get('/', ensureDb, ensureAuthenticated, async (req, res) => {
    try {
        let reminders = await req.db.all(`SELECT * FROM reminders WHERE user_id = ?`, [req.session.userId]);

        for (let reminder of reminders) {
            const newStatus = determineStatus(reminder.dateTime, reminder.completed);
            if (reminder.status !== newStatus) {
                await req.db.run(
                    `UPDATE reminders SET status = ? WHERE id = ? AND user_id = ?`,
                    [newStatus, reminder.id, req.session.userId]
                );
                reminder.status = newStatus;
            }
        }

        if (req.query.date) {
            reminders = reminders.filter(r => new Date(r.dateTime).toISOString().split('T')[0] === req.query.date);
        }
        if (req.query.status) {
            reminders = reminders.filter(r => r.status === req.query.status);
        }

        res.json(reminders);
    } catch (err) {
        console.error('Помилка при отриманні нагадувань:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/', ensureDb, ensureAuthenticated, async (req, res) => {
    const { text, reminder_label, card_title, dateTime, equipment, operator, taskType, repairPart, repairDescription } = req.body;
    const userId = req.session.userId;

    if (!text || !dateTime || !equipment || !operator || !taskType) {
        return res.status(400).json({ error: 'Текст, дата/час, техніка, оператор і тип задачі обов’язкові.' });
    }

    try {
        const status = determineStatus(dateTime, false);
        const result = await req.db.run(
            `INSERT INTO reminders (user_id, text, reminder_label, card_title, dateTime, completed, status, equipment, operator, taskType, repairPart, repairDescription) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, text, reminder_label || null, card_title || null, dateTime, false, status, equipment, operator, taskType, repairPart || null, repairDescription || null]
        );
        const reminder = await req.db.get(`SELECT * FROM reminders WHERE id = ?`, [result.lastID]);
        await syncReminderToTask(req.db, reminder, userId);

        const wss = req.app.get('wss');
        if (wss && wss.clients) {
            wss.clients.forEach(client => {
                if (client.readyState === client.OPEN) {
                    client.send(JSON.stringify({ type: 'reminderUpdated', reminder }));
                }
            });
        } else {
            console.warn('WebSocket-сервер недоступний для відправки reminderUpdated');
        }

        res.status(201).json(reminder);
    } catch (err) {
        console.error('Помилка при додаванні нагадування:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id', ensureDb, ensureAuthenticated, async (req, res) => {
    try {
        const reminder = await req.db.get(`SELECT * FROM reminders WHERE id = ? AND user_id = ?`, [req.params.id, req.session.userId]);
        if (!reminder) {
            return res.status(404).json({ error: 'Нагадування не знайдено' });
        }
        res.json(reminder);
    } catch (err) {
        console.error('Помилка при отриманні нагадування:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', ensureDb, ensureAuthenticated, async (req, res) => {
    const { completed, text, reminder_label, card_title, dateTime, equipment, operator, taskType, repairPart, repairDescription } = req.body;

    try {
        const reminder = await req.db.get(`SELECT * FROM reminders WHERE id = ? AND user_id = ?`, [req.params.id, req.session.userId]);
        if (!reminder) {
            return res.status(404).json({ error: 'Нагадування не знайдено' });
        }

        let newStatus = reminder.status;
        if (typeof completed === 'boolean') {
            newStatus = determineStatus(reminder.dateTime, completed);
            await req.db.run(
                `UPDATE reminders SET completed = ?, status = ? WHERE id = ? AND user_id = ?`,
                [completed, newStatus, req.params.id, req.session.userId]
            );

            if (completed && !reminder.completed) {
                await addToMaintenanceHistory(req.db, { ...reminder, completed, status: newStatus }, req.session.userId, req.app.get('wss'));
            }
        }

        await req.db.run(
            `UPDATE reminders SET 
                text = ?, 
                reminder_label = ?,
                card_title = ?,
                dateTime = ?, 
                equipment = ?, 
                operator = ?, 
                taskType = ?, 
                repairPart = ?, 
                repairDescription = ? 
             WHERE id = ? AND user_id = ?`,
            [
                text || reminder.text,
                reminder_label !== undefined ? reminder_label : reminder.reminder_label,
                card_title !== undefined ? card_title : reminder.card_title,
                dateTime || reminder.dateTime,
                equipment || reminder.equipment,
                operator || reminder.operator,
                taskType || reminder.taskType,
                repairPart !== undefined ? repairPart : reminder.repairPart,
                repairDescription !== undefined ? repairDescription : reminder.repairDescription,
                req.params.id,
                req.session.userId
            ]
        );

        const updatedReminder = await req.db.get(`SELECT * FROM reminders WHERE id = ? AND user_id = ?`, [req.params.id, req.session.userId]);
        await syncReminderToTask(req.db, updatedReminder, req.session.userId);

        const wss = req.app.get('wss');
        if (wss && wss.clients) {
            wss.clients.forEach(client => {
                if (client.readyState === client.OPEN) {
                    client.send(JSON.stringify({ type: 'reminderUpdated', reminder: updatedReminder }));
                }
            });
        } else {
            console.warn('WebSocket-сервер недоступний для відправки reminderUpdated');
        }

        res.status(200).json(updatedReminder);
    } catch (err) {
        console.error('Помилка при оновленні нагадування:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', ensureDb, ensureAuthenticated, async (req, res) => {
    try {
        const reminder = await req.db.get(`SELECT * FROM reminders WHERE id = ? AND user_id = ?`, [req.params.id, req.session.userId]);
        if (!reminder) {
            return res.status(404).json({ error: 'Нагадування не знайдено' });
        }

        await req.db.run(`DELETE FROM reminders WHERE id = ? AND user_id = ?`, [req.params.id, req.session.userId]);
        await req.db.run(`DELETE FROM tasks WHERE reminder_id = ? AND user_id = ?`, [req.params.id, req.session.userId]);

        const wss = req.app.get('wss');
        if (wss && wss.clients) {
            wss.clients.forEach(client => {
                if (client.readyState === client.OPEN) {
                    client.send(JSON.stringify({ type: 'reminderDeleted', id: req.params.id }));
                }
            });
        } else {
            console.warn('WebSocket-сервер недоступний для відправки reminderDeleted');
        }

        res.status(204).send();
    } catch (err) {
        console.error('Помилка при видаленні нагадування:', err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;