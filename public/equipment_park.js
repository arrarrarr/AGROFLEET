// Файл: equipment_park.js (Обновлённый код для вызова submitCart)

import { addToCart, updateCartCount, removeFromCart, clearCart, submitCart, updateCartQuantity, renderCartModal } from './cart.js';

let machines = [];
let editId = null;
let userRole = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM fully loaded');

    // Завантаження даних про машини через API
    await loadMachines();

    // Отримуємо дані користувача і зберігаємо роль
    const userData = await fetchUserData();
    console.log('Результат fetchUserData:', userData);
    if (!userData || userData.role === 'unauthorized') {
        console.warn('Користувач не авторизований або сталася помилка при отриманні даних');
        userRole = 'unauthorized';
        hideAddButton('unauthorized');
    } else {
        userRole = userData.role;
        if (userRole !== 'admin' && userRole !== 'manager') {
            console.log('Приховуємо кнопку для користувача з роллю:', userRole);
            hideAddButton(userRole);
        } else {
            console.log('Кнопка додавання техніки відображається для користувача з роллю:', userRole);
        }
    }

    // Рендеринг карток і налаштування фільтрів
    renderCards(machines);
    document.querySelectorAll('.filter').forEach(filter => filter.addEventListener('change', filterCards));
    document.getElementById('search').addEventListener('input', filterCards);

    // Перевіряємо наявність форми перед прив'язкою обробника
    const machineForm = document.getElementById('machineForm');
    if (machineForm) {
        machineForm.addEventListener('submit', saveMachine);
    } else {
        console.warn('Форма з id="machineForm" не знайдена на сторінці');
    }

    // Ініціалізація кошика
    await updateCartCount();

    // Прив'язка події для відкриття кошика
    document.getElementById('cartIcon').addEventListener('click', renderCartModal);

    // Прив'язка події для закриття модального вікна оренди
    document.getElementById('close-rent-modal').addEventListener('click', closeRentCartModal);

    // Прив'язка події для форми оренди
    const rentCartForm = document.getElementById('rent-cart-form');
    if (rentCartForm) {
        rentCartForm.addEventListener('submit', handleRentCartSubmit);
    } else {
        console.warn('Форма з id="rent-cart-form" не знайдена на сторінці');
    }

    // Спостерігач за змінами в DOM (на випадок, якщо кнопка додається динамічно)
    const observer = new MutationObserver((mutations) => {
        if (!userData || userData.role === 'unauthorized' || (userData.role !== 'admin' && userData.role !== 'manager')) {
            hideAddButton(userData ? userData.role : 'unauthorized');
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
});

// Функція для приховування кнопки
function hideAddButton(role) {
    const addButton = document.querySelector('.add-btn');
    if (addButton) {
        addButton.style.display = 'none';
        console.log('Кнопка додавання техніки прихована для користувача з роллю:', role);
    } else {
        console.warn('Кнопка додавання техніки не знайдена. Перевірте селектор .add-btn');
    }
}

// Функція для отримання даних користувача
async function fetchUserData() {
    try {
        const response = await fetch('/api/auth/check-auth', {
            method: 'GET',
            credentials: 'include',
        });
        if (!response.ok) {
            throw new Error(`Не вдалося завантажити дані користувача: ${response.status} ${response.statusText}`);
        }
        const userData = await response.json();
        console.log('Дані користувача:', userData);
        return userData;
    } catch (error) {
        console.error('Помилка при завантаженні даних користувача:', error);
        return null;
    }
}

async function loadMachines() {
    try {
        console.log('Завантажуємо дані про машини через API...');
        const response = await fetch('/api/equipment', {
            method: 'GET',
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error('Не вдалося завантажити техніку');
        }
        machines = await response.json();
        console.log('Дані про машини завантажені:', machines);
    } catch (error) {
        console.error('Помилка при завантаженні техніки:', error);
        alert('Не вдалося завантажити техніку. Спробуйте ще раз.');
    }
}

function renderCards(data) {
    const container = document.getElementById('container');
    container.innerHTML = '';
    console.log('Рендеринг карток із даними:', data);
    if (!data || data.length === 0) {
        container.innerHTML = '<p>Техніка не знайдена.</p>';
        return;
    }

    data.forEach(machine => {
        const adminButtons = (userRole === 'admin' || userRole === 'manager') ? `
            <button class="cart-btn edit-btn" data-id="${machine.id}"><i class="fas fa-edit"></i></button>
            <button class="cart-btn delete-btn" data-id="${machine.id}"><i class="fas fa-trash"></i></button>
        ` : '';

        const card = `
            <div class="card" data-category="${machine.category}">
                <a href="${machine.link}" style="text-decoration: none; color: inherit;">
                    <img src="${machine.image}" alt="${machine.name}">
                    <h2>${machine.name}</h2>
                    <div class="details">${machine.details}</div>
                    <div class="price">Ціна за день: ${machine.price ? machine.price.toLocaleString('uk-UA') + ' UAH' : 'Невідомо'}</div>
                </a>
                <div class="card-actions">
                    <button class="cart-btn add-to-cart-btn" data-id="${machine.id}"><i class="fas fa-shopping-cart"></i></button>
                    ${adminButtons}
                </div>
            </div>`;
        container.innerHTML += card;
    });

    // Прив'язуємо події для кнопок "Додати до кошика"
    document.querySelectorAll('.card-actions .add-to-cart-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            const id = parseInt(button.dataset.id);
            await addToCartFromList(id);
        });
    });

    // Прив'язуємо події для кнопок "Редагувати" і "Видалити" (тільки якщо користувач admin або manager)
    if (userRole === 'admin' || userRole === 'manager') {
        document.querySelectorAll('.card-actions .edit-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const id = parseInt(button.dataset.id);
                editMachine(id, event);
            });
        });

        document.querySelectorAll('.card-actions .delete-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const id = parseInt(button.dataset.id);
                deleteMachine(id, event);
            });
        });
    }
}

