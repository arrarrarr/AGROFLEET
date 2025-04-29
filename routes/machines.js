const express = require('express');
const router = express.Router();
const { machines } = require('../db');

// Отримання всіх машин
router.get('/', (req, res) => {
    res.json(machines);
});

// Додавання нової машини
router.post('/', (req, res) => {
    const { name, category, details, image, link } = req.body;
    const newMachine = {
        id: machines.length + 1,
        name,
        category,
        details,
        image,
        link
    };
    machines.push(newMachine);
    res.status(201).json(newMachine);
});

// Оновлення машини
router.put('/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { name, category, details, image, link } = req.body;
    const machineIndex = machines.findIndex(m => m.id === id);
    if (machineIndex === -1) {
        return res.status(404).json({ error: 'Машина не знайдена' });
    }
    machines[machineIndex] = { id, name, category, details, image, link };
    res.json(machines[machineIndex]);
});

// Видалення машини
router.delete('/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const machineIndex = machines.findIndex(m => m.id === id);
    if (machineIndex === -1) {
        return res.status(404).json({ error: 'Машина не знайдена' });
    }
    machines.splice(machineIndex, 1);
    res.status(204).send();
});

module.exports = router;