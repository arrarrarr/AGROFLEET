import express from 'express';
const router = express.Router();

// Middleware для перевірки авторизації
const checkAuth = (req, res, next) => {
    if (!req.session.userId) {
        console.log('Неавторизований доступ:', req.method, req.url);
        return res.status(401).json({ error: 'Не авторизовано' });
    }
    console.log('Авторизований доступ:', req.method, req.url, 'ID користувача:', req.session.userId);
    next();
};

// Middleware для перевірки прав доступу (admin або manager)
const checkAdminOrManager = (req, res, next) => {
    const userRole = req.session.userRole;
    if (userRole !== 'admin' && userRole !== 'manager') {
        console.log('Недостатньо прав для', req.method, req.url, 'Роль:', userRole);
        return res.status(403).json({ error: 'Недостатньо прав. Тільки admin або manager можуть виконувати цю дію.' });
    }
    next();
};

// Початкові дані для техніки (залишено для сумісності, але більше не використовується для ініціалізації)
const initialEquipment = [
    { name: "Трактор 404DG2U", image: "/images/tractor-404dg2u.jpg", quantity: 5, type: "трактор", category: "Трактори", details: "Потужність: 40 к.с.<br>Гідравлічний вихід", link: "/pages/traktor404dg2u.html", price: 1000.0 },
    { name: "Культиватор Кентавр МБ40-1С/G", image: "/images/cultivator-kentavr-mb40-1c6.jpg", quantity: 3, type: "культиватор", category: "Культиватори", details: "Ширина захвату: 100 см<br>Вага: 90 кг", link: "/pages/kultivator_kentavr_mb40.html", price: "500.0" },
    { name: "Комбайн CAT Lexion 470R", image: "/images/combine-cat-lexion-470r.jpg", quantity: 2, type: "комбайн", category: "Комбайни", details: "Напрацювання: 3 106 м/год<br>Двигун: 290 к.с.", link: "/pages/kombajn_dongfeng_df204.html", price: 2000.0 },
    { name: "Обприскувач навісний", image: "/images/6352693431_w640_h640_6352693431.jpg", quantity: 4, type: "обприскувач", category: "Обприскувачі", details: "Об'єм бака: 400 л<br>Ширина захвату: 12 м", link: "/pages/6352693431_w640_h640_6352693431.html", price: 300.0 },
    { name: "Комбайн YTO 4LZ-8B1", image: "/images/komb-300x300.jpg", quantity: 1, type: "комбайн", category: "Комбайни", details: "Об'єм бака: 300 л<br>Ширина захвату: 12 м", link: "#", price: 1800.0 },
    { name: "Плуг ДТЗ 300", image: "/images/plug.jpg", quantity: 6, type: "плуг", category: "Плуги", details: "Кількість корпусів: 3<br>Ширина захвату: 120 см", link: "#", price: 400.0 },
    { name: "Плуг ПН-3-35", image: "/images/plygiiiiii.png", quantity: 3, type: "плуг", category: "Плуги", details: "Кількість корпусів: 3<br>Ширина захвату: 15 м", link: "#", price: 450.0 },
    { name: "Плуг ПН-225", image: "/images/Plug 2korp.jpg", quantity: 4, type: "плуг", category: "Плуги", details: "Кількість корпусів: 2<br>Потужність: 22-25 к.с.", link: "#", price: 350.0 },
    { name: "Трактор Xingtai XT-900", image: "/images/xingtai XT.png", quantity: 2, type: "трактор", category: "Трактори", details: "Потужність: 90 к.с.<br>Ємність бака: 800 л", link: "#", price: 1500.0 },
    { name: "Культиватор КПС-8МРП", image: "/images/unnamed (1).jpg", quantity: 3, type: "культиватор", category: "Культиватори", details: "Ширина захвату: 150 см<br>Глибина: до 30 см", link: "#", price: 600.0 },
    { name: "Плуг ПН 220", image: "/images/plug-pn-220-2024-03-1000x1000.jpg", quantity: 5, type: "плуг", category: "Плуги", details: "Кількість корпусів: 3<br>Ширина захвату: 120 см", link: "#", price: 400.0 },
    { name: "Дощувальні машини", image: "/images/oroshenie-dogdevalnye-mashyny.jpg", quantity: 2, type: "обприскувач", category: "Обприскувачі", details: "Об'єм бака: 600 л<br>Ширина захвату: 15 м", link: "#", price: 700.0 }
];

