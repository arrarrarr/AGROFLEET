import { notoSansBase64 } from "./fonts.js";

// Перевірка наявності jsPDF
const { jsPDF } = window.jspdf || { jsPDF: null }; // Оновлено для UMD-модуля

// Список операторів
const operators = [
  "Іван Петров",
  "Олена Сидоренко",
  "Михайло Коваль",
  "Сергій Іванов",
  "Анна Грищенко",
];

// Коефіцієнти для різних типів робіт (впливають на витрату палива та масла)
const workTypeConsumptionModifiers = {
  Оранка: { fuel: 1.2, oil: 1.2 }, // +20%
  Сівба: { fuel: 1.1, oil: 1.1 }, // +10%
  "Збір врожаю": { fuel: 1.15, oil: 1.15 }, // +15%
  "Обробка ґрунту": { fuel: 1.0, oil: 1.0 }, // Без змін
  Обприскування: { fuel: 0.9, oil: 0.9 }, // -10%
};

// Data storage
let totalHours = {};
let totalFuel = {};
let totalOil = {};
let totalLand = {};
let logs = [];
let dailyRecords = [];
let hoursTrendChart;
let dateRange = { start: new Date(), end: new Date() };
let currentOperator = operators[0];
let equipmentApiData = [];
let averageConsumptionRates = {};
let equipmentVisibility = {};
let equipmentClasses = [];

// Mapping of work types to available equipment
let workTypeEquipmentMap = {
  Оранка: [],
  Сівба: [],
  "Збір врожаю": [],
  "Обробка ґрунту": [],
  Обприскування: [],
};

// Ініціалізація сторінки
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadEquipmentApiData();
    initializeEquipmentStats();
    initializeWorkTypeEquipmentMap();
    await calculateAverageConsumptionRates();
    initializeDatePickers();
    initializeDateRangeInputs();
    await loadData();
    loadEquipmentOptions();
    loadEquipmentClassOptions();
    loadOperatorOptions();
    loadCharts();
    setupEquipmentToggles();
    updateStatistics();
    updateLogDisplay();
    setupFormValidation();

    // Прив'язка обробників подій
    const addButton = document.querySelector(".log-header .primary-btn");
    if (addButton) {
      addButton.addEventListener("click", openAddModal);
    } else {
      console.error("Add button not found");
    }

    const closeModalButton = document.querySelector("#addModal .close-modal");
    if (closeModalButton) {
      closeModalButton.addEventListener("click", closeAddModal);
    } else {
      console.error("Close modal button not found");
    }

    const cancelButton = document.querySelector("#addWorkForm .secondary-btn");
    if (cancelButton) {
      cancelButton.addEventListener("click", closeAddModal);
    } else {
      console.error("Cancel button not found");
    }

    const exportButton = document.querySelector(".export-btn");
    if (exportButton) {
      exportButton.addEventListener("click", exportToPDF);
    } else {
      console.error("Export button not found");
    }

    const equipmentFilter = document.getElementById("equipmentFilter");
    if (equipmentFilter) {
      equipmentFilter.addEventListener("change", () => {
        updateLogDisplay();
        updateCharts();
        updateStatistics();
      });
    } else {
      console.error("Equipment filter not found");
    }

    const equipmentClassFilter = document.getElementById(
      "equipmentClassFilter"
    );
    if (equipmentClassFilter) {
      equipmentClassFilter.addEventListener("change", () => {
        updateLogDisplay();
        updateCharts();
        updateStatistics();
      });
    } else {
      console.error("Equipment class filter not found");
    }

    const applyDateRangeBtn = document.getElementById("applyDateRangeBtn");
    if (applyDateRangeBtn) {
      applyDateRangeBtn.addEventListener("click", applyDateRange);
    } else {
      console.error("Apply date range button not found");
    }

    const form = document.getElementById("addWorkForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        addWorkRecord();
      });
    } else {
      console.error("Add work form not found");
    }
  } catch (error) {
    console.error("Помилка ініціалізації сторінки:", error.message);
  }
});

// Ініціалізація об'єктів для зберігання статистики
function initializeEquipmentStats() {
  equipmentApiData.forEach((equip) => {
    totalHours[equip.name] = 0;
    totalFuel[equip.name] = 0;
    totalOil[equip.name] = 0;
    totalLand[equip.name] = 0;
    equipmentVisibility[equip.name] = true;
  });

  equipmentClasses.forEach((cls) => {
    totalHours[cls] = 0;
    totalFuel[cls] = 0;
    totalOil[cls] = 0;
    totalLand[cls] = 0;
    equipmentVisibility[cls] = true;
  });
}

// Формуємо workTypeEquipmentMap на основі даних з API
function initializeWorkTypeEquipmentMap() {
  equipmentApiData.forEach((equip) => {
    if (equip.type === "трактор") {
      workTypeEquipmentMap["Оранка"].push(equip.name);
      workTypeEquipmentMap["Сівба"].push(equip.name);
      workTypeEquipmentMap["Обробка ґрунту"].push(equip.name);
    } else if (equip.type === "комбайн") {
      workTypeEquipmentMap["Збір врожаю"].push(equip.name);
    } else if (equip.type === "культиватор") {
      workTypeEquipmentMap["Оранка"].push(equip.name);
      workTypeEquipmentMap["Обробка ґрунту"].push(equip.name);
    } else if (equip.type === "плуг") {
      workTypeEquipmentMap["Оранка"].push(equip.name);
    } else if (equip.type === "обприскувач") {
      workTypeEquipmentMap["Обробка ґрунту"].push(equip.name);
      workTypeEquipmentMap["Обприскування"].push(equip.name);
    }
  });
}

