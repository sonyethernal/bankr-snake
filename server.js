import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

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
    // If the player is already waiting, do nothing
    if (waitingPlayer === socket) return;

    if (waitingPlayer) {
      // Match found
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

      console.log(`Match started in ${room}: ${waitingPlayer.id} (P1) vs ${socket.id} (P2)`);
      waitingPlayer = null; // Clear queue
    } else {
      // Join queue
      waitingPlayer = socket;
      socket.emit('waiting_for_match');
      console.log('User waiting for match:', socket.id);
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

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`Snakes & Ladders Server running on port ${PORT}`);
});
