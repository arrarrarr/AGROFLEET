const equipment = [
    { id: 1, name: "Трактор Донгфенг 404 ДГ", rentalPrice: 1500 },
    { id: 2, name: "Комбайн John Deere S760", rentalPrice: 3000 },
    { id: 3, name: "Сівалка Amazone D9", rentalPrice: 2000 }
];

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function addFavorite(equipmentId) {
    const equipmentItem = equipment.find(eq => eq.id === equipmentId);
    if (!equipmentItem) return;
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    const existingFavorite = favorites.find(f => f.id === equipmentId);
    const notification = document.getElementById("notification");
    if (!existingFavorite) {
        favorites.push({ id: equipmentItem.id, name: equipmentItem.name });
        localStorage.setItem('favorites', JSON.stringify(favorites));
        notification.textContent = `Додано "${equipmentItem.name}" до обраного!`;
        notification.style.display = "block";
        setTimeout(() => notification.style.display = "none", 2000);
    } else {
        notification.textContent = `"${equipmentItem.name}" вже в обраному!`;
        notification.style.display = "block";
        setTimeout(() => notification.style.display = "none", 2000);
    }
}

function updateFavoritesList() {
    const favoritesModal = document.getElementById("favorites-modal");
    const favoritesList = document.getElementById("favorites-list");
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    favoritesList.innerHTML = '';
    if (favorites.length === 0) {
        favoritesList.innerHTML = '<li class="empty-message">Список обраного порожній.</li>';
    } else {
        let totalCost = 0;
        favorites.forEach((favorite, index) => {
            const equipmentItem = equipment.find(eq => eq.id === favorite.id);
            if (equipmentItem) {
                totalCost += equipmentItem.rentalPrice;
                const li = document.createElement('li');
                li.innerHTML = `
                    <div class="info">
                        <strong>${favorite.name}</strong><br>
                        <small>Вартість оренди: ${formatNumber(equipmentItem.rentalPrice)} UAH/день</small>
                    </div>
                    <div class="actions">
                        <button class="rent-btn" onclick="rentFavorite(${index})"><i class="fas fa-hand-holding"></i> Орендувати</button>
                        <button class="remove-btn" onclick="removeFavorite(${index})"><i class="fas fa-trash"></i> Видалити</button>
                    </div>
                `;
                favoritesList.appendChild(li);
            }
        });
        if (favorites.length > 0) {
            const totalLi = document.createElement('li');
            totalLi.className = 'total-cost';
            totalLi.innerHTML = `<strong>Загальна вартість оренди: ${formatNumber(totalCost)} UAH/день</strong>`;
            favoritesList.appendChild(totalLi);
        }
    }
    favoritesModal.style.display = "flex";
}

function openFavoritesModal() {
    updateFavoritesList();
}

function removeFavorite(index) {
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    favorites.splice(index, 1);
    localStorage.setItem('favorites', JSON.stringify(favorites));
    updateFavoritesList();
    const notification = document.getElementById("notification");
    notification.textContent = "Елемент видалено з обраного!";
    notification.style.display = "block";
    setTimeout(() => notification.style.display = "none", 2000);
}

function clearFavorites() {
    localStorage.removeItem('favorites');
    updateFavoritesList();
    const notification = document.getElementById("notification");
    notification.textContent = "Список обраного очищено!";
    notification.style.display = "block";
    setTimeout(() => notification.style.display = "none", 2000);
}

function rentFavorite(index) {
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    const equipmentId = favorites[index].id;
    window.openRentModal([equipmentId]);
}

function rentAllFavorites() {
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    if (favorites.length === 0) {
        const notification = document.getElementById("notification");
        notification.textContent = "Список обраного порожній!";
        notification.style.display = "block";
        setTimeout(() => notification.style.display = "none", 2000);
        return;
    }
    const equipmentIds = favorites.map(f => f.id);
    window.openRentModal(equipmentIds);
}

document.addEventListener('DOMContentLoaded', () => {
    const favoritesModal = document.getElementById("favorites-modal");
    const closeFavoritesModal = document.getElementById("close-favorites-modal");

    closeFavoritesModal.addEventListener("click", () => {
        favoritesModal.style.display = "none";
    });
    window.addEventListener("click", (event) => {
        if (event.target === favoritesModal) {
            favoritesModal.style.display = "none";
        }
    });
});

window.addFavorite = addFavorite;
window.openFavoritesModal = openFavoritesModal;
window.removeFavorite = removeFavorite;
window.clearFavorites = clearFavorites;
window.rentFavorite = rentFavorite;
window.rentAllFavorites = rentAllFavorites;     