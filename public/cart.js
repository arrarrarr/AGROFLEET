// Файл: cart.js

async function fetchUserProfile() {
    try {
        const response = await fetch('/api/profile', {
            method: 'GET',
            credentials: 'include',
        });
        if (!response.ok) throw new Error('Не вдалося завантажити дані профілю');
        const user = await response.json();
        console.log('Отримані дані профілю:', user);
        return user;
    } catch (error) {
        console.error('Помилка при завантаженні профілю:', error);
        return { fullName: '', email: '', phone: '', city: '', address: '', gender: 'не указано', profileImage: '' };
    }
}

async function updateUserProfile(userData) {
    try {
        console.log('Отправляем данные для обновления профиля:', userData);
        const response = await fetch('/api/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(userData),
        });
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Ошибка от сервера при обновлении профиля:', errorData);
            throw new Error(errorData.message || 'Не вдалося оновити профіль');
        }
        const updatedUser = await response.json();
        console.log('Профіль оновлено:', updatedUser);
        return updatedUser;
    } catch (error) {
        console.error('Помилка при оновленні профілю:', error);
        showNotification('Не вдалося оновити профіль. Спробуйте ще раз.', 5000);
        throw error;
    }
}

async function autofillCartForm() {
    const user = await fetchUserProfile();
    const userFullnameInput = document.getElementById('user-fullname');
    const userEmailInput = document.getElementById('user-email');
    const userPhoneInput = document.getElementById('user-phone');
    const userCityInput = document.getElementById('user-city');
    const userAddressInput = document.getElementById('user-address');

    if (userFullnameInput && !userFullnameInput.value && user.fullName) userFullnameInput.value = user.fullName;
    if (userEmailInput && !userEmailInput.value && user.email) userEmailInput.value = user.email;
    if (userPhoneInput && !userPhoneInput.value && user.phone) userPhoneInput.value = user.phone;
    if (userCityInput && !userCityInput.value && user.city) userCityInput.value = user.city;
    if (userAddressInput && !userAddressInput.value && user.address) userAddressInput.value = user.address;
}

async function fetchCart() {
    try {
        const response = await fetch('/api/equipment/cart', {
            method: 'GET',
            credentials: 'include',
        });
        if (!response.ok) throw new Error('Не вдалося завантажити кошик');
        const cart = await response.json();
        console.log('Отриманий кошик:', cart);
        return cart;
    } catch (error) {
        console.error('Помилка при завантаженні кошика:', error);
        showNotification('Не вдалося завантажити кошик. Спробуйте ще раз.', 5000);
        return [];
    }
}

export async function addToCart(machine) {
    try {
        if (!machine.price) {
            console.warn(`Ціна відсутня для техніки: ${machine.name}`);
            machine.price = 0;
        }
        console.log('Додаємо до кошика:', machine);
        const response = await fetch('/api/equipment/cart/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                id: machine.id,
                name: machine.name,
                quantity: 1,
                price: machine.price,
            }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Не вдалося додати техніку до кошика');
        }
        showNotification(`${machine.name} додано до кошика!`, 3000);
        await updateCartCount();
        await renderCartModal();
    } catch (error) {
        console.error('Помилка при додаванні до кошика:', error);
        showNotification('Не вдалося додати техніку до кошика. Спробуйте ще раз.', 5000);
    }
}

export async function removeFromCart(index) {
    try {
        const response = await fetch('/api/equipment/cart/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ index }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Не вдалося видалити техніку з кошика');
        }
        showNotification('Техніку видалено з кошика.', 3000);
        await updateCartCount();
        await renderCartModal();
    } catch (error) {
        console.error('Помилка при видаленні з кошика:', error);
        showNotification('Не вдалося видалити техніку з кошика. Спробуйте ще раз.', 5000);
    }
}