// Ініціалізація Flatpickr для модального вікна
function initializeDatePickers() {
  if (typeof flatpickr === "undefined") {
    console.error("Flatpickr is not loaded");
    return;
  }

  flatpickr("#workDate", {
    dateFormat: "Y-m-d",
    defaultDate: new Date(),
    maxDate: new Date(),
    enableTime: false,
    locale: {
      firstDayOfWeek: 1,
      weekdays: {
        shorthand: ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
        longhand: [
          "Неділя",
          "Понеділок",
          "Вівторок",
          "Середа",
          "Четвер",
          "П’ятниця",
          "Субота",
        ],
      },
      months: {
        shorthand: [
          "Січ",
          "Лют",
          "Бер",
          "Квіт",
          "Трав",
          "Черв",
          "Лип",
          "Серп",
          "Вер",
          "Жовт",
          "Лист",
          "Груд",
        ],
        longhand: [
          "Січень",
          "Лютий",
          "Березень",
          "Квітень",
          "Травень",
          "Червень",
          "Липень",
          "Серпень",
          "Вересень",
          "Жовтень",
          "Листопад",
          "Грудень",
        ],
      },
    },
  });
}

// Ініціалізація полів вибору діапазону дат
function initializeDateRangeInputs() {
  const startDateInput = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");

  if (!startDateInput || !endDateInput) {
    console.error("Date range inputs not found");
    return;
  }

  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  startDateInput.value = thirtyDaysAgo.toISOString().split("T")[0];
  endDateInput.value = today.toISOString().split("T")[0];

  dateRange.start = thirtyDaysAgo;
  dateRange.end = today;

  startDateInput.max = today.toISOString().split("T")[0];
  endDateInput.max = today.toISOString().split("T")[0];
}

// Застосування обраного діапазону дат
function applyDateRange() {
  const startDateInput = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");

  if (!startDateInput.value || !endDateInput.value) {
    alert("Будь ласка, оберіть початкову та кінцеву дату.");
    return;
  }

  const startDate = new Date(startDateInput.value);
  const endDate = new Date(endDateInput.value);

  if (startDate > endDate) {
    alert("Початкова дата не може бути пізніше кінцевої дати.");
    return;
  }

  dateRange.start = startDate;
  dateRange.end = endDate;

  updateLogDisplay();
  updateStatistics();
  updateCharts();
}

// Завантаження даних про техніку з API
async function loadEquipmentApiData() {
  try {
    const response = await fetch(
      "https://agrofleet-pdqw.onrender.com/api/equipment",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      if (response.status === 401) {
        console.log(
          "Не авторизовано при отриманні даних про техніку. Завантажимо порожній список."
        );
        equipmentApiData = [];
        equipmentClasses = [];
        return;
      }
      throw new Error(
        errorData.error ||
          `Failed to fetch equipment data: ${response.statusText}`
      );
    }

    equipmentApiData = await response.json();
    console.log("Дані про техніку завантажені з API:", equipmentApiData);

    equipmentClasses = [
      ...new Set(equipmentApiData.map((equip) => equip.type)),
    ];
    console.log("Класи техніки:", equipmentClasses);
  } catch (error) {
    console.error(
      "Помилка при завантаженні даних про техніку з API:",
      error.message
    );
    equipmentApiData = [];
    equipmentClasses = [];
  }
}

// Розрахунок середніх значень витрат на основі історичних даних (тільки для статистики)
async function calculateAverageConsumptionRates() {
  try {
    const response = await fetch(
      "https://agrofleet-pdqw.onrender.com/api/moto_time",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      if (response.status === 401) {
        console.log(
          "Не авторизовано при отриманні записів для середніх значень. Використаємо стандартні значення."
        );
        equipmentApiData.forEach((equip) => {
          averageConsumptionRates[equip.name] = {
            fuelConsumptionRate: getFuelConsumptionRate(equip.type),
            oilConsumptionRate: getOilConsumptionRate(equip.type),
            landProcessingRate: equip.land_processing_rate || 2,
          };
        });
        return;
      }
      throw new Error(
        errorData.error ||
          `Failed to fetch moto time records: ${response.statusText}`
      );
    }

    const records = await response.json();
    console.log("Отримані записи для розрахунку середніх значень:", records);

    const equipmentStats = {};

    equipmentApiData.forEach((equip) => {
      equipmentStats[equip.name] = {
        totalHours: 0,
        totalFuel: 0,
        totalOil: 0,
        totalLand: 0,
        recordCount: 0,
      };
    });

    records.forEach((record) => {
      const equipment = record.equipment;
      if (equipmentStats[equipment]) {
        equipmentStats[equipment].totalHours += parseFloat(record.hours);
        equipmentStats[equipment].totalFuel += parseFloat(
          record.fuel_consumed || 0
        );
        equipmentStats[equipment].totalOil += parseFloat(
          record.oil_consumed || 0
        );
        equipmentStats[equipment].totalLand += parseFloat(
          record.land_processed || 0
        );
        equipmentStats[equipment].recordCount += 1;
      }
    });

    equipmentApiData.forEach((equip) => {
      const stats = equipmentStats[equip.name];
      const totalHours = stats.totalHours;

      if (totalHours > 0 && stats.recordCount > 0) {
        averageConsumptionRates[equip.name] = {
          fuelConsumptionRate: stats.totalFuel / totalHours,
          oilConsumptionRate: stats.totalOil / totalHours,
          landProcessingRate: stats.totalLand / totalHours,
        };
      } else {
        averageConsumptionRates[equip.name] = {
          fuelConsumptionRate: getFuelConsumptionRate(equip.type),
          oilConsumptionRate: getOilConsumptionRate(equip.type),
          landProcessingRate: equip.land_processing_rate || 2,
        };
      }
    });

    console.log("Середні значення витрат:", averageConsumptionRates);
  } catch (error) {
    console.error("Помилка при розрахунку середніх значень:", error.message);
    equipmentApiData.forEach((equip) => {
      averageConsumptionRates[equip.name] = {
        fuelConsumptionRate: getFuelConsumptionRate(equip.type),
        oilConsumptionRate: getOilConsumptionRate(equip.type),
        landProcessingRate: equip.land_processing_rate || 2,
      };
    });
  }
}

// Функція для визначення витрати палива залежно від типу техніки
function getFuelConsumptionRate(equipmentType) {
  switch (equipmentType) {
    case "трактор":
      return 15; // 15 літрів на годину
    case "комбайн":
      return 25; // 25 літрів на годину
    case "культиватор":
      return 12; // 12 літрів на годину
    case "плуг":
      return 18; // 18 літрів на годину
    case "обприскувач":
      return 8; // 8 літрів на годину
    default:
      return 10; // Значення за замовчуванням
  }
}

