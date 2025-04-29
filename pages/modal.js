// Загружаем оборудование из API
let equipment = [];

async function fetchEquipment() {
    try {
        const response = await fetch('/api/equipment');
        if (!response.ok) {
            throw new Error('Ошибка загрузки оборудования');
        }
        equipment = await response.json();
    } catch (error) {
        console.error(error.message);
        alert('Не удалось загрузить данные оборудования');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Загружаем оборудование при загрузке страницы
    await fetchEquipment();

    const productContainer = document.querySelector('.product-container');
    const equipmentId = parseInt(productContainer?.dataset.equipmentId) || null;

    const characteristicsList = document.getElementById('characteristics-list');
    const toggleButton = document.getElementById('toggle-characteristics');
    const notification = document.getElementById("notification");

    toggleButton.addEventListener("click", () => {
        characteristicsList.classList.toggle("expanded");
        toggleButton.textContent = characteristicsList.classList.contains("expanded") ? "Приховати характеристики" : "Показати всі характеристики";
    });

    document.querySelectorAll('.gallery img').forEach(image => {
        image.addEventListener('click', () => {
            document.getElementById('main-image').src = image.src;
        });
    });
});

function loadPage(url) {
    window.location.href = url;
}