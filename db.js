import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcrypt';

// Початкові дані для техніки
const initialEquipment = [
    { name: "Трактор 404D6ZU", image: "/images/tractor-404dg2u.jpg", quantity: 5, type: "трактор", category: "Трактори", details: "Потужність: 40 к.с.<br>Гідравлічний вихід", link: "/pages/traktor404dg2u.html", price: 1000.0, usage_count: 10 },
    { name: "Культиватор Кентавр МБ40-1С/G", image: "/images/cultivator-kentavr-mb40-1c6.jpg", quantity: 3, type: "культиватор", category: "Культиватори", details: "Ширина захвату: 100 см<br>Вага: 90 кг", link: "/pages/kultivator_kentavr_mb40.html", price: 500.0, usage_count: 20 },
    { name: "Комбайн CAT Lexion 470R", image: "/images/combine-cat-lexion-470r.jpg", quantity: 2, type: "комбайн", category: "Комбайни", details: "Напрацювання: 3 106 м/год<br>Двигун: 290 к.с.", link: "/pages/kombajn_dongfeng_df204.html", price: 2000.0, usage_count: 60 },
    { name: "Обприскувач навісний", image: "/images/6352693431_w640_h640_6352693431.jpg", quantity: 4, type: "обприскувач", category: "Обприскувачі", details: "Об'єм бака: 400 л<br>Ширина захвату: 12 м", link: "/pages/6352693431_w640_h640_6352693431.html", price: 300.0, usage_count: 15 },
    { name: "Комбайн YTO 4LZ-8B1", image: "/images/komb-300x300.jpg", quantity: 1, type: "комбайн", category: "Комбайни", details: "Об'єм бака: 300 л<br>Ширина захвату: 12 м", link: "#", price: 1800.0, usage_count: 30 },
    { name: "Плуг ДТЗ 300", image: "/images/plug.jpg", quantity: 6, type: "плуг", category: "Плуги", details: "Кількість корпусів: 3<br>Ширина захвату: 120 см", link: "#", price: 400.0, usage_count: 25 },
    { name: "Плуг ПН-3-35", image: "/images/plygiiiiii.png", quantity: 3, type: "плуг", category: "Плуги", details: "Кількість корпусів: 3<br>Ширина захвату: 15 м", link: "#", price: 450.0, usage_count: 40 },
    { name: "Плуг ПН-225", image: "/images/Plug 2korp.jpg", quantity: 4, type: "плуг", category: "Плуги", details: "Кількість корпусів: 2<br>Потужність: 22-25 к.с.", link: "#", price: 350.0, usage_count: 10 },
    { name: "Трактор Xingtai XT-900", image: "/images/xingtai XT.png", quantity: 2, type: "трактор", category: "Трактори", details: "Потужність: 90 к.с.<br>Ємність бака: 800 л", link: "#", price: 1500.0, usage_count: 55 },
    { name: "Культиватор КПС-8МРП", image: "/images/unnamed (1).jpg", quantity: 3, type: "культиватор", category: "Культиватори", details: "Ширина захвату: 150 см<br>Глибина: до 30 см", link: "#", price: 600.0, usage_count: 30 },
    { name: "Плуг ПН 220", image: "/images/plug-pn-220-2024-03-1000x1000.jpg", quantity: 5, type: "плуг dawg", category: "Плуги", details: "Кількість корпусів: 3<br>Ширина захвату: 120 см", link: "#", price: 400.0, usage_count: 20 },
    { name: "Дощувальні машини", image: "/images/oroshenie-dogdevalnye-mashyny.jpg", quantity: 2, type: "обприскувач", category: "Обприскувачі", details: "Об'єм бака: 600 л<br>Ширина захвату: 15 м", link: "#", price: 700.0, usage_count: 5 },
];

// Початкові дані для операторів
const initialOperators = [
    { name: "Іван Петров" },
    { name: "Олена Сидоренко" },
    { name: "Петро Іванов" },
    { name: "Марія Коваленко" },
];

