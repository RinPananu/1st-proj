import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

interface Player {
  id: string;
  x: number;
  y: number;
  username: string;
  color: string;
  hat: string;
}

const players: Map<string, Player> = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join', (data: { username: string; color: string; hat: string }) => {
    const newPlayer: Player = {
      id: socket.id,
      x: Math.random() * 500,
      y: Math.random() * 500,
      username: data.username || 'Anonymous',
      color: data.color || '#000000',
      hat: data.hat || 'none'
    };
    players.set(socket.id, newPlayer);
    
    // Send current players to the new player
    socket.emit('currentPlayers', Array.from(players.values()));
    
    // Notify others about the new player
    socket.broadcast.emit('newPlayer', newPlayer);
  });

  socket.on('move', (data: { x: number; y: number }) => {
    const player = players.get(socket.id);
    if (player) {
      player.x = data.x;
      player.y = data.y;
      socket.broadcast.emit('playerMoved', player);
    }
  });

  socket.on('emote', (action: string) => {
    socket.broadcast.emit('playerEmote', { id: socket.id, action });
  });

  socket.on('chat', (message: string) => {
    const player = players.get(socket.id);
    if (player) {
      io.emit('chatMessage', {
        username: player.username,
        message: message,
        id: socket.id
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    players.delete(socket.id);
    io.emit('playerDisconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