// Функція для очищення дублікатів у базі даних
const cleanDuplicates = async (db) => {
    try {
        console.log('Очищаємо дублікати в базі даних...');

        // Очищення дублікатів у таблиці users
        console.log('Очищаємо дублікати в таблиці users...');
        await db.exec(`
            DELETE FROM users
            WHERE id NOT IN (
                SELECT MIN(id)
                FROM users
                GROUP BY username, email
            )
        `);
        console.log('Дублікати в таблиці users успішно видалені.');

        // Очищення дублікатів у таблиці notifications (якщо є однакові сповіщення для одного користувача)
        console.log('Очищаємо дублікати в таблиці notifications...');
        await db.exec(`
            DELETE FROM notifications
            WHERE id NOT IN (
                SELECT MIN(id)
                FROM notifications
                GROUP BY userId, message, relatedId
            )
        `);
        console.log('Дублікати в таблиці notifications успішно видалені.');

        console.log('Очищення дублікатів завершено.');
    } catch (err) {
        console.error('Помилка при очищенні дублікатів:', err.message);
        throw err;
    }
};

// Очищення дублікатів при запуску маршрутів (викликається один раз при старті сервера)
router.use(async (req, res, next) => {
    try {
        // Очищаємо дублікати
        await cleanDuplicates(req.db);
        next();
    } catch (err) {
        console.error('Помилка при ініціалізації маршрутів equipment:', err.message);
        res.status(500).json({ error: 'Помилка сервера при ініціалізації маршрутів' });
    }
});

// --- Маршрути для обладнання (equipment) ---

// Отримання всіх машин (доступно всім авторизованим користувачам)
router.get('/', checkAuth, async (req, res) => {
    try {
        console.log('GET /api/equipment: Запит на отримання всіх машин');
        const equipment = await req.db.all(`SELECT * FROM equipment`);
        console.log('Знайдено машин:', equipment.length);
        res.json(equipment);
    } catch (err) {
        console.error('Помилка при отриманні техніки:', err.message);
        res.status(500).json({ error: 'Помилка сервера при отриманні техніки' });
    }
});