// Функція для визначення витрати масла залежно від типу техніки
function getOilConsumptionRate(equipmentType) {
  switch (equipmentType) {
    case "трактор":
      return 0.8; // 0.8 літра на годину
    case "комбайн":
      return 1.2; // 1.2 літра на годину
    case "культиватор":
      return 0.6; // 0.6 літра на годину
    case "плуг":
      return 0.9; // 0.9 літра на годину
    case "обприскувач":
      return 0.4; // 0.4 літра на годину
    default:
      return 0.5; // Значення за замовчуванням
  }
}

// Завантаження опцій для вибору техніки
function loadEquipmentOptions() {
  const equipmentSelect = document.getElementById("equipment");
  const equipmentFilter = document.getElementById("equipmentFilter");
  if (!equipmentSelect || !equipmentFilter) {
    console.error("Equipment select or filter not found");
    return;
  }

  equipmentSelect.innerHTML =
    '<option value="" disabled selected>Оберіть техніку</option>';
  equipmentFilter.innerHTML = '<option value="">Уся техніка</option>';

  equipmentApiData.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.name;
    option.textContent = item.name;
    equipmentSelect.appendChild(option);

    const filterOption = document.createElement("option");
    filterOption.value = item.name;
    filterOption.textContent = item.name;
    equipmentFilter.appendChild(filterOption);
  });
}

// Завантаження опцій для вибору класів техніки
function loadEquipmentClassOptions() {
  const equipmentClassFilter = document.getElementById("equipmentClassFilter");
  if (!equipmentClassFilter) {
    console.error("Equipment class filter not found");
    return;
  }

  equipmentClassFilter.innerHTML = '<option value="">Усі класи</option>';

  equipmentClasses.forEach((cls) => {
    const option = document.createElement("option");
    option.value = cls;
    option.textContent = cls.charAt(0).toUpperCase() + cls.slice(1);
    equipmentClassFilter.appendChild(option);
  });
}

// Завантаження опцій для вибору оператора
function loadOperatorOptions() {
  const operatorSelect = document.getElementById("operator");
  if (!operatorSelect) {
    console.error("Operator select not found");
    return;
  }

  operatorSelect.innerHTML =
    '<option value="" disabled selected>Оберіть оператора</option>';

  operators.forEach((operator) => {
    const option = document.createElement("option");
    option.value = operator;
    option.textContent = operator;
    operatorSelect.appendChild(option);
  });
}

// Оновлення опцій техніки на основі типу роботи
function updateEquipmentOptions() {
  const workType = document.getElementById("workType").value;
  const equipmentSelect = document.getElementById("equipment");
  if (!equipmentSelect) {
    console.error("Equipment select not found");
    return;
  }

  equipmentSelect.innerHTML =
    '<option value="" disabled selected>Оберіть техніку</option>';

  if (workType && workTypeEquipmentMap[workType]) {
    workTypeEquipmentMap[workType].forEach((equipment) => {
      const option = document.createElement("option");
      option.value = equipment;
      option.textContent = equipment;
      equipmentSelect.appendChild(option);
    });
  }
}

// Налаштування валідації форми в реальному часі
function setupFormValidation() {
  const form = document.getElementById("addWorkForm");
  if (!form) {
    console.error("Add work form not found");
    return;
  }

  const inputs = form.querySelectorAll("input, select");
  inputs.forEach((input) => {
    input.addEventListener("input", () => validateInput(input));
    input.addEventListener("change", () => validateInput(input));
  });

  const workTypeSelect = document.getElementById("workType");
  if (workTypeSelect) {
    workTypeSelect.addEventListener("change", updateEquipmentOptions);
  }
}

// Валідація окремого поля
function validateInput(input) {
  const errorMessage =
    input.nextElementSibling || document.createElement("span");
  errorMessage.classList.add("error-message");
  if (!input.nextElementSibling) input.parentElement.appendChild(errorMessage);

  if (!input.value || (input.type === "number" && input.value <= 0)) {
    input.classList.add("invalid");
    input.classList.remove("valid");
    errorMessage.textContent =
      input.id === "hoursWorked"
        ? "Введіть коректну кількість годин"
        : "Це поле обов’язкове";
  } else {
    input.classList.remove("invalid");
    input.classList.add("valid");
    errorMessage.textContent = "";
  }
}

// Завантаження даних з API
async function loadData() {
  try {
    equipmentApiData.forEach((equip) => {
      totalHours[equip.name] = 0;
      totalFuel[equip.name] = 0;
      totalOil[equip.name] = 0;
      totalLand[equip.name] = 0;
    });
    equipmentClasses.forEach((cls) => {
      totalHours[cls] = 0;
      totalFuel[cls] = 0;
      totalOil[cls] = 0;
      totalLand[cls] = 0;
    });

    dailyRecords = [];
    logs = [];

    const response = await fetch(
      "https://agrofleet-pdqw.onrender.com/api/moto_time",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      if (response.status === 401) {
        console.log(
          "Не авторизовано при отриманні записів. Завантажимо тестові дані."
        );
        addTestData();
        return;
      }
      throw new Error(
        errorData.error ||
          `Failed to fetch moto time records: ${response.statusText}`
      );
    }

    const records = await response.json();
    console.log("Отримані записи з сервера:", records);
    dailyRecords = records;

    records.forEach((record) => {
      const equipment = record.equipment;
      const hoursWorked = parseFloat(record.hours) || 0;
      const date = record.date;
      const fuelConsumed = parseFloat(record.fuel_consumed) || 0;
      const oilConsumed = parseFloat(record.oil_consumed) || 0;
      const landProcessed = parseFloat(record.land_processed) || 0;

      const equipmentClass =
        equipmentApiData.find((equip) => equip.name === equipment)?.type ||
        "невідомий";

      logs.push({
        recordId: record.id.toString(),
        date: date,
        equipment: equipment,
        equipmentClass: equipmentClass,
        operator: record.operator || operators[0],
        workType: record.work_type || "Невідомо",
        hoursWorked: hoursWorked,
        fuelConsumed: fuelConsumed,
        oilConsumed: oilConsumed,
        landProcessed: landProcessed,
        notes: record.notes || "Без приміток",
      });

      totalHours[equipment] = (totalHours[equipment] || 0) + hoursWorked;
      totalFuel[equipment] = (totalFuel[equipment] || 0) + fuelConsumed;
      totalOil[equipment] = (totalOil[equipment] || 0) + oilConsumed;
      totalLand[equipment] = (totalLand[equipment] || 0) + landProcessed;

      totalHours[equipmentClass] =
        (totalHours[equipmentClass] || 0) + hoursWorked;
      totalFuel[equipmentClass] =
        (totalFuel[equipmentClass] || 0) + fuelConsumed;
      totalOil[equipmentClass] = (totalOil[equipmentClass] || 0) + oilConsumed;
      totalLand[equipmentClass] =
        (totalLand[equipmentClass] || 0) + landProcessed;
    });

    console.log("Вміст logs після завантаження:", logs);
    console.log("Вміст dailyRecords після завантаження:", dailyRecords);

    updateLogDisplay();
    updateStatistics();
  } catch (error) {
    console.error("Помилка завантаження даних з API:", error.message);
    addTestData();
  }
}

