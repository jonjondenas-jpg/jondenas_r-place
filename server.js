const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname + '/public'));

let players = {};
let zombies = [];
let bullets = [];
let moneyDrops = [];
const MAP_SIZE = 2000;

// Создаем зомби при запуске
for (let i = 0; i < 15; i++) {
    spawnZombie();
}

function spawnZombie() {
    zombies.push({
        id: Math.random(),
        x: Math.random() * MAP_SIZE,
        y: Math.random() * MAP_SIZE,
        health: 50,
        speed: 1 + Math.random() * 1
    });
}

// Игровой цикл сервера (обновление мира 30 раз в секунду)
setInterval(() => {
    // Движение зомби к ближайшему игроку
    zombies.forEach(z => {
        let closestPlayer = null;
        let minDist = Infinity;
        for (let id in players) {
            let p = players[id];
            let dist = Math.hypot(p.x - z.x, p.y - z.y);
            if (dist < minDist) {
                minDist = dist;
                closestPlayer = p;
            }
        }
        if (closestPlayer && minDist < 500) {
            let angle = Math.atan2(closestPlayer.y - z.y, closestPlayer.x - z.x);
            z.x += Math.cos(angle) * z.speed;
            z.y += Math.sin(angle) * z.speed;
        }
    });

    // Движение пуль и коллизии
    bullets.forEach((b, bIdx) => {
        b.x += b.velX;
        b.y += b.velY;
        b.life--;

        // Коллизия пули с зомби
        zombies.forEach((z, zIdx) => {
            if (Math.hypot(b.x - z.x, b.y - z.y) < 20) {
                z.health -= 25;
                bullets.splice(bIdx, 1);
                if (z.health <= 0) {
                    // Зомби умер, спавним деньги
                    moneyDrops.push({ x: z.x, y: z.y, amount: 10 + Math.floor(Math.random()*10), id: Math.random() });
                    zombies.splice(zIdx, 1);
                    setTimeout(spawnZombie, 5000); // Респавн через 5 сек
                    if (players[b.owner]) players[b.owner].money += 5; // Бонус за убийство
                }
            }
        });

        if (b.life <= 0) bullets.splice(bIdx, 1);
    });

    // Сбор денег игроками
    moneyDrops.forEach((m, mIdx) => {
        for (let id in players) {
            let p = players[id];
            if (Math.hypot(p.x - m.x, p.y - m.y) < 30) {
                p.money += m.amount;
                moneyDrops.splice(mIdx, 1);
                io.to(id).emit('playSound', 'money');
                break;
            }
        }
    });

    // Рассылка состояния мира всем
    io.emit('worldUpdate', { players, zombies, bullets, moneyDrops });
}, 1000 / 30);


io.on('connection', (socket) => {
    console.log('Игрок подключился:', socket.id);

    players[socket.id] = {
        id: socket.id,
        x: MAP_SIZE / 2,
        y: MAP_SIZE / 2,
        color: `hsl(${Math.random() * 360}, 70%, 50%)`,
        money: 0,
        health: 100,
        weapon: 'Pistol',
        inventory: ['Pistol', 'Knife']
    };

    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
        }
    });

    socket.on('shoot', (data) => {
        if (players[socket.id]) {
            const angle = Math.atan2(data.targetY - players[socket.id].y, data.targetX - players[socket.id].x);
            bullets.push({
                x: players[socket.id].x,
                y: players[socket.id].y,
                velX: Math.cos(angle) * 15,
                velY: Math.sin(angle) * 15,
                life: 60, // Время жизни пули в кадрах
                owner: socket.id
            });
            io.emit('playSound', 'shoot');
        }
    });

    socket.on('chat', (msg) => {
        if (players[socket.id]) {
            io.emit('chat', { id: socket.id, msg: msg.slice(0, 50) });
        }
    });

    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
        delete players[socket.id];
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Zombie Server на порту ' + PORT));
