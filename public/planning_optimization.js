const API_URL = 'http://localhost:3000/api/optimization';
const MOTO_TIME_API = 'http://localhost:3000/api/moto_time';

let currentUserId;
let lastTaskUpdate = 0;

async function checkAuth() {
    try {
        const response = await fetch('http://localhost:3000/api/auth/check-auth', {
            method: 'GET',
            credentials: 'include'
        });
        if (!response.ok) {
            console.error('Помилка авторизації:', response.status);
            window.location.href = '/profile.html?authRequired=true';
            return null;
        }
        const userData = await response.json();
        if (userData.role === 'unauthorized') {
            console.error('Користувач не авторизований');
            window.location.href = '/profile.html?authRequired=true';
            return null;
        }
        currentUserId = userData.id;
        return userData.id;
    } catch (error) {
        console.error('Помилка при перевірці авторизації:', error.message);
        window.location.href = '/profile.html?authRequired=true';
        return null;
    }
}

function validateTaskForm(task) {
    const errors = [];
    if (!task.name || task.name.length < 3) errors.push('Назва завдання має бути не коротше 3 символів');
    if (!['technical_inspection', 'repair'].includes(task.task_type)) errors.push('Виберіть коректний тип завдання');
    if (!Number.isInteger(task.priority) || task.priority < 1 || task.priority > 3) errors.push('Пріоритет має бути числом від 1 до 3');
    if (!task.due_date || !/^\d{4}-\d{2}-\d{2}$/.test(task.due_date)) errors.push('Дата виконання має бути у форматі YYYY-MM-DD');
    return errors;
}

function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

