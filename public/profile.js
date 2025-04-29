window.showProfile = (user) => {
    const content = document.getElementById('content');
    if (!content) {
        console.error('Елемент з id="content" не знайдено');
        return;
    }

    if (!user) {
        console.error('Користувача не передано у функцію showProfile');
        return;
    }

    const safeUser = {
        fullName: user.fullName || 'Не вказано',
        createdAt: user.createdAt || null,
        city: user.city || 'Не вказано',
        role: user.role || 'Не вказано',
        username: user.username || 'Не вказано',
        gender: user.gender || 'Не вказано',
        email: user.email || 'Не вказано',
        phone: user.phone || 'Не вказано',
        address: user.address || 'Не вказано',
        profileImage: user.profileImage || 'images/user.png'
    };

    content.innerHTML = `
        <div class="profile-info">
            <div class="profile-header">
                <img id="profileImage" src="${safeUser.profileImage}" alt="Аватар" class="profile-image">
                <div class="message-icon-container profile-message-icon">
                    <i class="fas fa-envelope message-icon" id="messageIconProfile"></i>
                    <span class="notification-badge" id="notificationBadgeProfile" style="display: none;">0</span>
                </div>
            </div>
            <div class="profile-details">
                <div class="detail-item" data-row="1" title="Повне ім'я користувача">
                    <i class="fas fa-user"></i>
                    <span>${safeUser.fullName}</span>
                </div>
                <div class="detail-item" data-row="1" title="Дата приєднання">
                    <i class="fas fa-calendar"></i>
                    <span id="joinDate">${safeUser.createdAt ? new Date(safeUser.createdAt).toLocaleDateString('uk-UA') : '01.01.2023'}</span>
                </div>
                <div class="detail-item" data-row="2" title="Місто проживання">
                    <i class="fas fa-city"></i>
                    <span>${safeUser.city}</span>
                </div>
                <div class="detail-item" data-row="2" title="Роль">
                    <i class="fas fa-user-tag"></i>
                    <span>${safeUser.role}</span>
                </div>
                <div class="detail-item" data-row="3" title="Логін">
                    <i class="fas fa-user-circle"></i>
                    <span>${safeUser.username}</span>
                </div>
                <div class="detail-item" data-row="3" title="Стать">
                    <i class="fas fa-venus-mars"></i>
                    <span>${safeUser.gender}</span>
                </div>
                <div class="detail-item" data-row="4" title="Електронна пошта">
                    <i class="fas fa-envelope"></i>
                    <span>${safeUser.email}</span>
                </div>
                <div class="detail-item" data-row="4" title="Телефон">
                    <i class="fas fa-phone"></i>
                    <span>${safeUser.phone}</span>
                </div>
                <div class="detail-item" data-row="5" title="Адреса">
                    <i class="fas fa-map-marker"></i>
                    <span>${safeUser.address}</span>
                </div>
            </div>
            <div class="button-group">
                <button class="nav-button" onclick="showEditModal()">Редагувати</button>
                <button class="nav-button secondary" onclick="showLogoutModal()">Вихід</button>
            </div>
        </div>
    `;

    const profileImage = document.getElementById('profileImage');
    const profileImageHeader = document.getElementById('profileImageHeader');
    const defaultImage = 'images/user.png';
    const userImage = safeUser.profileImage || defaultImage;

    if (profileImage) {
        profileImage.src = userImage;
    } else {
        console.warn('Елемент з id="profileImage" не знайдено після оновлення DOM');
    }

    if (profileImageHeader) {
        profileImageHeader.src = userImage;
    } else {
        console.warn('Елемент з id="profileImageHeader" не знайдено');
    }

    console.log('Оновлено профіль:', safeUser);

    const messageIcon = document.getElementById('messageIconProfile');
    if (messageIcon) {
        messageIcon.addEventListener('click', () => {
            showModal('notificationsModal');
            fetchNotifications();
        });
    }

    fetchUnreadNotificationsCount();
};

async function checkAuth() {
    try {
        const response = await fetch('http://localhost:3000/api/auth/check-auth', {
            method: 'GET',
            credentials: 'include'
        });
        console.log('Відповідь від /api/auth/check-auth (checkAuth):', response.status, response.statusText);
        if (!response.ok) {
            console.error('Помилка при перевірці авторизації:', response.status);
            return { role: 'unauthorized' };
        }
        const data = await response.json();
        console.log('Результат перевірки авторизації:', data);
        return data;
    } catch (error) {
        console.error('Помилка перевірки авторизації:', error);
        return { role: 'unauthorized' };
    }
}

