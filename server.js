// server.js
import express from 'express';
import initializeDb from './db.js';
import open from 'open';
import cors from 'cors';
import session from 'express-session';
import rentalsRoutes from './routes/rentals.js';
import usersRoutes from './routes/users.js';
import motoTimeRoutes from './routes/moto_time.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import usageRoutes from './routes/usage.js';
import expensesRoutes from './routes/expenses.js';
import contractsRoutes from './routes/contracts.js';
import createOrdersRouter from './routes/orders.js';
import notificationsRoutes from './routes/notifications.js';
import equipmentRoutes from './routes/equipment.js';
import remindersRoutes from './routes/reminders.js';
import historyRoutes from './routes/history.js';
import effectivenessRoutes from './routes/effectiveness.js';
import inventoryRoutes from './routes/inventory.js';
import optimizationRoutes from './routes/optimization.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import { sendOrderToManager } from './utils/email.js';
import compression from 'compression';
import bcrypt from 'bcrypt';
import { WebSocketServer } from 'ws';
import http from 'http';
import ExcelJS from 'exceljs';

import SQLiteStoreFactory from 'connect-sqlite3';
const SQLiteStore = SQLiteStoreFactory(session);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;

// Создаём HTTP-сервер для интеграции с WebSocket
const server = http.createServer(app);

// Инициализация WebSocket-сервера
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', ws => {
    console.log('WebSocket клієнт підключений');
    ws.on('message', message => {
        console.log('Отримано повідомлення:', message.toString());
        // Рассылаем сообщение всем подключенным клиентам
        wss.clients.forEach(client => {
            if (client.readyState === ws.OPEN) {
                client.send(message.toString());
            }
        });
    });
    ws.on('close', () => console.log('WebSocket клієнт відключений'));
});

// Передаём wss в приложение
app.set('wss', wss);

// Список допустимих класів техніки
const VALID_EQUIPMENT_CLASSES = [
    'Трактор',
    'Комбайн',
    'Сівалка',
    'Плуг',
    'Культиватор',
    'Обприскувач',
    'Інше',
];

// Список допустимих типів витрат
const VALID_EXPENSE_TYPES = [
    'Пальне',
    'Технічне обслуговування та ремонт',
    'Запчастини',
    'Зарплата операторів/механіків',
    'Страхування',
    'Транспортні витрати',
    'Інші витрати',
];

// Используем сжатие для всех ответов
app.use(compression());

// Ограничение размера тела запроса
app.use(express.json({ limit: '10mb' }));

// Настройка CORS
app.use(cors({
    origin: (origin, callback) => {
        const allowedOrigins = ['http://localhost:3000'];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Доступ заборонений через CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['Set-Cookie'],
}));

// Обработка предварительных запросов OPTIONS
app.options('*', cors(), (req, res) => {
    res.status(200).send();
});

// Настройка сессий
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: './',
        concurrentDB: true,
        ttl: 365 * 24 * 60 * 60,
    }),
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { 
        secure: false,
        maxAge: 365 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
    },
}));

// Middleware для логирования сессий
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] Перевірка сесії для запиту: ${req.method} ${req.url}`);
    console.log('Ідентифікатор сесії:', req.sessionID || 'Немає ідентифікатора сесії');
    console.log('Дані сесії:', req.session || 'Сесія не ініціалізована');
    console.log('Куки:', req.headers.cookie || 'Немає куків');
    if (req.session && req.session.userId) {
        console.log('Користувач авторизований. Ідентифікатор користувача:', req.session.userId);
    } else {
        console.log('Користувач НЕ авторизований');
    }
    next();
});

// Middleware для логирования запросов
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] Новий запит: ${req.method} ${req.url}`);
    console.log('Куки у запиті:', req.headers.cookie || 'Немає куків');
    console.log('Ідентифікатор сесії:', req.sessionID || 'Сесія не ініціалізована');
    console.log('Дані сесії:', req.session || 'Сесія не створена');
    if (req.session && req.session.userId) {
        console.log('Сесія активна. Ідентифікатор користувача:', req.session.userId, 'Закінчується:', req.session.cookie.expires);
    } else {
        console.log('Сесія не має ідентифікатора користувача');
        if (req.sessionID && !req.session) {
            console.warn('Сесія не ініціалізована, але ідентифікатор сесії присутній. Можлива проблема з SQLiteStore.');
        }
    }
    if (['POST', 'PUT'].includes(req.method)) {
        console.log('Тіло запиту:', req.body);
    }

    const originalSend = res.send;
    res.send = function (body) {
        console.log(`[${new Date().toISOString()}] Відповідь: ${req.method} ${req.url} - Статус: ${res.statusCode}`);
        console.log('Тіло відповіді:', body);
        return originalSend.call(this, body);
    };

    next();
});