async function updateTaskStatuses(tasks) {
    for (let task of tasks) {
        let updateData = {};

        const dueDate = new Date(task.due_date);
        const todayDate = new Date();
        const diffDays = (dueDate - todayDate) / (1000 * 60 * 60 * 24);

        if (task.status === 'planned') {
            if (diffDays <= 3 && diffDays > 0) {
                updateData.priority = Math.max(1, task.priority - 1);
            } else if (diffDays > 7) {
                updateData.priority = Math.min(3, task.priority + 1);
            }
        } else if (task.status === 'in_progress') {
            if (diffDays < 0) {
                updateData.priority = 1;
            }
        } else if (task.status === 'completed') {
            updateData.priority = Math.min(3, task.priority + 1);
        }

        if (Object.keys(updateData).length > 0) {
            await fetch(`${API_URL}/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData),
                credentials: 'include'
            });
        }
    }
}

async function fetchTasks() {
    if (!currentUserId) {
        console.warn('Користувач не авторизований, перезавантаження сторінки');
        await checkAuth();
        if (!currentUserId) return;
    }

    try {
        const taskType = document.getElementById('taskTypeFilter').value;
        const equipment = document.getElementById('equipmentFilter').value;
        const operator = document.getElementById('operatorFilter').value;
        const dueDate = document.getElementById('dueDateFilter').value;
        const status = document.getElementById('statusFilter').value;

        const params = new URLSearchParams();
        if (taskType !== '') params.append('task_type', taskType);
        if (equipment !== '') params.append('equipment', equipment);
        if (operator !== '') params.append('operator', operator);
        if (dueDate !== '') params.append('due_date', dueDate);
        if (status !== '') params.append('status', status);

        const url = params.toString() ? `${API_URL}/tasks?${params.toString()}` : `${API_URL}/tasks`;
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Помилка завантаження завдань');
        }
        const tasks = await response.json();
        await updateTaskStatuses(tasks);
        const updatedTasks = await fetch(url, { credentials: 'include' }).then(res => res.json());
        const motoTimeRecords = await fetchMotoTime(true);
        updateKanbanBoard(updatedTasks, motoTimeRecords);
        updateListView(updatedTasks, motoTimeRecords);
        updateCalendarView(updatedTasks, motoTimeRecords);
        updateStatusBar(updatedTasks);
        populateDependenciesSelect(updatedTasks);
        lastTaskUpdate = Date.now();
    } catch (error) {
        console.error('Помилка при отриманні завдань:', error.message);
        showNotification(`Помилка: ${error.message}`, 'error');
    }
}

async function fetchOperators() {
    try {
        const response = await fetch(`${API_URL}/operators`, { credentials: 'include' });
        if (!response.ok) throw new Error('Помилка завантаження операторів');
        const operators = await response.json();
        const operatorSelect = document.getElementById('operatorSelect');
        const operatorFilter = document.getElementById('operatorFilter');
        operatorSelect.innerHTML = '<option value="">Оберіть оператора</option>';
        operatorFilter.innerHTML = '<option value="">Усі оператори</option>';
        operators.forEach(operator => {
            const option = document.createElement('option');
            option.value = operator.name;
            option.textContent = operator.name;
            operatorSelect.appendChild(option);
            operatorFilter.appendChild(option.cloneNode(true));
        });
    } catch (error) {
        console.error('Помилка при отриманні операторів:', error.message);
        showNotification('Помилка при отриманні операторів.', 'error');
    }
}

async function fetchMotoTime(preserveSelection = false) {
    try {
        const response = await fetch(MOTO_TIME_API, { credentials: 'include' });
        if (!response.ok) throw new Error('Помилка завантаження мотогодин');
        const records = await response.json();

        const equipmentSelect = document.getElementById('equipmentSelect');
        const equipmentFilter = document.getElementById('equipmentFilter');

        const selectedEquipmentFilter = preserveSelection ? equipmentFilter.value : '';
        const selectedEquipmentSelect = preserveSelection ? equipmentSelect.value : '';

        const uniqueEquipment = [...new Set(records.map(record => record.equipment))];
        equipmentSelect.innerHTML = '<option value="">Оберіть обладнання</option>';
        equipmentFilter.innerHTML = '<option value="">Усе обладнання</option>';

        uniqueEquipment.forEach(equipment => {
            const totalHours = records
                .filter(record => record.equipment === equipment)
                .reduce((sum, record) => sum + (record.hours || 0), 0);
            const option = document.createElement('option');
            option.value = equipment;
            option.textContent = `${equipment} (Моточаси: ${totalHours.toFixed(2)})`;
            equipmentSelect.appendChild(option);
            equipmentFilter.appendChild(option.cloneNode(true));
        });

        if (preserveSelection) {
            if (selectedEquipmentFilter && uniqueEquipment.includes(selectedEquipmentFilter)) {
                equipmentFilter.value = selectedEquipmentFilter;
            }
            if (selectedEquipmentSelect && uniqueEquipment.includes(selectedEquipmentSelect)) {
                equipmentSelect.value = selectedEquipmentSelect;
            }
        }

        return records;
    } catch (error) {
        console.error('Помилка при отриманні мотогодин:', error.message);
        showNotification('Помилка при отриманні мотогодин.', 'error');
        return [];
    }
}

function populateDependenciesSelect(tasks) {
    const dependenciesSelect = document.getElementById('dependencies');
    dependenciesSelect.innerHTML = '<option value="">Немає залежностей</option>';
    tasks.forEach(task => {
        const option = document.createElement('option');
        option.value = task.id;
        option.textContent = task.name;
        dependenciesSelect.appendChild(option);
    });
}

function getTaskTypeLabel(taskType) {
    const taskTypeMap = {
        'technical_inspection': 'Техогляд',
        'repair': 'Ремонт',
        'maintenance': 'Техогляд', // Для обратной совместимости
    };
    return taskTypeMap[taskType] || taskType || 'Невідомий тип';
}

function getStatusLabel(status) {
    const statusMap = {
        'planned': 'Заплановано',
        'in_progress': 'В процесі',
        'completed': 'Завершено'
    };
    return statusMap[status] || status || 'Невідомий статус';
}

function calculateTimeRemaining(dueDate) {
    const now = new Date();
    const due = new Date(dueDate);
    const diffMs = due - now;
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    return diffHours >= 0 ? `${diffHours} год` : `Просрочено на ${Math.abs(diffHours)} год`;
}

function sortTasks(tasks) {
    const statusOrder = { 'planned': 1, 'in_progress': 2, 'completed': 3 };
    return tasks.sort((a, b) => {
        const dateComparison = a.due_date.localeCompare(b.due_date);
        if (dateComparison !== 0) return dateComparison;
        return statusOrder[a.status] - statusOrder[b.status];
    });
}

function updateKanbanBoard(tasks, motoTimeRecords) {
    const columns = {
        planned: document.getElementById('planned-tasks'),
        in_progress: document.getElementById('in-progress-tasks'),
        completed: document.getElementById('completed-tasks')
    };
    Object.values(columns).forEach(column => (column.innerHTML = ''));
    if (!tasks || tasks.length === 0) {
        Object.values(columns).forEach(column => (column.innerHTML = '<p class="empty-placeholder">Немає завдань</p>'));
        return;
    }
    tasks.forEach(task => {
        const taskElement = document.createElement('div');
        taskElement.className = 'kanban-task task-transition';
        taskElement.draggable = true;
        taskElement.dataset.id = task.id;
        // Формируем HTML карточки задачи, показываем "Залежності" только если они есть
        let dependenciesHtml = '';
        if (task.dependencies) {
            const dependencyNames = task.dependencies
                .split(',')
                .map(id => tasks.find(t => t.id === parseInt(id.trim()))?.name || id)
                .join(', ');
            dependenciesHtml = `<p>Залежності: ${dependencyNames}</p>`;
        }
        taskElement.innerHTML = `
            <h4>${task.name}</h4>
            <p>Тип: ${getTaskTypeLabel(task.task_type)}</p>
            <p>Пріоритет: ${task.priority}</p>
            <p>Дата: ${task.due_date}</p>
            <p>Обладнання: ${task.equipment || 'Немає'}</p>
            <p>Оператор: ${task.operator || 'Немає'}</p>
            ${dependenciesHtml}
            <button class="delete-btn" data-id="${task.id}"><i class="fas fa-trash"></i></button>
        `;
        if (columns[task.status]) {
            columns[task.status].appendChild(taskElement);
        } else {
            console.warn(`Завдання ${task.id} має некоректний статус: ${task.status}`);
        }
        taskElement.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', task.id);
        });
    });
    Object.keys(columns).forEach(status => {
        columns[status].parentElement.addEventListener('dragover', (e) => e.preventDefault());
        columns[status].parentElement.addEventListener('drop', async (e) => {
            e.preventDefault();
            const taskId = e.dataTransfer.getData('text/plain');
            try {
                const updateData = { status };
                const response = await fetch(`${API_URL}/tasks/${taskId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData),
                    credentials: 'include'
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Помилка зміни статусу');
                }
                fetchTasks();
            } catch (error) {
                console.error('Помилка при зміні статусу:', error.message);
                showNotification(`Помилка: ${error.message}`, 'error');
            }
        });
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.removeEventListener('click', handleDelete);
        btn.addEventListener('click', handleDelete);
    });
}

