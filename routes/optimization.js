import { Router } from 'express';
import ExcelJS from 'exceljs';

const router = Router();

const ensureAuthenticated = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Не авторизован' });
    }
    next();
};

const logAction = async (db, userId, action, details) => {
    try {
        await db.run(
            `INSERT INTO logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)`,
            [userId, action, JSON.stringify(details), new Date().toISOString()]
        );
    } catch (error) {
        console.error('Помилка при логуванні дії:', error.message);
    }
};

const validateTaskData = (task) => {
    const errors = [];
    if (!task.name || typeof task.name !== 'string' || task.name.length < 3) {
        errors.push('Назва завдання повинна бути рядком довжиною не менше 3 символів');
    }
    if (!['technical_inspection', 'repair'].includes(task.task_type)) {
        errors.push('Невірний тип завдання');
    }
    if (!Number.isInteger(task.priority) || task.priority < 1 || task.priority > 3) {
        errors.push('Пріоритет має бути цілим числом від 1 до 3');
    }
    if (!task.due_date || !/^\d{4}-\d{2}-\d{2}$/.test(task.due_date)) {
        errors.push('Дата виконання має бути у форматі YYYY-MM-DD');
    }
    if (task.status && !['planned', 'in_progress', 'completed'].includes(task.status)) {
        errors.push('Невірний статус завдання');
    }
    return errors;
};