// Додавання тестових даних (як запасний варіант, але без записів)
function addTestData() {
  logs = [];
  dailyRecords = [];
  console.log("Тестові дані не додано, ініціалізовано порожні масиви.");
  updateLogDisplay();
  updateStatistics();
}

// Налаштування перемикачів для класів техніки в "Трендах Моточасів"
function setupEquipmentToggles() {
  const togglesContainer = document.getElementById("equipment-toggles");
  if (!togglesContainer) {
    console.error("Equipment toggles container not found");
    return;
  }

  togglesContainer.innerHTML = "";

  const colorMap = {
    трактор: "#4A90E2", // Синій
    комбайн: "#2ECC71", // Зелений
    культиватор: "#F1C40F", // Жовтий
    плуг: "#E74C3C", // Червоний
    обприскувач: "#9B59B6", // Фіолетовий
  };

  equipmentClasses.forEach((cls) => {
    const toggleButton = document.createElement("span");
    toggleButton.classList.add("equipment-toggle-btn");
    toggleButton.textContent = cls.charAt(0).toUpperCase() + cls.slice(1);
    toggleButton.dataset.equipment = cls;

    const color = colorMap[cls] || "#455A64";
    toggleButton.style.color = color;

    if (!equipmentVisibility[cls]) {
      toggleButton.classList.add("strikethrough");
    }

    toggleButton.addEventListener("click", () => {
      equipmentVisibility[cls] = !equipmentVisibility[cls];
      toggleButton.classList.toggle("strikethrough");
      updateCharts();
    });

    togglesContainer.appendChild(toggleButton);
  });
}

// Завантаження графіків (з урахуванням фільтрів)
function loadCharts() {
  const hoursTrendCtx = document
    .getElementById("hoursTrendCanvas")
    ?.getContext("2d");
  if (!hoursTrendCtx) {
    console.error("Hours trend canvas not found");
    return;
  }

  const equipmentFilter = document.getElementById("equipmentFilter")?.value;
  const equipmentClassFilter = document.getElementById(
    "equipmentClassFilter"
  )?.value;

  // Фільтруємо записи з урахуванням вибраних фільтрів
  const filteredRecords = dailyRecords.filter((record) => {
    const recordDate = new Date(record.date);
    const includeDate =
      recordDate >= dateRange.start && recordDate <= dateRange.end;
    const includeEquipment =
      !equipmentFilter || record.equipment === equipmentFilter;
    const equipmentClass = equipmentApiData.find(
      (equip) => equip.name === record.equipment
    )?.type;
    const includeClass =
      !equipmentClassFilter || equipmentClass === equipmentClassFilter;
    return includeDate && includeEquipment && includeClass;
  });

  const dates = [
    ...new Set(filteredRecords.map((record) => record.date)),
  ].sort();

  const colorMap = {
    трактор: "#4A90E2", // Синій
    комбайн: "#2ECC71", // Зелений
    культиватор: "#F1C40F", // Жовтий
    плуг: "#E74C3C", // Червоний
    обприскувач: "#9B59B6", // Фіолетовий
  };

  // Агрегація даних по класам техніки
  const datasets = [];
  equipmentClasses.forEach((cls) => {
    const color = colorMap[cls] || "#455A64";

    // Дані для моточасів
    const hoursData = dates.map((date) => {
      const recordsOnDate = filteredRecords.filter((record) => {
        const equipmentClass = equipmentApiData.find(
          (equip) => equip.name === record.equipment
        )?.type;
        return record.date === date && equipmentClass === cls;
      });

      let totalHours = recordsOnDate.reduce(
        (sum, record) => sum + (parseFloat(record.hours) || 0),
        0
      );
      // Обрезаем моточасы до максимума 100
      totalHours = Math.min(totalHours, 100);
      return totalHours;
    });

    // Дані для гектарів
    const landData = dates.map((date) => {
      const recordsOnDate = filteredRecords.filter((record) => {
        const equipmentClass = equipmentApiData.find(
          (equip) => equip.name === record.equipment
        )?.type;
        return record.date === date && equipmentClass === cls;
      });

      const totalLand = recordsOnDate.reduce(
        (sum, record) => sum + (parseFloat(record.land_processed) || 0),
        0
      );
      return totalLand;
    });

    // Проверяем, есть ли ненулевые данные для моточасов или гектаров
    const hasHoursData = hoursData.some((value) => value > 0);
    const hasLandData = landData.some((value) => value > 0);

    // Если нет данных ни для моточасов, ни для гектаров, пропускаем этот класс техники
    if (!hasHoursData && !hasLandData) {
      return;
    }

    // Додаємо датасет для моточасів, если есть данные
    if (hasHoursData) {
      datasets.push({
        type: "line",
        label: cls, // Название для tooltip
        data: hoursData,
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        fill: false,
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointHitRadius: 10, // Збільшуємо область виявлення точки
        hidden: !equipmentVisibility[cls],
        yAxisID: "hours",
        spanGaps: true,
      });
    }

    // Додаємо датасет для гектарів, если есть данные
    if (hasLandData) {
      datasets.push({
        type: "line",
        label: cls, // Название для tooltip
        data: landData,
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        borderDash: [5, 5], // Пунктирна лінія для гектарів
        fill: false,
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointHitRadius: 10, // Збільшуємо область виявлення точки
        hidden: !equipmentVisibility[cls],
        yAxisID: "land",
        spanGaps: true,
      });
    }
  });

  hoursTrendChart = new Chart(hoursTrendCtx, {
    data: {
      labels: dates,
      datasets: datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false, // Отключаем легенду
        },
        tooltip: {
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          titleColor: "#fff",
          bodyColor: "#fff",
          borderColor: "#ddd",
          borderWidth: 1,
          padding: 8,
          mode: "nearest",
          intersect: false, // Tooltip срабатывает даже если курсор не точно над точкой
          callbacks: {
            title: function (context) {
              const date = context[0].label;
              return `Дата: ${date}`;
            },
            label: function (context) {
              const dataset = context.dataset;
              const value = context.parsed.y;
              if (value === 0) return null;
              if (dataset.yAxisID === "hours") {
                return `${dataset.label}: ${value.toFixed(2)} год`;
              } else {
                return `${dataset.label}: ${value.toFixed(2)} га`;
              }
            },
            filter: function (tooltipItem) {
              return tooltipItem.parsed.y !== 0;
            },
          },
        },
      },
      scales: {
        x: {
          type: "category",
          position: "bottom",
          title: {
            display: true,
            text: "Дата",
            color: "#333",
            font: {
              size: 14,
              family: "NotoSans",
            },
          },
          ticks: {
            color: "#666",
            font: {
              size: 12,
              family: "NotoSans",
            },
          },
          grid: {
            color: "#eee",
            borderDash: [5, 5],
          },
        },
        hours: {
          type: "linear",
          position: "left",
          beginAtZero: true,
          min: 0,
          max: 100, // Максимум для моточасів
          title: {
            display: true,
            text: "Мотогодини (год)", // Заменяем "Моточаси" на "Мотогодини"
            color: "#333",
            font: {
              size: 14,
              family: "NotoSans",
            },
          },
          ticks: {
            color: "#666",
            font: {
              size: 12,
              family: "NotoSans",
            },
            stepSize: 20,
            callback: (value) => `${value} год`,
          },
          grid: {
            color: "#eee",
            borderDash: [5, 5],
          },
        },
        land: {
          type: "linear",
          position: "right",
          beginAtZero: true,
          min: 0,
          max: 150,
          title: {
            display: true,
            text: "Оброблено землі (га)",
            color: "#333",
            font: {
              size: 14,
              family: "NotoSans",
            },
          },
          ticks: {
            color: "#666",
            font: {
              size: 12,
              family: "NotoSans",
            },
            stepSize: 15,
            callback: (value) => `${value} га`,
          },
          grid: {
            drawOnChartArea: false, // Не малюємо сітку для другої осі, щоб уникнути накладання
          },
        },
      },
      interaction: {
        mode: "nearest",
        intersect: false,
        axis: "x",
      },
      animation: {
        duration: 1000,
        easing: "easeInOutQuad",
      },
    },
  });
}

