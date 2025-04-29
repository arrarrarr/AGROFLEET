import nodemailer from 'nodemailer';

// Настройка транспортера для отправки email
const transporter = nodemailer.createTransport({
    service: 'gmail', // Используем Gmail, но вы можете выбрать другой сервис (например, SendGrid, Mailgun и т.д.)
    auth: {
        user: 'your-email@gmail.com', // Замените на ваш email
        pass: 'your-app-password', // Замените на пароль приложения (не обычный пароль Gmail, а app-specific password)
    },
});

// Функция для отправки email менеджеру о новом заказе
export const sendOrderToManager = async (order, managerEmail) => {
    try {
        // Формируем список товаров в заказе
        const itemsList = order.items
            .map(item => `${item.name} (Кількість: ${item.quantity})`)
            .join('\n');

        // Настройки email
        const mailOptions = {
            from: 'your-email@gmail.com', // Ваш email
            to: managerEmail, // Email менеджера
            subject: `Нове замовлення #${order.id} від ${order.userFullName}`,
            text: `
                Нове замовлення потребує вашого підтвердження.

                Замовлення #${order.id}
                Користувач: ${order.userFullName} (ID: ${order.userId})
                Email користувача: ${order.userEmail}
                Телефон користувача: ${order.userPhone}
                Товари:
                ${itemsList}
                Період оренди: з ${order.rentalStart} до ${order.rentalEnd}
                Дата доставки: ${order.deliveryDate}
                Загальна сума: ${order.totalAmount} грн
                Статус: ${order.status}
                Дата створення: ${new Date(order.createdAt).toLocaleString()}
            `,
        };

        // Отправка email
        await transporter.sendMail(mailOptions);
        console.log(`Email успішно відправлено на ${managerEmail}`);
    } catch (error) {
        console.error(`Помилка при відправці email на ${managerEmail}:`, error.message);
        throw new Error('Не вдалося відправити email менеджеру');
    }
};