router.get('/tasks', ensureAuthenticated, async (req, res) => {
    try {
        const { status, task_type, due_date, equipment, operator } = req.query;
        let query = 'SELECT * FROM tasks WHERE user_id = ?';
        const params = [req.session.userId];

        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        if (task_type) {
            query += ' AND task_type = ?';
            params.push(task_type);
        }
        if (due_date) {
            query += ' AND due_date = ?';
            params.push(due_date);
        }
        if (equipment) {
            query += ' AND equipment = ?';
            params.push(equipment);
        }
        if (operator) {
            query += ' AND operator = ?';
            params.push(operator);
        }

        const tasks = await req.db.all(query, params);
        console.log('Завдання, повернуті для userId:', req.session.userId, tasks);
        res.json(tasks);
    } catch (error) {
        console.error('Помилка при отриманні завдань:', error.message);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

router.get('/operators', ensureAuthenticated, async (req, res) => {
    try {
        const operators = await req.db.all('SELECT name FROM operators');
        res.json(operators);
    } catch (error) {
        console.error('Помилка при отриманні операторів:', error.message);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

router.post('/tasks', ensureAuthenticated, async (req, res) => {
    const { name, task_type, priority, due_date, equipment, operator, dependencies, status } = req.body;

    const errors = validateTaskData({ name, task_type, priority, due_date, status });
    if (errors.length > 0) {
        return res.status(400).json({ error: 'Невірні дані', details: errors });
    }

    try {
        if (dependencies) {
            const dependencyIds = dependencies.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            if (dependencyIds.length > 0) {
                const dependentTasks = await req.db.all(
                    'SELECT id, status FROM tasks WHERE id IN (' + dependencyIds.join(',') + ') AND user_id = ?',
                    [req.session.userId]
                );
                const incompleteDependencies = dependentTasks.filter(task => task.status !== 'completed');
                if (incompleteDependencies.length > 0) {
                    return res.status(400).json({ error: 'Не всі залежності завершені', details: incompleteDependencies });
                }
            }
        }

        await req.db.run(
            `INSERT INTO tasks (name, task_type, priority, due_date, user_id, equipment, operator, dependencies, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, task_type, priority, due_date, req.session.userId, equipment || null, operator || null, dependencies || null, status || 'planned']
        );

        await logAction(req.db, req.session.userId, 'add_task', { name, task_type, due_date });

        res.status(201).json({ message: 'Завдання додано' });
    } catch (error) {
        console.error('Помилка при додаванні завдання:', error.message);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

router.put('/tasks/:id', ensureAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['planned', 'in_progress', 'completed'].includes(status)) {
        return res.status(400).json({ error: 'Невірний статус завдання' });
    }

    try {
        const task = await req.db.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [id, req.session.userId]);
        if (!task) {
            return res.status(404).json({ error: 'Завдання не знайдено' });
        }

        if (status !== 'planned' && task.dependencies) {
            const dependencyIds = task.dependencies.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            if (dependencyIds.length > 0) {
                const dependentTasks = await req.db.all(
                    'SELECT id, status, due_date FROM tasks WHERE id IN (' + dependencyIds.join(',') + ') AND user_id = ?',
                    [req.session.userId]
                );
                const incompleteDependencies = dependentTasks.filter(task => task.status !== 'completed');
                if (incompleteDependencies.length > 0) {
                    return res.status(400).json({ error: 'Не всі залежності завершені', details: incompleteDependencies });
                }
            }
        }

        if (status === 'in_progress') {
            if (task.equipment) {
                const equipmentSchedules = await req.db.all(
                    'SELECT * FROM moto_time WHERE equipment = ? AND date = ? AND user_id = ?',
                    [task.equipment, task.due_date, req.session.userId]
                );
                if (equipmentSchedules.length > 0) {
                    return res.status(400).json({ error: `Обладнання ${task.equipment} вже зайняте на цю дату` });
                }
            }
            if (task.operator) {
                const operatorSchedules = await req.db.all(
                    'SELECT * FROM tasks WHERE operator = ? AND status = ? AND due_date = ? AND user_id = ?',
                    [task.operator, 'in_progress', task.due_date, req.session.userId]
                );
                if (operatorSchedules.length > 0) {
                    return res.status(400).json({ error: `Оператор ${task.operator} вже зайнятий на цю дату` });
                }
            }
        }

        if (status === 'completed' && task.equipment) {
            await req.db.run(
                'INSERT INTO moto_time (user_id, equipment, hours, date, work_type, operator) VALUES (?, ?, ?, ?, ?, ?)',
                [req.session.userId, task.equipment, 1, task.due_date, task.task_type, task.operator || null]
            );
            console.log(`Додано запис у moto_time для обладнання: ${task.equipment}`);
        }

        await req.db.run(
            'UPDATE tasks SET status = ? WHERE id = ? AND user_id = ?',
            [status, id, req.session.userId]
        );

        await logAction(req.db, req.session.userId, 'update_task_status', { task_id: id, new_status: status });

        res.json({ message: 'Статус оновлено' });
    } catch (error) {
        console.error('Помилка при оновленні статусу:', error.message);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

router.delete('/tasks/:id', ensureAuthenticated, async (req, res) => {
    const { id } = req.params;
    try {
        const task = await req.db.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [id, req.session.userId]);
        if (!task) {
            return res.status(404).json({ error: 'Завдання не знайдено' });
        }

        await req.db.run('DELETE FROM tasks WHERE id = ? AND user_id = ?', [id, req.session.userId]);

        await logAction(req.db, req.session.userId, 'delete_task', { task_id: id, task_name: task.name });

        res.json({ message: 'Завдання видалено' });
    } catch (error) {
        console.error('Помилка при видаленні завдання:', error.message);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

router.post('/optimize', ensureAuthenticated, async (req, res) => {
    try {
        const tasks = await req.db.all('SELECT * FROM tasks WHERE user_id = ? AND status != ?', [req.session.userId, 'completed']);
        if (!tasks || tasks.length === 0) {
            return res.status(200).json({ message: 'Немає завдань для оптимізації' });
        }

        console.log('Завдання для оптимізації:', tasks);

        const motoTimeRecords = await req.db.all('SELECT equipment, date FROM moto_time WHERE user_id = ?', [req.session.userId]);
        const operators = await req.db.all('SELECT name FROM operators');
        const allTasks = await req.db.all('SELECT * FROM tasks WHERE user_id = ?', [req.session.userId]);

        // Приоритизация задач на основе task_type (техосмотр более приоритетный, чем ремонт)
        const typePriority = {
            'technical_inspection': 1,
            'repair': 2
        };

        const optimizedTasks = tasks.sort((a, b) => {
            // Сначала по приоритету типа задачи
            const typeComparison = typePriority[a.task_type] - typePriority[b.task_type];
            if (typeComparison !== 0) return typeComparison;

            // Если типы одинаковые, по приоритету
            if (a.priority !== b.priority) return a.priority - b.priority;

            // Если приоритеты одинаковые, по дате
            return new Date(a.due_date) - new Date(b.due_date);
        });

        for (let task of optimizedTasks) {
            if (task.dependencies) {
                const dependencyIds = task.dependencies.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                if (dependencyIds.length > 0) {
                    const dependentTasks = await req.db.all(
                        'SELECT id, status, due_date FROM tasks WHERE id IN (' + dependencyIds.join(',') + ') AND user_id = ?',
                        [req.session.userId]
                    );
                    const incompleteDependencies = dependentTasks.filter(task => task.status !== 'completed');
                    if (incompleteDependencies.length > 0) {
                        const latestDependencyDate = dependentTasks
                            .map(t => new Date(t.due_date))
                            .reduce((a, b) => a > b ? a : b);
                        task.due_date = new Date(latestDependencyDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                        await req.db.run(
                            'UPDATE tasks SET due_date = ? WHERE id = ? AND user_id = ?',
                            [task.due_date, task.id, req.session.userId]
                        );
                        console.log(`Оновлено дату завдання ${task.id} через залежності: ${task.due_date}`);
                    }
                }
            }
        }

        const uniqueEquipment = [...new Set(motoTimeRecords.map(record => record.equipment))];
        const equipmentAvailability = new Map(uniqueEquipment.map(eq => [eq, []]));
        const operatorAvailability = new Map(operators.map(op => [op.name, []]));

        allTasks.forEach(task => {
            if (task.equipment) {
                const eqSchedule = equipmentAvailability.get(task.equipment) || [];
                eqSchedule.push({ start_date: task.due_date, end_date: task.due_date });
                equipmentAvailability.set(task.equipment, eqSchedule);
            }
            if (task.operator) {
                const opSchedule = operatorAvailability.get(task.operator) || [];
                opSchedule.push({ start_date: task.due_date, end_date: task.due_date });
                operatorAvailability.set(task.operator, opSchedule);
            }
        });

        motoTimeRecords.forEach(record => {
            const eqSchedule = equipmentAvailability.get(record.equipment) || [];
            eqSchedule.push({ start_date: record.date, end_date: record.date });
            equipmentAvailability.set(record.equipment, eqSchedule);
        });

        for (let task of optimizedTasks) {
            if (!task.equipment) {
                let selectedEquipment = null;
                for (let eq of uniqueEquipment) {
                    const schedule = equipmentAvailability.get(eq) || [];
                    const isBusy = schedule.some(s => s.start_date === task.due_date);
                    if (!isBusy) {
                        selectedEquipment = eq;
                        break;
                    }
                }
                if (!selectedEquipment) {
                    selectedEquipment = uniqueEquipment.reduce((a, b) => 
                        (equipmentAvailability.get(a)?.length || 0) <= (equipmentAvailability.get(b)?.length || 0) ? a : b
                    );
                }
                task.equipment = selectedEquipment;
                const eqSchedule = equipmentAvailability.get(task.equipment) || [];
                eqSchedule.push({ start_date: task.due_date, end_date: task.due_date });
                equipmentAvailability.set(task.equipment, eqSchedule);
                console.log(`Призначено обладнання для завдання ${task.id}: ${task.equipment}`);
            }

            if (!task.operator) {
                let selectedOperator = null;
                for (let op of operators) {
                    const schedule = operatorAvailability.get(op.name) || [];
                    const isBusy = schedule.some(s => s.start_date === task.due_date);
                    if (!isBusy) {
                        selectedOperator = op;
                        break;
                    }
                }
                if (!selectedOperator) {
                    selectedOperator = operators.reduce((a, b) => 
                        (operatorAvailability.get(a.name)?.length || 0) <= (operatorAvailability.get(b.name)?.length || 0) ? a : b
                    );
                }
                task.operator = selectedOperator.name;
                const opSchedule = operatorAvailability.get(task.operator) || [];
                opSchedule.push({ start_date: task.due_date, end_date: task.due_date });
                operatorAvailability.set(task.operator, opSchedule);
                console.log(`Призначено оператора для завдання ${task.id}: ${task.operator}`);
            }

            await req.db.run(
                'UPDATE tasks SET equipment = ?, operator = ? WHERE id = ? AND user_id = ?',
                [task.equipment, task.operator, task.id, req.session.userId]
            );
        }

        await logAction(req.db, req.session.userId, 'optimize_tasks', { task_count: optimizedTasks.length });

        res.json(optimizedTasks);
    } catch (error) {
        console.error('Помилка при оптимізації завдань:', error.message);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

router.get('/export', ensureAuthenticated, async (req, res) => {
    try {
        // Получаем задачи
        const tasks = await req.db.all('SELECT * FROM tasks WHERE user_id = ?', [req.session.userId]);
        // Получаем связанные напоминания
        const reminders = await req.db.all('SELECT * FROM reminders WHERE user_id = ?', [req.session.userId]);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Завдання');

        // Определяем столбцы
        worksheet.columns = [
            { header: 'Назва', key: 'name', width: 30 },
            { header: 'Тип', key: 'task_type', width: 15 },
            { header: 'Пріоритет', key: 'priority', width: 10 },
            { header: 'Дата виконання', key: 'due_date', width: 15 },
            { header: 'Обладнання', key: 'equipment', width: 20 },
            { header: 'Оператор', key: 'operator', width: 20 },
            { header: 'Залежності', key: 'dependencies', width: 20 },
            { header: 'Статус', key: 'status', width: 15 },
            { header: 'Деталь ремонту', key: 'repairPart', width: 20 },
            { header: 'Опис ремонту', key: 'repairDescription', width: 30 },
        ];

        // Функции для перевода значений в читаемый вид
        const getTaskTypeLabel = (taskType) => {
            const taskTypeMap = {
                'technical_inspection': 'Техогляд',
                'repair': 'Ремонт',
                'maintenance': 'Техогляд', // Для обратной совместимости
            };
            return taskTypeMap[taskType] || taskType || 'Невідомий тип';
        };

        const getStatusLabel = (status) => {
            const statusMap = {
                'planned': 'Заплановано',
                'in_progress': 'В процесі',
                'completed': 'Завершено'
            };
            return statusMap[status] || status || 'Невідомий статус';
        };

        // Формируем строки для экспорта
        tasks.forEach(task => {
            // Находим связанное напоминание, если есть
            const relatedReminder = reminders.find(reminder => reminder.id === task.reminder_id);

            worksheet.addRow({
                name: task.name,
                task_type: getTaskTypeLabel(task.task_type),
                priority: task.priority,
                due_date: task.due_date,
                equipment: task.equipment || 'Немає',
                operator: task.operator || 'Немає',
                dependencies: task.dependencies || 'Немає',
                status: getStatusLabel(task.status),
                repairPart: relatedReminder && relatedReminder.taskType === 'repair' ? relatedReminder.repairPart || 'Немає' : 'Н/Д',
                repairDescription: relatedReminder && relatedReminder.taskType === 'repair' ? relatedReminder.repairDescription || 'Немає' : 'Н/Д',
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="tasks.xlsx"');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Помилка при експорті завдань:', error.message);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

export default router;