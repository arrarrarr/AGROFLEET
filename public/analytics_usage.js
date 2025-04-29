import { notoSansBase64 } from './fonts.js';

document.addEventListener('DOMContentLoaded', async () => {
    const addBtn = document.getElementById('addReportBtn');
    const modal = document.getElementById('reportModal');
    const form = document.getElementById('reportForm');
    const grid = document.getElementById('reportGrid');

    if (!addBtn || !modal || !form || !grid) {
        console.error('Один або кілька елементів не знайдені:', { addBtn, modal, form, grid });
        alert('Помилка: Не вдалося ініціалізувати сторінку.');
        return;
    }

    let editId = null;
    let reports = [];
    let motoTimeRecords = [];
    let userRole = null;
    let equipmentClassesList = ['Трактор', 'Культиватор', 'Комбайн', 'Обприскувач', 'Плуг'];

    const fetchEquipmentClasses = async () => {
        try {
            const response = await fetch('/api/equipment-classes', { credentials: 'include' });
            if (!response.ok) throw new Error('Не вдалося завантажити класи техніки');
            equipmentClassesList = await response.json();
            console.log('Класи техніки:', equipmentClassesList);
        } catch (error) {
            console.error('Помилка завантаження класів:', error.message);
            equipmentClassesList = ['Трактор', 'Культиватор', 'Комбайн', 'Обприскувач', 'Плуг'];
        }
    };

    const addEquipmentClassField = () => {
        const label = document.createElement('label');
        label.setAttribute('for', 'reportEquipmentClass');
        label.className = 'noto-sans-regular';
        label.textContent = 'Клас техніки:';

        const select = document.createElement('select');
        select.id = 'reportEquipmentClass';
        select.setAttribute('required', true);
        select.className = 'noto-sans-regular';

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Виберіть клас техніки';
        select.appendChild(defaultOption);

        equipmentClassesList.forEach(cls => {
            const option = document.createElement('option');
            option.value = cls;
            option.textContent = cls;
            select.appendChild(option);
        });

        form.insertBefore(select, form.firstChild);
        form.insertBefore(label, select);
    };

    const removeEquipmentClassField = () => {
        const existingLabel = form.querySelector('label[for="reportEquipmentClass"]');
        const existingSelect = form.querySelector('#reportEquipmentClass');
        if (existingLabel) existingLabel.remove();
        if (existingSelect) existingSelect.remove();
    };

    const checkAuth = async () => {
        try {
            const response = await fetch('/api/auth/check-auth', { credentials: 'include' });
            if (!response.ok) {
                console.log('Не авторизовано. Статус:', response.status);
                alert('Будь ласка, увійдіть у систему');
                window.location.href = '/profile.html?authRequired=true';
                return false;
            }
            const user = await response.json();
            userRole = user.role;
            console.log('Роль користувача:', userRole);
            if (userRole !== 'admin' && userRole !== 'manager') {
                addBtn.style.display = 'none';
            }
            return true;
        } catch (error) {
            console.error('Помилка авторизації:', error.message);
            alert('Помилка перевірки авторизації');
            return false;
        }
    };

    const fetchMotoTimeRecords = async () => {
        try {
            const response = await fetch('/api/moto_time', { credentials: 'include' });
            if (!response.ok) {
                const errorData = await response.json();
                if (response.status === 401) {
                    alert('Сесія закінчилася. Увійдіть знову.');
                    window.location.href = '/profile.html?authRequired=true';
                    return;
                }
                throw new Error(errorData.error || 'Не вдалося завантажити дані мотогодин');
            }
            motoTimeRecords = await response.json();
            console.log('Записи мотогодин:', motoTimeRecords);
            return motoTimeRecords;
        } catch (error) {
            console.error('Помилка завантаження мотогодин:', error.message);
            alert(`Помилка: ${error.message}`);
            return [];
        }
    };

    const fetchReports = async () => {
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) return;

        try {
            const response = await fetch('/api/usage', { credentials: 'include' });
            if (!response.ok) {
                const errorData = await response.json();
                if (response.status === 401) {
                    alert('Сесія закінчилася. Увійдіть знову.');
                    window.location.href = '/profile.html?authRequired=true';
                    return;
                }
                throw new Error(errorData.error || 'Не вдалося завантажити звіти');
            }
            reports = await response.json();
            console.log('Звіти:', reports);
        } catch (error) {
            console.error('Помилка в fetchReports:', error.message);
            alert(`Помилка: ${error.message}`);
        }

        await fetchMotoTimeRecords();

        let combinedData = [
            ...motoTimeRecords.map(record => ({
                id: record.id,
                equipment: record.equipment,
                equipmentClass: record.equipment_class || 'Невідомий',
                operator: record.operator || 'Невідомий',
                hours: parseFloat(record.hours) || 0,
                fuel: record.fuel_consumed ? parseFloat(record.fuel_consumed) : 0,
                fuelUnit: record.fuel_consumed ? 'л' : '',
                oil: record.oil_consumed ? parseFloat(record.oil_consumed) : 0,
                oilUnit: record.oil_consumed ? 'л' : '',
                land: record.land_processed ? parseFloat(record.land_processed) : 0,
                landUnit: record.land_processed ? 'га' : '',
                status: record.status || 'Невідомий',
                date: record.date,
                workType: record.work_type || 'Невідомо',
                source: 'moto_time'
            })),
            ...reports.map(report => ({
                id: report.id,
                equipment: report.equipment,
                equipmentClass: report.equipment_class || 'Невідомий',
                operator: report.fullName || 'Невідомий',
                hours: parseInt(report.hours) || 0,
                fuel: report.fuel ? parseFloat(report.fuel) : 0,
                fuelUnit: report.fuel ? 'л' : '',
                oil: 0,
                oilUnit: '',
                land: 0,
                landUnit: '',
                status: report.status || 'Невідомий',
                period: report.period,
                date: report.date,
                workType: 'Невідомо',
                source: 'usage'
            }))
        ];

        // Группировка по дате, классу техники и оператору
        const groupedData = combinedData.reduce((acc, record) => {
            const key = `${record.date}|${record.equipmentClass}|${record.operator}`;
            if (!acc[key]) {
                acc[key] = { ...record, ids: [record.id], sources: [record.source] };
            } else {
                acc[key].hours += record.hours;
                acc[key].fuel += record.fuel;
                acc[key].fuelUnit = acc[key].fuel > 0 ? 'л' : '';
                acc[key].oil += record.oil;
                acc[key].oilUnit = acc[key].oil > 0 ? 'л' : '';
                acc[key].land += record.land;
                acc[key].landUnit = acc[key].land > 0 ? 'га' : '';
                acc[key].ids.push(record.id);
                acc[key].sources.push(record.source);
                // Если статусы разные, берём последний
                acc[key].status = record.status;
                // Если есть период, добавляем его (для записей из usage)
                if (record.period) {
                    acc[key].period = record.period;
                }
                // Если типы работы разные, берём последний
                acc[key].workType = record.workType;
            }
            return acc;
        }, {});

        // Преобразуем объект в массив и сортируем по дате (новые первыми)
        const finalData = Object.values(groupedData).sort((a, b) => new Date(b.date) - new Date(a.date));

        renderGrid(finalData);
    };

    addBtn.addEventListener('click', () => {
        editId = null;
        form.reset();
        form.reportDateModal.value = new Date().toISOString().split('T')[0];
        addEquipmentClassField();
        modal.style.display = 'flex';
        document.getElementById('modalTitle').textContent = 'Додати';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Зберігаю...';

        const report = {};
        if (form.reportName.value.trim()) report.equipment = form.reportName.value.trim();
        if (form.reportPeriod.value.trim()) report.period = form.reportPeriod.value.trim();
        if (form.reportHours.value.trim()) report.hours = parseInt(form.reportHours.value);
        if (form.reportFuel.value.trim()) report.fuel = form.reportFuel.value.trim();
        if (form.reportStatus.value) report.status = form.reportStatus.value;
        if (!editId) {
            const reportEquipmentClass = form.querySelector('#reportEquipmentClass');
            if (reportEquipmentClass && reportEquipmentClass.value) {
                report.equipmentClass = reportEquipmentClass.value;
            }
        }
        if (form.reportDateModal.value) {
            try {
                const date = new Date(form.reportDateModal.value);
                report.date = date.toISOString().split('T')[0];
            } catch (error) {
                console.error('Помилка форматування дати:', error.message);
                alert('Некоректний формат дати.');
                submitButton.disabled = false;
                submitButton.textContent = 'Зберегти';
                modal.style.display = 'none';
                return;
            }
        }

        if (!editId && (!report.equipment || !report.equipmentClass || !report.period || !report.hours || !report.fuel || !report.status || !report.date)) {
            alert('Заповніть усі поля для створення звіту.');
            submitButton.disabled = false;
            submitButton.textContent = 'Зберегти';
            modal.style.display = 'none';
            return;
        } else if (editId && Object.keys(report).length === 0) {
            alert('Змініть хоча б одне поле для оновлення.');
            submitButton.disabled = false;
            submitButton.textContent = 'Зберегти';
            modal.style.display = 'none';
            return;
        }

        if (report.hours && (isNaN(report.hours) || report.hours < 0)) {
            alert('Години роботи повинні бути позитивним числом.');
            submitButton.disabled = false;
            submitButton.textContent = 'Зберегти';
            modal.style.display = 'none';
            return;
        }

        try {
            const isAuthenticated = await checkAuth();
            if (!isAuthenticated) {
                submitButton.disabled = false;
                submitButton.textContent = 'Зберегти';
                modal.style.display = 'none';
                return;
            }

            let successMessage = '';
            if (editId) {
                const response = await fetch(`/api/usage/${editId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(report),
                    credentials: 'include'
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    if (response.status === 401) {
                        alert('Сесія закінчилася. Увійдіть знову.');
                        window.location.href = '/profile.html?authRequired=true';
                        return;
                    }
                    throw new Error(errorData.error || 'Помилка оновлення звіту');
                }
                successMessage = 'Звіт оновлено!';
            } else {
                const response = await fetch('/api/usage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(report),
                    credentials: 'include'
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    if (response.status === 401) {
                        alert('Сесія закінчилася. Увійдіть знову.');
                        window.location.href = '/profile.html?authRequired=true';
                        return;
                    }
                    throw new Error(errorData.error || 'Помилка додавання звіту');
                }
                successMessage = 'Звіт додано!';
            }

            modal.style.display = 'none';
            form.reset();
            fetchReports();
            alert(successMessage);
        } catch (error) {
            console.error('Помилка:', error.message);
            alert(`Помилка: ${error.message}`);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Зберегти';
            modal.style.display = 'none';
        }
    });

    function renderGrid(data) {
        grid.innerHTML = '';
        if (data.length === 0) {
            grid.innerHTML = '<p>Звітів не знайдено.</p>';
            return;
        }
        data.forEach(r => {
            let card = `
                <div class="report-card noto-sans-regular">
                    <h3>${r.equipment}</h3>
                    <p><i class="fas fa-user"></i><span> Оператор: ${r.operator}</span></p>
                    <p><i class="fas fa-clock"></i><span> Години: ${r.hours.toFixed(2)}</span></p>
                    <p><i class="fas fa-gas-pump"></i><span> Паливо: ${r.fuel.toFixed(2)} ${r.fuelUnit}</span></p>
                    <p><i class="fas fa-oil-can"></i><span> Масло: ${r.oil.toFixed(2)} ${r.oilUnit}</span></p>
                    <p><i class="fas fa-leaf"></i><span> Оброблено землі: ${r.land.toFixed(2)} ${r.landUnit}</span></p>
                    <p><i class="fas fa-calendar-check"></i><span> Дата: ${r.date}</span></p>
                    <p><i class="fas fa-tasks"></i><span> Тип роботи: ${r.workType}</span></p>
                    <div class="contract-actions">
            `;
            if (userRole === 'admin' || userRole === 'manager') {
                card += `
                        <button class="delete-btn noto-sans-regular" onclick="deleteReport(${r.ids[0]}, '${r.sources[0]}')"><i class="fas fa-trash"></i> Видалити</button>
                        <button class="export-btn noto-sans-regular" onclick="exportSingleToPDF(${r.ids[0]})"><i class="fas fa-file-pdf"></i></button>
                `;
            }
            card += `</div></div>`;
            grid.innerHTML += card;
        });
    }

    window.deleteReport = async function(id, source) {
        if (userRole !== 'admin' && userRole !== 'manager') {
            alert('У вас немає прав для видалення.');
            return;
        }
        try {
            const isAuthenticated = await checkAuth();
            if (!isAuthenticated) return;

            const apiEndpoint = source === 'moto_time' ? `/api/moto_time/${id}` : `/api/usage/${id}`;
            const response = await fetch(apiEndpoint, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!response.ok) {
                const errorData = await response.json();
                if (response.status === 401) {
                    alert('Сесія закінчилася. Увійдіть знову.');
                    window.location.href = '/profile.html?authRequired=true';
                    return;
                }
                throw new Error(errorData.error || 'Помилка видалення звіту');
            }
            fetchReports();
        } catch (error) {
            console.error('Помилка:', error.message);
            alert(`Помилка: ${error.message}`);
        }
    };

    window.exportSingleToPDF = async function(id) {
        if (userRole !== 'admin' && userRole !== 'manager') {
            alert('У вас немає прав для експорту.');
            return;
        }
        try {
            const isAuthenticated = await checkAuth();
            if (!isAuthenticated) return;

            const report = [...motoTimeRecords, ...reports].find(r => r.id === id);
            if (!report) {
                alert('Звіт не знайдено.');
                return;
            }

            const reportIndex = [...motoTimeRecords, ...reports].findIndex(r => r.id === id) + 1;
            const formattedReport = {
                id: report.id,
                equipment: report.equipment,
                operator: report.operator || report.fullName || 'Невідомий',
                hours: parseFloat(report.hours) || 0,
                fuel: report.fuel || (report.fuel_consumed ? `${parseFloat(report.fuel_consumed).toFixed(2)} л` : '0 л'),
                oil: report.oil_consumed ? `${parseFloat(report.oil_consumed).toFixed(2)} л` : '0 л',
                land: report.land_processed ? `${parseFloat(report.land_processed).toFixed(2)} га` : '0 га',
                status: report.status || 'Невідомий',
                date: report.date,
                workType: report.work_type || 'Невідомо',
                period: report.period || ''
            };
            exportToPDF([formattedReport], reportIndex);
        } catch (error) {
            console.error('Помилка:', error.message);
            alert(`Помилка: ${error.message}`);
        }
    };

    window.closeModal = function() {
        modal.style.display = 'none';
        editId = null;
        form.reset();
        removeEquipmentClassField();
    };

    function exportToPDF(selectedReports, reportIndex) {
        if (typeof window.jspdf === 'undefined') {
            console.error('jsPDF не завантажено.');
            alert('jsPDF не завантажено.');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
            putOnlyUsedFonts: true
        });

        try {
            doc.addFileToVFS('NotoSans-Regular.ttf', notoSansBase64);
            doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
            doc.setFont('NotoSans', 'normal');
        } catch (error) {
            console.error('Помилка додавання шрифту:', error);
            alert('Не вдалося додати шрифт.');
            return;
        }

        let yOffset = 10;
        const margin = 10;
        const pageWidth = doc.internal.pageSize.width;
        const maxLineWidth = pageWidth - 2 * margin;

        doc.setFontSize(20);
        doc.text('Звітність по використанню', margin, yOffset);
        yOffset += 15;

        selectedReports.forEach((r) => {
            if (yOffset > 260) {
                doc.addPage();
                yOffset = 10;
            }

            doc.setFontSize(14);
            const title = `Звіт #${reportIndex}: ${r.equipment}`;
            const splitTitle = doc.splitTextToSize(title, maxLineWidth);
            doc.text(splitTitle, margin, yOffset);
            yOffset += splitTitle.length * 7 + 5;

            doc.setFontSize(12);
            const reportDetails = [
                `Оператор: ${r.operator}`,
                `Години роботи: ${r.hours.toFixed(2)}`,
                `Витрати пального: ${r.fuel}`,
                `Витрати масла: ${r.oil}`,
                `Оброблено землі: ${r.land}`,
                `Дата: ${r.date}`,
                `Тип роботи: ${r.workType}`,
                r.period ? `Період: ${r.period}` : null,
                `Стан: ${r.status}`
            ].filter(detail => detail);

            reportDetails.forEach(detail => {
                if (yOffset > 260) {
                    doc.addPage();
                    yOffset = 10;
                }
                const splitText = doc.splitTextToSize(detail, maxLineWidth);
                doc.text(splitText, margin, yOffset);
                yOffset += splitText.length * 6 + 4;
            });

            yOffset += 5;
        });

        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(10);
            doc.text(`Сторінка ${i} з ${pageCount}`, pageWidth - margin - 20, 287);
        }

        try {
            doc.save(`Звіт_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error('Помилка збереження PDF:', error);
            alert('Не вдалося завантажити PDF.');
        }
    }

    await fetchEquipmentClasses();
    await checkAuth();
    fetchReports();
});