async function handleDelete(e) {
    const taskId = e.target.closest('button').dataset.id;
    try {
        await fetch(`${API_URL}/tasks/${taskId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        fetchTasks();
        showNotification('Завдання успішно видалено!', 'success');
    } catch (error) {
        console.error('Помилка при видаленні завдання:', error.message);
        showNotification('Помилка при видаленні завдання.', 'error');
    }
}

function updateListView(tasks, motoTimeRecords) {
    const tbody = document.getElementById('taskTableBody');
    tbody.innerHTML = '';
    if (!tasks || tasks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">Немає завдань</td></tr>';
        return;
    }

    const sortedTasks = sortTasks(tasks);

    sortedTasks.forEach(task => {
        const timeRemaining = task.status !== 'completed' ? calculateTimeRemaining(task.due_date) : 'Завершено';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${task.name}</td>
            <td>${getTaskTypeLabel(task.task_type)}</td>
            <td>${task.priority}</td>
            <td>${task.due_date}</td>
            <td>${task.equipment || 'Немає'}</td>
            <td>${task.operator || 'Немає'}</td>
            <td>${timeRemaining}</td>
            <td>${getStatusLabel(task.status)}</td>
        `;
        tbody.appendChild(row);
    });
}

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let currentDay = new Date().getDate();
let calendarMode = 'month';