function filterCards() {
    const selectedFilters = Array.from(document.querySelectorAll('.filter:checked')).map(f => f.dataset.category);
    const searchQuery = document.getElementById('search').value.toLowerCase();
    console.log('Вибрані фільтри:', selectedFilters, 'Пошуковий запит:', searchQuery);
    const filtered = machines.filter(machine => {
        const matchesCategory = selectedFilters.length === 0 || selectedFilters.includes(machine.category);
        const matchesSearch = machine.name.toLowerCase().includes(searchQuery);
        return matchesCategory && matchesSearch;
    });
    console.log('Відфільтровані машини:', filtered);
    renderCards(filtered);
}

function openAddModal() {
    editId = null;
    document.getElementById('modal-title').innerHTML = '<i class="fas fa-plus"></i> Додати техніку';
    document.getElementById('machineForm').reset();
    document.getElementById('modal').style.display = 'flex';
}

function editMachine(id, event) {
    event.preventDefault();
    const machine = machines.find(m => m.id === id);
    editId = id;
    document.getElementById('modal-title').innerHTML = '<i class="fas fa-edit"></i> Редагувати техніку';
    document.getElementById('name').value = machine.name;
    document.getElementById('category').value = machine.category;
    document.getElementById('details').value = machine.details.replace(/<br>/g, '\n');
    document.getElementById('image').value = machine.image;
    document.getElementById('link').value = machine.link;
    document.getElementById('price').value = machine.price || '';
    document.getElementById('modal').style.display = 'flex';
}

async function saveMachine(e) {
    e.preventDefault();
    const machine = {
        name: document.getElementById('name').value,
        category: document.getElementById('category').value,
        details: document.getElementById('details').value.replace(/\n/g, '<br>'),
        image: document.getElementById('image').value,
        link: document.getElementById('link').value,
        quantity: 1,
        type: document.getElementById('category').value,
        price: parseFloat(document.getElementById('price').value) || 0
    };

    console.log('Дані, що відправляються на сервер:', machine);

    try {
        let response;
        if (editId) {
            response = await fetch(`/api/equipment/${editId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(machine),
                credentials: 'include'
            });
        } else {
            response = await fetch('/api/equipment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(machine),
                credentials: 'include'
            });
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Не вдалося зберегти техніку');
        }

        await loadMachines();
        renderCards(machines);
        closeModal();
    } catch (error) {
        console.error('Помилка при збереженні техніки:', error);
        alert('Помилка при збереженні техніки: ' + error.message);
    }
}

async function deleteMachine(id, event) {
    event.preventDefault();
    if (confirm('Видалити цю техніку?')) {
        try {
            const response = await fetch(`/api/equipment/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Не вдалося видалити техніку');
            }

            await loadMachines();
            renderCards(machines);
        } catch (error) {
            console.error('Помилка при видаленні техніки:', error);
            alert('Помилка при видаленні техніки: ' + error.message);
        }
    }
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
    document.activeElement.blur(); // Скидаємо фокус
}

function closeFavoritesModal() {
    document.getElementById('favorites-modal').style.display = 'none';
}