window.toggleAuthForms = () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const authModalTitle = document.getElementById('authModalTitle');
    const toggleAuthText = document.getElementById('toggleAuthText');

    if (loginForm.style.display === 'none') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        authModalTitle.textContent = 'Вхід';
        toggleAuthText.textContent = 'реєстрації';
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        authModalTitle.textContent = 'Реєстрація';
        toggleAuthText.textContent = 'входу';
    }

    loginForm.reset();
    registerForm.reset();
};

window.togglePasswordVisibility = (inputId) => {
    const passwordInput = document.getElementById(inputId);
    const toggleIcon = passwordInput.nextElementSibling.querySelector('i');
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.classList.remove('fa-eye');
        toggleIcon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        toggleIcon.classList.remove('fa-eye-slash');
        toggleIcon.classList.add('fa-eye');
    }
};

const fetchUnreadNotificationsCount = async () => {
    try {
        const response = await fetch('http://localhost:3000/api/notifications/unread-count', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error('Помилка при отриманні кількості непрочитаних сповіщень');
        }

        const data = await response.json();
        const unreadCount = data.unreadCount || 0;
        console.log('Кількість непрочитаних сповіщень:', unreadCount);

        const badge = document.getElementById('notificationBadgeProfile');
        const messageIcon = document.getElementById('messageIconProfile');
        if (badge && messageIcon) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount;
                badge.style.display = 'flex';
                messageIcon.classList.remove('fa-envelope-open');
                messageIcon.classList.add('fa-envelope');
                messageIcon.classList.add('animate-icon');
            } else {
                badge.style.display = 'none';
                messageIcon.classList.remove('fa-envelope');
                messageIcon.classList.add('fa-envelope-open');
                messageIcon.classList.add('animate-icon');
            }
        }
    } catch (err) {
        console.error('Помилка при завантаженні кількості непрочитаних сповіщень:', err.message);
        const badge = document.getElementById('notificationBadgeProfile');
        const messageIcon = document.getElementById('messageIconProfile');
        if (badge && messageIcon) {
            badge.style.display = 'none';
            messageIcon.classList.remove('fa-envelope');
            messageIcon.classList.add('fa-envelope-open');
            messageIcon.classList.add('animate-icon');
        }
    }
};

const fetchNotifications = async () => {
    try {
        const response = await fetch('http://localhost:3000/api/notifications', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error('Помилка при отриманні сповіщень');
        }

        const notifications = await response.json();
        console.log('Отримано сповіщення:', notifications);

        const notificationsList = document.querySelector('.notifications-list');
        if (!notificationsList) {
            console.error('Елемент .notifications-list не знайдено');
            return;
        }

        if (notifications.length === 0) {
            notificationsList.innerHTML = '<p>Немає сповіщень.</p>';
            return;
        }

        notificationsList.innerHTML = `
            <div class="notification-block">
                <h3>Список сповіщень</h3>
                ${notifications.map(notification => `
                    <div class="notification-item" data-id="${notification.id}">
                        <div class="notification-content">
                            <p>Нове замовлення №${notification.relatedId} для користувача ${notification.user.fullName}.</p>
                            <p>Дата створення: ${new Date(notification.created_at).toLocaleDateString('uk-UA')}.</p>
                            <p>Техніка: ${notification.order?.items?.map(item => item.name).join(', ') || 'Невідома техніка'} (Кількість: ${notification.order?.items?.length || 1}).</p>
                            <p>Період оренди: ${notification.order?.rentalStart ? new Date(notification.order.rentalStart).toLocaleDateString('uk-UA') : 'невідомо'} - ${notification.order?.rentalEnd ? new Date(notification.order.rentalEnd).toLocaleDateString('uk-UA') : 'невідомо'}.</p>
                            <p>Дата доставки: ${notification.order?.deliveryDate ? new Date(notification.order.deliveryDate).toLocaleDateString('uk-UA') : 'невідомо'}.</p>
                            <p>Email користувача: ${notification.user.email}.</p>
                            <p>Телефон користувача: ${notification.user.phone}.</p>
                        </div>
                        <div class="notification-actions">
                            <button class="action-button confirm-button" onclick="confirmNotification(${notification.id})">Створити договір</button>
                            <button class="action-button decline-button" onclick="deleteNotification(${notification.id})">Видалити</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        fetchUnreadNotificationsCount();
    } catch (err) {
        console.error('Помилка при завантаженні сповіщень:', err.message);
        showNotification('Помилка завантаження сповіщень.');
    }
};