function getWeekDates(year, month, day) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay() || 7;
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - (dayOfWeek - 1));
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const weekDay = new Date(startOfWeek);
        weekDay.setDate(startOfWeek.getDate() + i);
        dates.push(weekDay);
    }
    return dates;
}

function updateCalendarView(tasks, motoTimeRecords) {
    const calendar = document.getElementById('calendar');
    calendar.innerHTML = '';
    document.getElementById('calendar-title').textContent = `${new Date(currentYear, currentMonth).toLocaleString('uk', { month: 'long' })} ${currentYear} р.`;
    if (!tasks || tasks.length === 0) {
        calendar.innerHTML = '<p>Немає завдань</p>';
        return;
    }
    if (calendarMode === 'month') {
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
        const table = document.createElement('table');
        const headerRow = document.createElement('tr');
        ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].forEach(day => {
            const th = document.createElement('th');
            th.textContent = day;
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);
        let date = 1;
        for (let i = 0; i < 6; i++) {
            const row = document.createElement('tr');
            for (let j = 0; j < 7; j++) {
                const cell = document.createElement('td');
                if (i === 0 && j < adjustedFirstDay || date > daysInMonth) {
                    cell.textContent = '';
                } else {
                    cell.textContent = date;
                    const taskDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
                    const tasksOnDate = tasks.filter(task => task.due_date === taskDate);
                    const motoRecordsOnDate = motoTimeRecords.filter(record => record.date === taskDate);
                    if (tasksOnDate.length > 0 || motoRecordsOnDate.length > 0) {
                        const taskList = document.createElement('div');
                        taskList.className = 'calendar-tasks';
                        tasksOnDate.forEach(task => {
                            const taskItem = document.createElement('div');
                            taskItem.textContent = `Завдання: ${task.name}`;
                            taskList.appendChild(taskItem);
                        });
                        motoRecordsOnDate.forEach(record => {
                            const motoItem = document.createElement('div');
                            motoItem.textContent = `Техніка: ${record.equipment} (${record.hours} год)`;
                            taskList.appendChild(motoItem);
                        });
                        cell.appendChild(taskList);
                    }
                    date++;
                }
                row.appendChild(cell);
            }
            table.appendChild(row);
        }
        calendar.appendChild(table);
    } else if (calendarMode === 'week') {
        const weekDates = getWeekDates(currentYear, currentMonth, currentDay);
        const table = document.createElement('table');
        const headerRow = document.createElement('tr');
        ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].forEach(day => {
            const th = document.createElement('th');
            th.textContent = day;
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);
        const row = document.createElement('tr');
        weekDates.forEach(date => {
            const cell = document.createElement('td');
            cell.textContent = date.getDate();
            const taskDate = date.toISOString().split('T')[0];
            const tasksOnDate = tasks.filter(task => task.due_date === taskDate);
            const motoRecordsOnDate = motoTimeRecords.filter(record => record.date === taskDate);
            if (tasksOnDate.length > 0 || motoRecordsOnDate.length > 0) {
                const taskList = document.createElement('div');
                taskList.className = 'calendar-tasks';
                tasksOnDate.forEach(task => {
                    const taskItem = document.createElement('div');
                    taskItem.textContent = `Завдання: ${task.name}`;
                    taskList.appendChild(taskItem);
                });
                motoRecordsOnDate.forEach(record => {
                    const motoItem = document.createElement('div');
                    motoItem.textContent = `Техніка: ${record.equipment} (${record.hours} год)`;
                    taskList.appendChild(motoItem);
                });
                cell.appendChild(taskList);
            }
            row.appendChild(cell);
        });
        table.appendChild(row);
        calendar.appendChild(table);
    } else if (calendarMode === 'day') {
        const date = new Date(currentYear, currentMonth, currentDay);
        const taskDate = date.toISOString().split('T')[0];
        const tasksOnDate = tasks.filter(task => task.due_date === taskDate);
        const motoRecordsOnDate = motoTimeRecords.filter(record => record.date === taskDate);
        const div = document.createElement('div');
        div.innerHTML = `<h4>Завдання та використання техніки на ${date.toLocaleDateString('uk')}</h4>`;
        if (tasksOnDate.length > 0 || motoRecordsOnDate.length > 0) {
            const taskList = document.createElement('div');
            taskList.className = 'calendar-tasks';
            tasksOnDate.forEach(task => {
                const taskItem = document.createElement('div');
                taskItem.textContent = `Завдання: ${task.name}`;
                taskList.appendChild(taskItem);
            });
            motoRecordsOnDate.forEach(record => {
                const motoItem = document.createElement('div');
                motoItem.textContent = `Техніка: ${record.equipment} (${record.hours} год)`;
                taskList.appendChild(motoItem);
            });
            div.appendChild(taskList);
        } else {
            div.innerHTML += '<p>Немає завдань або використання техніки</p>';
        }
        calendar.appendChild(div);
    }
}