// Добавляем заголовки безопасности
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
        "img-src 'self' data:; " +
        "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://cdnjs.cloudflare.com data:; " +
        "connect-src 'self' http://localhost:3000 ws://localhost:3000;"
    );
    next();
});

// Раздача статических файлов из корневой директории
app.use(express.static('.', {
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.css') {
            res.setHeader('Content-Type', 'text/css');
        } else if (ext === '.js') {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (ext === '.html') {
            res.setHeader('Content-Type', 'text/html');
        } else if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
            res.setHeader('Content-Type', `image/${ext.slice(1)}`);
        }
    },
}));

// Раздача статических файлов из папки public
app.use('/public', express.static('public', {
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.css') {
            res.setHeader('Content-Type', 'text/css');
        } else if (ext === '.js') {
            res.setHeader('Content-Type', 'application/javascript');
        }
    },
}));

// Раздача статических файлов из папки components
app.use('/components', express.static('components', {
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.css') {
            res.setHeader('Content-Type', 'text/css');
        } else if (ext === '.js') {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (ext === '.html') {
            res.setHeader('Content-Type', 'text/html');
        }
    },
}));

// Раздача статических файлов из папки images
app.use('/images', express.static(path.join(__dirname, 'images'), {
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
            res.setHeader('Content-Type', `image/${ext.slice(1)}`);
        }
    },
}));

// Защита от доступа к файлам .db и .json
app.use((req, res, next) => {
    if (req.path.endsWith('.db') || req.path.endsWith('.json')) {
        if (!req.path.startsWith('/api/')) {
            return res.status(403).send('Доступ заборонено');
        }
    }
    next();
});

let db;

async function initDb() {
    try {
        db = await initializeDb();
        console.log('Успішно підключено до бази даних через db.js');
    } catch (err) {
        console.error('Помилка підключення до бази даних:', err.message);
        process.exit(1);
    }
}

app.use((req, res, next) => {
    if (!db) {
        console.error('Middleware: База даних ще не ініціалізована');
        return res.status(503).json({ error: 'Сервер ще ініціалізується, будь ласка, зачекайте...' });
    }
    req.db = db;
    console.log('Middleware: Базу даних передано в запит. Ідентифікатор сесії:', req.sessionID || 'Сесія не ініціалізована', 'Ідентифікатор користувача:', req.session?.userId);
    next();
});

// Middleware для проверки авторизации API-запросов
app.use('/api', (req, res, next) => {
    console.log(`[${new Date().toISOString()}] Перевірка авторизації для API-запиту: ${req.url}`);
    console.log('Сесія:', req.session);
    if (req.path.startsWith('/auth/')) {
        console.log('Пропускаємо перевірку авторизації для:', req.url);
        return next();
    }

    if (!req.session.userId) {
        console.log('Неавторизований API-запит:', req.url);
        return res.status(401).json({ error: 'Не авторизовано' });
    }
    console.log('Авторизований API-запит:', req.url, 'Ідентифікатор користувача:', req.session.userId);
    next();
});

