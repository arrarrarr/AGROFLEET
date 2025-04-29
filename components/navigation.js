// components/navigation.js

// Функція для навігації
function loadPage(page) {
    console.log('Перехід на:', page);
    if (!page.startsWith('/')) {
        page = '/' + page;
    }
    window.location.href = page;
}

// Функція для перевірки авторизації через API
async function checkAuth() {
    try {
        console.log('Робимо запит на /api/auth/check-auth з поточної сторінки:', window.location.pathname);
        const response = await fetch('/api/auth/check-auth', { credentials: 'include' });
        if (!response.ok) {
            console.error('Помилка при перевірці авторизації, статус:', response.status);
            return { role: 'unauthorized' };
        }
        const data = await response.json();
        console.log('Результат перевірки авторизації:', data);
        return data;
    } catch (error) {
        console.error('Помилка при перевірці авторизації:', error.message);
        return { role: 'unauthorized' };
    }
}

// Функція для переключення випадаючого меню
function toggleDropdown(event) {
    event.stopPropagation();
    const dropdownContent = event.target.nextElementSibling;
    if (!dropdownContent) {
        console.error('Не знайдено dropdown-content для кнопки:', event.target);
        return;
    }
    const allDropdowns = document.getElementsByClassName('dropdown-content');
    for (let i = 0; i < allDropdowns.length; i++) {
        if (allDropdowns[i] !== dropdownContent) {
            allDropdowns[i].classList.remove('show');
        }
    }
    dropdownContent.classList.toggle('show');
    console.log('Випадаюче меню переключено:', dropdownContent.classList.contains('show') ? 'показано' : 'приховано');
}

// Закриття випадаючого меню при кліку поза ним
document.addEventListener('click', (event) => {
    const dropdowns = document.getElementsByClassName('dropdown-content');
    for (let i = 0; i < dropdowns.length; i++) {
        const openDropdown = dropdowns[i];
        if (!event.target.closest('.dropdown')) {
            openDropdown.classList.remove('show');
        }
    }
});

// Функція для прив'язки подій до кнопок навігації
function bindNavigationEvents(user) {
    const navElements = document.querySelectorAll('[data-page]');
    if (navElements.length === 0) {
        console.warn('Не знайдено елементів із атрибутом data-page для прив’язки подій');
    }
    navElements.forEach(element => {
        element.addEventListener('click', async (event) => {
            event.preventDefault();
            const page = element.getAttribute('data-page');
            if (page) {
                const currentUser = await checkAuth();
                if (currentUser.role === 'unauthorized' && page !== 'index.html' && page !== 'profile.html') {
                    console.log('Користувач не авторизований, перенаправляємо на index.html');
                    loadPage('index.html');
                } else {
                    loadPage(page);
                }
            } else {
                console.warn('Атрибут data-page не знайдено для елемента:', element);
            }
        });
    });

    const dropdownButtons = document.querySelectorAll('.nav-button[onclick="toggleDropdown(event)"]');
    if (dropdownButtons.length === 0) {
        console.warn('Не знайдено кнопок із класом nav-button для випадаючих меню');
    }
    dropdownButtons.forEach(button => {
        button.addEventListener('click', toggleDropdown);
    });
}