// Оновлення графіків (з урахуванням фільтрів)
function updateCharts() {
  if (!hoursTrendChart) return;

  const equipmentFilter = document.getElementById("equipmentFilter")?.value;
  const equipmentClassFilter = document.getElementById(
    "equipmentClassFilter"
  )?.value;

  // Фільтруємо записи з урахуванням вибраних фільтрів
  const filteredRecords = dailyRecords.filter((record) => {
    const recordDate = new Date(record.date);
    const includeDate =
      recordDate >= dateRange.start && recordDate <= dateRange.end;
    const includeEquipment =
      !equipmentFilter || record.equipment === equipmentFilter;
    const equipmentClass = equipmentApiData.find(
      (equip) => equip.name === record.equipment
    )?.type;
    const includeClass =
      !equipmentClassFilter || equipmentClass === equipmentClassFilter;
    return includeDate && includeEquipment && includeClass;
  });

  const dates = [
    ...new Set(filteredRecords.map((record) => record.date)),
  ].sort();

  const colorMap = {
    трактор: "#4A90E2",
    комбайн: "#2ECC71",
    культиватор: "#F1C40F",
    плуг: "#E74C3C",
    обприскувач: "#9B59B6",
  };

  // Агрегація даних по класам техніки
  const datasets = [];
  equipmentClasses.forEach((cls) => {
    const color = colorMap[cls] || "#455A64";

    // Дані для моточасів
    const hoursData = dates.map((date) => {
      const recordsOnDate = filteredRecords.filter((record) => {
        const equipmentClass = equipmentApiData.find(
          (equip) => equip.name === record.equipment
        )?.type;
        return record.date === date && equipmentClass === cls;
      });

      let totalHours = recordsOnDate.reduce(
        (sum, record) => sum + (parseFloat(record.hours) || 0),
        0
      );
      // Обрезаем моточасы до максимума 100
      totalHours = Math.min(totalHours, 100);
      return totalHours;
    });

    // Дані для гектарів
    const landData = dates.map((date) => {
      const recordsOnDate = filteredRecords.filter((record) => {
        const equipmentClass = equipmentApiData.find(
          (equip) => equip.name === record.equipment
        )?.type;
        return record.date === date && equipmentClass === cls;
      });

      const totalLand = recordsOnDate.reduce(
        (sum, record) => sum + (parseFloat(record.land_processed) || 0),
        0
      );
      return totalLand;
    });

    // Проверяем, есть ли ненулевые данные для моточасов или гектаров
    const hasHoursData = hoursData.some((value) => value > 0);
    const hasLandData = landData.some((value) => value > 0);

    // Если нет данных ни для моточасов, ни для гектаров, пропускаем этот класс техники
    if (!hasHoursData && !hasLandData) {
      return;
    }

    // Додаємо датасет для моточасів, если есть данные
    if (hasHoursData) {
      datasets.push({
        type: "line",
        label: cls, // Название для tooltip
        data: hoursData,
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        fill: false,
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointHitRadius: 10, // Збільшуємо область виявлення точки
        hidden: !equipmentVisibility[cls],
        yAxisID: "hours",
        spanGaps: true,
      });
    }

    // Додаємо датасет для гектарів, если есть данные
    if (hasLandData) {
      datasets.push({
        type: "line",
        label: cls, // Название для tooltip
        data: landData,
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        borderDash: [5, 5], // Пунктирна лінія для гектарів
        fill: false,
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointHitRadius: 10, // Збільшуємо область виявлення точки
        hidden: !equipmentVisibility[cls],
        yAxisID: "land",
        spanGaps: true,
      });
    }
  });

  hoursTrendChart.data.labels = dates;
  hoursTrendChart.data.datasets = datasets;
  hoursTrendChart.update();
}

