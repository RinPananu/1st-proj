import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface Player {
  id: string;
  x: number;
  y: number;
  username: string;
  color: string;
  action?: string;
  actionUntil?: number;
  isMoving?: boolean;
}

interface Zone {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

interface GameCanvasProps {
  username: string;
  color: string;
}

const ZONES: Zone[] = [
  { name: 'Spawn Plaza', x: 300, y: 200, w: 200, h: 200, color: '#e0e0e0' },
  { name: 'Green Park', x: 50, y: 50, w: 200, h: 150, color: '#d4edda' },
  { name: 'Rest Area', x: 550, y: 400, w: 200, h: 150, color: '#fff3cd' }
];

const GameCanvas: React.FC<GameCanvasProps> = ({ username, color }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const [, setPlayers] = useState<Map<string, Player>>(new Map());
  const playersRef = useRef<Map<string, Player>>(new Map());
  const [messages, setMessages] = useState<{username: string, message: string}[]>([]);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    socketRef.current = io('http://localhost:3001');
    const socket = socketRef.current;

    socket.emit('join', { username, color });

    socket.on('currentPlayers', (playerList: Player[]) => {
      const newPlayers = new Map();
      playerList.forEach(p => newPlayers.set(p.id, p));
      playersRef.current = newPlayers;
      setPlayers(new Map(newPlayers));
    });

    socket.on('newPlayer', (player: Player) => {
      playersRef.current.set(player.id, player);
      setPlayers(new Map(playersRef.current));
    });

    socket.on('playerMoved', (player: Player) => {
      const existing = playersRef.current.get(player.id);
      playersRef.current.set(player.id, { ...existing, ...player, isMoving: true });
      setPlayers(new Map(playersRef.current));
      
      // Reset isMoving after a short delay if no more moves come in
      setTimeout(() => {
        const p = playersRef.current.get(player.id);
        if (p && p.x === player.x && p.y === player.y) {
          playersRef.current.set(player.id, { ...p, isMoving: false });
        }
      }, 100);
    });

    socket.on('playerEmote', (data: { id: string, action: string }) => {
      const p = playersRef.current.get(data.id);
      if (p) {
        playersRef.current.set(data.id, { 
          ...p, 
          action: data.action, 
          actionUntil: Date.now() + 2000 
        });
        setPlayers(new Map(playersRef.current));
      }
    });

    socket.on('playerDisconnected', (id: string) => {
      playersRef.current.delete(id);
      setPlayers(new Map(playersRef.current));
    });

    socket.on('chatMessage', (data: { username: string, message: string }) => {
      setMessages(prev => [...prev.slice(-10), data]);
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't move if typing in chat
      if (document.activeElement?.tagName === 'INPUT') return;

      const socketId = socketRef.current?.id;
      if (!socketId) return;

      const me = playersRef.current.get(socketId);
      if (!me) return;

      // Handle Emotes
      if (e.key === '1') {
        socket.emit('emote', 'wave');
        playersRef.current.set(socketId, { ...me, action: 'wave', actionUntil: Date.now() + 2000 });
        setPlayers(new Map(playersRef.current));
        return;
      }
      if (e.key === '2') {
        socket.emit('emote', 'jump');
        playersRef.current.set(socketId, { ...me, action: 'jump', actionUntil: Date.now() + 1000 });
        setPlayers(new Map(playersRef.current));
        return;
      }

      // Handle Movement
      let { x, y } = me;
      const speed = 10;
      let moved = false;

      if (e.key === 'ArrowUp' || e.key === 'w') { y -= speed; moved = true; }
      if (e.key === 'ArrowDown' || e.key === 's') { y += speed; moved = true; }
      if (e.key === 'ArrowLeft' || e.key === 'a') { x -= speed; moved = true; }
      if (e.key === 'ArrowRight' || e.key === 'd') { x += speed; moved = true; }

      x = Math.max(0, Math.min(800, x));
      y = Math.max(0, Math.min(600, y));

      if (moved) {
        socket.emit('move', { x, y });
        playersRef.current.set(socketId, { ...me, x, y, isMoving: true });
        setPlayers(new Map(playersRef.current));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const socketId = socketRef.current?.id;
      if (!socketId) return;
      const me = playersRef.current.get(socketId);
      if (me && ['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
        playersRef.current.set(socketId, { ...me, isMoving: false });
        setPlayers(new Map(playersRef.current));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      socket.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [username, color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const drawStickMan = (player: Player, time: number) => {
      const { x, y, username, color, action, actionUntil, isMoving } = player;
      const isActionActive = actionUntil && actionUntil > Date.now();
      
      let renderY = y;
      if (isActionActive && action === 'jump') {
        renderY -= Math.abs(Math.sin(time / 100) * 20);
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      // Head
      ctx.arc(x, renderY - 30, 10, 0, Math.PI * 2);
      
      // Body
      ctx.moveTo(x, renderY - 20);
      ctx.lineTo(x, renderY + 10);
      
      // Arms
      if (isActionActive && action === 'wave') {
        // One arm waving
        ctx.moveTo(x, renderY - 10);
        ctx.lineTo(x - 15, renderY - 10);
        ctx.moveTo(x, renderY - 10);
        const waveAngle = Math.sin(time / 100) * 0.5 - 0.5;
        ctx.lineTo(x + 15 * Math.cos(waveAngle), renderY - 10 + 15 * Math.sin(waveAngle));
      } else {
        ctx.moveTo(x - 15, renderY - 10);
        ctx.lineTo(x + 15, renderY - 10);
      }
      
      // Legs (Animation)
      const legOffset = isMoving ? Math.sin(time / 50) * 10 : 0;
      ctx.moveTo(x, renderY + 10);
      ctx.lineTo(x - 10 - legOffset, renderY + 30);
      ctx.moveTo(x, renderY + 10);
      ctx.lineTo(x + 10 + legOffset, renderY + 30);
      
      ctx.stroke();

      // Name
      ctx.fillStyle = 'black';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(username, x, renderY - 45);

      // Action Label
      if (isActionActive) {
        ctx.fillStyle = '#666';
        ctx.font = 'italic 10px Arial';
        ctx.fillText(`*${action}*`, x, renderY - 60);
      }
    };

    const render = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw Zones
      ZONES.forEach(zone => {
        ctx.fillStyle = zone.color;
        ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(zone.name, zone.x + zone.w/2, zone.y + 20);
      });

      // Draw Grid
      ctx.strokeStyle = '#eee';
      ctx.lineWidth = 1;
      for(let i=0; i<canvas.width; i+=50) {
        ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i, canvas.height); ctx.stroke();
      }
      for(let i=0; i<canvas.height; i+=50) {
        ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width, i); ctx.stroke();
      }

      playersRef.current.forEach((player) => {
        drawStickMan(player, time);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim() && socketRef.current) {
      socketRef.current.emit('chat', chatInput);
      setChatInput('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '20px' }}>
      <div style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          style={{ border: '2px solid #333', backgroundColor: 'white', cursor: 'crosshair', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
        />
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          width: '250px',
          height: '150px',
          backgroundColor: 'rgba(255,255,255,0.9)',
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '5px',
          overflowY: 'auto',
          fontSize: '12px',
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'auto'
        }}>
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '5px' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: '2px' }}>
                <span style={{ color: '#007bff', fontWeight: 'bold' }}>{m.username}:</span> {m.message}
              </div>
            ))}
          </div>
          <form onSubmit={sendChat} style={{ display: 'flex' }}>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Press Enter to chat..."
              style={{ flex: 1, border: '1px solid #ccc', padding: '4px', borderRadius: '2px' }}
            />
          </form>
        </div>
      </div>
      <div style={{ fontSize: '14px', color: '#555', backgroundColor: '#f9f9f9', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
        <strong>Controls:</strong> <span style={{marginRight: '15px'}}>WASD to Move</span> 
        <span style={{marginRight: '15px'}}><strong>1</strong> to Wave</span> 
        <span><strong>2</strong> to Jump</span>
      </div>
    </div>
  );
};

export default GameCanvas;
