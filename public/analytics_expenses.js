document.addEventListener("DOMContentLoaded", () => {
  const addExpenseBtn = document.getElementById("addExpenseBtn");
  const exportBtn = document.getElementById("exportBtn");
  const modal = document.getElementById("expenseModal");
  const form = document.getElementById("expenseForm");
  const grid = document.getElementById("expense-grid");
  const filterType = document.getElementById("filterType");
  const totalExpensesElement = document.getElementById("total-expenses");
  const metricTitle = document.getElementById("metric-title");
  const exportPeriod = document.getElementById("exportPeriod");
  const dayPicker = document.getElementById("dayPicker");
  const weekPicker = document.getElementById("weekPicker");
  const monthPicker = document.getElementById("monthPicker");
  const halfyearPicker = document.getElementById("halfyearPicker");
  const yearPicker = document.getElementById("yearPicker");
  const startDate = document.getElementById("startDate");
  const endDate = document.getElementById("endDate");
  const closeButton = document.querySelector(".close-button");

  let expenses = [];
  let editId = null;
  let userRole = null;
  let currentUserId = null;

  const expenseIcons = {
    пальне: "fas fa-gas-pump",
    "технічне обслуговування та ремонт": "fas fa-tools",
    запчастини: "fas fa-cogs",
    "зарплата операторів/механіків": "fas fa-user-tie",
    "оренда техніки": "fas fa-handshake",
    страхування: "fas fa-shield-alt",
    "транспортні витрати": "fas fa-truck",
    "інші витрати": "fas fa-ellipsis-h",
  };

  const loadingIndicator = document.createElement("div");
  loadingIndicator.id = "loadingIndicator";
  loadingIndicator.style.display = "none";
  loadingIndicator.style.textAlign = "center";
  loadingIndicator.style.padding = "20px";
  loadingIndicator.innerHTML = "<p>Завантаження...</p>";
  grid.parentElement.insertBefore(loadingIndicator, grid);

  const currentYear = new Date().getFullYear();
  for (let year = currentYear - 5; year <= currentYear + 5; year++) {
    yearPicker.innerHTML += `<option value="${year}">${year}</option>`;
    halfyearPicker.innerHTML += `<option value="${year}-1">Перше півріччя ${year}</option>`;
    halfyearPicker.innerHTML += `<option value="${year}-2">Друге півріччя ${year}</option>`;
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const loadExpenseTypes = async () => {
    try {
      const response = await fetch("https://agrofleet-pdqw.onrender.com/", {
        method: "GET",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Не вдалося отримати типи витрат");
      }
      const expenseTypes = await response.json();
      const filterSelect = document.getElementById("filterType");
      const formSelect = document.getElementById("expenseType");
      filterSelect.innerHTML = '<option value="">Усі типи</option>';
      expenseTypes.forEach((type) => {
        const option1 = document.createElement("option");
        option1.value = type;
        option1.textContent = type;
        filterSelect.appendChild(option1);

        const option2 = document.createElement("option");
        option2.value = type;
        option2.textContent = type;
        formSelect.appendChild(option2);
      });
    } catch (error) {
      console.error("Помилка при завантаженні типів витрат:", error);
      alert("Не вдалося завантажити типи витрат. Спробуйте ще раз.");
    }
  };

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/check-auth", {
        credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json();
        console.log(
          "Не авторизований. Статус:",
          response.status,
          "Повідомлення:",
          data.error
        );
        localStorage.setItem(
          "authMessage",
          data.error || "Будь ласка, увійдіть в систему"
        );
        window.location.href = "/index.html";
        return false;
      }
      const user = await response.json();
      userRole = user.role;
      currentUserId = user.id;
      console.log("Користувач авторизований:", user);
      return true;
    } catch (error) {
      console.error("Помилка перевірки авторизації:", error.message);
      localStorage.setItem("authMessage", "Помилка перевірки авторизації");
      window.location.href = "/index.html";
      return false;
    }
  };

  const loadUserProfile = async () => {
    try {
      const response = await fetch("/api/auth/check-auth", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Помилка завантаження профілю");
      }
      const user = await response.json();
      userRole = user.role;
      currentUserId = user.id;
      console.log(
        "Роль користувача:",
        userRole,
        "ID користувача:",
        currentUserId
      );

      if (userRole === "user") {
        addExpenseBtn.style.display = "none";
        exportBtn.style.display = "none";
      }
    } catch (error) {
      console.error("Помилка завантаження профілю:", error.message);
    }
  };

  const fetchExpenses = async (filters = {}) => {
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) return;

    try {
      loadingIndicator.style.display = "block";
      grid.style.display = "none";

      const queryParams = {};
      if (filters.expenseType && filters.expenseType !== "") {
        queryParams.expenseType = filters.expenseType.toLowerCase();
      }
      if (filters.period) {
        queryParams.period = filters.period;
        if (filters.period === "day" && filters.day) {
          queryParams.day = filters.day;
        } else if (filters.period === "week" && filters.week) {
          queryParams.week = filters.week;
        } else if (filters.period === "month" && filters.month) {
          queryParams.month = filters.month;
        } else if (filters.period === "halfyear" && filters.halfyear) {
          queryParams.halfyear = filters.halfyear;
        } else if (filters.period === "year" && filters.year) {
          queryParams.year = filters.year;
        } else if (
          filters.period === "custom" &&
          filters.startDate &&
          filters.endDate
        ) {
          queryParams.startDate = filters.startDate;
          queryParams.endDate = filters.endDate;
        }
      }
      const query = new URLSearchParams(queryParams).toString();
      console.log("Запит до API:", `/api/expenses?${query}`);
      console.log("Поточний користувач:", { userRole, currentUserId });
      const response = await fetch(`/api/expenses?${query}`, {
        credentials: "include",
      });
      if (!response.ok) {
        let errorMessage = "Помилка завантаження витрат";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          console.log(
            "Помилка від сервера:",
            errorMessage,
            "Статус:",
            response.status
          );
          if (response.status === 401) {
            localStorage.setItem(
              "authMessage",
              "Сесія закінчилася. Будь ласка, увійдіть знову."
            );
            window.location.href = "/index.html";
            return;
          }
        } catch (e) {
          console.log(
            "Не вдалося отримати повідомлення про помилку:",
            e.message
          );
        }
        throw new Error(errorMessage);
      }
      expenses = await response.json();
      console.log("Отримані витрати:", expenses);
      if (!Array.isArray(expenses)) {
        console.error("Сервер повернув не масив:", expenses);
        expenses = [];
      }
      if (expenses.length === 0) {
        console.log(
          "Сервер повернув порожній масив. Перевірте базу даних або права доступу."
        );
      }
      renderGrid(expenses);
      updateTotalExpenses(expenses);
    } catch (error) {
      console.error("Помилка в fetchExpenses:", error.message);
      alert(`Помилка: ${error.message}`);
      grid.innerHTML =
        "<p>Не вдалося завантажити витрати. Спробуйте ще раз.</p>";
    } finally {
      loadingIndicator.style.display = "none";
      grid.style.display = "grid";
    }
  };

  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  if (addExpenseBtn) {
    addExpenseBtn.addEventListener("click", () => {
      if (userRole !== "admin" && userRole !== "manager") {
        alert("У вас немає прав для додавання витрат.");
        return;
      }
      editId = null;
      form.reset();
      form.expenseDate.value = new Date().toISOString().split("T")[0];
      modal.style.display = "flex";
      document.getElementById("modalTitle").textContent = "Додати";
    });
  }

  if (closeButton) {
    closeButton.addEventListener("click", () => {
      modal.style.display = "none";
      editId = null;
      form.reset();
    });
  } else {
    console.error("Хрестик (close-button) не знайдено в DOM");
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (userRole === "user") {
        alert("У вас немає прав для додавання або редагування витрат.");
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      submitButton.textContent = "Зберігаю...";

      const expense = {
        equipmentName: form.equipmentName.value.trim(),
        expenseType: form.expenseType.value,
        expenseAmount: parseFloat(form.expenseAmount.value),
        expenseDate: form.expenseDate.value,
      };

      if (!editId) {
        if (
          !expense.equipmentName ||
          !expense.expenseType ||
          !expense.expenseAmount ||
          !expense.expenseDate
        ) {
          console.log(
            "Недостатньо даних для створення нової витрати:",
            expense
          );
          alert("Будь ласка, заповніть усі поля для створення нової витрати.");
          submitButton.disabled = false;
          submitButton.textContent = "Зберегти";
          modal.style.display = "none";
          return;
        }
      }

      if (isNaN(expense.expenseAmount) || expense.expenseAmount < 0) {
        console.log(
          "Некоректне значення expenseAmount:",
          expense.expenseAmount
        );
        alert("Сума витрат повинна бути позитивним числом.");
        submitButton.disabled = false;
        submitButton.textContent = "Зберегти";
        modal.style.display = "none";
        return;
      }

      try {
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) {
          submitButton.disabled = false;
          submitButton.textContent = "Зберегти";
          modal.style.display = "none";
          return;
        }

        let successMessage = "";
        console.log("Надсилаємо запит. editId:", editId, "Дані:", expense);
        if (editId) {
          console.log(
            "Надсилаємо PUT-запит для редагування запису з id:",
            editId
          );
          const response = await fetch(`/api/expenses/${editId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(expense),
            credentials: "include",
          });
          if (!response.ok) {
            let errorMessage = "Помилка оновлення витрати";
            try {
              const errorData = await response.json();
              errorMessage = errorData.error || errorMessage;
              console.log(
                "Помилка від сервера:",
                errorMessage,
                "Статус:",
                response.status
              );
              if (response.status === 401) {
                localStorage.setItem(
                  "authMessage",
                  "Сесія закінчилася. Будь ласка, увійдіть знову."
                );
                window.location.href = "/index.html";
                return;
              } else if (response.status === 403) {
                alert("У вас немає прав для редагування цієї витрати.");
                return;
              } else if (response.status === 404) {
                alert("Витрата не знайдена або доступ заборонений.");
                return;
              }
            } catch (e) {
              console.log(
                "Не вдалося отримати повідомлення про помилку:",
                e.message
              );
            }
            throw new Error(errorMessage);
          }
          successMessage = "Витрата успішно оновлена!";
        } else {
          console.log("Надсилаємо POST-запит для створення нового запису");
          const response = await fetch("/api/expenses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(expense),
            credentials: "include",
          });
          if (!response.ok) {
            let errorMessage = "Помилка додавання витрати";
            try {
              const errorData = await response.json();
              errorMessage = errorData.error || errorMessage;
              console.log(
                "Помилка від сервера:",
                errorMessage,
                "Статус:",
                response.status
              );
              if (response.status === 401) {
                localStorage.setItem(
                  "authMessage",
                  "Сесія закінчилася. Будь ласка, увійдіть знову."
                );
                window.location.href = "/index.html";
                return;
              } else if (response.status === 403) {
                alert("У вас немає прав для додавання витрат.");
                return;
              }
            } catch (e) {
              console.log(
                "Не вдалося отримати повідомлення про помилку:",
                e.message
              );
            }
            throw new Error(errorMessage);
          }
          const responseData = await response.json();
          successMessage = `Витрата успішно додана!\nСтворено: ${responseData.visibility.createdBy}\nВидно: ${responseData.visibility.visibleTo}`;
        }

        modal.style.display = "none";
        form.reset();
        fetchExpenses({
          expenseType: filterType.value,
          period: exportPeriod.value,
          day: dayPicker.value,
          week: weekPicker.value,
          month: monthPicker.value,
          halfyear: halfyearPicker.value,
          year: yearPicker.value,
          startDate: startDate.value,
          endDate: endDate.value,
        });
        alert(successMessage);
      } catch (error) {
        console.error("Помилка:", error.message);
        alert(`Помилка: ${error.message}`);
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Зберегти";
        modal.style.display = "none";
      }
    });
  }

  filterType.addEventListener("change", () => {
    fetchExpenses({
      expenseType: filterType.value,
      period: exportPeriod.value,
      day: dayPicker.value,
      week: weekPicker.value,
      month: monthPicker.value,
      halfyear: halfyearPicker.value,
      year: yearPicker.value,
      startDate: startDate.value,
      endDate: endDate.value,
    });
  });

  exportPeriod.addEventListener("change", () => {
    dayPicker.style.display =
      exportPeriod.value === "day" ? "inline-block" : "none";
    weekPicker.style.display =
      exportPeriod.value === "week" ? "inline-block" : "none";
    monthPicker.style.display =
      exportPeriod.value === "month" ? "inline-block" : "none";
    halfyearPicker.style.display =
      exportPeriod.value === "halfyear" ? "inline-block" : "none";
    yearPicker.style.display =
      exportPeriod.value === "year" ? "inline-block" : "none";
    startDate.style.display =
      exportPeriod.value === "custom" ? "inline-block" : "none";
    endDate.style.display =
      exportPeriod.value === "custom" ? "inline-block" : "none";
    fetchExpenses({
      expenseType: filterType.value,
      period: exportPeriod.value,
      day: dayPicker.value,
      week: weekPicker.value,
      month: monthPicker.value,
      halfyear: halfyearPicker.value,
      year: yearPicker.value,
      startDate: startDate.value,
      endDate: endDate.value,
    });
  });

  dayPicker.addEventListener("change", () => {
    fetchExpenses({
      expenseType: filterType.value,
      period: exportPeriod.value,
      day: dayPicker.value,
      week: weekPicker.value,
      month: monthPicker.value,
      halfyear: halfyearPicker.value,
      year: yearPicker.value,
      startDate: startDate.value,
      endDate: endDate.value,
    });
  });

  [
    weekPicker,
    monthPicker,
    halfyearPicker,
    yearPicker,
    startDate,
    endDate,
  ].forEach((picker) => {
    picker.addEventListener("change", () => {
      fetchExpenses({
        expenseType: filterType.value,
        period: exportPeriod.value,
        day: dayPicker.value,
        week: weekPicker.value,
        month: monthPicker.value,
        halfyear: halfyearPicker.value,
        year: yearPicker.value,
        startDate: startDate.value,
        endDate: endDate.value,
      });
    });
  });

  if (exportBtn) {
    exportBtn.addEventListener("click", exportByPeriod);
  }

  function exportToExcel(data, fileName) {
    if (userRole === "user") {
      alert("У вас немає прав для експорту витрат.");
      return;
    }
    const wb = XLSX.utils.book_new();
    const wsData = data.map((e) => ({
      Дата: formatDate(e.expense_date),
      "Тип витрат": e.expense_type,
      "Назва техніки": e.equipment_name,
      "Сума (UAH)": formatNumber(e.expense_amount.toFixed(2)),
      Користувач: e.fullName || "Невідомий",
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Витрати");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  }

  function renderGrid(data) {
    console.log("Рендеринг даних:", data);
    grid.innerHTML = "";
    if (!data || data.length === 0) {
      console.log("Немає даних для відображення");
      grid.innerHTML = "<p>Наразі витрат немає.</p>";
      return;
    }
    console.log("Створюємо картки для даних:", data.length);
    data.forEach((e, index) => {
      console.log(`Обробляємо запис ${index + 1}:`, e);
      const iconClass =
        expenseIcons[e.expense_type.toLowerCase()] || "fas fa-question";
      const fullName = e.fullName || "Невідомий";
      let card = `
                <div class="expense-card">
                    <h3><i class="${iconClass}"></i> ${e.expense_type}</h3>
                    <p><i class="fas fa-tractor"></i> Техніка: ${
                      e.equipment_name
                    }</p>
                    <p><i class="fas fa-user"></i> Користувач: ${fullName}</p>
                    <p><i class="fas fa-money-bill-wave"></i> Сума: ${formatNumber(
                      e.expense_amount.toFixed(2)
                    )} UAH</p>
                    <p><i class="fas fa-calendar-alt"></i> Дата: ${formatDate(
                      e.expense_date
                    )}</p>
                    <div class="actions">
            `;

      if (
        userRole === "admin" ||
        (userRole === "manager" && e.user_id === currentUserId)
      ) {
        card += `
                        <button class="edit-btn" onclick="editExpense(${e.id})"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn" onclick="deleteExpense(${e.id})"><i class="fas fa-trash"></i></button>
                `;
      }

      card += `
                    </div>
                </div>`;
      grid.innerHTML += card;
    });
    console.log("Кінцевий HTML grid:", grid.innerHTML);
  }

  function updateTotalExpenses(filtered) {
    console.log("Оновлення загальної суми:", filtered);
    let total = filtered.reduce((sum, e) => sum + e.expense_amount, 0);
    let title = "Загальні витрати";

    if (filterType.value) {
      title = `${filterType.value}`;
    }
    if (exportPeriod.value !== "all") {
      if (exportPeriod.value === "day" && dayPicker.value) {
        title += ` за ${formatDate(dayPicker.value)}`;
      } else if (exportPeriod.value === "week" && weekPicker.value) {
        title += ` за тиждень ${weekPicker.value}`;
      } else if (exportPeriod.value === "month" && monthPicker.value) {
        title += ` за ${monthPicker.value}`;
      } else if (exportPeriod.value === "halfyear" && halfyearPicker.value) {
        title += ` за ${
          halfyearPicker.options[halfyearPicker.selectedIndex].text
        }`;
      } else if (exportPeriod.value === "year" && yearPicker.value) {
        title += ` за ${yearPicker.value}`;
      } else if (
        exportPeriod.value === "custom" &&
        startDate.value &&
        endDate.value
      ) {
        title += ` з ${formatDate(startDate.value)} по ${formatDate(
          endDate.value
        )}`;
      }
    }

    metricTitle.innerHTML = `<i class="fas fa-wallet"></i> ${title}`;

    let current = 0;
    const step = total / 50;
    const interval = setInterval(() => {
      current += step;
      if (current >= total) {
        current = total;
        clearInterval(interval);
      }
      totalExpensesElement.textContent = `${formatNumber(
        current.toFixed(2)
      )} UAH`;
    }, 20);
  }

  function exportByPeriod() {
    if (userRole === "user") {
      alert("У вас немає прав для експорту витрат.");
      return;
    }

    const period = exportPeriod.value;
    let filteredExpenses = expenses;
    let fileName = "Витрати";

    if (filterType.value) {
      fileName += `_${filterType.value}`;
    }

    if (period === "all") {
      fileName += "_Усі";
    } else if (period === "day" && dayPicker.value) {
      fileName += `_за_${dayPicker.value}`;
    } else if (period === "week" && weekPicker.value) {
      fileName += `_за_тиждень_${weekPicker.value}`;
    } else if (period === "month" && monthPicker.value) {
      fileName += `_за_${monthPicker.value}`;
    } else if (period === "halfyear" && halfyearPicker.value) {
      fileName += `_за_${halfyearPicker.value}`;
    } else if (period === "year" && yearPicker.value) {
      fileName += `_за_${yearPicker.value}`;
    } else if (period === "custom" && startDate.value && endDate.value) {
      fileName += `_з_${startDate.value}_по_${endDate.value}`;
    } else {
      alert("Виберіть дату або період для експорту!");
      return;
    }

    exportToExcel(filteredExpenses, fileName);
  }

  window.editExpense = async function (id) {
    if (userRole === "user") {
      alert("У вас немає прав для редагування витрат.");
      return;
    }

    try {
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) return;

      const response = await fetch(`/api/expenses/${id}`, {
        credentials: "include",
      });
      if (!response.ok) {
        let errorMessage = "Помилка завантаження витрати для редагування";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          if (response.status === 401) {
            localStorage.setItem(
              "authMessage",
              "Сесія закінчилася. Будь ласка, увійдіть знову."
            );
            window.location.href = "/index.html";
            return;
          } else if (response.status === 403) {
            alert("У вас немає прав для редагування цієї витрати.");
            return;
          } else if (response.status === 404) {
            alert("Витрата не знайдена або доступ заборонений.");
            return;
          }
        } catch (e) {
          console.log(
            "Не вдалося отримати повідомлення про помилку:",
            e.message
          );
        }
        throw new Error(errorMessage);
      }
      const e = await response.json();
      form.equipmentName.value = e.equipment_name;
      form.expenseType.value = e.expense_type;
      form.expenseAmount.value = e.expense_amount;
      form.expenseDate.value = e.expense_date;
      editId = id;
      modal.style.display = "flex";
      document.getElementById("modalTitle").textContent = "Редагувати";
    } catch (error) {
      console.error("Помилка:", error.message);
      alert(`Помилка: ${error.message}`);
    }
  };

  window.deleteExpense = async function (id) {
    if (userRole === "user") {
      alert("У вас немає прав для видалення витрат.");
      return;
    }

    if (!confirm("Видалити цю витрату?")) return;

    try {
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) return;

      const response = await fetch(`/api/expenses/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        let errorMessage = "Помилка видалення витрати";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          if (response.status === 401) {
            localStorage.setItem(
              "authMessage",
              "Сесія закінчилася. Будь ласка, увійдіть знову."
            );
            window.location.href = "/index.html";
            return;
          } else if (response.status === 403) {
            alert("У вас немає прав для видалення цієї витрати.");
            return;
          } else if (response.status === 404) {
            alert("Витрата не знайдена або доступ заборонений.");
            return;
          }
        } catch (e) {
          console.log(
            "Не вдалося отримати повідомлення про помилку:",
            e.message
          );
        }
        throw new Error(errorMessage);
      }
      fetchExpenses({
        expenseType: filterType.value,
        period: exportPeriod.value,
        day: dayPicker.value,
        week: weekPicker.value,
        month: monthPicker.value,
        halfyear: halfyearPicker.value,
        year: yearPicker.value,
        startDate: startDate.value,
        endDate: endDate.value,
      });
      alert("Витрата успішно видалена!");
    } catch (error) {
      console.error("Помилка:", error.message);
      alert(`Помилка: ${error.message}`);
    }
  };

  (async () => {
    await checkAuth();
    await loadUserProfile();
    await loadExpenseTypes();
    fetchExpenses({
      expenseType: filterType.value,
      period: exportPeriod.value,
    });
  })();
});