async function rentAllFavorites() {
    const cart = await fetch('/api/equipment/cart', {
        method: 'GET',
        credentials: 'include',
    }).then(res => res.json());

    if (cart.length === 0) {
        alert('Кошик порожній. Додайте техніку перед орендою.');
        return;
    }

    console.log('Кошик:', cart);

    const equipmentList = document.getElementById('rent-equipment-list');
    equipmentList.innerHTML = '';
    cart.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <i class="fas fa-tractor"></i>
            <span class="equipment-name">${item.name}</span>
            <span class="quantity">Кількість: ${item.quantity || 1}</span>
        `;
        equipmentList.appendChild(li);
    });

    const userData = await fetchUserData();
    if (userData) {
        document.getElementById('user-fullname').value = userData.fullName || '';
        document.getElementById('user-email').value = userData.email || '';
        document.getElementById('user-phone').value = userData.phone || '';
    } else {
        document.getElementById('user-fullname').value = '';
        document.getElementById('user-email').value = '';
        document.getElementById('user-phone').value = '';
    }

    document.getElementById('cart-rental-start').value = '';
    document.getElementById('cart-rental-period').value = '';
    document.getElementById('cart-rental-end').value = '';
    document.getElementById('cart-delivery-date').value = '';
    document.getElementById('cart-rental-cost').textContent = '0 UAH';

    document.getElementById('rent-cart-modal').style.display = 'flex';

    const rentalStartInput = document.getElementById('cart-rental-start');
    const rentalPeriodInput = document.getElementById('cart-rental-period');
    const rentalEndInput = document.getElementById('cart-rental-end');
    const rentalCostElement = document.getElementById('cart-rental-cost');

    const updateRentalEndAndCost = () => {
        const startDate = rentalStartInput.value;
        const period = parseInt(rentalPeriodInput.value) || 0;

        console.log('Оновлення вартості. Дата початку:', startDate, 'Тривалість:', period);

        if (startDate && period > 0) {
            const start = new Date(startDate);
            const end = new Date(start);
            end.setDate(start.getDate() + period - 1);
            rentalEndInput.value = end.toISOString().split('T')[0];

            const totalAmount = cart.reduce((total, item) => {
                const pricePerDay = item.price || 0;
                const quantity = item.quantity || 1;
                const itemTotal = pricePerDay * quantity * period;
                console.log(`Техніка: ${item.name}, Ціна за день: ${pricePerDay}, Кількість: ${quantity}, Днів: ${period}, Загальна сума: ${itemTotal}`);
                return total + itemTotal;
            }, 0);

            console.log('Загальна сума:', totalAmount);

            rentalCostElement.textContent = `${totalAmount.toLocaleString('uk-UA')} UAH`;
        } else {
            rentalEndInput.value = '';
            rentalCostElement.textContent = '0 UAH';
        }
    };

    rentalStartInput.removeEventListener('change', updateRentalEndAndCost);
    rentalPeriodInput.removeEventListener('input', updateRentalEndAndCost);

    rentalStartInput.addEventListener('change', updateRentalEndAndCost);
    rentalPeriodInput.addEventListener('input', updateRentalEndAndCost);
}

async function handleRentCartSubmit(e) {
    e.preventDefault();

    const rentalStart = document.getElementById('cart-rental-start').value;
    const rentalPeriod = parseInt(document.getElementById('cart-rental-period').value);
    const rentalEnd = document.getElementById('cart-rental-end').value;
    const deliveryDate = document.getElementById('cart-delivery-date').value;
    const userFullname = document.getElementById('user-fullname').value;
    const userEmail = document.getElementById('user-email').value;
    const userPhone = document.getElementById('user-phone').value;

    // Логування даних форми
    console.log('handleRentCartSubmit: Дані форми:', {
        rentalStart,
        rentalPeriod,
        rentalEnd,
        deliveryDate,
        userFullname,
        userEmail,
        userPhone
    });

    if (!rentalStart || !rentalPeriod || !rentalEnd || !deliveryDate || !userFullname || !userEmail || !userPhone) {
        alert('Будь ласка, заповніть усі поля.');
        return;
    }

    if (new Date(rentalEnd) <= new Date(rentalStart)) {
        alert('Дата закінчення оренди повинна бути пізніше дати початку.');
        return;
    }

    console.log('handleRentCartSubmit: Валідація пройдена, викликаємо submitCart()');
    await submitCart();

    closeRentCartModal();
    closeFavoritesModal();

    await renderCartModal();
}

function closeRentCartModal() {
    document.getElementById('rent-cart-modal').style.display = 'none';
}

async function clearFavorites() {
    if (confirm('Очистити кошик?')) {
        await clearCart();
        await renderCartModal();
    }
}

async function addToCartFromList(id) {
    const machine = machines.find(m => m.id === id);
    if (machine) {
        await addToCart(machine);
        await renderCartModal();
    }
}

window.openCartModal = renderCartModal;
window.closeFavoritesModal = closeFavoritesModal;
window.rentAllFavorites = rentAllFavorites;
window.clearFavorites = clearFavorites;
window.openAddModal = openAddModal;
window.editMachine = editMachine;
window.deleteMachine = deleteMachine;
window.closeModal = closeModal;
window.closeRentCartModal = closeRentCartModal;
window.fetchUserData = fetchUserData;