// Подключение маршрутов
app.use('/api/maintenance/reminders', remindersRoutes);
app.use('/api/maintenance/history', historyRoutes);
app.use('/api/rentals', rentalsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/moto_time', motoTimeRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/orders', createOrdersRouter(sendOrderToManager));
app.use('/api/notifications', notificationsRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api', effectivenessRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/optimization', optimizationRoutes);

// Маршрут для проверки статуса сервера
app.get('/api/health', async (req, res) => {
    try {
        await req.db.get('SELECT 1');
        res.json({ status: 'ok', message: 'Сервер працює, база даних доступна' });
    } catch (err) {
        console.error('Помилка при перевірці статусу сервера:', err.message);
        res.status(500).json({ error: 'Помилка сервера або бази даних' });
    }
});

// Маршрут для проверки статуса WebSocket
app.get('/api/websocket-status', (req, res) => {
    try {
        const clientCount = wss.clients.size;
        res.json({ status: 'ok', message: 'WebSocket-сервер працює', connectedClients: clientCount });
    } catch (err) {
        console.error('Помилка при перевірці статусу WebSocket:', err.message);
        res.status(500).json({ error: 'Помилка WebSocket-сервера' });
    }
});

// Маршрут для экспорта задач в Excel
app.get('/api/optimization/export', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Не авторизовано' });
        }

        const tasks = await req.db.all('SELECT * FROM optimization WHERE user_id = ?', [req.session.userId]);

        // Создаем новый файл Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Завдання');

        // Заголовки таблицы
        worksheet.columns = [
            { header: 'Назва', key: 'name', width: 20 },
            { header: 'Тип завдання', key: 'task_type', width: 20 },
            { header: 'Пріоритет', key: 'priority', width: 15 },
            { header: 'Дата виконання', key: 'due_date', width: 15 },
            { header: 'Обладнання', key: 'equipment', width: 20 },
            { header: 'Оператор', key: 'operator', width: 20 },
            { header: 'Статус', key: 'status', width: 15 },
        ];

        // Добавляем данные
        tasks.forEach(task => {
            worksheet.addRow({
                name: task.name,
                task_type: task.task_type,
                priority: task.priority,
                due_date: task.due_date,
                equipment: task.equipment || 'Немає',
                operator: task.operator || 'Немає',
                status: task.status,
            });
        });

        // Стили для заголовков
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF28A745' },
        };
        worksheet.getRow(1).eachCell(cell => {
            cell.font = { color: { argb: 'FFFFFFFF' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        // Устанавливаем заголовки ответа
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="tasks.xlsx"');

        // Отправляем файл
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Помилка при експорті завдань в Excel:', error.message);
        res.status(500).json({ error: 'Помилка сервера при експорті завдань' });
    }
});

const authenticatePage = (req, res, next) => {
    const redirectCount = parseInt(req.headers['x-redirect-count'] || '0', 10);
    if (redirectCount >= 2) {
        console.log('Виявлено цикл перенаправлень:', req.url);
        return res.status(400).send('Помилка: виявлено цикл перенаправлень. Будь ласка, увійдіть у систему.');
    }

    if (!req.session || !req.session.userId) {
        console.log('Неавторизований доступ до сторінки:', req.url);
        res.setHeader('X-Redirect-Count', redirectCount + 1);
        return res.redirect('/profile.html?authRequired=true');
    }
    console.log('Авторизований доступ до сторінки:', req.url, 'Ідентифікатор користувача:', req.session.userId);
    next();
};

// Middleware для проверки роли для страниц
const checkAdminOrManagerRoleForPage = async (req, res, next) => {
    try {
        const redirectCount = parseInt(req.headers['x-redirect-count'] || '0', 10);
        if (redirectCount >= 2) {
            console.log('Виявлено цикл перенаправлень:', req.url);
            return res.status(400).send('Помилка: виявлено цикл перенаправлень. Будь ласка, увійдіть у систему.');
        }

        if (!req.session.userId) {
            console.log('Неавторизований доступ до сторінки:', req.url);
            res.setHeader('X-Redirect-Count', redirectCount + 1);
            return res.redirect('/profile.html?authRequired=true');
        }

        const user = await req.db.get('SELECT role FROM users WHERE id = ?', [req.session.userId]);
        if (!user) {
            console.log('Користувача не знайдено:', req.session.userId);
            res.setHeader('X-Redirect-Count', redirectCount + 1);
            return res.redirect('/profile.html?authRequired=true');
        }

        if (user.role !== 'admin' && user.role !== 'manager') {
            console.log('Доступ до сторінки заборонено для користувача з роллю:', user.role, 'на сторінку:', req.url);
            return res.status(403).send('Доступ заборонено: недостатньо прав');
        }

        console.log('Доступ до сторінки дозволено для користувача з роллю:', user.role, 'на сторінку:', req.url);
        next();
    } catch (err) {
        console.error('Помилка при перевірці ролі для сторінки:', err.message);
        res.status(500).send('Помилка сервера при перевірці ролі');
    }
};

app.get('/', (req, res) => {
    res.sendFile('index.html', { root: __dirname });
});

app.get('/profile.html', (req, res) => {
    console.log('Доступ до profile.html. Ідентифікатор сесії:', req.sessionID, 'Ідентифікатор користувача:', req.session?.userId);
    res.sendFile('profile.html', { root: __dirname });
});

const rootHtmlFiles = [
    'analytics_usage.html',
    'contract_management.html',
    'equipment_park.html',
    'maintenance_history.html',
    'maintenance_inventory.html',
    'maintenance_reminders.html',
    'monitoring_condition.html',
    'monitoring_failures.html',
    'moto_time.html',
    'planning_calendar.html',
    'planning_optimization.html',
    'planning_rental.html',
];

const adminManagerPages = [
    'analytics_expenses.html',
    'analytics_effectiveness.html',
];

// Маршрут для раздачи HTML-файлов
rootHtmlFiles.forEach(file => {
    app.get(`/${file}`, authenticatePage, (req, res) => {
        const filePath = path.join(__dirname, file);
        console.log(`Спроба роздачі файлу: ${filePath}`);
        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                console.error(`Файл ${file} не знайдено: ${err.message}`);
                return res.status(404).send('Сторінку не знайдено');
            }
            res.sendFile(file, { root: __dirname }, (err) => {
                if (err) {
                    console.error(`Помилка при відправці файлу ${file}: ${err.message}`);
                    res.status(500).send('Помилка сервера');
                }
            });
        });
    });
});