export async function clearCart() {
    try {
        const response = await fetch('/api/equipment/cart/clear', {
            method: 'POST',
            credentials: 'include',
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Не вдалося очистити кошик');
        }
        showNotification('Кошик очищено.', 3000);
        await updateCartCount();
        await renderCartModal();
    } catch (error) {
        console.error('Помилка при очищенні кошика:', error);
        showNotification('Не вдалося очистити кошик. Спробуйте ще раз.', 5000);
    }
}

export async function updateCartQuantity(index, action) {
    try {
        const cart = await fetchCart();
        if (!cart[index]) throw new Error('Техніка не знайдена в кошику');
        let newQuantity = cart[index].quantity || 1;
        if (action === 'increase') {
            newQuantity += 1;
        } else if (action === 'decrease' && newQuantity > 1) {
            newQuantity -= 1;
        } else {
            console.log('Кількість не може бути меншою за 1');
            return;
        }
        const response = await fetch('/api/equipment/cart/update-quantity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ index, quantity: newQuantity }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Не вдалося оновити кількість техніки в кошику');
        }
        showNotification('Кількість техніки оновлено.', 3000);
        await updateCartCount();
        await renderCartModal();
    } catch (error) {
        console.error('Помилка при оновленні кількості:', error);
        showNotification('Не вдалося оновити кількість техніки. Спробуйте ще раз.', 5000);
    }
}

