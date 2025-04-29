// Реєструємо плагін аннотацій для Chart.js
Chart.register(window['chartjs-plugin-annotation']);

document.addEventListener('DOMContentLoaded', () => {
    // Оголошуємо елементи сторінки
    const elements = {
        totalUsers: document.getElementById('total-users'),
        maintenanceRecords: document.getElementById('maintenance-records'),
        motoHours: document.getElementById('moto-hours'),
        rentalsCount: document.getElementById('rentals-count'),
        efficiencyChart: document.getElementById('efficiencyChart').getContext('2d'),
        trendChart: document.getElementById('trendChart').getContext('2d'),
        barChart: document.getElementById('barChart').getContext('2d'),
        filterDate: document.getElementById('filterDate'),
        filterCategory: document.getElementById('filterCategory'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        loadingSpinner: document.getElementById('loadingSpinner'),
        totalUsersCard: document.getElementById('total-users-card'),
        maintenanceRecordsCard: document.getElementById('maintenance-records-card'),
        motoHoursCard: document.getElementById('moto-hours-card'),
        rentalsCountCard: document.getElementById('rentals-count-card')
    };

    let efficiencyChartInstance = null;
    let trendChartInstance = null;
    let barChartInstance = null;

    // Показуємо спінер завантаження
    const showLoading = () => {
        elements.loadingOverlay.style.display = 'block';
        elements.loadingSpinner.style.display = 'block';
    };

    // Приховуємо спінер завантаження
    const hideLoading = () => {
        elements.loadingOverlay.style.display = 'none';
        elements.loadingSpinner.style.display = 'none';
    };

    // Показуємо сповіщення
    const showNotification = (message, type = 'success') => {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    };

    // Форматуємо числа
    const formatNumber = (num) => {
        return new Intl.NumberFormat('uk-UA').format(num);
    };

    // Перевіряємо прострочені техобслуговування
    const checkMaintenanceReminders = (maintenanceRecords) => {
        const currentDate = new Date();
        const overdueRecords = maintenanceRecords.filter(record => {
            const nextMaintenanceDate = new Date(record.next_maintenance_date);
            return nextMaintenanceDate < currentDate && record.status !== 'Завершено';
        });
        if (overdueRecords.length > 0) {
            overdueRecords.forEach(record => {
                showNotification(
                    `Прострочено техобслуговування для ${record.equipment}! Заплановано на ${new Date(record.next_maintenance_date).toLocaleDateString('uk-UA')}`,
                    'error'
                );
            });
        }
    };

    // Оновлюємо дані на сторінці
    const updateData = (data) => {
        const users = data.users || [];
        const maintenanceRecords = data.maintenance || [];
        const maintenanceHistory = data.maintenanceHistory || []; // Новые данные истории обслуживания
        const motoTimeRecords = data.motoTime || [];
        const contracts = data.contracts || [];

        // Логування для дебагу
        console.log('Дані motoTimeRecords:', motoTimeRecords);
        console.log('Дані maintenanceHistory:', maintenanceHistory);
        console.log('Дані contracts:', contracts);
        const totalMotoHours = motoTimeRecords.reduce((sum, record) => {
            const hours = Number(record.hours) || 0;
            console.log(`Запис: ${JSON.stringify(record)}, Години: ${hours}`);
            return sum + hours;
        }, 0);
        console.log('Загальна кількість мотогодин:', totalMotoHours);
        console.log('Загальна кількість контрактів:', contracts.length);
        console.log('Загальна кількість історії обслуговування:', maintenanceHistory.length);

        // Анімація появи даних
        elements.totalUsers.style.opacity = '0';
        elements.maintenanceRecords.style.opacity = '0';
        elements.motoHours.style.opacity = '0';
        elements.rentalsCount.style.opacity = '0';

        setTimeout(() => {
            elements.totalUsers.textContent = formatNumber(users.length);
            elements.maintenanceRecords.textContent = formatNumber(maintenanceRecords.length + maintenanceHistory.length); // Суммируем записи техобслуживания и истории
            elements.motoHours.textContent = formatNumber(totalMotoHours);
            elements.rentalsCount.textContent = formatNumber(contracts.length);

            elements.totalUsers.style.transition = 'opacity 0.5s ease';
            elements.maintenanceRecords.style.transition = 'opacity 0.5s ease';
            elements.motoHours.style.transition = 'opacity 0.5s ease';
            elements.rentalsCount.style.transition = 'opacity 0.5s ease';

            elements.totalUsers.style.opacity = '1';
            elements.maintenanceRecords.style.opacity = '1';
            elements.motoHours.style.opacity = '1';
            elements.rentalsCount.style.opacity = '1';
        }, 300);

        updateEfficiencyChart(users.length, maintenanceRecords.length + maintenanceHistory.length, motoTimeRecords, contracts.length);
        updateTrendChart(users, maintenanceRecords, maintenanceHistory, motoTimeRecords, contracts);
        updateBarChart(users, maintenanceRecords, maintenanceHistory, motoTimeRecords, contracts);

        // Перевіряємо нагадування про техобслуговування
        checkMaintenanceReminders(maintenanceRecords);
    };

    // Завантажуємо дані з сервера
    const fetchData = async (filters = {}) => {
        showLoading();
        try {
            const query = new URLSearchParams(filters).toString();
            const [usersResponse, maintenanceResponse, maintenanceHistoryResponse, motoTimeResponse, contractsResponse] = await Promise.all([
                fetch(`/api/users?${query}`, { credentials: 'include' }),
                fetch(`/api/maintenance?${query}`, { credentials: 'include' }),
                fetch(`/api/maintenance/history?${query}`, { credentials: 'include' }), // Новый запрос для истории обслуживания
                fetch(`/api/moto_time?${query}`, { credentials: 'include' }),
                fetch(`/api/contracts?${query}`, { credentials: 'include' })
            ]);

            // Перевірка на помилку авторизації (401)
            if (usersResponse.status === 401 || maintenanceResponse.status === 401 || 
                maintenanceHistoryResponse.status === 401 || motoTimeResponse.status === 401 || 
                contractsResponse.status === 401) {
                showNotification('Будь ласка, увійдіть у систему', 'error');
                setTimeout(() => {
                    window.location.href = '/profile.html?authRequired=true';
                }, 2000);
                return;
            }

            if (!usersResponse.ok) throw new Error(`Помилка завантаження користувачів: ${usersResponse.statusText}`);
            if (!maintenanceResponse.ok) throw new Error(`Помилка завантаження техобслуговування: ${maintenanceResponse.statusText}`);
            if (!maintenanceHistoryResponse.ok) throw new Error(`Помилка завантаження історії обслуговування: ${maintenanceHistoryResponse.statusText}`);
            if (!motoTimeResponse.ok) throw new Error(`Помилка завантаження мотогодин: ${motoTimeResponse.statusText}`);
            if (!contractsResponse.ok) throw new Error(`Помилка завантаження контрактів: ${contractsResponse.statusText}`);

            const users = await usersResponse.json();
            const maintenanceRecords = await maintenanceResponse.json();
            const maintenanceHistory = await maintenanceHistoryResponse.json(); // Получаем данные истории обслуживания
            const motoTimeRecords = await motoTimeResponse.json();
            const contracts = await contractsResponse.json();

            const data = {
                users,
                maintenance: maintenanceRecords,
                maintenanceHistory, // Добавляем данные истории
                motoTime: motoTimeRecords,
                contracts
            };

            updateData(data);
        } catch (error) {
            console.error('Помилка:', error.message);
            elements.totalUsers.textContent = 'Помилка';
            elements.maintenanceRecords.textContent = 'Помилка';
            elements.motoHours.textContent = 'Помилка';
            elements.rentalsCount.textContent = 'Помилка';
            showNotification(error.message, 'error');
        } finally {
            hideLoading();
        }
    };

    // Оновлюємо кругову діаграму
    const updateEfficiencyChart = (usersCount, maintenanceCount, motoTimeRecords, contractsCount) => {
        if (efficiencyChartInstance) efficiencyChartInstance.destroy();
        efficiencyChartInstance = new Chart(elements.efficiencyChart, {
            type: 'pie',
            data: {
                labels: ['Користувачі', 'Техобслуговування та Історія', 'Мотогодини', 'Контракти'],
                datasets: [{
                    data: [
                        usersCount,
                        maintenanceCount, // Теперь включает и maintenance_records, и maintenance_history
                        motoTimeRecords.reduce((sum, record) => sum + (Number(record.hours) || 0), 0),
                        contractsCount
                    ],
                    backgroundColor: ['#2ecc71', '#27ae60', '#ff6f61', '#36a2eb'],
                    borderWidth: 1,
                    hoverOffset: 20,
                    shadowOffsetX: 3,
                    shadowOffsetY: 3,
                    shadowBlur: 10,
                    shadowColor: 'rgba(0, 0, 0, 0.2)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#2c3e50',
                            font: { size: 14, family: 'Arial' },
                            padding: 20,
                            boxWidth: 20,
                            usePointStyle: true
                        }
                    },
                    title: {
                        display: true,
                        text: 'Розподіл ефективності',
                        color: '#2ecc71',
                        font: { size: 18, family: 'Arial', weight: '600' },
                        padding: { top: 20, bottom: 20 }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(44, 62, 80, 0.9)',
                        titleFont: { family: 'Arial', size: 14 },
                        bodyFont: { family: 'Arial', size: 12 },
                        cornerRadius: 8,
                        caretSize: 8,
                        padding: 10
                    }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true,
                    duration: 1500,
                    easing: 'easeOutQuart'
                }
            }
        });
    };

    // Оновлюємо лінійний графік
    const updateTrendChart = (users, maintenanceRecords, maintenanceHistory, motoTimeRecords, contracts) => {
        if (trendChartInstance) trendChartInstance.destroy();

        // Отримуємо унікальні дати з motoTimeRecords, contracts и maintenanceHistory
        const motoDates = motoTimeRecords.map(m => m.date);
        const contractDates = contracts.map(c => c.date);
        const historyDates = maintenanceHistory.map(h => h.date);
        const dates = [...new Set([...motoDates, ...contractDates, ...historyDates])].sort();

        // Якщо немає дат, додаємо поточну дату для коректного відображення
        if (dates.length === 0) {
            dates.push(new Date().toISOString().split('T')[0]);
        }

        // Логування для дебагу
        console.log('Дати для графіка:', dates);
        console.log('motoTimeRecords:', motoTimeRecords);
        console.log('maintenanceHistory:', maintenanceHistory);
        console.log('contracts:', contracts);

        const userCounts = dates.map(date => users.filter(u => u.created_at?.startsWith(date)).length);
        const maintenanceCounts = dates.map(date => maintenanceRecords.filter(m => m.date?.startsWith(date)).length);
        const historyCounts = dates.map(date => maintenanceHistory.filter(h => h.date === date).length);
        const motoHours = dates.map(date => {
            const hours = motoTimeRecords.filter(m => m.date === date).reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
            console.log(`Моточаси для ${date}: ${hours}`);
            return hours;
        });
        const contractCounts = dates.map(date => {
            const count = contracts.filter(c => c.date === date).length;
            console.log(`Контракти для ${date}: ${count}`);
            return count;
        });

        // Логування для дебагу
        console.log('Користувачі:', userCounts);
        console.log('Техобслуговування:', maintenanceCounts);
        console.log('Історія обслуговування:', historyCounts);
        console.log('Моточаси:', motoHours);
        console.log('Контракти:', contractCounts);

        // Створюємо аннотації для моточасів
        const annotations = motoHours.map((hours, index) => ({
            type: 'label',
            xValue: dates[index],
            yValue: hours + 2,
            content: hours.toFixed(1),
            backgroundColor: 'rgba(255, 111, 97, 0.8)',
            color: '#fff',
            font: { size: 12 },
            padding: 4,
            borderRadius: 4
        }));

        trendChartInstance = new Chart(elements.trendChart, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: 'Користувачі',
                        data: userCounts,
                        borderColor: '#2ecc71',
                        backgroundColor: 'rgba(46, 204, 113, 0.2)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 5,
                        pointHoverRadius: 8,
                        pointBackgroundColor: '#2ecc71',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2
                    },
                    {
                        label: 'Техобслуговування',
                        data: maintenanceCounts,
                        borderColor: '#27ae60',
                        backgroundColor: 'rgba(39, 174, 96, 0.2)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 5,
                        pointHoverRadius: 8,
                        pointBackgroundColor: '#27ae60',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2
                    },
                    {
                        label: 'Історія обслуговування',
                        data: historyCounts,
                        borderColor: '#8e44ad',
                        backgroundColor: 'rgba(142, 68, 173, 0.2)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 5,
                        pointHoverRadius: 8,
                        pointBackgroundColor: '#8e44ad',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2
                    },
                    {
                        label: 'Мотогодини',
                        data: motoHours,
                        borderColor: '#ff6f61',
                        backgroundColor: 'rgba(255, 111, 97, 0.2)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 5,
                        pointHoverRadius: 8,
                        pointBackgroundColor: '#ff6f61',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2
                    },
                    {
                        label: 'Контракти',
                        data: contractCounts,
                        borderColor: '#36a2eb',
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 5,
                        pointHoverRadius: 8,
                        pointBackgroundColor: '#36a2eb',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#2c3e50',
                            font: { size: 14, family: 'Arial' },
                            padding: 20,
                            boxWidth: 20,
                            usePointStyle: true
                        }
                    },
                    title: {
                        display: true,
                        text: 'Тренди ефективності за датами',
                        color: '#2ecc71',
                        font: { size: 18, family: 'Arial', weight: '600' },
                        padding: { top: 20, bottom: 20 }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(44, 62, 80, 0.9)',
                        titleFont: { family: 'Arial', size: 14 },
                        bodyFont: { family: 'Arial', size: 12 },
                        cornerRadius: 8,
                        caretSize: 8,
                        padding: 10
                    },
                    annotation: {
                        annotations: annotations
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Дата',
                            color: '#2c3e50',
                            font: { size: 14, family: 'Arial' }
                        },
                        ticks: {
                            color: '#2c3e50',
                            maxRotation: 45,
                            minRotation: 45,
                            font: { size: 12 }
                        },
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Значення',
                            color: '#2c3e50',
                            font: { size: 14, family: 'Arial' }
                        },
                        ticks: {
                            color: '#2c3e50',
                            font: { size: 12 },
                            beginAtZero: true,
                            stepSize: 2
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        suggestedMax: 15
                    }
                },
                animation: {
                    duration: 1500,
                    easing: 'easeOutQuart'
                }
            }
        });
    };

    // Оновлюємо стовпчикову діаграму
    const updateBarChart = (users, maintenanceRecords, maintenanceHistory, motoTimeRecords, contracts) => {
        if (barChartInstance) barChartInstance.destroy();
        barChartInstance = new Chart(elements.barChart, {
            type: 'bar',
            data: {
                labels: ['Користувачі', 'Техобслуговування та Історія', 'Мотогодини', 'Контракти'],
                datasets: [{
                    label: 'Кількість',
                    data: [
                        users.length,
                        maintenanceRecords.length + maintenanceHistory.length, // Суммируем записи
                        motoTimeRecords.reduce((sum, record) => sum + (Number(record.hours) || 0), 0),
                        contracts.length
                    ],
                    backgroundColor: ['#2ecc71', '#27ae60', '#ff6f61', '#36a2eb'],
                    borderColor: ['#27ae60', '#219653', '#e74c3c', '#2c82c9'],
                    borderWidth: 1,
                    hoverBackgroundColor: ['#27ae60', '#219653', '#e74c3c', '#2c82c9'],
                    hoverBorderColor: ['#219653', '#1e8449', '#c0392b', '#2874a6']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Порівняння показників',
                        color: '#2ecc71',
                        font: { size: 18, family: 'Arial', weight: '600' },
                        padding: { top: 20, bottom: 20 }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(44, 62, 80, 0.9)',
                        titleFont: { family: 'Arial', size: 14 },
                        bodyFont: { family: 'Arial', size: 12 },
                        cornerRadius: 8,
                        caretSize: 8,
                        padding: 10
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Категорії',
                            color: '#2c3e50',
                            font: { size: 14, family: 'Arial' }
                        },
                        ticks: {
                            color: '#2c3e50',
                            font: { size: 12 }
                        },
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Значення',
                            color: '#2c3e50',
                            font: { size: 14, family: 'Arial' }
                        },
                        ticks: {
                            color: '#2c3e50',
                            font: { size: 12 },
                            beginAtZero: true,
                            stepSize: 2
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        suggestedMax: 15
                    }
                },
                animation: {
                    duration: 1500,
                    easing: 'easeOutQuart'
                }
            }
        });
    };

    // Обробка фільтрів
    const applyFilters = () => {
        const filters = {};
        if (elements.filterDate.value) {
            filters.date = elements.filterDate.value;
        }
        if (elements.filterCategory.value) {
            filters.category = elements.filterCategory.value;
        }
        fetchData(filters);
    };

    // Додаємо обробники подій для фільтрів
    elements.filterDate.addEventListener('change', applyFilters);
    elements.filterCategory.addEventListener('change', applyFilters);

    // Додаємо обробники кліків для метрик
    elements.totalUsersCard.addEventListener('click', () => {
        window.location.href = '/users.html';
    });

    elements.maintenanceRecordsCard.addEventListener('click', () => {
        window.location.href = '/maintenance.html';
    });

    elements.motoHoursCard.addEventListener('click', () => {
        window.location.href = '/moto_time.html';
    });

    elements.rentalsCountCard.addEventListener('click', () => {
        window.location.href = '/contract_management.html';
    });

    // Ініціалізація сторінки
    const init = () => {
        // Початкове завантаження даних
        fetchData();
    };

    // Запускаємо ініціалізацію
    init();
});