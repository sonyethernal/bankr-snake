import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Allow CORS from our Vite dev server
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

let waitingPlayer = null;
let roomCounter = 0;

// Store rooms state: { roomId: { p1: socketId, p2: socketId, turn: 0 } }
const rooms = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('find_match', () => {
    console.log(`[SOCKET] User ${socket.id} requested matchmaking.`);
    // If the player is already waiting, do nothing
    if (waitingPlayer === socket) return;

    if (waitingPlayer) {
      // Match found
      console.log(`[MATCH] Found opponent for ${socket.id}. Pairing with ${waitingPlayer.id}`);
      const room = `room_${++roomCounter}`;
      socket.join(room);
      waitingPlayer.join(room);

      rooms[room] = {
        p1: waitingPlayer.id,
        p2: socket.id,
        turn: 0
      };

      // Notify Player 1
      waitingPlayer.emit('game_start', {
        room,
        playerIndex: 0, // P1
        opponentId: socket.id
      });

      // Notify Player 2
      socket.emit('game_start', {
        room,
        playerIndex: 1, // P2
        opponentId: waitingPlayer.id
      });

      console.log(`[GAME] Started in ${room}: ${waitingPlayer.id} vs ${socket.id}`);
      waitingPlayer = null; // Clear queue
    } else {
      // Join queue
      waitingPlayer = socket;
      socket.emit('waiting_for_match');
      console.log(`[QUEUE] User ${socket.id} is now waiting for an opponent.`);
    }
  });

  socket.on('cancel_search', () => {
    if (waitingPlayer === socket) {
      waitingPlayer = null;
      console.log('User canceled search:', socket.id);
    }
  });

  socket.on('roll_request', (room) => {
    const roomData = rooms[room];
    if (!roomData) return;

    // Generate random dice roll server-side
    const diceResult = Math.ceil(Math.random() * 6);
    
    // Broadcast the result to the room so both clients animate the exact same roll
    io.to(room).emit('roll_result', { dice: diceResult });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (waitingPlayer === socket) {
      waitingPlayer = null;
    }

    // Find if the user was in a game and notify the opponent
    for (const room in rooms) {
      if (rooms[room].p1 === socket.id || rooms[room].p2 === socket.id) {
        io.to(room).emit('opponent_disconnected');
        delete rooms[room];
        break;
      }
    }
  });
});

// Serve static files in production
app.use(express.static(path.join(__dirname, 'dist')));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Snakes & Ladders Server running on port ${PORT}`);
});