export async function renderCartModal() {
    try {
        const cart = await fetchCart();
        const favoritesList = document.getElementById('favorites-list');
        if (!favoritesList) {
            console.error('Елемент з id="favorites-list" не знайдено');
            return;
        }
        favoritesList.innerHTML = '';
        if (cart.length === 0) {
            favoritesList.innerHTML = '<li>Кошик порожній.</li>';
        } else {
            cart.forEach((item, index) => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${item.name}</span>
                    <div class="quantity-controls">
                        <button class="cart-btn decrease-btn" data-index="${index}" ${item.quantity <= 1 ? 'disabled' : ''}>−</button>
                        <span>Кількість: ${item.quantity || 1}</span>
                        <button class="cart-btn increase-btn" data-index="${index}">+</button>
                    </div>
                    <button class="cart-btn remove-btn" data-index="${index}"><i class="fas fa-trash"></i> Видалити</button>
                `;
                favoritesList.appendChild(li);
            });
            document.querySelectorAll('.remove-btn').forEach(button => {
                button.addEventListener('click', async () => {
                    const index = parseInt(button.dataset.index);
                    await removeFromCart(index);
                });
            });
            document.querySelectorAll('.increase-btn').forEach(button => {
                button.addEventListener('click', async () => {
                    const index = parseInt(button.dataset.index);
                    await updateCartQuantity(index, 'increase');
                });
            });
            document.querySelectorAll('.decrease-btn').forEach(button => {
                button.addEventListener('click', async () => {
                    const index = parseInt(button.dataset.index);
                    await updateCartQuantity(index, 'decrease');
                });
            });
        }
        const modal = document.getElementById('favorites-modal');
        if (modal) {
            modal.style.display = 'flex';
            await autofillCartForm();
        } else {
            console.error('Модальне вікно з id="favorites-modal" не знайдено');
        }
    } catch (error) {
        console.error('Помилка при рендерингу кошика:', error);
        showNotification('Не вдалося відобразити кошик. Спробуйте ще раз.', 5000);
    }
}

export async function renderCartHistory() {
    try {
        const response = await fetch('/api/orders', {
            method: 'GET',
            credentials: 'include',
        });
        if (!response.ok) throw new Error('Не вдалося завантажити історію замовлень');
        const orders = await response.json();
        console.log('Отримана історія замовлень:', orders);
        const cartHistoryList = document.getElementById('cart-history-list');
        if (!cartHistoryList) {
            console.error('Елемент з id="cart-history-list" не знайдено');
            return;
        }
        cartHistoryList.innerHTML = '';
        if (orders.length === 0) {
            cartHistoryList.innerHTML = '<li>Історія замовлень порожня.</li>';
        } else {
            orders.sort((a, b) => {
                const dateA = new Date(a.created_at);
                const dateB = new Date(b.created_at);
                return dateB - dateA;
            });
            orders.forEach(order => {
                const createdAt = order.created_at ? new Date(order.created_at + 'Z') : null;
                const formattedDate = createdAt && !isNaN(createdAt) ? createdAt.toLocaleString('uk-UA', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) : 'Дата не вказана';
                const itemsList = order.items.map(item => `${item.name} (Кількість: ${item.quantity})`).join(', ');
                const li = document.createElement('li');
                li.innerHTML = `
                    <div class="cart-history-item">
                        <p>Замовлення №${order.id}: ${itemsList}</p>
                        <p>Дата: ${formattedDate}</p>
                        <p>Статус: ${order.status}</p>
                        <p>Загальна сума: ${order.totalAmount.toLocaleString('uk-UA')} грн</p>
                    </div>
                `;
                cartHistoryList.appendChild(li);
            });
        }
        const historyModal = document.getElementById('cart-history-modal');
        if (historyModal) {
            historyModal.style.display = 'flex';
        } else {
            console.error('Модальне вікно з id="cart-history-modal" не знайдено');
        }
    } catch (error) {
        console.error('Помилка при рендерингу історії замовлень:', error);
        showNotification('Не вдалося відобразити історію замовлень. Спробуйте ще раз.', 5000);
    }
}

export async function updateCartCount() {
    const cart = await fetchCart();
    const cartCount = cart.reduce((total, item) => total + (item.quantity || 1), 0);
    const cartCountElement = document.getElementById('cartCount');
    if (cartCountElement) {
        cartCountElement.textContent = cartCount;
    } else {
        console.warn('Елемент з id="cartCount" не знайдено в DOM. Счетчик корзины не обновлен.');
    }
}

function calculateDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    console.log(`Розрахунок днів: ${startDate} - ${endDate}, Кількість днів: ${days}`);
    return days;
}

function showNotification(message, duration = 3000) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), duration);
}

export async function submitCart() {
    const cart = await fetchCart();
    if (cart.length === 0) {
        showNotification('Кошик порожній. Додайте техніку перед відправленням.', 5000);
        return;
    }

    const rentalStart = document.getElementById('cart-rental-start')?.value;
    const rentalEnd = document.getElementById('cart-rental-end')?.value;
    const deliveryDate = document.getElementById('cart-delivery-date')?.value;
    const userFullname = document.getElementById('user-fullname')?.value;
    const userEmail = document.getElementById('user-email')?.value;
    const userPhone = document.getElementById('user-phone')?.value;
    const userCity = document.getElementById('user-city')?.value;
    const userAddress = document.getElementById('user-address')?.value;

    if (!rentalStart || !rentalEnd || !deliveryDate) {
        showNotification('Будь ласка, вкажіть дати оренди та дату доставки.', 5000);
        return;
    }
    if (!userFullname || !userEmail || !userPhone || !userCity || !userAddress) {
        showNotification('Будь ласка, заповніть усі поля з даними користувача (ПІБ, Email, Телефон, Місто, Адреса).', 5000);
        return;
    }
    if (!/^\S+@\S+\.\S+$/.test(userEmail)) {
        showNotification('Некоректний email!', 5000);
        return;
    }
    if (!/^\+?\d{10,}$/.test(userPhone.replace(/\D/g, ''))) {
        showNotification('Некоректний номер телефону! Введіть щонайменше 10 цифр.', 5000);
        return;
    }

    const rentalStartDate = new Date(rentalStart);
    const rentalEndDate = new Date(rentalEnd);
    const deliveryDateObj = new Date(deliveryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (rentalStartDate < today) {
        showNotification('Дата початку оренди не може бути в минулому.', 5000);
        return;
    }
    if (rentalEndDate <= rentalStartDate) {
        showNotification('Дата закінчення оренди повинна бути пізніше дати початку.', 5000);
        return;
    }
    if (deliveryDateObj < rentalStartDate) {
        showNotification('Дата доставки не може бути раніше дати початку оренди.', 5000);
        return;
    }

    const rentalDays = calculateDays(rentalStart, rentalEnd);
    console.log(`Кількість днів оренди: ${rentalDays}`);

    const totalAmount = cart.reduce((total, item) => {
        const pricePerDay = item.price || 0;
        const quantity = item.quantity || 1;
        const itemTotal = pricePerDay * quantity * rentalDays;
        console.log(`Техніка: ${item.name}, Ціна за день: ${pricePerDay}, Кількість: ${quantity}, Днів: ${rentalDays}, Загальна сума: ${itemTotal}`);
        return total + itemTotal;
    }, 0);

    if (totalAmount <= 0) {
        showNotification('Загальна сума не може бути 0. Перевірте ціни техніки.', 5000);
        return;
    }

    let currentProfile;
    try {
        currentProfile = await fetchUserProfile();
    } catch (error) {
        console.warn('Не удалось загрузить текущий профиль, продолжаем с пустым profileImage:', error);
        currentProfile = { profileImage: '' };
    }

    try {
        const userProfileData = {
            fullName: userFullname,
            email: userEmail,
            phone: userPhone,
            city: userCity,
            address: userAddress,
            gender: 'не указано',
            profileImage: currentProfile.profileImage || '',
        };
        console.log('Данные для обновления профиля:', userProfileData);
        await updateUserProfile(userProfileData);
    } catch (error) {
        console.warn('Обновление профиля не удалось, но продолжаем отправку заказа:', error);
    }

    const orderData = {
        items: cart.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
        })),
        status: 'pending',
        rentalStart,
        rentalEnd,
        deliveryDate,
        totalAmount,
        user: {
            fullName: userFullname,
            email: userEmail,
            phone: userPhone,
            city: userCity,
            address: userAddress,
        },
    };

    console.log('Відправляємо дані на сервер:', orderData);

    const submitButton = document.querySelector('.submit-cart-btn');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Завантаження...';
    }

    try {
        console.log('Отправка запроса на создание заказа:', {
            timestamp: new Date().toISOString(),
            data: orderData
        });

        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(orderData),
        });

        const responseData = await response.json();
        if (!response.ok) {
            console.error('Помилка від сервера:', responseData);
            if (responseData.error === 'Замовлення з такими даними вже існує') {
                showNotification(`Замовлення #${responseData.orderId} вже існує. Перевірте історію замовлень.`, 5000);
                await clearCart();
                await renderCartModal();
                window.location.href = '/profile.html'; // Перенаправляем на профиль
                return;
            }
            throw new Error(responseData.error || 'Помилка при відправленні замовлення');
        }

        console.log('Замовлення успішно відправлено:', responseData);
        const sentAt = new Date().toLocaleString('uk-UA', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        showNotification(`Замовлення #${responseData.orderId} успішно відправлено ${sentAt}! Очікуйте підтвердження менеджера. Загальна сума: ${totalAmount.toLocaleString('uk-UA')} грн`, 5000);

        await clearCart();
        await renderCartModal();
        window.location.href = '/profile.html'; // Перенаправляем на профиль, чтобы пользователь увидел уведомление
    } catch (error) {
        console.error('Помилка при відправленні кошика:', error);
        showNotification(`Не вдалося відправити замовлення: ${error.message}`, 5000);
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Оформити замовлення';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateCartCount();
    const submitButton = document.querySelector('.submit-cart-btn');
    if (submitButton) {
        // Убедимся, что обработчик добавляется только один раз
        submitButton.removeEventListener('click', submitCart); // Удаляем старый обработчик, если он есть
        submitButton.addEventListener('click', submitCart);
    }
    const historyButton = document.querySelector('.cart-history-btn');
    if (historyButton) historyButton.addEventListener('click', renderCartHistory);
});