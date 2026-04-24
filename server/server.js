const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

const rooms = {};

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

wss.on('connection', (ws) => {
  ws.roomId = null;
  ws.playerId = null;

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    if (msg.type === 'create') {
      const roomId = generateRoomId();
      rooms[roomId] = { players: [ws], started: false };
      ws.roomId = roomId;
      ws.playerId = 0;
      ws.send(JSON.stringify({ type: 'created', roomId, playerId: 0 }));
    }

    else if (msg.type === 'join') {
      const room = rooms[msg.roomId];
      if (!room) { ws.send(JSON.stringify({ type: 'error', message: 'ルームが見つかりません' })); return; }
      if (room.players.length >= 2) { ws.send(JSON.stringify({ type: 'error', message: 'ルームが満員です' })); return; }
      room.players.push(ws);
      ws.roomId = msg.roomId;
      ws.playerId = 1;
      ws.send(JSON.stringify({ type: 'joined', roomId: msg.roomId, playerId: 1 }));
      room.players[0].send(JSON.stringify({ type: 'start', playerId: 0 }));
      room.players[1].send(JSON.stringify({ type: 'start', playerId: 1 }));
      room.started = true;
    }

    else if (msg.type === 'state') {
      const room = rooms[ws.roomId];
      if (!room) return;
      room.players.forEach(p => {
        if (p !== ws && p.readyState === WebSocket.OPEN) {
          p.send(JSON.stringify({ type: 'state', playerId: ws.playerId, data: msg.data }));
        }
      });
    }

    // 攻撃ヒット → 相手に吹き飛びベクトルを送信
    else if (msg.type === 'hit') {
      const room = rooms[ws.roomId];
      if (!room) return;
      room.players.forEach(p => {
        if (p !== ws && p.readyState === WebSocket.OPEN) {
          p.send(JSON.stringify({ type: 'hit', vx: msg.vx, vy: msg.vy }));
        }
      });
    }
  });

  ws.on('close', () => {
    const room = rooms[ws.roomId];
    if (!room) return;
    room.players.forEach(p => {
      if (p !== ws && p.readyState === WebSocket.OPEN) {
        p.send(JSON.stringify({ type: 'opponent_left' }));
      }
    });
    delete rooms[ws.roomId];
  });
});

console.log(`WebSocketサーバー起動中: port ${PORT}`);
