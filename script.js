// index.js

// Глобальные переменные
window.totalHours = window.totalHours || {
  Трактор: 4,
  Комбайн: 0,
  Плуг: 0,
  Сівалка: 0
};

window.activeShifts = window.activeShifts || [];
window.logs = window.logs || [];
window.dailyHours = window.dailyHours || {};
window.deletedLogs = window.deletedLogs || [];
window.currentFilter = window.currentFilter || 'day';
window.currentStatsFilter = window.currentStatsFilter || 'day';
window.currentDate = window.currentDate || new Date().toISOString().split('T')[0];
window.simulatedToday = window.simulatedToday || window.currentDate;

// Функция для плавной прокрутки наверх (для кнопки в футере)
function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

// Функция для открытия Google Maps по адресу
function openGoogleMaps(address) {
  const encodedAddress = encodeURIComponent(address);
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
  window.open(googleMapsUrl, '_blank');
}

// Функция для инициализации анимаций при скролле
function initScrollAnimations() {
  const observerOptions = {
    root: null, // Используем viewport
    rootMargin: '0px',
    threshold: 0.1 // Запускаем, когда 10% элемента видно
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = entry.target;
        target.classList.add('loaded'); // Добавляем класс для анимации

        // Для элементов с индивидуальными задержками
        if (target.classList.contains('footer-section')) {
          const index = Array.from(document.querySelectorAll('.footer-section')).indexOf(target);
          target.style.transitionDelay = `${index * 0.2}s`;
        } else if (target.classList.contains('social-icon')) {
          const index = Array.from(document.querySelectorAll('.social-icon')).indexOf(target);
          target.style.transitionDelay = `${0.2 + index * 0.2}s`;
        } else if (target.classList.contains('footer-bottom')) {
          target.style.transitionDelay = '0.8s';
        } else if (target.classList.contains('scroll-top')) {
          target.style.transitionDelay = '1s';
        } else if (target.classList.contains('decor-tractor') || target.classList.contains('decor-wheat')) {
          target.style.transitionDelay = '1.2s';
        }

        observer.unobserve(target); // Останавливаем наблюдение после срабатывания
      }
    });
  }, observerOptions);

  // Находим все элементы, которые нужно анимировать
  const elements = document.querySelectorAll(
    '.content-block, .content-image, .fade-in, .footer, .footer-section, .social-icon, .footer-bottom, .scroll-top, .decor-tractor, .decor-wheat'
  );

  elements.forEach(element => {
    observer.observe(element); // Начинаем наблюдение за каждым элементом
  });
}

// Запускаем анимации после загрузки страницы
document.addEventListener('DOMContentLoaded', initScrollAnimations);