window.confirmNotification = async (notificationId) => {
    try {
        const response = await fetch('http://localhost:3000/api/notifications/confirm-to-contract', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ notificationId }),
        });

        if (!response.ok) {
            throw new Error('Помилка при створенні договору');
        }

        const data = await response.json();
        console.log('Договір створено:', data);
        showNotification(data.message);
        fetchNotifications();
        window.location.href = '/contract.html';
    } catch (err) {
        console.error('Помилка при створенні договору:', err.message);
        showNotification('Помилка при створенні договору.');
    }
};

window.deleteNotification = async (notificationId) => {
    try {
        const response = await fetch(`http://localhost:3000/api/notifications/${notificationId}`, {
            method: 'DELETE',
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error('Помилка при видаленні сповіщення');
        }

        const data = await response.json();
        console.log('Сповіщення видалено:', data);
        showNotification(data.message);
        fetchNotifications();
    } catch (err) {
        console.error('Помилка при видаленні сповіщення:', err.message);
        showNotification('Помилка при видаленні сповіщення.');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const content = document.getElementById('content');
    const editModal = document.getElementById('editModal');
    const logoutModal = document.getElementById('logoutModal');
    const authModal = document.getElementById('authModal');
    const profileImageHeader = document.getElementById('profileImageHeader');
    const editForm = document.getElementById('editForm');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    fetchUnreadNotificationsCount();

    setInterval(fetchUnreadNotificationsCount, 30000);

    window.showModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            console.log(`Відкриваємо модальне вікно з id="${modalId}"`);
            document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
            modal.style.display = 'flex';
        } else {
            console.error(`Модальне вікно з id="${modalId}" не знайдено в DOM`);
            showNotification(`Помилка: модальне вікно з id="${modalId}" не знайдено. Перевірте HTML.`);
        }
    };

    window.closeModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            console.log(`Закриваємо модальне вікно з id="${modalId}"`);
            modal.style.display = 'none';
        }
    };

    window.showEditModal = () => {
        fetch('http://localhost:3000/api/profile', {
            method: 'GET',
            credentials: 'include'
        }).then(response => {
            console.log('Відповідь від /api/profile (showEditModal):', response.status, response.statusText);
            if (!response.ok) {
                throw new Error('Не вдалося завантажити дані профілю');
            }
            return response.json();
        }).then(user => {
            document.getElementById('editFullName').value = user.fullName || '';
            document.getElementById('editUsername').value = user.username || '';
            document.getElementById('editCity').value = user.city || '';
            document.getElementById('editGender').value = user.gender || 'Чоловіча';
            document.getElementById('editEmail').value = user.email || '';
            document.getElementById('editPhone').value = user.phone || '';
            document.getElementById('editAddress').value = user.address || '';
            document.getElementById('avatarFileName').textContent = user.profileImage ? 'Поточний аватар завантажено' : 'Файл не вибрано';
            document.getElementById('editAvatar').value = '';

            const editModal = document.getElementById('editModal');
            if (editModal) {
                editModal.dataset.currentProfileImage = user.profileImage || '';
            }

            showModal('editModal');
        }).catch(err => {
            console.error('Помилка при завантаженні даних для редагування:', err);
            showNotification('Помилка завантаження даних профілю.');
        });
    };

    window.showLogoutModal = () => {
        showModal('logoutModal');
    };

    window.login = async () => {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        const loginButton = document.querySelector('#loginForm button[type="submit"]');

        if (!username || !password) {
            showNotification('Будь ласка, заповніть усі поля.');
            return;
        }

        loginButton.disabled = true;
        loginButton.textContent = 'Завантаження...';

        try {
            const response = await fetch('http://localhost:3000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });
            console.log('Відповідь від /api/auth/login:', response.status, response.statusText);
            if (response.ok) {
                const user = await response.json();
                console.log('Дані користувача після входу:', user);
                window.showProfile(user);
                if (profileImageHeader) profileImageHeader.src = user.profileImage || 'images/user.png';
                closeModal('authModal');
                showNotification('Вхід виконано успішно!');
                loginForm.reset();
                const event = new Event('updateProfileImage');
                document.dispatchEvent(event);
                window.dispatchEvent(new Event('authChange'));
                fetchUnreadNotificationsCount();
            } else {
                const error = await response.json();
                console.log('Помилка входу:', error);
                if (response.status === 401) {
                    showNotification('Невірний логін або пароль.');
                } else {
                    showNotification(error.error || 'Помилка входу.');
                }
            }
        } catch (err) {
            console.error('Помилка при вході:', err);
            showNotification('Помилка сервера при вході.');
        } finally {
            loginButton.disabled = false;
            loginButton.textContent = 'Увійти';
        }
    };

    window.register = async () => {
        const fullName = document.getElementById('registerFullName').value.trim();
        const city = document.getElementById('registerCity').value.trim();
        const gender = document.getElementById('registerGender').value;
        const email = document.getElementById('registerEmail').value.trim();
        const username = document.getElementById('registerUsername').value.trim();
        const password = document.getElementById('registerPassword').value.trim();
        const registerButton = document.querySelector('#registerForm button[type="submit"]');

        if (!fullName || !city || !gender || !email || !username || !password) {
            showNotification('Будь ласка, заповніть усі поля.');
            return;
        }

        if (!/^\S+@\S+\.\S+$/.test(email)) {
            showNotification('Некоректний email!');
            return;
        }

        if (username.length < 3) {
            showNotification('Логін має містити мінімум 3 символи.');
            return;
        }

        if (password.length < 6) {
            showNotification('Пароль має містити мінімум 6 символів.');
            return;
        }

        console.log('Спроба реєстрації:', { fullName, city, gender, email, username, password });

        registerButton.disabled = true;
        registerButton.textContent = 'Завантаження...';

        try {
            const response = await fetch('http://localhost:3000/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ fullName, city, gender, email, username, password })
            });
            console.log('Відповідь від /api/auth/register:', response.status, response.statusText);
            if (response.ok) {
                const user = await response.json();
                console.log('Дані користувача після реєстрації:', user);
                window.showProfile(user);
                if (profileImageHeader) profileImageHeader.src = user.profileImage || 'images/user.png';
                closeModal('authModal');
                showNotification('Реєстрація успішна!');
                registerForm.reset();
                const event = new Event('updateProfileImage');
                document.dispatchEvent(event);
                window.dispatchEvent(new Event('authChange'));
                fetchUnreadNotificationsCount();
            } else {
                const error = await response.json();
                console.log('Помилка реєстрації:', error);
                showNotification(error.error || 'Помилка реєстрації.');
            }
        } catch (err) {
            console.error('Помилка при реєстрації:', err);
            showNotification('Помилка сервера при реєстрації.');
        } finally {
            registerButton.disabled = false;
            registerButton.textContent = 'Зареєструватися';
        }
    };

    window.logout = () => {
        const logoutButton = document.querySelector('#logoutModal .modal-button:not(.secondary)');
        logoutButton.disabled = true;
        logoutButton.textContent = 'Завантаження...';

        fetch('http://localhost:3000/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        }).then(response => {
            console.log('Відповідь від /api/auth/logout:', response.status, response.statusText);
            if (response.ok) {
                if (content) content.innerHTML = '';
                closeModal('logoutModal');
                showModal('authModal');
                showNotification('Ви вийшли!');
                if (profileImageHeader) {
                    profileImageHeader.src = 'images/user.png';
                }
                const event = new Event('updateProfileImage');
                document.dispatchEvent(event);
                window.dispatchEvent(new Event('authChange'));
                const badge = document.getElementById('notificationBadgeProfile');
                const messageIcon = document.getElementById('messageIconProfile');
                if (badge && messageIcon) {
                    badge.textContent = '0';
                    badge.style.display = 'none';
                    messageIcon.classList.remove('fa-envelope');
                    messageIcon.classList.add('fa-envelope-open');
                    messageIcon.classList.add('animate-icon');
                }
            } else {
                showNotification('Помилка при виході.');
            }
        }).catch(err => {
            console.error('Помилка при виході:', err);
            showNotification('Помилка при виході.');
        }).finally(() => {
            logoutButton.disabled = false;
            logoutButton.textContent = 'Так';
        });
    };

    window.loadPage = (page) => {
        window.location.href = page;
    };

    window.toggleDropdown = (event) => {
        const dropdownContent = event.target.nextElementSibling;
        if (dropdownContent.style.display === 'block') {
            dropdownContent.style.display = 'none';
        } else {
            dropdownContent.style.display = 'block';
        }
    };

    window.showNotification = (message) => {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    };

    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = document.getElementById('editFullName').value.trim();
            const username = document.getElementById('editUsername').value.trim();
            const city = document.getElementById('editCity').value.trim();
            const gender = document.getElementById('editGender').value;
            const email = document.getElementById('editEmail').value.trim();
            const phone = document.getElementById('editPhone').value.trim();
            const address = document.getElementById('editAddress').value.trim();
            const avatarInput = document.getElementById('editAvatar');
            const saveButton = editForm.querySelector('button[type="submit"]');

            if (!/^\S+@\S+\.\S+$/.test(email)) {
                showNotification('Некоректний email!');
                return;
            }

            if (username.length < 3) {
                showNotification('Логін має містити мінімум 3 символи.');
                return;
            }

            if (avatarInput.files[0]) {
                const maxSizeInMB = 5;
                const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
                if (avatarInput.files[0].size > maxSizeInBytes) {
                    showNotification(`Файл аватара занадто великий! Максимальний розмір: ${maxSizeInMB} МБ.`);
                    return;
                }
            }

            saveButton.disabled = true;
            saveButton.textContent = 'Збереження...';

            const updatedUser = { fullName, username, city, gender, email, phone, address };
            const editModal = document.getElementById('editModal');
            const currentProfileImage = editModal.dataset.currentProfileImage || '';

            if (avatarInput.files[0]) {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    updatedUser.profileImage = event.target.result;
                    await updateProfile(updatedUser);
                    saveButton.disabled = false;
                    saveButton.textContent = 'Зберегти';
                };
                reader.readAsDataURL(avatarInput.files[0]);
            } else {
                if (currentProfileImage) {
                    updatedUser.profileImage = currentProfileImage;
                }
                await updateProfile(updatedUser);
                saveButton.disabled = false;
                saveButton.textContent = 'Зберегти';
            }
        });
    }

    const editAvatar = document.getElementById('editAvatar');
    if (editAvatar) {
        editAvatar.addEventListener('change', (e) => {
            const file = e.target.files[0];
            const avatarFileName = document.getElementById('avatarFileName');
            if (avatarFileName && file) {
                avatarFileName.textContent = file.name;
            } else if (avatarFileName) {
                avatarFileName.textContent = 'Файл не вибрано';
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            login();
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            register();
        });
    }

    window.addEventListener('userLoaded', (event) => {
        const user = event.detail;
        console.log('Отримано дані користувача з profile.html:', user);

        if (user.role === 'unauthorized') {
            console.log('Користувач не авторизований, відкриваємо authModal');
            if (content) {
                content.innerHTML = '';
            }
            showModal('authModal');
            const urlParams = new URLSearchParams(window.location.search);
            const authRequired = urlParams.get('authRequired') === 'true';
            if (authRequired) {
                showNotification('Будь ласка, увійдіть, щоб отримати доступ до цієї сторінки.');
            }
        } else {
            console.log('Користувач авторизований, показуємо профіль');
            window.showProfile(user);
            if (profileImageHeader) {
                profileImageHeader.src = user.profileImage || 'images/user.png';
            }
            const updateEvent = new Event('updateProfileImage');
            document.dispatchEvent(updateEvent);
            fetchUnreadNotificationsCount();
        }
    });
});

async function updateProfile(user) {
    try {
        const response = await fetch('http://localhost:3000/api/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(user)
        });
        console.log('Відповідь від /api/profile (updateProfile):', response.status, response.statusText);
        if (response.ok) {
            const updatedUser = await response.json();
            console.log('Оновлені дані профілю:', updatedUser);
            window.showProfile(updatedUser);
            const profileImageHeader = document.getElementById('profileImageHeader');
            if (profileImageHeader) {
                profileImageHeader.src = updatedUser.profileImage || 'images/user.png';
            }
            closeModal('editModal');
            showNotification('Профіль оновлено!');
            const event = new Event('updateProfileImage');
            document.dispatchEvent(event);
        } else {
            const error = await response.json();
            console.log('Помилка оновлення профілю:', error);
            if (response.status === 401) {
                showNotification('Сесія закінчилася. Будь ласка, увійдіть знову.');
                showModal('authModal');
            } else {
                showNotification(error.error || 'Помилка при оновленні профілю.');
            }
        }
    } catch (err) {
        console.error('Помилка при оновленні профілю:', err);
        showNotification('Помилка сервера при оновленні профілю. Перевірте підключення до мережі.');
    }
}