// Додавання запису через API
async function addWorkRecord() {
  try {
    const workDate = document.getElementById("workDate")?.value;
    const workType = document.getElementById("workType")?.value;
    const equipment = document.getElementById("equipment")?.value;
    const operator = document.getElementById("operator")?.value;
    const hoursWorked = parseFloat(
      document.getElementById("hoursWorked")?.value
    );
    const notes = document.getElementById("notes")?.value.trim();

    if (
      !workDate ||
      !workType ||
      !equipment ||
      !operator ||
      isNaN(hoursWorked) ||
      hoursWorked <= 0
    ) {
      alert("Будь ласка, заповніть усі обов’язкові поля коректно!");
      return;
    }

    // Отримуємо дані про техніку
    const equipmentData = equipmentApiData.find(
      (equip) => equip.name === equipment
    );
    if (!equipmentData) {
      alert("Дані про техніку не знайдено.");
      return;
    }

    // Використовуємо значення витрат залежно від типу техніки
    const fuelConsumptionRate = getFuelConsumptionRate(equipmentData.type);
    const oilConsumptionRate = getOilConsumptionRate(equipmentData.type);
    const landProcessingRate = equipmentData.land_processing_rate || 2;

    // Отримуємо коефіцієнти для типу роботи
    const modifier = workTypeConsumptionModifiers[workType] || {
      fuel: 1.0,
      oil: 1.0,
    };
    const fuelConsumed = (
      fuelConsumptionRate *
      hoursWorked *
      modifier.fuel
    ).toFixed(2);
    const oilConsumed = (
      oilConsumptionRate *
      hoursWorked *
      modifier.oil
    ).toFixed(2);
    const landProcessed = (landProcessingRate * hoursWorked).toFixed(2);

    const equipmentClass = equipmentData.type || "невідомий";

    const record = {
      equipment: equipment,
      operator: operator,
      hours: hoursWorked,
      date: workDate,
      work_type: workType,
      notes: notes,
      fuel_consumed: parseFloat(fuelConsumed),
      oil_consumed: parseFloat(oilConsumed),
      land_processed: parseFloat(landProcessed),
    };

    console.log("Відправляємо дані на сервер:", record);
    const response = await fetch(
      "https://agrofleet-pdqw.onrender.com/api/moto_time",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(record),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      if (response.status === 401) {
        alert("Ви не авторизовані. Будь ласка, увійдіть у систему.");
        window.location.href = "/profile.html?authRequired=true";
        return;
      }
      throw new Error(
        errorData.error || `Failed to add work record: ${response.statusText}`
      );
    }

    const newRecord = await response.json();
    console.log("Запис успішно додано:", newRecord);

    // Додаємо запис на початок списків
    logs.unshift({
      recordId: newRecord.id.toString(),
      date: newRecord.date,
      equipment: newRecord.equipment,
      equipmentClass: equipmentClass,
      operator: operator,
      workType: newRecord.work_type || "Невідомо",
      hoursWorked: parseFloat(newRecord.hours),
      fuelConsumed: newRecord.fuel_consumed || 0,
      oilConsumed: newRecord.oil_consumed || 0,
      landProcessed: newRecord.land_processed || 0,
      notes: newRecord.notes || "Без приміток",
    });

    dailyRecords.unshift(newRecord);

    totalHours[newRecord.equipment] =
      (totalHours[newRecord.equipment] || 0) + parseFloat(newRecord.hours);
    totalFuel[newRecord.equipment] =
      (totalFuel[newRecord.equipment] || 0) + (newRecord.fuel_consumed || 0);
    totalOil[newRecord.equipment] =
      (totalOil[newRecord.equipment] || 0) + (newRecord.oil_consumed || 0);
    totalLand[newRecord.equipment] =
      (totalLand[newRecord.equipment] || 0) + (newRecord.land_processed || 0);

    totalHours[equipmentClass] =
      (totalHours[equipmentClass] || 0) + parseFloat(newRecord.hours);
    totalFuel[equipmentClass] =
      (totalFuel[equipmentClass] || 0) + (newRecord.fuel_consumed || 0);
    totalOil[equipmentClass] =
      (totalOil[equipmentClass] || 0) + (newRecord.oil_consumed || 0);
    totalLand[equipmentClass] =
      (totalLand[equipmentClass] || 0) + (newRecord.land_processed || 0);

    await calculateAverageConsumptionRates();

    updateLogDisplay();
    updateStatistics();
    updateCharts();
    closeAddModal();
  } catch (error) {
    console.error("Помилка додавання запису:", error.message);
    alert(`Не вдалося додати запис: ${error.message}`);
  }
}

