// public/common.js

// Функція для створення бургер-меню
function createBurgerMenu() {
    const header = document.querySelector('header');
    if (!header) return;

    // Додаємо бургер-меню в хедер
    const burgerMenu = document.createElement('div');
    burgerMenu.className = 'burger-menu';
    burgerMenu.innerHTML = `
        <i class="fas fa-bars"></i>
        <div class="dropdown-content" id="burgerMenu">
            <button onclick="loadPage('index.html')">Головна</button>
            <button id="analyticsExpensesBtn" onclick="loadPage('analytics_expenses.html')">Облік витрат</button>
            <button id="analyticsUsageBtn" onclick="loadPage('analytics_usage.html')">Звітність по використанню</button>
            <button onclick="loadPage('maintenance_inventory.html')">Технічне обслуговування</button>
            <button onclick="loadPage('monitoring_condition.html')">Моніторинг техніки</button>
        </div>
    `;
    header.insertBefore(burgerMenu, header.querySelector('.profile-icon'));

    // Додаємо обробник для бургер-меню
    const burgerIcon = burgerMenu.querySelector('.fa-bars');
    if (burgerIcon) {
        burgerIcon.addEventListener('click', toggleDropdown);
    }

    // Перевіряємо авторизацію та роль користувача
    checkUserRole();
}

// Функція для перемикання бургер-меню
window.toggleDropdown = (event) => {
    const dropdownContent = event.target.nextElementSibling;
    if (dropdownContent.style.display === 'block') {
        dropdownContent.style.display = 'none';
    } else {
        dropdownContent.style.display = 'block';
    }
};

// Функція для завантаження сторінки
window.loadPage = (page) => {
    window.location.href = page;
};

// Функція для показу сповіщень
window.showNotification = (message) => {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
};

// Функція для перевірки авторизації та ролі користувача
async function checkUserRole() {
    const analyticsExpensesBtn = document.getElementById('analyticsExpensesBtn');
    const analyticsUsageBtn = document.getElementById('analyticsUsageBtn');
    const profileImageHeader = document.getElementById('profileImageHeader');

    try {
        const response = await fetch('/api/check-auth', {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            const user = data.user;
            console.log('Користувач авторизований:', user);

            // Оновлюємо аватар у хедері
            if (profileImageHeader && user.profileImage) {
                profileImageHeader.src = user.profileImage;
            }

            // Ховаємо кнопки для ролі 'user'
            if (user.role === 'user') {
                if (analyticsExpensesBtn) analyticsExpensesBtn.style.display = 'none';
                if (analyticsUsageBtn) analyticsUsageBtn.style.display = 'none';
            } else {
                // Для manager або admin показуємо кнопки
                if (analyticsExpensesBtn) analyticsExpensesBtn.style.display = 'block';
                if (analyticsUsageBtn) analyticsUsageBtn.style.display = 'block';
            }
        } else if (response.status === 401) {
            console.log('Користувач не авторизований');
            // Ховаємо кнопки для неавторизованих користувачів
            if (analyticsExpensesBtn) analyticsExpensesBtn.style.display = 'none';
            if (analyticsUsageBtn) analyticsUsageBtn.style.display = 'none';
        } else {
            throw new Error('Помилка перевірки авторизації');
        }
    } catch (err) {
        console.error('Помилка при перевірці авторизації:', err);
        // Ховаємо кнопки у разі помилки
        if (analyticsExpensesBtn) analyticsExpensesBtn.style.display = 'none';
        if (analyticsUsageBtn) analyticsUsageBtn.style.display = 'none';
        showNotification('Помилка перевірки авторизації.');
    }
}

// Ініціалізація при завантаженні сторінки
document.addEventListener('DOMContentLoaded', () => {
    createBurgerMenu();
});