// Додавання нової машини (тільки admin і manager)
router.post('/', checkAuth, checkAdminOrManager, async (req, res) => {
    const { name, category, details, image, link, quantity, type, price } = req.body;

    console.log('POST /api/equipment: Запит на додавання машини:', req.body);

    if (!name || !category || !image || !quantity || !type || price === undefined) {
        console.log('Недостатньо даних для додавання машини');
        return res.status(400).json({ error: 'name, category, image, quantity, type та price обов’язкові' });
    }

    try {
        const result = await req.db.run(
            `INSERT INTO equipment (name, category, details, image, link, quantity, type, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, category, details || '', image, link || '#', quantity, type, price]
        );
        const newMachine = await req.db.get(`SELECT * FROM equipment WHERE id = ?`, [result.lastID]);
        console.log('Нова машина додана:', newMachine);
        res.status(201).json(newMachine);
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            console.log('Помилка: Техніка з таким ім’ям уже існує:', name);
            return res.status(400).json({ error: 'Техніка з таким ім’ям уже існує' });
        }
        console.error('Помилка при додаванні техніки:', err.message);
        res.status(500).json({ error: 'Помилка сервера при додаванні техніки' });
    }
});

// Оновлення машини (тільки admin і manager)
router.put('/:id', checkAuth, checkAdminOrManager, async (req, res) => {
    const id = parseInt(req.params.id);
    const { name, category, details, image, link, quantity, type, price } = req.body;

    console.log(`PUT /api/equipment/${id}: Запит на оновлення машини:`, req.body);

    if (!name || !category || !image || !quantity || !type || price === undefined) {
        console.log('Недостатньо даних для оновлення машини');
        return res.status(400).json({ error: 'name, category, image, quantity, type та price обов’язкові' });
    }

    try {
        const result = await req.db.run(
            `UPDATE equipment SET name = ?, category = ?, details = ?, image = ?, link = ?, quantity = ?, type = ?, price = ? WHERE id = ?`,
            [name, category, details || '', image, link || '#', quantity, type, price, id]
        );

        if (result.changes === 0) {
            console.log('Машина не знайдена для оновлення, ID:', id);
            return res.status(404).json({ error: 'Машина не знайдена' });
        }

        const updatedMachine = await req.db.get(`SELECT * FROM equipment WHERE id = ?`, [id]);
        console.log('Машина оновлена:', updatedMachine);
        res.json(updatedMachine);
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            console.log('Помилка: Техніка з таким ім’ям уже існує:', name);
            return res.status(400).json({ error: 'Техніка з таким ім’ям уже існує' });
        }
        console.error('Помилка при оновленні техніки:', err.message);
        res.status(500).json({ error: 'Помилка сервера при оновленні техніки' });
    }
});

// Видалення машини (тільки admin і manager)
router.delete('/:id', checkAuth, checkAdminOrManager, async (req, res) => {
    const id = parseInt(req.params.id);

    console.log(`DELETE /api/equipment/${id}: Запит на видалення машини`);

    try {
        const result = await req.db.run(`DELETE FROM equipment WHERE id = ?`, [id]);

        if (result.changes === 0) {
            console.log('Машина не знайдена для видалення, ID:', id);
            return res.status(404).json({ error: 'Машина не знайдена' });
        }

        console.log('Машина видалена, ID:', id);
        res.status(204).send();
    } catch (err) {
        console.error('Помилка при видаленні техніки:', err.message);
        res.status(500).json({ error: 'Помилка сервера при видаленні техніки' });
    }
});

// --- Маршрути для кошика (cart) ---

// Отримати кошик користувача
router.get('/cart', checkAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const cart = await req.db.get('SELECT items FROM carts WHERE userId = ?', [userId]);
        if (!cart) {
            await req.db.run('INSERT OR IGNORE INTO carts (userId, items) VALUES (?, ?)', [userId, JSON.stringify([])]);
            return res.json([]);
        }
        const cartItems = JSON.parse(cart.items);

        const enrichedItems = await Promise.all(cartItems.map(async (item) => {
            const equipment = await req.db.get('SELECT price FROM equipment WHERE id = ?', [item.id]);
            if (!equipment) {
                console.warn(`Техніка з ID ${item.id} не знайдена в таблиці equipment`);
                return { ...item, price: 0 };
            }
            return {
                ...item,
                price: equipment.price || 0
            };
        }));

        console.log('Кошик користувача:', enrichedItems);
        res.json(enrichedItems);
    } catch (error) {
        console.error('Помилка при отриманні кошика:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Додати товар до кошика
router.post('/cart/add', checkAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { id, name, quantity, price } = req.body;

        if (!id || !name || !quantity || price === undefined) {
            return res.status(400).json({ error: 'Невірні дані для додавання до кошика: id, name, quantity та price обов’язкові' });
        }

        let cart = await req.db.get('SELECT items FROM carts WHERE userId = ?', [userId]);
        let items = cart ? JSON.parse(cart.items) : [];

        const existingItem = items.find(item => item.id === id);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            items.push({ id, name, quantity, price });
        }

        await req.db.run(
            'INSERT OR REPLACE INTO carts (userId, items, updated_at) VALUES (?, ?, datetime("now"))',
            [userId, JSON.stringify(items)]
        );

        res.status(200).json({ message: 'Товар додано до кошика' });
    } catch (error) {
        console.error('Помилка при додаванні до кошика:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Оновити кількість товару в кошику
router.post('/cart/update-quantity', checkAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { index, quantity } = req.body;

        // Перевіряємо вхідні дані
        if (typeof index !== 'number' || index < 0) {
            console.log('Невірний індекс для оновлення кількості:', index);
            return res.status(400).json({ error: 'Невірний індекс' });
        }

        if (typeof quantity !== 'number' || quantity < 1) {
            console.log('Невірна кількість для оновлення:', quantity);
            return res.status(400).json({ error: 'Кількість повинна бути числом і не меншою за 1' });
        }

        // Отримуємо кошик користувача
        const cart = await req.db.get('SELECT items FROM carts WHERE userId = ?', [userId]);
        if (!cart) {
            console.log('Кошик порожній для користувача:', userId);
            return res.status(400).json({ error: 'Кошик порожній' });
        }

        let items = JSON.parse(cart.items);
        if (index >= items.length) {
            console.log('Невірний індекс для оновлення кількості, індекс:', index, 'довжина кошика:', items.length);
            return res.status(400).json({ error: 'Невірний індекс' });
        }

        // Оновлюємо кількість
        items[index].quantity = quantity;

        // Зберігаємо оновлений кошик
        await req.db.run(
            'UPDATE carts SET items = ?, updated_at = datetime("now") WHERE userId = ?',
            [JSON.stringify(items), userId]
        );

        console.log(`Кількість товару оновлено: індекс=${index}, нова кількість=${quantity}, користувач=${userId}`);
        res.status(200).json({ message: 'Кількість оновлено' });
    } catch (error) {
        console.error('Помилка при оновленні кількості в кошику:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Видалити товар із кошика
router.post('/cart/remove', checkAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { index } = req.body;

        if (typeof index !== 'number' || index < 0) {
            return res.status(400).json({ error: 'Невірний індекс для видалення' });
        }

        const cart = await req.db.get('SELECT items FROM carts WHERE userId = ?', [userId]);
        if (!cart) {
            return res.status(400).json({ error: 'Кошик порожній' });
        }

        let items = JSON.parse(cart.items);
        if (index >= items.length) {
            return res.status(400).json({ error: 'Невірний індекс' });
        }

        items.splice(index, 1);

        await req.db.run(
            'UPDATE carts SET items = ?, updated_at = datetime("now") WHERE userId = ?',
            [JSON.stringify(items), userId]
        );

        res.status(200).json({ message: 'Товар видалено з кошика' });
    } catch (error) {
        console.error('Помилка при видаленні з кошика:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Очистити кошик
router.post('/cart/clear', checkAuth, async (req, res) => {
    try {
        const userId = req.session.userId;

        await req.db.run(
            'INSERT OR REPLACE INTO carts (userId, items, updated_at) VALUES (?, ?, datetime("now"))',
            [userId, JSON.stringify([])]
        );

        res.status(200).json({ message: 'Кошик очищено' });
    } catch (error) {
        console.error('Помилка при очищенні кошика:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

export default router;