// Видалення запису через API
async function deleteRecord(recordId) {
  if (!confirm("Ви впевнені, що хочете видалити цей запис?")) return;

  try {
    const response = await fetch(
      `https://agrofleet-pdqw.onrender.com/api/moto_time/${recordId}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      if (response.status === 401) {
        alert("Ви не авторизовані. Будь ласка, увійдіть у систему.");
        window.location.href = "/profile.html?authRequired=true";
        return;
      }
      throw new Error(
        errorData.error ||
          `Failed to delete work record: ${response.statusText}`
      );
    }

    const record = logs.find((log) => log.recordId === recordId);
    if (record) {
      const equipment = record.equipment;
      const equipmentClass = record.equipmentClass;
      const hours = record.hoursWorked || 0;
      const fuel = record.fuelConsumed || 0;
      const oil = record.oilConsumed || 0;
      const land = record.landProcessed || 0;

      totalHours[equipment] = (totalHours[equipment] || 0) - hours;
      totalFuel[equipment] = (totalFuel[equipment] || 0) - fuel;
      totalOil[equipment] = (totalOil[equipment] || 0) - oil;
      totalLand[equipment] = (totalLand[equipment] || 0) - land;

      totalHours[equipmentClass] = (totalHours[equipmentClass] || 0) - hours;
      totalFuel[equipmentClass] = (totalFuel[equipmentClass] || 0) - fuel;
      totalOil[equipmentClass] = (totalOil[equipmentClass] || 0) - oil;
      totalLand[equipmentClass] = (totalLand[equipmentClass] || 0) - land;

      logs = logs.filter((log) => log.recordId !== recordId);
      dailyRecords = dailyRecords.filter(
        (record) => record.id.toString() !== recordId
      );

      await calculateAverageConsumptionRates();

      updateLogDisplay();
      updateStatistics();
      updateCharts();
    }
  } catch (error) {
    console.error("Помилка видалення запису:", error.message);
    alert(`Не вдалося видалити запис: ${error.message}`);
  }
}

// Оновлення відображення журналу
function updateLogDisplay() {
  const logBody = document.getElementById("logBody");
  if (!logBody) {
    console.error("Log body not found");
    return;
  }

  logBody.innerHTML = "";
  const equipmentFilter = document.getElementById("equipmentFilter")?.value;
  const equipmentClassFilter = document.getElementById(
    "equipmentClassFilter"
  )?.value;

  const filteredLogs = logs.filter((log) => {
    const logDate = new Date(log.date);
    const includeDate = logDate >= dateRange.start && logDate <= dateRange.end;
    const includeEquipment =
      !equipmentFilter || log.equipment === equipmentFilter;
    const includeClass =
      !equipmentClassFilter || log.equipmentClass === equipmentClassFilter;
    return includeDate && includeEquipment && includeClass;
  });

  filteredLogs.forEach((log) => {
    const row = document.createElement("tr");
    row.innerHTML = `
            <td>${log.date || "Невідомо"}</td>
            <td>${log.equipment || "Невідомо"}</td>
            <td>${log.operator || "Невідомо"}</td>
            <td>${log.workType || "Невідомо"}</td>
            <td>${(log.hoursWorked || 0).toFixed(2)}</td>
            <td>${(log.fuelConsumed || 0).toFixed(2)}</td>
            <td>${(log.oilConsumed || 0).toFixed(2)}</td>
            <td>${(log.landProcessed || 0).toFixed(2)}</td>
            <td>${log.notes || "Без приміток"}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn delete-btn" data-id="${
                      log.recordId
                    }"><i class="fas fa-trash"></i></button>
                    <button class="action-btn export-btn" data-id="${
                      log.recordId
                    }"><i class="fas fa-file-pdf"></i></button>
                </div>
            </td>
        `;
    row.querySelector(".delete-btn").addEventListener("click", (e) => {
      const recordId = e.currentTarget.getAttribute("data-id");
      deleteRecord(recordId);
    });
    row.querySelector(".export-btn").addEventListener("click", (e) => {
      const recordId = e.currentTarget.getAttribute("data-id");
      exportRecordToPDF(recordId);
    });
    logBody.appendChild(row);
  });

  if (filteredLogs.length === 0) {
    logBody.innerHTML =
      '<tr><td colspan="10" class="no-data">Немає записів за обраний період.</td></tr>';
  }

  updateStatistics();
}

// Оновлення статистики
function updateStatistics() {
  const equipmentFilter = document.getElementById("equipmentFilter")?.value;
  const equipmentClassFilter = document.getElementById(
    "equipmentClassFilter"
  )?.value;

  const filteredLogs = logs.filter((log) => {
    const logDate = new Date(log.date);
    const includeDate = logDate >= dateRange.start && logDate <= dateRange.end;
    const includeEquipment =
      !equipmentFilter || log.equipment === equipmentFilter;
    const includeClass =
      !equipmentClassFilter || log.equipmentClass === equipmentClassFilter;
    return includeDate && includeEquipment && includeClass;
  });

  let totalHoursCount = 0;
  let totalFuelConsumption = 0;
  let totalOilConsumption = 0;
  let totalLandProcessed = 0;
  const operatorsSet = new Set();

  filteredLogs.forEach((log) => {
    const hours = parseFloat(log.hoursWorked) || 0;
    const fuel = parseFloat(log.fuelConsumed) || 0;
    const oil = parseFloat(log.oilConsumed) || 0;
    const land = parseFloat(log.landProcessed) || 0;

    totalHoursCount += hours;
    totalFuelConsumption += fuel;
    totalOilConsumption += oil;
    totalLandProcessed += land;
    operatorsSet.add(log.operator);
  });

  document.getElementById(
    "totalHoursCount"
  ).textContent = `${totalHoursCount.toFixed(2)} год`;
  document.getElementById(
    "totalFuelConsumption"
  ).textContent = `${totalFuelConsumption.toFixed(2)} л`;
  document.getElementById(
    "totalOilConsumption"
  ).textContent = `${totalOilConsumption.toFixed(2)} л`;
  document.getElementById(
    "totalLandProcessed"
  ).textContent = `${totalLandProcessed.toFixed(2)} га`;
  document.getElementById("totalOperatorsCount").textContent =
    operatorsSet.size;
}

// Експорт одного запису в PDF
async function exportRecordToPDF(recordId) {
  if (!jsPDF) {
    console.error("jsPDF is not loaded");
    alert("Не вдалося експортувати запис. Бібліотека jsPDF недоступна.");
    return;
  }

  const record = logs.find((log) => log.recordId === recordId);
  if (!record) {
    alert("Запис не знайдено.");
    return;
  }

  try {
    const doc = new jsPDF();
    doc.addFileToVFS("NotoSans-Regular.ttf", notoSansBase64);
    doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
    doc.setFont("NotoSans");

    doc.setFontSize(16);
    doc.text("Звіт по запису роботи", 105, 20, { align: "center" });

    doc.setFontSize(12);
    let yPosition = 40;
    const pageHeight = doc.internal.pageSize.height;
    const maxWidth = 170;

    const fields = [
      `Дата: ${record.date || "Невідомо"}`,
      `Техніка: ${record.equipment || "Невідомо"}`,
      `Оператор: ${record.operator || "Невідомо"}`,
      `Тип роботи: ${record.workType || "Невідомо"}`,
      `Години роботи: ${(record.hoursWorked || 0).toFixed(2)} год`,
      `Витрата палива: ${(record.fuelConsumed || 0).toFixed(2)} л`,
      `Витрата масла: ${(record.oilConsumed || 0).toFixed(2)} л`,
      `Оброблено землі: ${(record.landProcessed || 0).toFixed(2)} га`,
      `Примітки: ${record.notes || "Без приміток"}`,
    ];

    fields.forEach((field) => {
      const splitText = doc.splitTextToSize(field, maxWidth);
      splitText.forEach((line) => {
        if (yPosition > pageHeight - 30) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(line, 20, yPosition);
        yPosition += 10;
      });
    });

    doc.save(`work_record_${recordId}.pdf`);
  } catch (error) {
    console.error("Помилка при експорті запису в PDF:", error.message);
    alert(`Не вдалося експортувати запис: ${error.message}`);
  }
}

// Експорт усіх відфільтрованих записів у PDF
async function exportToPDF() {
  if (!jsPDF) {
    console.error("jsPDF is not loaded");
    alert("Не вдалося експортувати записи. Бібліотека jsPDF недоступна.");
    return;
  }

  const equipmentFilter = document.getElementById("equipmentFilter")?.value;
  const equipmentClassFilter = document.getElementById(
    "equipmentClassFilter"
  )?.value;

  const filteredLogs = logs.filter((log) => {
    const logDate = new Date(log.date);
    const includeDate = logDate >= dateRange.start && logDate <= dateRange.end;
    const includeEquipment =
      !equipmentFilter || log.equipment === equipmentFilter;
    const includeClass =
      !equipmentClassFilter || log.equipmentClass === equipmentClassFilter;
    return includeDate && includeEquipment && includeClass;
  });

  if (filteredLogs.length === 0) {
    alert("Немає записів для експорту.");
    return;
  }

  try {
    const doc = new jsPDF();
    doc.addFileToVFS("NotoSans-Regular.ttf", notoSansBase64);
    doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
    doc.setFont("NotoSans");

    doc.setFontSize(16);
    doc.text("Звіт по журналу роботи", 105, 20, { align: "center" });

    doc.setFontSize(12);
    let yPosition = 40;
    const pageHeight = doc.internal.pageSize.height;
    const maxWidth = 170;
    let recordsOnPage = 0; // Счетчик записей на странице

    filteredLogs.forEach((log, index) => {
      // Проверяем, можно ли добавить еще одну запись на страницу
      if (recordsOnPage >= 2) {
        doc.addPage();
        yPosition = 20;
        recordsOnPage = 0;
      }

      // Если это не первая запись на странице, добавляем разделительную линию
      if (recordsOnPage > 0) {
        doc.setLineWidth(0.5);
        doc.setDrawColor(200, 200, 200); // Серый цвет линии
        doc.line(20, yPosition, 190, yPosition); // Линия от 20 до 190 по X
        yPosition += 10;
      }

      doc.text(`Запис ${index + 1}`, 20, yPosition);
      yPosition += 10;

      const fields = [
        `Дата: ${log.date || "Невідомо"}`,
        `Техніка: ${log.equipment || "Невідомо"}`,
        `Оператор: ${log.operator || "Невідомо"}`,
        `Тип роботи: ${log.workType || "Невідомо"}`,
        `Години роботи: ${(log.hoursWorked || 0).toFixed(2)} год`,
        `Витрата палива: ${(log.fuelConsumed || 0).toFixed(2)} л`,
        `Витрата масла: ${(log.oilConsumed || 0).toFixed(2)} л`,
        `Оброблено землі: ${(log.landProcessed || 0).toFixed(2)} га`,
        `Примітки: ${log.notes || "Без приміток"}`,
      ];

      fields.forEach((field) => {
        const splitText = doc.splitTextToSize(field, maxWidth);
        splitText.forEach((line) => {
          if (yPosition > pageHeight - 30) {
            doc.addPage();
            yPosition = 20;
            recordsOnPage = 0;
          }
          doc.text(line, 20, yPosition);
          yPosition += 10;
        });
      });

      yPosition += 10; // Дополнительный отступ после записи
      recordsOnPage += 1; // Увеличиваем счетчик записей на странице
    });

    doc.save("work_log_report.pdf");
  } catch (error) {
    console.error("Помилка при експорті журналу в PDF:", error.message);
    alert(`Не вдалося експортувати журнал: ${error.message}`);
  }
}

// Відкриття модального вікна для додавання запису
function openAddModal() {
  const modal = document.getElementById("addModal");
  if (modal) {
    modal.style.display = "flex";
    const modalTitle = modal.querySelector("h2");
    if (modalTitle) {
      modalTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Додати Запис';
    }

    // Скидаємо форму
    const form = document.getElementById("addWorkForm");
    if (form) {
      form.reset();
      const inputs = form.querySelectorAll("input, select, textarea");
      inputs.forEach((input) => {
        input.classList.remove("valid", "invalid");
        const errorMessage = input.nextElementSibling;
        if (errorMessage && errorMessage.classList.contains("error-message")) {
          errorMessage.textContent = "";
        }
      });
    }

    // Встановлюємо дату за замовчуванням
    const workDateInput = document.getElementById("workDate");
    if (workDateInput) {
      workDateInput.value = new Date().toISOString().split("T")[0];
    }
  }
}

// Закриття модального вікна
function closeAddModal() {
  const modal = document.getElementById("addModal");
  if (modal) {
    modal.style.display = "none";
    const form = document.getElementById("addWorkForm");
    if (form) {
      form.reset();
      const inputs = form.querySelectorAll("input, select, textarea");
      inputs.forEach((input) => {
        input.classList.remove("valid", "invalid");
        const errorMessage = input.nextElementSibling;
        if (errorMessage && errorMessage.classList.contains("error-message")) {
          errorMessage.textContent = "";
        }
      });
    }
  }
}