adminManagerPages.forEach(file => {
    app.get(`/${file}`, authenticatePage, checkAdminOrManagerRoleForPage, (req, res) => {
        res.sendFile(file, { root: __dirname });
    });
});

const pagesHtmlFiles = [
    'kombajn_dongfeng_df204.html',
    'kultivator_kentavr_mb40.html',
    'traktor404dg2u.html',
    '6352693431_w640_h640_6352693431.html',
];

pagesHtmlFiles.forEach(file => {
    app.get(`/pages/${file}`, (req, res) => {
        res.sendFile(`pages/${file}`, { root: __dirname });
    });
});

app.get('/*.html', (req, res) => {
    console.log('Спроба доступу до неіснуючої сторінки:', req.url);
    const filePath = path.join(__dirname, '404.html');
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error('Файл 404.html не знайдено:', err.message);
            return res.status(404).send('Сторінку не знайдено');
        }
        res.status(404).sendFile('404.html', { root: __dirname }, (err) => {
            if (err) {
                console.error('Помилка при відправці 404.html:', err.message);
                res.status(404).send('Сторінку не знайдено');
            }
        });
    });
});

const authenticate = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        console.log('Неавторизований запит:', req.url);
        return res.status(401).json({ error: 'Не авторизовано' });
    }
    next();
};

