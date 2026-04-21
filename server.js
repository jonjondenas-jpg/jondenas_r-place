const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname + '/public'));

let players = {};

io.on('connection', (socket) => {
    console.log('Игрок вошел:', socket.id);

    // Создаем нового игрока
    players[socket.id] = {
        x: Math.random() * 500,
        y: Math.random() * 500,
        color: `hsl(${Math.random() * 360}, 70%, 50%)`,
        id: socket.id
    };

    // Рассылаем всем обновленный список игроков
    io.emit('updatePlayers', players);

    // Обработка движения
    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            socket.broadcast.emit('updatePlayers', players);
        }
    });

    // Обработка стрельбы (просто пробрасываем событие всем)
    socket.on('shoot', (bulletData) => {
        io.emit('newBullet', bulletData);
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('updatePlayers', players);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Войнушка запущена на порту ' + PORT));
