const express = require('express');
const app = express();
const port = 3000;

// Serve static files
app.use(express.static('./'));

// Start HTTP server
const server = app.listen(port, () => {
  console.log(`AIGaming Racing development server running at http://localhost:${port}`);
});

/* 
 * The code below is commented out as it will be implemented in MVP3 for multiplayer functionality
 */

/*
// Set up WebSocket server for multiplayer
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });

// Store connected players
const players = new Map();
let nextPlayerId = 1;

// Handle WebSocket connections
wss.on('connection', (ws) => {
  // Assign a unique ID to this player
  const playerId = nextPlayerId++;
  players.set(playerId, { ws, state: null });
  
  console.log(`Player ${playerId} connected. Total players: ${players.size}`);
  
  // Send player their ID
  ws.send(JSON.stringify({
    type: 'player_id',
    playerId
  }));
  
  // Notify everyone about the new player
  broadcastToAll({
    type: 'player_joined',
    playerId
  });
  
  // Handle messages from this player
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Handle player state updates
      if (data.type === 'player_update') {
        const player = players.get(playerId);
        if (player) {
          player.state = data.state;
          // Broadcast this player's state to all other players
          broadcastToOthers(playerId, {
            type: 'player_update',
            playerId,
            state: data.state
          });
        }
      }
    } catch (e) {
      console.error('Error processing message:', e);
    }
  });
  
  // Handle disconnections
  ws.on('close', () => {
    players.delete(playerId);
    console.log(`Player ${playerId} disconnected. Remaining players: ${players.size}`);
    
    // Notify everyone about the player leaving
    broadcastToAll({
      type: 'player_left',
      playerId
    });
  });
});

// Broadcast to all connected players
function broadcastToAll(data) {
  const message = JSON.stringify(data);
  players.forEach((player) => {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(message);
    }
  });
}

// Broadcast to all players except one
function broadcastToOthers(excludePlayerId, data) {
  const message = JSON.stringify(data);
  players.forEach((player, id) => {
    if (id !== excludePlayerId && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(message);
    }
  });
}

// Send regular game state updates to all players
setInterval(() => {
  // Collect all player states
  const gameState = {
    type: 'game_state',
    players: Array.from(players.entries()).map(([id, player]) => ({
      id,
      state: player.state
    }))
  };
  
  // Send to all players
  broadcastToAll(gameState);
}, 100); // 10 updates per second
*/ 