// Функція для ініціалізації навігації
async function initNavigation() {
    console.log('Початок ініціалізації навігації...');
    const navigationContainer = document.getElementById('navigation-container');
    if (!navigationContainer) {
        console.error('Елемент з id "navigation-container" не знайдено');
        throw new Error('id "navigation-container" not found');
    }

    // Перевіряємо, чи це перше завантаження
    const isFirstLoad = !sessionStorage.getItem('hasVisited');
    if (isFirstLoad && window.location.pathname !== '/index.html') {
        console.log('Це перше завантаження, перенаправляємо на index.html');
        sessionStorage.setItem('hasVisited', 'true');
        loadPage('index.html');
        return;
    }

    navigationContainer.innerHTML = `
        <header class="logo-header">
            <div class="site-title" data-page="index.html">
                <i class="fas fa-tractor tractor-icon"></i> AgroFleet
            </div>
            <div class="header-content">
                <a href="profile.html">
                    <img id="profileImageHeader" src="images/default-avatar.jpg" alt="Профіль" class="header-profile-image">
                </a>
            </div>
        </header>
        <nav class="main-nav">
            <button class="nav-button" data-page="index.html">Головна</button>
            <button class="nav-button" id="profileButton" data-page="profile.html">Профіль</button>
            <div class="dropdown" id="analyticsDropdown">
                <button class="nav-button" onclick="toggleDropdown(event)">Аналітика і звітність</button>
                <div class="dropdown-content">
                    <button class="dropdown-item" id="expenses" data-page="analytics_expenses.html">Облік витрат</button>
                    <button class="dropdown-item" id="usage" data-page="analytics_usage.html">Звітність по використанню</button>
                    <button class="dropdown-item" id="effectiveness" data-page="analytics_effectiveness.html">Оцінка ефективності</button>
                    <button class="dropdown-item" id="contractManagement" data-page="contract_management.html">Управління договорами</button>
                </div>
            </div>
            <div class="dropdown" id="maintenanceDropdown">
                <button class="nav-button" onclick="toggleDropdown(event)">Технічне обслуговування</button>
                <div class="dropdown-content">
                    <button class="dropdown-item" id="reminders" data-page="maintenance_reminders.html">Нагадування про ТО</button>
                    <button class="dropdown-item" id="history" data-page="maintenance_history.html">Історія обслуговування</button>
                    <button class="dropdown-item" id="inventory" data-page="maintenance_inventory.html">Управління запасами</button>
                    <button class="dropdown-item" id="equipmentPark" data-page="equipment_park.html">Парк техніки</button>
                </div>
            </div>
            <div class="dropdown" id="monitoringDropdown">
                <button class="nav-button" onclick="toggleDropdown(event)">Моніторинг техніки</button>
                <div class="dropdown-content">
                    <button class="dropdown-item" id="failures" data-page="monitoring_failures.html">Сигналізація про поломки</button>
                    <button class="dropdown-item" id="condition" data-page="monitoring_condition.html">Технічний стан</button>
                    <button class="dropdown-item" id="motoHours" data-page="moto_time.html">МотоГодини</button>
                    <button class="dropdown-item" id="optimization" data-page="planning_optimization.html">Оптимізація завдань</button>
                </div>
            </div>
        </nav>
    `;

    const user = await checkAuth();

    const profileImageHeader = document.getElementById('profileImageHeader');
    const analyticsDropdown = document.getElementById('analyticsDropdown');
    const maintenanceDropdown = document.getElementById('maintenanceDropdown');
    const monitoringDropdown = document.getElementById('monitoringDropdown');
    const expensesButton = document.getElementById('expenses');
    const effectivenessButton = document.getElementById('effectiveness');
    const usageButton = document.getElementById('usage');
    const contractManagementButton = document.getElementById('contractManagement');
    const remindersButton = document.getElementById('reminders');
    const historyButton = document.getElementById('history');
    const inventoryButton = document.getElementById('inventory');
    const equipmentParkButton = document.getElementById('equipmentPark');
    const failuresButton = document.getElementById('failures');
    const conditionButton = document.getElementById('condition');
    const motoHoursButton = document.getElementById('motoHours');
    const optimizationButton = document.getElementById('optimization');
    const profileButton = document.getElementById('profileButton');

    if (profileImageHeader) {
        if (user && user.profileImage && user.role !== 'unauthorized') {
            profileImageHeader.src = user.profileImage;
        } else {
            profileImageHeader.src = 'images/default-avatar.jpg';
        }
    } else {
        console.error('Елемент з id "profileImageHeader" не знайдено');
    }

    if (profileButton) {
        if (user.role !== 'unauthorized') {
            profileButton.style.display = 'none';
            console.log('Кнопка "Профіль" прихована, оскільки користувач авторизований');
        } else {
            profileButton.style.display = 'block';
            console.log('Кнопка "Профіль" показана, оскільки користувач не авторизований');
        }
    }

    if (user.role === 'unauthorized') {
        if (analyticsDropdown) analyticsDropdown.style.display = 'none';
        if (maintenanceDropdown) maintenanceDropdown.style.display = 'none';
        if (monitoringDropdown) monitoringDropdown.style.display = 'none';
    } else {
        if (analyticsDropdown) analyticsDropdown.style.display = 'block';
        if (maintenanceDropdown) maintenanceDropdown.style.display = 'block';
        if (monitoringDropdown) monitoringDropdown.style.display = 'block';

        if (user.role === 'user') {
            // Аналітика і звітність
            if (expensesButton) {
                expensesButton.style.display = 'none';
                console.log('Кнопка "Облік витрат" прихована для користувача з роллю user');
            }
            if (effectivenessButton) {
                effectivenessButton.style.display = 'none'; // Зміна: приховуємо "Оцінку ефективності" для user
                console.log('Кнопка "Оцінка ефективності" прихована для користувача з роллю user');
            }
            if (usageButton) {
                usageButton.style.display = 'none';
                console.log('Кнопка "Звітність по використанню" прихована для користувача з роллю user');
            }
            if (contractManagementButton) {
                contractManagementButton.style.display = 'block';
                console.log('Кнопка "Управління договорами" показана для користувача з роллю user');
            }

            // Технічне обслуговування
            if (remindersButton) {
                remindersButton.style.display = 'none';
                console.log('Кнопка "Нагадування про ТО" прихована для користувача з роллю user');
            }
            if (historyButton) {
                historyButton.style.display = 'none';
                console.log('Кнопка "Історія обслуговування" прихована для користувача з роллю user');
            }
            if (inventoryButton) {
                inventoryButton.style.display = 'none';
                console.log('Кнопка "Управління запасами" прихована для користувача з роллю user');
            }
            if (equipmentParkButton) {
                equipmentParkButton.style.display = 'block';
                console.log('Кнопка "Парк техніки" показана для користувача з роллю user');
            }

            // Моніторинг техніки
            if (failuresButton) {
                failuresButton.style.display = 'block';
                console.log('Кнопка "Сигналізація про поломки" показана для користувача з роллю user');
            }
            if (conditionButton) {
                conditionButton.style.display = 'block';
                console.log('Кнопка "Технічний стан" показана для користувача з роллю user');
            }
            if (motoHoursButton) {
                motoHoursButton.style.display = 'none';
                console.log('Кнопка "Мото Години" прихована для користувача з роллю user');
            }
            if (optimizationButton) {
                optimizationButton.style.display = 'none';
                console.log('Кнопка "Оптимізація завдань" прихована для користувача з роллю user');
            }
        } else if (user.role === 'admin' || user.role === 'manager') {
            // Показуємо всі кнопки для admin та manager
            if (expensesButton) {
                expensesButton.style.display = 'block';
                console.log('Кнопка "Облік витрат" показана для користувача з роллю', user.role);
            }
            if (effectivenessButton) {
                effectivenessButton.style.display = 'block';
                console.log('Кнопка "Оцінка ефективності" показана для користувача з роллю', user.role);
            }
            if (usageButton) {
                usageButton.style.display = 'block';
                console.log('Кнопка "Звітність по використанню" показана для користувача з роллю', user.role);
            }
            if (contractManagementButton) {
                contractManagementButton.style.display = 'block';
                console.log('Кнопка "Управління договорами" показана для користувача з роллю', user.role);
            }
            if (remindersButton) {
                remindersButton.style.display = 'block';
                console.log('Кнопка "Нагадування про ТО" показана для користувача з роллю', user.role);
            }
            if (historyButton) {
                historyButton.style.display = 'block';
                console.log('Кнопка "Історія обслуговування" показана для користувача з роллю', user.role);
            }
            if (inventoryButton) {
                inventoryButton.style.display = 'block';
                console.log('Кнопка "Управління запасами" показана для користувача з роллю', user.role);
            }
            if (equipmentParkButton) {
                equipmentParkButton.style.display = 'block';
                console.log('Кнопка "Парк техніки" показана для користувача з роллю', user.role);
            }
            if (failuresButton) {
                failuresButton.style.display = 'block';
                console.log('Кнопка "Сигналізація про поломки" показана для користувача з роллю', user.role);
            }
            if (conditionButton) {
                conditionButton.style.display = 'block';
                console.log('Кнопка "Технічний стан" показана для користувача з роллю', user.role);
            }
            if (motoHoursButton) {
                motoHoursButton.style.display = 'block';
                console.log('Кнопка "Мото Години" показана для користувача з роллю', user.role);
            }
            if (optimizationButton) {
                optimizationButton.style.display = 'block';
                console.log('Кнопка "Оптимізація завдань" показана для користувача з роллю', user.role);
            }
        }
    }

    // Додаємо анімацію появи елементів
    navigationContainer.classList.add('loaded');
    const header = navigationContainer.querySelector('header');
    const nav = navigationContainer.querySelector('nav');

    if (header) {
        header.classList.add('loaded');
        console.log('Анісація появи застосована до header');
    }
    if (nav) {
        nav.classList.add('loaded');
        console.log('Анісація появи застосована до nav');
    }

    bindNavigationEvents(user);
    console.log('Навігація ініціалізована успішно');

    window.addEventListener('authChange', async () => {
        console.log('Подія authChange: оновлюємо навігацію');
        const updatedUser = await checkAuth();

        const profileImageHeader = document.getElementById('profileImageHeader');
        const analyticsDropdown = document.getElementById('analyticsDropdown');
        const maintenanceDropdown = document.getElementById('maintenanceDropdown');
        const monitoringDropdown = document.getElementById('monitoringDropdown');
        const expensesButton = document.getElementById('expenses');
        const effectivenessButton = document.getElementById('effectiveness');
        const usageButton = document.getElementById('usage');
        const contractManagementButton = document.getElementById('contractManagement');
        const remindersButton = document.getElementById('reminders');
        const historyButton = document.getElementById('history');
        const inventoryButton = document.getElementById('inventory');
        const equipmentParkButton = document.getElementById('equipmentPark');
        const failuresButton = document.getElementById('failures');
        const conditionButton = document.getElementById('condition');
        const motoHoursButton = document.getElementById('motoHours');
        const optimizationButton = document.getElementById('optimization');
        const profileButton = document.getElementById('profileButton');

        if (profileImageHeader) {
            if (updatedUser && updatedUser.profileImage && updatedUser.role !== 'unauthorized') {
                profileImageHeader.src = updatedUser.profileImage;
            } else {
                profileImageHeader.src = 'images/default-avatar.jpg';
            }
        }

        if (profileButton) {
            if (updatedUser.role !== 'unauthorized') {
                profileButton.style.display = 'none';
                console.log('Кнопка "Профіль" прихована після події authChange');
            } else {
                profileButton.style.display = 'block';
                console.log('Кнопка "Профіль" показана після події authChange');
            }
        }

        if (updatedUser.role === 'unauthorized') {
            if (analyticsDropdown) analyticsDropdown.style.display = 'none';
            if (maintenanceDropdown) maintenanceDropdown.style.display = 'none';
            if (monitoringDropdown) monitoringDropdown.style.display = 'none';
        } else {
            if (analyticsDropdown) analyticsDropdown.style.display = 'block';
            if (maintenanceDropdown) maintenanceDropdown.style.display = 'block';
            if (monitoringDropdown) monitoringDropdown.style.display = 'block';

            if (updatedUser.role === 'user') {
                // Аналітика і звітність
                if (expensesButton) {
                    expensesButton.style.display = 'none';
                    console.log('Кнопка "Облік витрат" прихована для користувача з роллю user');
                }
                if (effectivenessButton) {
                    effectivenessButton.style.display = 'none'; // Зміна: приховуємо "Оцінку ефективності" для user
                    console.log('Кнопка "Оцінка ефективності" прихована для користувача з роллю user');
                }
                if (usageButton) {
                    usageButton.style.display = 'none';
                    console.log('Кнопка "Звітність по використанню" прихована для користувача з роллю user');
                }
                if (contractManagementButton) {
                    contractManagementButton.style.display = 'block';
                    console.log('Кнопка "Управління договорами" показана для користувача з роллю user');
                }

                // Технічне обслуговування
                if (remindersButton) {
                    remindersButton.style.display = 'none';
                    console.log('Кнопка "Нагадування про ТО" прихована для користувача з роллю user');
                }
                if (historyButton) {
                    historyButton.style.display = 'none';
                    console.log('Кнопка "Історія обслуговування" прихована для користувача з роллю user');
                }
                if (inventoryButton) {
                    inventoryButton.style.display = 'none';
                    console.log('Кнопка "Управління запасами" прихована для користувача з роллю user');
                }
                if (equipmentParkButton) {
                    equipmentParkButton.style.display = 'block';
                    console.log('Кнопка "Парк техніки" показана для користувача з роллю user');
                }

                // Моніторинг техніки
                if (failuresButton) {
                    failuresButton.style.display = 'block';
                    console.log('Кнопка "Сигналізація про поломки" показана для користувача з роллю user');
                }
                if (conditionButton) {
                    conditionButton.style.display = 'block';
                    console.log('Кнопка "Технічний стан" показана для користувача з роллю user');
                }
                if (motoHoursButton) {
                    motoHoursButton.style.display = 'none';
                    console.log('Кнопка "Мото Години" прихована для користувача з роллю user');
                }
                if (optimizationButton) {
                    optimizationButton.style.display = 'none';
                    console.log('Кнопка "Оптимізація завдань" прихована для користувача з роллю user');
                }
            } else if (updatedUser.role === 'admin' || updatedUser.role === 'manager') {
                // Показуємо всі кнопки для admin та manager
                if (expensesButton) {
                    expensesButton.style.display = 'block';
                    console.log('Кнопка "Облік витрат" показана для користувача з роллю', updatedUser.role);
                }
                if (effectivenessButton) {
                    effectivenessButton.style.display = 'block';
                    console.log('Кнопка "Оцінка ефективності" показана для користувача з роллю', updatedUser.role);
                }
                if (usageButton) {
                    usageButton.style.display = 'block';
                    console.log('Кнопка "Звітність по використанню" показана для користувача з роллю', updatedUser.role);
                }
                if (contractManagementButton) {
                    contractManagementButton.style.display = 'block';
                    console.log('Кнопка "Управління договорами" показана для користувача з роллю', updatedUser.role);
                }
                if (remindersButton) {
                    remindersButton.style.display = 'block';
                    console.log('Кнопка "Нагадування про ТО" показана для користувача з роллю', updatedUser.role);
                }
                if (historyButton) {
                    historyButton.style.display = 'block';
                    console.log('Кнопка "Історія обслуговування" показана для користувача з роллю', updatedUser.role);
                }
                if (inventoryButton) {
                    inventoryButton.style.display = 'block';
                    console.log('Кнопка "Управління запасами" показана для користувача з роллю', updatedUser.role);
                }
                if (equipmentParkButton) {
                    equipmentParkButton.style.display = 'block';
                    console.log('Кнопка "Парк техніки" показана для користувача з роллю', updatedUser.role);
                }
                if (failuresButton) {
                    failuresButton.style.display = 'block';
                    console.log('Кнопка "Сигналізація про поломки" показана для користувача з роллю', updatedUser.role);
                }
                if (conditionButton) {
                    conditionButton.style.display = 'block';
                    console.log('Кнопка "Технічний стан" показана для користувача з роллю', updatedUser.role);
                }
                if (motoHoursButton) {
                    motoHoursButton.style.display = 'block';
                    console.log('Кнопка "Мото Години" показана для користувача з роллю', updatedUser.role);
                }
                if (optimizationButton) {
                    optimizationButton.style.display = 'block';
                    console.log('Кнопка "Оптимізація завдань" показана для користувача з роллю', updatedUser.role);
                }
            }
        }
    });
}

// Експортуємо функції для використання в інших модулях
export { initNavigation, loadPage, checkAuth };