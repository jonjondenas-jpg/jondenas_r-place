const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Настройки доски
const boardSize = 50; 
let board = Array(boardSize).fill().map(() => Array(boardSize).fill('#ffffff'));

// Настройки кулдауна (100 секунд)
const cooldowns = new Map();
const COOLDOWN_TIME = 100 * 1000; 

app.use(express.static(__dirname + '/public'));

io.on('connection', (socket) => {
    // При входе отправляем игроку всю доску
    socket.emit('init', board);

    socket.on('pixel', (data) => {
        const lastClick = cooldowns.get(socket.id) || 0;
        const now = Date.now();

        if (now - lastClick >= COOLDOWN_TIME) {
            const { x, y, color } = data;
            
            // Проверка координат, чтобы не сломали сервер
            if (x >= 0 && x < boardSize && y >= 0 && y < boardSize) {
                board[y][x] = color;
                cooldowns.set(socket.id, now);
                
                // Рассылаем всем новый пиксель
                io.emit('updatePixel', { x, y, color });
                // Запускаем таймер у игрока
                socket.emit('cooldownStarted', COOLDOWN_TIME);
            }
        } else {
            const remaining = Math.ceil((COOLDOWN_TIME - (now - lastClick)) / 1000);
            socket.emit('errorMsg', `Подожди еще ${remaining} сек.`);
        }
    });

    socket.on('disconnect', () => {
        cooldowns.delete(socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Сервер на порту ${PORT}`));