document.addEventListener("DOMContentLoaded", () => {
  const addBtn = document.getElementById("addReminderBtn");
  const modal = document.getElementById("reminderModal");
  const closeBtn = document.querySelector(".close-button");
  const form = document.getElementById("reminderForm");
  const grid = document.getElementById("remindersGrid");
  const modalTitle = document.getElementById("modalTitle");
  const dateFilter = document.getElementById("dateFilter");
  const statusFilter = document.getElementById("statusFilter");
  const taskTypeSelect = document.getElementById("taskType");
  const repairDetails = document.getElementById("repairDetails");
  const equipmentSelect = document.getElementById("equipment");
  const repairPartSelect = document.getElementById("repairPart");

  let reminders = [];
  let editId = null;
  let userRole = null;
  let ws;

  const equipmentParts = {
    "Трактор 404D6ZU": [
      "Двигун",
      "Гідравліка",
      "Колеса",
      "Трансмісія",
      "Кабіна",
    ],
    "Трактор Xingtai XT-900": [
      "Двигун",
      "Гідравліка",
      "Колеса",
      "Трансмісія",
      "Система охолодження",
    ],
    "Комбайн CAT Lexion 470R": [
      "Жатка",
      "Молотильний барабан",
      "Система сепарації",
      "Двигун",
      "Гідравліка",
    ],
    "Комбайн YTO 4LZ-8B1": [
      "Жатка",
      "Молотильний барабан",
      "Система сепарації",
      "Двигун",
      "Гідравліка",
    ],
    "Дощувальна машина ДТЗ 300": [
      "Насос",
      "Форсунки",
      "Труби",
      "Електродвигун",
      "Контролер",
    ],
    "Дощувальна машина ПГР-3.35": [
      "Насос",
      "Форсунки",
      "Труби",
      "Електродвигун",
      "Контролер",
    ],
    "Дощувальна машина ПГР НН-225": [
      "Насос",
      "Форсунки",
      "Труби",
      "Електродвигун",
      "Контролер",
    ],
    "Дощувальна машина ПГР НН 220": [
      "Насос",
      "Форсунки",
      "Труби",
      "Електродвигун",
      "Контролер",
    ],
    "Культиватор КМ-140/C": ["Леміш", "Рама", "Гідравліка", "Колеса", "Диски"],
    "Культиватор KTLC-8MRT": ["Леміш", "Рама", "Гідравліка", "Колеса", "Диски"],
  };

  function showToast(message, isError = false) {
    const toast = document.createElement("div");
    toast.className = `toast ${isError ? "error" : ""}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("show");
    }, 100);

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }

  function connectWebSocket() {
    ws = new WebSocket("ws://https://agrofleet-pdqw.onrender.com/ws");
    ws.onopen = () => console.log("WebSocket підключено");
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "reminderUpdated") {
        const updatedReminder = message.reminder;
        const index = reminders.findIndex((r) => r.id === updatedReminder.id);
        if (index !== -1) {
          reminders[index] = updatedReminder;
        } else {
          reminders.push(updatedReminder);
        }
        displayReminders(reminders);
      } else if (message.type === "reminderDeleted") {
        reminders = reminders.filter((r) => r.id !== parseInt(message.id));
        displayReminders(reminders);
      }
    };
    ws.onclose = () => {
      console.log(
        "WebSocket відключено, повторне підключення через 5 секунд..."
      );
      setTimeout(connectWebSocket, 5000);
    };
    ws.onerror = (error) => console.error("Помилка WebSocket:", error);
  }

  connectWebSocket();

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/check-auth", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Не авторизований");
      }
      const user = await response.json();
      userRole = user.role;
      if (userRole === "user") {
        addBtn.style.display = "none";
      }
    } catch (error) {
      console.error("Помилка авторизації:", error);
      window.location.href = "/profile.html";
    }
  };

  const updateRepairParts = () => {
    const selectedEquipment = equipmentSelect.value;
    repairPartSelect.innerHTML = '<option value="">Оберіть деталь</option>';
    if (selectedEquipment && equipmentParts[selectedEquipment]) {
      equipmentParts[selectedEquipment].forEach((part) => {
        const option = document.createElement("option");
        option.value = part;
        option.textContent = part;
        repairPartSelect.appendChild(option);
      });
    }
  };

  const loadReminders = async (filters = {}) => {
    try {
      grid.innerHTML = "<p>Завантаження нагадувань...</p>";
      const query = new URLSearchParams(filters).toString();
      const response = await fetch(
        `/api/maintenance/reminders${query ? `?${query}` : ""}`,
        {
          method: "GET",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = "/profile.html?authRequired=true";
          return;
        }
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Помилка при завантаженні нагадувань"
        );
      }

      reminders = await response.json();
      displayReminders(reminders);
    } catch (error) {
      console.error("Помилка завантаження нагадувань:", error.message);
      grid.innerHTML = `<p>Помилка: ${error.message}. Спробуйте оновити сторінку.</p>`;
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date)) return "Невідома дата";
    const options = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    };
    return date.toLocaleString("uk-UA", options).replace(",", "");
  };

  const getStatusText = (status) => {
    const statusMap = {
      planned: "Заплановано",
      in_progress: "В процесі",
      completed: "Завершено",
    };
    return statusMap[status] || "Невідомо";
  };

  const displayReminders = (data) => {
    grid.innerHTML = "";
    if (!data.length) {
      grid.innerHTML =
        userRole === "user"
          ? "<p>У вас поки що немає нагадувань. Зверніться до менеджера.</p>"
          : "<p>Нагадувань не знайдено</p>";
      return;
    }

    data.forEach((reminder) => {
      const card = document.createElement("div");
      card.className = `reminder-card ${
        reminder.completed ? "completed" : ""
      } noto-sans-regular`;
      card.innerHTML = `
                <h3>${reminder.text}</h3>
                <p><i class="fas fa-calendar-alt"></i> <span>Дата: ${formatDate(
                  reminder.dateTime
                )}</span></p>
                <p><i class="fas fa-tractor"></i> <span>Техніка: ${
                  reminder.equipment || "Невідомо"
                }</span></p>
                <p><i class="fas fa-user"></i> <span>Оператор: ${
                  reminder.operator || "Невідомо"
                }</span></p>
                <p><i class="fas fa-tools"></i> <span>Тип: ${
                  reminder.taskType === "maintenance" ? "Техогляд" : "Ремонт"
                }</span></p>
                ${
                  reminder.taskType === "repair" && reminder.repairPart
                    ? `
                    <p><i class="fas fa-wrench"></i> <span>Деталь: ${
                      reminder.repairPart
                    }</span></p>
                    <p><i class="fas fa-comment"></i> <span>Опис ремонту: ${
                      reminder.repairDescription || "Немає"
                    }</span></p>
                `
                    : ""
                }
                <p><i class="fas fa-info-circle"></i> <span>Статус: <span class="status-label ${
                  reminder.status
                }">${getStatusText(reminder.status)}</span></span></p>
                <div class="action-buttons">
                    ${
                      userRole === "admin" || userRole === "manager"
                        ? `
                        <button class="complete-btn noto-sans-regular" data-id="${
                          reminder.id
                        }">
                            <i class="fas fa-check"></i> ${
                              reminder.completed ? "Відновити" : "Завершити"
                            }
                        </button>
                        <button class="edit-btn noto-sans-regular" data-id="${
                          reminder.id
                        }" data-text="${encodeURIComponent(reminder.text)}">
                            <i class="fas fa-edit"></i> Редагувати
                        </button>
                        <button class="delete-btn noto-sans-regular" data-id="${
                          reminder.id
                        }">
                            <i class="fas fa-trash"></i> Видалити
                        </button>
                    `
                        : `
                        <button class="complete-btn noto-sans-regular" data-id="${
                          reminder.id
                        }">
                            <i class="fas fa-check"></i> ${
                              reminder.completed ? "Відновити" : "Завершити"
                            }
                        </button>
                    `
                    }
                </div>
            `;
      grid.appendChild(card);
    });

    document.querySelectorAll(".reminder-card").forEach((card, index) => {
      card.style.opacity = "0";
      card.style.transform = "translateY(20px)";
      setTimeout(() => {
        card.style.transition = "opacity 0.5s ease, transform 0.5s ease";
        card.style.opacity = "1";
        card.style.transform = "translateY(0)";
      }, index * 100);
    });

    document.querySelectorAll(".complete-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        updateReminderStatus(id);
      });
    });

    document.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const text = btn.getAttribute("data-text");
        // Передаємо текст нагадування через URL
        window.location.href = `/maintenance_history.html?editId=${id}&text=${text}`;
      });
    });

    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        deleteReminder(id);
      });
    });
  };

  const editReminder = (id) => {
    if (userRole === "user") {
      showToast("Немає прав", true);
      return;
    }
    editId = id;
    const reminder = reminders.find((r) => r.id == id);
    if (!reminder) return;

    modalTitle.innerHTML = '<i class="fas fa-bell"></i> Редагувати нагадування';
    form.reminderText.value = reminder.text || "";
    form.taskDateTime.value = reminder.dateTime
      ? reminder.dateTime.slice(0, 16)
      : "";
    form.equipment.value = reminder.equipment || "";
    form.operator.value = reminder.operator || "";
    form.taskType.value = reminder.taskType || "maintenance";
    repairDetails.style.display =
      reminder.taskType === "repair" ? "block" : "none";
    updateRepairParts();
    form.repairPart.value = reminder.repairPart || "";
    form.repairDescription.value = reminder.repairDescription || "";
    modal.style.display = "flex";
    modal.style.animation = "scaleUp 0.5s ease";
  };

  const updateReminderStatus = async (id) => {
    try {
      const reminder = reminders.find((r) => r.id == id);
      if (!reminder) {
        throw new Error("Нагадування не знайдено");
      }

      const completed = !reminder.completed;
      const response = await fetch(`/api/maintenance/reminders/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = "/profile.html?authRequired=true";
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || "Помилка при оновленні статусу");
      }

      showToast(
        completed
          ? "Нагадування завершено та перенесено до завершених задач."
          : "Нагадування відновлено та додано до задач оптимізації."
      );
      await loadReminders({
        date: dateFilter.value,
        status: statusFilter.value,
      });
      await fetchTasks();
    } catch (error) {
      console.error("Помилка оновлення статусу:", error.message);
      showToast(`Не вдалося оновити статус: ${error.message}`, true);
    }
  };

  const deleteReminder = async (id) => {
    if (userRole === "user") {
      showToast("Немає прав", true);
      return;
    }
    if (!confirm("Ви впевнені, що хочете видалити це нагадування?")) {
      return;
    }

    try {
      const response = await fetch(`/api/maintenance/reminders/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = "/profile.html?authRequired=true";
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || "Помилка при видаленні нагадування");
      }

      showToast(
        "Нагадування видалено разом із пов’язаною задачею для оптимізації."
      );
      await loadReminders({
        date: dateFilter.value,
        status: statusFilter.value,
      });
      await fetchTasks();
    } catch (error) {
      console.error("Помилка видалення нагадування:", error.message);
      showToast(`Не вдалося видалити нагадування: ${error.message}`, true);
    }
  };

  addBtn.addEventListener("click", () => {
    if (userRole !== "admin" && userRole !== "manager") {
      showToast("Немає прав", true);
      return;
    }
    editId = null;
    modalTitle.innerHTML = '<i class="fas fa-bell"></i> Додати нагадування';
    form.reset();
    repairDetails.style.display = "none";
    repairPartSelect.innerHTML = '<option value="">Оберіть деталь</option>';
    modal.style.display = "flex";
    modal.style.animation = "scaleUp 0.5s ease";
  });

  closeBtn.addEventListener("click", () => {
    modal.style.display = "none";
    modal.style.animation = "";
    form.reset();
    repairDetails.style.display = "none";
    repairPartSelect.innerHTML = '<option value="">Оберіть деталь</option>';
  });

  window.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
      modal.style.animation = "";
      form.reset();
      repairDetails.style.display = "none";
      repairPartSelect.innerHTML = '<option value="">Оберіть деталь</option>';
    }
  });

  equipmentSelect.addEventListener("change", updateRepairParts);

  taskTypeSelect.addEventListener("change", () => {
    repairDetails.style.display =
      taskTypeSelect.value === "repair" ? "block" : "none";
    if (taskTypeSelect.value !== "repair") {
      repairPartSelect.innerHTML = '<option value="">Оберіть деталь</option>';
      form.repairDescription.value = "";
    } else {
      updateRepairParts();
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (userRole !== "admin" && userRole !== "manager") {
      showToast("Немає прав", true);
      return;
    }

    const reminder = {
      text: form.reminderText.value.trim(),
      dateTime: form.taskDateTime.value,
      equipment: form.equipment.value,
      operator: form.operator.value,
      taskType: form.taskType.value,
      repairPart:
        form.taskType.value === "repair" ? form.repairPart.value : null,
      repairDescription:
        form.taskType.value === "repair" ? form.repairDescription.value : null,
    };

    console.log("Дані для відправки:", reminder);

    if (
      !reminder.text ||
      !reminder.dateTime ||
      !reminder.equipment ||
      !reminder.operator ||
      !reminder.taskType
    ) {
      showToast("Будь ласка, заповніть усі обов’язкові поля", true);
      return;
    }

    if (reminder.taskType === "repair" && !reminder.repairPart) {
      showToast("Будь ласка, оберіть деталь для ремонту", true);
      return;
    }

    try {
      const url = editId
        ? `/api/maintenance/reminders/${editId}`
        : "/api/maintenance/reminders";
      const method = editId ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reminder),
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = "/profile.html?authRequired=true";
          return;
        }
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Помилка при створенні/оновленні нагадування"
        );
      }

      const updatedReminder = await response.json();
      showToast(
        editId
          ? "Нагадування оновлено"
          : "Нагадування додано та автоматично створено як задачу для оптимізації."
      );
      modal.style.display = "none";
      modal.style.animation = "";
      form.reset();
      repairDetails.style.display = "none";
      repairPartSelect.innerHTML = '<option value="">Оберіть деталь</option>';
      await loadReminders({
        date: dateFilter.value,
        status: statusFilter.value,
      });
      await fetchTasks();
    } catch (error) {
      console.error("Помилка при відправці нагадування:", error.message);
      showToast(`Помилка: ${error.message}`, true);
    }
  });

  dateFilter.addEventListener("change", () => {
    loadReminders({ date: dateFilter.value, status: statusFilter.value });
  });

  statusFilter.addEventListener("change", () => {
    loadReminders({ date: dateFilter.value, status: statusFilter.value });
  });

  dateFilter.addEventListener("dblclick", () => {
    dateFilter.value = "";
    loadReminders({ date: "", status: statusFilter.value });
  });

  statusFilter.addEventListener("dblclick", () => {
    statusFilter.value = "";
    loadReminders({ date: dateFilter.value, status: "" });
  });

  async function fetchTasks() {
    try {
      const response = await fetch(
        "https://agrofleet-pdqw.onrender.com/api/optimization/tasks",
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Помилка завантаження задач");
      const tasks = await response.json();
      console.log("Завдання оновлено:", tasks);
    } catch (error) {
      console.error("Помилка оновлення задач:", error.message);
    }
  }

  const init = async () => {
    await checkAuth();
    if (!userRole) return;
    loadReminders();
  };

  init();
});