// Початкові дані для нагадувань
const initialReminders = [
    { user_id: 1, text: "Технічне обслуговування Трактора 404D6ZU", reminder_label: "Техогляд Трактора 404", card_title: "Олег", dateTime: "2025-04-20T10:00:00", completed: 0, status: "planned", equipment: "Трактор 404D6ZU", operator: "Іван Петров", taskType: "maintenance" },
    { user_id: 1, text: "Заміна масла в Комбайні CAT Lexion 470R", reminder_label: "5", card_title: "Заміна Масла Комбайн", dateTime: "2025-04-18T14:00:00", completed: 0, status: "planned", equipment: "Комбайн CAT Lexion 470R", operator: "Олена Сидоренко", taskType: "maintenance" },
    { user_id: 2, text: "Перевірка Культиватора Кентавр МБ40-1С/G", reminder_label: "Перевірка Культиватора", card_title: "Культиватор Перевірка", dateTime: "2025-04-22T09:00:00", completed: 0, status: "planned", equipment: "Культиватор Кентавр МБ40-1С/G", operator: "Петро Іванов", taskType: "maintenance" },
];

// Початкові дані для завдань
const initialTasks = [
    { name: "Технічне обслуговування трактора", task_type: "maintenance", priority: 1, due_date: "2025-04-20", user_id: 1, reminder_id: 1, equipment: "Трактор 404D6ZU", operator: "Іван Петров", dependencies: null, status: "planned", completed: 0 },
    { name: "Посів пшениці", task_type: "seeding", priority: 2, due_date: "2025-04-25", user_id: 2, reminder_id: null, equipment: "Культиватор Кентавр МБ40-1С/G", operator: "Олена Сидоренко", dependencies: null, status: "planned", completed: 0 },
];

// Початкові дані для запасів (inventory)
const initialInventory = [
    { user_id: 1, name: "Паливний насос", quantity: 3, min_level: 5, responsible: "Адмін Іван", update_date: "2025-04-17", notes: "Для трактора 404D6ZU" },
    { user_id: 1, name: "Масляний фільтр", quantity: 12, min_level: 10, responsible: "Адмін Іван", update_date: "2025-04-17", notes: "Для комбайна" },
    { user_id: 2, name: "Повітряний фільтр", quantity: 8, min_level: 8, responsible: "Менеджер Олена", update_date: "2025-04-17", notes: "Для культиватора" },
];