function updateStatusBar(tasks) {
    if (!tasks || tasks.length === 0) {
        document.getElementById('planned-count').textContent = '0';
        document.getElementById('in-progress-count').textContent = '0';
        document.getElementById('completed-count').textContent = '0';
        document.getElementById('progress-fill').style.width = '0%';
        return;
    }
    const plannedCount = tasks.filter(task => task.status === 'planned').length;
    const inProgressCount = tasks.filter(task => task.status === 'in_progress').length;
    const completedCount = tasks.filter(task => task.status === 'completed').length;
    const total = tasks.length;
    document.getElementById('planned-count').textContent = plannedCount;
    document.getElementById('in-progress-count').textContent = inProgressCount;
    document.getElementById('completed-count').textContent = completedCount;
    const progress = total > 0 ? (completedCount / total) * 100 : 0;
    document.getElementById('progress-fill').style.width = `${progress}%`;
}

async function optimizeTasks() {
    try {
        const response = await fetch(`${API_URL}/optimize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Помилка оптимізації');
        }
        fetchTasks();
        showNotification('Завдання успішно оптимізовано!', 'success');
    } catch (error) {
        console.error('Помилка при оптимізації завдань:', error.message);
        showNotification(`Помилка: ${error.message}`, 'error');
    }
}

async function exportToExcel() {
    try {
        window.location.href = `${API_URL}/export`;
    } catch (error) {
        console.error('Помилка при експорті завдань:', error.message);
        showNotification('Помилка при експорті завдань.', 'error');
    }
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function startPolling() {
    setInterval(async () => {
        const now = Date.now();
        if (now - lastTaskUpdate >= 3000) {
            await fetchTasks();
        }
    }, 3000);
}

document.addEventListener('DOMContentLoaded', async () => {
    currentUserId = await checkAuth();
    if (!currentUserId) return;
    fetchTasks();
    fetchOperators();
    startPolling();

    window.addEventListener('message', async (event) => {
        if (event.data.type === 'taskUpdated' || event.data.type === 'taskDeleted') {
            await fetchTasks();
        }
    });

    const kanbanBoard = document.getElementById('kanban-board');
    const listView = document.getElementById('list-view');
    const calendarView = document.getElementById('calendar-view');
    document.getElementById('kanban-btn').addEventListener('click', () => {
        kanbanBoard.style.display = 'flex';
        listView.style.display = 'none';
        calendarView.style.display = 'none';
        document.getElementById('kanban-btn').classList.add('active');
        document.getElementById('list-btn').classList.remove('active');
        document.getElementById('calendar-btn').classList.remove('active');
    });
    document.getElementById('list-btn').addEventListener('click', () => {
        kanbanBoard.style.display = 'none';
        listView.style.display = 'block';
        calendarView.style.display = 'none';
        document.getElementById('kanban-btn').classList.remove('active');
        document.getElementById('list-btn').classList.add('active');
        document.getElementById('calendar-btn').classList.remove('active');
    });
    document.getElementById('calendar-btn').addEventListener('click', () => {
        kanbanBoard.style.display = 'none';
        listView.style.display = 'none';
        calendarView.style.display = 'block';
        document.getElementById('kanban-btn').classList.remove('active');
        document.getElementById('list-btn').classList.remove('active');
        document.getElementById('calendar-btn').classList.add('active');
        fetchTasks();
    });
    document.getElementById('prev-month').addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        currentDay = 1;
        fetchTasks();
    });
    document.getElementById('next-month').addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        currentDay = 1;
        fetchTasks();
    });
    document.getElementById('month-view').addEventListener('click', () => {
        calendarMode = 'month';
        document.getElementById('month-view').classList.add('active');
        document.getElementById('week-view').classList.remove('active');
        document.getElementById('day-view').classList.remove('active');
        fetchTasks();
    });
    document.getElementById('week-view').addEventListener('click', () => {
        calendarMode = 'week';
        document.getElementById('month-view').classList.remove('active');
        document.getElementById('week-view').classList.add('active');
        document.getElementById('day-view').classList.remove('active');
        fetchTasks();
    });
    document.getElementById('day-view').addEventListener('click', () => {
        calendarMode = 'day';
        document.getElementById('month-view').classList.remove('active');
        document.getElementById('week-view').classList.remove('active');
        document.getElementById('day-view').classList.add('active');
        fetchTasks();
    });
    document.getElementById('optimize-btn').addEventListener('click', optimizeTasks);
    document.querySelector('.export-btn').addEventListener('click', exportToExcel);
    const modal = document.getElementById('addTaskModal');
    const openModalBtn = document.getElementById('open-add-modal');
    const closeModalBtns = document.querySelectorAll('.close-modal, .close-modal-btn');
    openModalBtn.addEventListener('click', () => {
        modal.style.display = 'block';
        fetchTasks();
    });
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modal.style.display = 'none';
            document.getElementById('addTaskForm').reset();
        });
    });
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            document.getElementById('addTaskForm').reset();
        }
    });
    document.getElementById('addTaskForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const dependenciesSelect = document.getElementById('dependencies');
        const selectedDependencies = Array.from(dependenciesSelect.selectedOptions).map(option => option.value).filter(Boolean).join(',');
        const task = {
            name: document.getElementById('taskName').value,
            task_type: document.getElementById('taskType').value,
            priority: parseInt(document.getElementById('priority').value),
            due_date: document.getElementById('dueDate').value,
            equipment: document.getElementById('equipmentSelect').value || null,
            operator: document.getElementById('operatorSelect').value || null,
            dependencies: selectedDependencies || null,
            status: 'planned'
        };
        const errors = validateTaskForm(task);
        if (errors.length > 0) {
            showNotification(errors.join('; '), 'error');
            return;
        }
        try {
            const response = await fetch(`${API_URL}/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(task),
                credentials: 'include'
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Помилка додавання завдання');
            }
            modal.style.display = 'none';
            document.getElementById('addTaskForm').reset();
            await fetchTasks();
            await optimizeTasks();
            showNotification('Завдання успішно додано!', 'success');
        } catch (error) {
            console.error('Помилка при додаванні завдання:', error.message);
            showNotification(`Помилка: ${error.message}`, 'error');
        }
    });
    const debouncedFetchTasks = debounce(fetchTasks, 300);
    const filters = ['taskTypeFilter', 'equipmentFilter', 'operatorFilter', 'dueDateFilter', 'statusFilter'];
    filters.forEach(id => {
        const filter = document.getElementById(id);
        if (filter) {
            filter.addEventListener('change', (e) => {
                filter.classList.add('filter-active');
                debouncedFetchTasks();
            });
        }
    });
});