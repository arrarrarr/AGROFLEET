// routes/taskOptimizer.js
export async function optimizeTasks(tasks, db) {
    // Простой алгоритм оптимизации: сортировка по приоритету и дедлайну с учетом доступности
    const optimizedTasks = [...tasks];

    // Получение данных об оборудовании и операторах
    const equipmentUsage = await db.all('SELECT equipment, due_date FROM optimization WHERE completed = 0');
    const operatorUsage = await db.all('SELECT operator, due_date FROM optimization WHERE completed = 0');

    // Сортировка задач
    optimizedTasks.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return new Date(a.due_date) - new Date(b.due_date);
    });

    // Перераспределение ресурсов
    for (let task of optimizedTasks) {
        if (task.equipment) {
            const conflicts = equipmentUsage.filter(e => e.equipment === task.equipment && e.due_date === task.due_date);
            if (conflicts.length > 1) {
                // Назначить альтернативное оборудование
                const availableEq = await db.get('SELECT name FROM equipment WHERE name != ? AND type = ? LIMIT 1', [task.equipment, task.task_type]);
                if (availableEq) task.equipment = availableEq.name;
            }
        }
        if (task.operator) {
            const conflicts = operatorUsage.filter(o => o.operator === task.operator && o.due_date === task.due_date);
            if (conflicts.length > 2) {
                // Назначить другого оператора
                const availableOp = await db.get('SELECT name FROM operators WHERE name != ? LIMIT 1', [task.operator]);
                if (availableOp) task.operator = availableOp.name;
            }
        }
    }

    return optimizedTasks;
}