// Функція для ініціалізації бази даних
async function initializeDb() {
    try {
        const db = await open({
            filename: './database.db',
            driver: sqlite3.Database,
        });

        console.log('Підключення до бази даних успішно встановлено.');

        // Перевірка наявності всіх необхідних таблиць
        const tables = await db.all(`SELECT name FROM sqlite_master WHERE type='table'`);
        const tableNames = tables.map(t => t.name);
        console.log('Існуючі таблиці в базі даних:', tableNames);

        // Таблиця users
        if (!tableNames.includes('users')) {
            console.log('Таблиця users не існує, створюємо...');
            await db.exec(`
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE,
                    password TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'user',
                    fullName TEXT NOT NULL DEFAULT 'Невідомий',
                    city TEXT NOT NULL DEFAULT 'Невідомо',
                    gender TEXT NOT NULL DEFAULT 'Невідомо',
                    email TEXT NOT NULL UNIQUE,
                    profileImage TEXT DEFAULT '',
                    workHours TEXT DEFAULT '0',
                    phone TEXT DEFAULT '',
                    address TEXT DEFAULT '',
                    equipment TEXT DEFAULT '',
                    projects TEXT DEFAULT '',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await db.exec(`CREATE INDEX idx_users_username ON users (username)`);
            await db.exec(`CREATE INDEX idx_users_email ON users (email)`);
            console.log('Таблиця users створена.');
        } else {
            console.log('Таблиця users уже існує.');
        }

        // Таблиця expense_records
        if (!tableNames.includes('expense_records')) {
            console.log('Таблиця expense_records не існує, створюємо...');
            await db.exec(`
                CREATE TABLE expense_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    equipment_name TEXT NOT NULL,
                    expense_type TEXT NOT NULL,
                    expense_amount REAL NOT NULL,
                    expense_date TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);
            await db.exec(`CREATE INDEX idx_expense_records_user_id ON expense_records (user_id)`);
            await db.exec(`CREATE INDEX idx_expense_records_expense_type ON expense_records (expense_type)`);
            await db.exec(`CREATE INDEX idx_expense_records_expense_date ON expense_records (expense_date)`);
            console.log('Таблиця expense_records створена.');
        } else {
            console.log('Таблиця expense_records уже існує.');
        }

        // Таблиця contracts
        if (!tableNames.includes('contracts')) {
            console.log('Таблиця contracts не існує, створюємо...');
            await db.exec(`
                CREATE TABLE contracts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    number TEXT NOT NULL,
                    name TEXT NOT NULL,
                    party TEXT NOT NULL,
                    date TEXT NOT NULL,
                    endDate TEXT NOT NULL,
                    amount REAL NOT NULL,
                    status TEXT NOT NULL,
                    equipmentType TEXT NOT NULL,
                    region TEXT NOT NULL,
                    notes TEXT,
                    paymentTerms TEXT,
                    deliveryTerms TEXT,
                    contractDuration TEXT,
                    responsiblePerson TEXT,
                    userId INTEGER NOT NULL,
                    createdByRole TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (userId) REFERENCES users(id)
                )
            `);
            await db.exec(`CREATE INDEX idx_contracts_userId ON contracts (userId)`);
            await db.exec(`CREATE INDEX idx_contracts_status ON contracts (status)`);
            await db.exec(`CREATE INDEX idx_contracts_date ON contracts (date)`);
            console.log('Таблиця contracts створена.');
        } else {
            console.log('Таблиця contracts уже існує.');
        }

        // Таблиця equipment
        if (!tableNames.includes('equipment')) {
            console.log('Таблиця equipment не існує, створюємо...');
            await db.exec(`
                CREATE TABLE equipment (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    image TEXT NOT NULL,
                    quantity INTEGER NOT NULL,
                    type TEXT NOT NULL,
                    category TEXT NOT NULL,
                    details TEXT,
                    link TEXT,
                    price REAL,
                    usage_count INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await db.exec(`CREATE INDEX idx_equipment_type ON equipment (type)`);
            await db.exec(`CREATE INDEX idx_equipment_category ON equipment (category)`);
            console.log('Таблиця equipment створена.');
        } else {
            console.log('Таблиця equipment уже існує.');
        }

        // Таблиця operators
        if (!tableNames.includes('operators')) {
            console.log('Таблиця operators не існує, створюємо...');
            await db.exec(`
                CREATE TABLE operators (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE
                )
            `);
            console.log('Таблиця operators створена.');
        } else {
            console.log('Таблиця operators уже існує.');
        }

        // Таблиця orders
        if (!tableNames.includes('orders')) {
            console.log('Таблиця orders не існує, створюємо...');
            await db.exec(`
                CREATE TABLE orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    userId INTEGER NOT NULL,
                    items TEXT NOT NULL,
                    status TEXT DEFAULT 'pending',
                    rentalStart TEXT,
                    rentalEnd TEXT,
                    deliveryDate TEXT,
                    totalAmount REAL,
                    user TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    comment TEXT,
                    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
                )
            `);
            await db.exec(`CREATE INDEX idx_orders_user_id ON orders (userId)`);
            await db.exec(`CREATE INDEX idx_orders_status ON orders (status)`);
            await db.exec(`CREATE INDEX idx_orders_created_at ON orders (created_at)`);
            console.log('Таблиця orders створена.');
        } else {
            console.log('Таблиця orders уже існує.');
        }

        // Таблиця notifications
        if (!tableNames.includes('notifications')) {
            console.log('Таблиця notifications не існує, створюємо...');
            await db.exec(`
                CREATE TABLE notifications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    userId INTEGER NOT NULL,
                    message TEXT NOT NULL,
                    type TEXT,
                    relatedId INTEGER,
                    icon TEXT,
                    isRead INTEGER NOT NULL DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
                )
            `);
            await db.exec(`CREATE INDEX idx_notifications_user_id ON notifications (userId)`);
            await db.exec(`CREATE INDEX idx_notifications_is_read ON notifications (isRead)`);
            await db.exec(`CREATE INDEX idx_notifications_created_at ON notifications (created_at)`);
            console.log('Таблиця notifications створена.');
        } else {
            console.log('Таблиця notifications уже існує.');
        }

        // Таблиця shifts
        if (!tableNames.includes('shifts')) {
            console.log('Таблиця shifts не існує, створюємо...');
            await db.exec(`
                CREATE TABLE shifts (
                    shiftId TEXT PRIMARY KEY,
                    user_id INTEGER,
                    equipment TEXT,
                    secondsWorked INTEGER,
                    startTime TEXT,
                    endTime TEXT,
                    operator TEXT,
                    purpose TEXT,
                    notes TEXT,
                    date TEXT,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )
            `);
            await db.exec(`CREATE INDEX idx_shifts_user_id ON shifts (user_id)`);
            console.log('Таблиця shifts створена.');
        } else {
            console.log('Таблиця shifts уже існує.');
        }

        // Таблиця maintenance_records
        if (!tableNames.includes('maintenance_records')) {
            console.log('Таблиця maintenance_records не існує, створюємо...');
            await db.exec(`
                CREATE TABLE maintenance_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    equipment TEXT NOT NULL,
                    date TEXT NOT NULL,
                    status TEXT NOT NULL,
                    description TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);
            await db.exec(`CREATE INDEX idx_maintenance_records_user_id ON maintenance_records (user_id)`);
            console.log('Таблиця maintenance_records створена.');
        } else {
            console.log('Таблиця maintenance_records уже існує.');
        }

        // Таблиця reminders
        if (!tableNames.includes('reminders')) {
            console.log('Таблиця reminders не існує, створюємо...');
            await db.exec(`
                CREATE TABLE reminders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    text TEXT NOT NULL,
                    reminder_label TEXT,
                    card_title TEXT, -- Нове поле для заголовка картки
                    dateTime TEXT NOT NULL,
                    completed INTEGER NOT NULL DEFAULT 0,
                    status TEXT DEFAULT 'planned' CHECK(status IN ('planned', 'in_progress', 'completed')),
                    equipment TEXT,
                    operator TEXT,
                    taskType TEXT,
                    repairPart TEXT,
                    repairDescription TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `);
            await db.exec(`CREATE INDEX idx_reminders_user_id ON reminders (user_id)`);
            await db.exec(`CREATE INDEX idx_reminders_dateTime ON reminders (dateTime)`);
            console.log('Таблиця reminders створена.');
        } else {
            console.log('Таблиця reminders уже існує.');
            // Перевірка наявності стовпців
            const reminderColumns = await db.all(`PRAGMA table_info(reminders)`);
            const columnsToAdd = [
                { name: 'equipment', type: 'TEXT' },
                { name: 'operator', type: 'TEXT' },
                { name: 'taskType', type: 'TEXT' },
                { name: 'repairPart', type: 'TEXT' },
                { name: 'repairDescription', type: 'TEXT' },
                { name: 'reminder_label', type: 'TEXT' },
                { name: 'card_title', type: 'TEXT' } // Додаємо нове поле
            ];
            for (const col of columnsToAdd) {
                if (!reminderColumns.some(c => c.name === col.name)) {
                    console.log(`Стовпець ${col.name} відсутній у таблиці reminders, додаємо...`);
                    await db.exec(`ALTER TABLE reminders ADD COLUMN ${col.name} ${col.type}`);
                    console.log(`Стовпець ${col.name} додано до таблиці reminders`);
                }
            }
        }

        // Таблиця moto_time
        if (!tableNames.includes('moto_time')) {
            console.log('Таблиця moto_time не існує, створюємо...');
            await db.exec(`
                CREATE TABLE moto_time (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    equipment TEXT NOT NULL,
                    hours REAL NOT NULL,
                    date TEXT NOT NULL,
                    work_type TEXT,
                    notes TEXT,
                    fuel_consumed REAL,
                    oil_consumed REAL,
                    land_processed REAL,
                    operator TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);
            await db.exec(`CREATE INDEX idx_moto_time_user_id ON moto_time (user_id)`);
            await db.exec(`CREATE INDEX idx_moto_time_date ON moto_time (date)`);
            console.log('Таблиця moto_time створена.');
        } else {
            console.log('Таблиця moto_time уже існує.');
        }

        // Таблиця rentals
        if (!tableNames.includes('rentals')) {
            console.log('Таблиця rentals не існує, створюємо...');
            await db.exec(`
                CREATE TABLE rentals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    equipment TEXT NOT NULL,
                    client TEXT NOT NULL,
                    start_date TEXT NOT NULL,
                    end_date TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);
            await db.exec(`CREATE INDEX idx_rentals_user_id ON rentals (user_id)`);
            console.log('Таблиця rentals створена.');
        } else {
            console.log('Таблиця rentals уже існує.');
        }

        // Таблиця usage_records
        if (!tableNames.includes('usage_records')) {
            console.log('Таблиця usage_records не існує, створюємо...');
            await db.exec(`
                CREATE TABLE usage_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    equipment TEXT NOT NULL,
                    equipment_class TEXT,
                    period TEXT NOT NULL,
                    hours INTEGER NOT NULL,
                    fuel TEXT NOT NULL,
                    status TEXT NOT NULL,
                    date TEXT NOT NULL,
                    createdByRole TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);
            await db.exec(`CREATE INDEX idx_usage_records_user_id ON usage_records (user_id)`);
            await db.exec(`CREATE INDEX idx_usage_records_date ON usage_records (date)`);
            await db.exec(`CREATE INDEX idx_usage_records_equipment_class ON usage_records (equipment_class)`);
            console.log('Таблиця usage_records створена.');
        } else {
            console.log('Таблиця usage_records уже існує.');
        }

        // Таблиця carts
        if (!tableNames.includes('carts')) {
            console.log('Таблиця carts не існує, створюємо...');
            await db.exec(`
                CREATE TABLE carts (
                    userId INTEGER NOT NULL,
                    items TEXT NOT NULL DEFAULT '[]',
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (userId),
                    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
                )
            `);
            await db.exec(`CREATE INDEX idx_carts_user_id ON carts (userId)`);
            console.log('Таблиця carts створена.');
        } else {
            console.log('Таблиця carts уже існує.');
        }

        // Таблиця maintenance_history
        if (!tableNames.includes('maintenance_history')) {
            console.log('Таблиця maintenance_history не існує, створюємо...');
            await db.exec(`
                CREATE TABLE maintenance_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    date TEXT NOT NULL,
                    type TEXT NOT NULL,
                    description TEXT NOT NULL,
                    responsible TEXT NOT NULL,
                    reminder_id INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (reminder_id) REFERENCES reminders(id) ON DELETE SET NULL
                )
            `);
            await db.exec(`CREATE INDEX idx_maintenance_history_user_id ON maintenance_history (user_id)`);
            await db.exec(`CREATE INDEX idx_maintenance_history_reminder_id ON maintenance_history (reminder_id)`);
            console.log('Таблиця maintenance_history створена.');
        } else {
            console.log('Таблиця maintenance_history уже існує.');
            // Перевірка наявності колонки reminder_id
            const historyColumns = await db.all(`PRAGMA table_info(maintenance_history)`);
            if (!historyColumns.some(c => c.name === 'reminder_id')) {
                console.log('Стовпець reminder_id відсутній у таблиці maintenance_history, додаємо...');
                await db.exec(`ALTER TABLE maintenance_history ADD COLUMN reminder_id INTEGER`);
                await db.exec(`CREATE INDEX idx_maintenance_history_reminder_id ON maintenance_history (reminder_id)`);
                console.log('Стовпець reminder_id додано до таблиці maintenance_history');
            }
        }

        // Таблиця inventory
        if (!tableNames.includes('inventory')) {
            console.log('Таблиця inventory не існує, створюємо...');
            await db.exec(`
                CREATE TABLE inventory (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    quantity INTEGER NOT NULL,
                    min_level INTEGER NOT NULL,
                    responsible TEXT NOT NULL,
                    update_date TEXT NOT NULL,
                    notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);
            await db.exec(`CREATE INDEX idx_inventory_user_id ON inventory (user_id)`);
            await db.exec(`CREATE INDEX idx_inventory_name ON inventory (name)`);
            await db.exec(`CREATE INDEX idx_inventory_update_date ON inventory (update_date)`);
            console.log('Таблиця inventory створена.');
        } else {
            console.log('Таблиця inventory уже існує.');
            const inventoryColumns = await db.all(`PRAGMA table_info(inventory)`);
            const requiredInventoryColumns = [
                { name: 'updated_at', type: 'DATETIME' },
                { name: 'notes', type: 'TEXT' }
            ];
            for (const col of requiredInventoryColumns) {
                if (!inventoryColumns.some(c => c.name === col.name)) {
                    console.log(`Стовпець ${col.name} відсутній у таблиці inventory, додаємо...`);
                    await db.exec(`ALTER TABLE inventory ADD COLUMN ${col.name} ${col.type}`);
                    console.log(`Стовпець ${col.name} додано до таблиці inventory`);
                    if (col.name === 'updated_at') {
                        await db.exec(`UPDATE inventory SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL`);
                        console.log(`Значення для updated_at оновлено для існуючих записів у inventory`);
                    }
                }
            }
        }

        // Перевірка наявності таблиць optimization і tasks
        if (tableNames.includes('optimization') && !tableNames.includes('tasks')) {
            console.log('Таблиця optimization існує, а tasks — ні. Перейменовуємо optimization на tasks...');
            await db.exec(`ALTER TABLE optimization RENAME TO tasks`);
            console.log('Таблиця optimization перейменована на tasks.');
        } else if (!tableNames.includes('tasks')) {
            console.log('Таблиця tasks не існує, створюємо...');
            await db.exec(`
                CREATE TABLE tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    task_type TEXT,
                    priority INTEGER NOT NULL CHECK(priority >= 1 AND priority <= 3),
                    due_date TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    reminder_id INTEGER,
                    equipment TEXT,
                    operator TEXT,
                    dependencies TEXT,
                    completed INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'planned' CHECK(status IN ('planned', 'in_progress', 'completed')),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (reminder_id) REFERENCES reminders(id) ON DELETE CASCADE
                )
            `);
            await db.exec(`CREATE INDEX idx_tasks_user_id ON tasks (user_id)`);
            await db.exec(`CREATE INDEX idx_tasks_due_date ON tasks (due_date)`);
            await db.exec(`CREATE INDEX idx_tasks_reminder_id ON tasks (reminder_id)`);
            console.log('Таблиця tasks створена.');
        } else {
            console.log('Таблиця tasks уже існує.');
        }

        // Функція для додавання початкових даних
        async function insertInitialData(table, data, columns, logMessage) {
            const count = await db.get(`SELECT COUNT(*) as count FROM ${table}`);
            if (count.count === 0) {
                console.log(`Таблиця ${table} порожня, додаємо початкові записи.`);
                for (const item of data) {
                    const placeholders = columns.map(() => '?').join(', ');
                    await db.run(
                        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
                        columns.map(col => item[col] || null)
                    );
                    console.log(logMessage(item));
                }
                console.log(`Початкові записи для ${table} додані.`);
            } else {
                console.log(`Таблиця ${table} уже містить дані (${count.count} записів), пропускаємо ініціалізацію.`);
            }
        }

        // Функція для синхронізації нагадувань із завданнями (tasks)
        async function syncReminderToTask(reminder) {
            if (reminder.completed) {
                await db.run(
                    'DELETE FROM tasks WHERE reminder_id = ? AND user_id = ?',
                    [reminder.id, reminder.user_id]
                );
                console.log(`Завдання для нагадування ${reminder.id} видалено з tasks`);
                return;
            }

            const today = new Date();
            const dueDate = new Date(reminder.dateTime);
            const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
            let priority = 3;
            if (daysUntilDue <= 2) priority = 1;
            else if (daysUntilDue <= 7) priority = 2;

            const task_type = reminder.taskType || 'maintenance';
            const equipment = reminder.equipment || null;
            const operator = reminder.operator || null;

            const existingTask = await db.get(
                'SELECT * FROM tasks WHERE reminder_id = ? AND user_id = ?',
                [reminder.id, reminder.user_id]
            );

            if (existingTask) {
                await db.run(
                    'UPDATE tasks SET name = ?, task_type = ?, priority = ?, due_date = ?, equipment = ?, operator = ?, status = ? WHERE reminder_id = ? AND user_id = ?',
                    [reminder.text, task_type, priority, dueDate.toISOString().split('T')[0], equipment, operator, reminder.status || 'planned', reminder.id, reminder.user_id]
                );
                console.log(`Завдання для нагадування ${reminder.id} оновлено в tasks`);
            } else {
                await db.run(
                    'INSERT INTO tasks (name, task_type, priority, due_date, user_id, reminder_id, equipment, operator, dependencies, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [reminder.text, task_type, priority, dueDate.toISOString().split('T')[0], reminder.user_id, reminder.id, equipment, operator, null, reminder.status || 'planned']
                );
                console.log(`Завдання для нагадування ${reminder.id} додано в tasks`);
            }
        }

        // Початкові користувачі
        await insertInitialData(
            'users',
            [
                {
                    username: 'admin',
                    password: await bcrypt.hash('admin123', 10),
                    role: 'admin',
                    fullName: 'Адмін Іван',
                    city: 'Київ',
                    gender: 'Чоловік',
                    email: 'admin@example.com',
                    profileImage: '',
                    workHours: '0',
                    phone: '+380661234567',
                    address: 'вул. Хрещатик, 1',
                    equipment: 'Трактор John Deere',
                    projects: 'Проєкт А',
                },
                {
                    username: 'manager',
                    password: await bcrypt.hash('manager123', 10),
                    role: 'manager',
                    fullName: 'Менеджер Олена',
                    city: 'Харків',
                    gender: 'Жінка',
                    email: 'manager@example.com',
                    profileImage: '',
                    workHours: '0',
                    phone: '+380671234567',
                    address: 'вул. Сумська, 10',
                    equipment: 'Культиватор Кентавр',
                    projects: 'Проєкт В',
                },
                {
                    username: 'user',
                    password: await bcrypt.hash('user123', 10),
                    role: 'user',
                    fullName: 'Користувач Петро',
                    city: 'Одеса',
                    gender: 'Чоловік',
                    email: 'user@example.com',
                    profileImage: '',
                    workHours: '0',
                    phone: '+380681234567',
                    address: 'вул. Дерибасівська, 5',
                    equipment: 'Трактор 404D6ZU',
                    projects: 'Проєкт Г',
                },
            ],
            [
                'username', 'password', 'role', 'fullName', 'city', 'gender', 'email',
                'profileImage', 'workHours', 'phone', 'address', 'equipment', 'projects',
            ],
            (user) => `Додано користувача: ${user.username}`
        );

        // Початкові записи для equipment
        await insertInitialData(
            'equipment',
            initialEquipment,
            ['name', 'image', 'quantity', 'type', 'category', 'details', 'link', 'price', 'usage_count'],
            (item) => `Додано техніку: name=${item.name}, type=${item.type}, price=${item.price}`
        );

        // Початкові записи для operators
        await insertInitialData(
            'operators',
            initialOperators,
            ['name'],
            (operator) => `Додано оператора: name=${operator.name}`
        );

        // Початкові записи для reminders
        await insertInitialData(
            'reminders',
            initialReminders,
            ['user_id', 'text', 'reminder_label', 'card_title', 'dateTime', 'completed', 'status', 'equipment', 'operator', 'taskType'],
            (reminder) => `Додано нагадування: text=${reminder.text}, reminder_label=${reminder.reminder_label}, card_title=${reminder.card_title}, dateTime=${reminder.dateTime}, status=${reminder.status}`
        );

        // Початкові записи для tasks
        await insertInitialData(
            'tasks',
            initialTasks,
            ['name', 'task_type', 'priority', 'due_date', 'user_id', 'reminder_id', 'equipment', 'operator', 'dependencies', 'status', 'completed'],
            (task) => `Додано завдання: name=${task.name}, task_type=${task.task_type}`
        );

        // Початкові записи для inventory
        await insertInitialData(
            'inventory',
            initialInventory,
            ['user_id', 'name', 'quantity', 'min_level', 'responsible', 'update_date', 'notes'],
            (item) => `Додано запас: name=${item.name}, quantity=${item.quantity}`
        );

        // Синхронізуємо початкові нагадування з tasks
        const reminders = await db.all(`SELECT * FROM reminders`);
        for (const reminder of reminders) {
            await syncReminderToTask(reminder);
        }

        // Логування остаточного стану бази даних
        const finalTables = await db.all(`SELECT name FROM sqlite_master WHERE type='table'`);
        console.log('Фінальний список таблиць у базі даних:', finalTables.map(t => t.name));

        // Не закриваємо базу даних, щоб WebSocket-сервер міг її використовувати
        return db;
    } catch (err) {
        console.error('Помилка при ініціалізації бази даних:', err.message);
        throw err;
    }
}

export default initializeDb;