app.get('/api/equipment-classes', authenticate, async (req, res) => {
    try {
        console.log('GET /api/equipment-classes: Запит на список категорій техніки');
        res.json(VALID_EQUIPMENT_CLASSES);
    } catch (err) {
        console.error('Помилка при отриманні списку категорій техніки:', err.message);
        res.status(500).json({ error: 'Помилка сервера при отриманні списку категорій.' });
    }
});

app.get('/api/expense-types', authenticate, async (req, res) => {
    try {
        console.log('GET /api/expense-types: Запит на список типів витрат');
        res.json(VALID_EXPENSE_TYPES);
    } catch (err) {
        console.error('Помилка при отриманні списку типів витрат:', err.message);
        res.status(500).json({ error: 'Помилка сервера при отриманні списку типів витрат.' });
    }
});

app.get('/api/efficiency', authenticate, async (req, res) => {
    try {
        console.log('GET /api/efficiency: Запит на дані про ефективність');
        const user = await req.db.get('SELECT role FROM users WHERE id = ?', [req.session.userId]);
        if (!user) {
            console.log('Користувача не знайдено:', req.session.userId);
            return res.status(404).json({ error: 'Користувача не знайдено' });
        }
        if (user.role !== 'admin' && user.role !== 'manager') {
            console.log('Доступ до /api/efficiency заборонено для користувача з роллю:', user.role);
            return res.status(403).json({ error: 'Доступ заборонено: недостатньо прав' });
        }

        const users = await req.db.all(`SELECT * FROM users`);
        const motoTimeRecords = await req.db.all(`SELECT * FROM moto_time`);
        const rentals = await req.db.all(`SELECT * FROM rentals`);
        const usageRecords = await req.db.all(`SELECT * FROM usage_records`);
        const expenseRecords = await req.db.all(`SELECT * FROM expense_records`);
        const contracts = await req.db.all(`SELECT * FROM contracts`);

        const efficiencyData = {
            users: users.length,
            motoHours: motoTimeRecords.reduce((sum, record) => sum + (record.hours || 0), 0),
            rentals: rentals.length,
            usageHours: usageRecords.reduce((sum, record) => sum + (record.hours || 0), 0),
            totalExpenses: expenseRecords.reduce((sum, expense) => sum + (expense.expense_amount || 0), 0),
            totalContracts: contracts.length,
            averageMotoHoursPerRental: rentals.length ? (motoTimeRecords.reduce((sum, record) => sum + (record.hours || 0), 0) / rentals.length).toFixed(2) : 0,
            contractsPerUser: users.length ? (contracts.length / users.length).toFixed(2) : 0,
        };

        console.log('Дані про ефективність:', efficiencyData);
        res.json(efficiencyData);
    } catch (err) {
        console.error('Помилка при отриманні даних про ефективність:', err.message);
        res.status(500).json({ error: 'Помилка сервера при отриманні даних про ефективність.' });
    }
});

// Обработчик ошибок
app.use((err, req, res, next) => {
    console.error(`[${new Date().toISOString()}] Необроблена помилка на маршруті ${req.method} ${req.url}:`, err.stack);
    console.error('Тіло запиту:', req.body);
    console.error('Ідентифікатор сесії:', req.sessionID, 'Ідентифікатор користувача:', req.session?.userId);
    res.status(500).json({ 
        error: 'Виникла помилка на сервері. Будь ласка, спробуйте пізніше.',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

async function startServer() {
    await initDb();

    server.listen(port, () => {
        console.log(`Сервер запущено на http://localhost:${port}`);
        open(`http://localhost:${port}`);
    });
}

startServer().catch(err => {
    console.error('Помилка при запуску сервера:', err.message);
    process.exit(1);
});

process.on('SIGINT', async () => {
    try {
        if (db) await db.close();
        console.log('З’єднання з базою даних закрито');
        wss.close(() => {
            console.log('WebSocket-сервер закрито');
            process.exit(0);
        });
    } catch (err) {
        console.error('Помилка при закритті бази даних або WebSocket-сервера:', err.message);
        process.exit(1);
    }
});