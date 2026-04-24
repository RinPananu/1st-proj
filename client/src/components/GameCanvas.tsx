import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface Player {
  id: string;
  x: number;
  y: number;
  username: string;
  color: string;
  hat: string;
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
  hat: string;
}

const ZONES: Zone[] = [
  { name: 'Spawn Plaza', x: 300, y: 200, w: 200, h: 200, color: '#e0e0e0' },
  { name: 'Green Park', x: 50, y: 50, w: 200, h: 150, color: '#d4edda' },
  { name: 'Rest Area', x: 550, y: 400, w: 200, h: 150, color: '#fff3cd' }
];

const PIXEL_SCALE = 2;

const GameCanvas: React.FC<GameCanvasProps> = ({ username, color, hat }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [, setPlayers] = useState<Map<string, Player>>(new Map());
  const playersRef = useRef<Map<string, Player>>(new Map());
  const [messages, setMessages] = useState<{username: string, message: string}[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Sound Synthesizer
  const playTone = (freq: number, type: OscillatorType, duration: number, volume: number = 0.1) => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  };

  const playJumpSound = () => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  };

  useEffect(() => {
    socketRef.current = io('http://localhost:3001');
    const socket = socketRef.current;

    socket.emit('join', { username, color, hat });

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
      
      // Step sound logic for local player
      if (player.id === socket.id) {
          if (Math.random() > 0.8) playTone(100, 'square', 0.05, 0.02);
      }

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
        if (data.action === 'jump') playJumpSound();
        if (data.action === 'wave') playTone(440, 'sine', 0.1);
      }
    });

    socket.on('playerDisconnected', (id: string) => {
      playersRef.current.delete(id);
      setPlayers(new Map(playersRef.current));
    });

    socket.on('chatMessage', (data: { username: string, message: string }) => {
      setMessages(prev => [...prev.slice(-10), data]);
      playTone(880, 'sine', 0.05);
      setTimeout(() => playTone(1320, 'sine', 0.05), 50);
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      if (document.activeElement?.tagName === 'INPUT') return;

      const socketId = socketRef.current?.id;
      if (!socketId) return;

      const me = playersRef.current.get(socketId);
      if (!me) return;

      if (e.key === '1') {
        socket.emit('emote', 'wave');
        playersRef.current.set(socketId, { ...me, action: 'wave', actionUntil: Date.now() + 2000 });
        setPlayers(new Map(playersRef.current));
        playTone(440, 'sine', 0.1);
        return;
      }
      if (e.key === '2') {
        socket.emit('emote', 'jump');
        playersRef.current.set(socketId, { ...me, action: 'jump', actionUntil: Date.now() + 1000 });
        setPlayers(new Map(playersRef.current));
        playJumpSound();
        return;
      }

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
  }, [username, color, hat]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const snap = (v: number) => Math.floor(v / PIXEL_SCALE) * PIXEL_SCALE;

    const drawPixelRect = (x: number, y: number, w: number, h: number, color: string) => {
        ctx.fillStyle = color;
        ctx.fillRect(snap(x), snap(y), snap(w), snap(h));
    };

    const drawTree = (x: number, y: number) => {
        // Pixel Trunk
        drawPixelRect(x - 4, y, 8, 24, '#5d4037');
        // Pixel Leaves (Blocky)
        drawPixelRect(x - 20, y - 10, 40, 10, '#2e7d32');
        drawPixelRect(x - 24, y - 24, 48, 14, '#2e7d32');
        drawPixelRect(x - 16, y - 36, 32, 12, '#388e3c');
        drawPixelRect(x - 8, y - 44, 16, 8, '#4caf50');
    };

    const drawBench = (x: number, y: number) => {
        // Blocky Legs
        drawPixelRect(x, y + 10, 4, 10, '#5d4037');
        drawPixelRect(x + 36, y + 10, 4, 10, '#5d4037');
        // Blocky Seat
        drawPixelRect(x, y, 40, 10, '#8d6e63');
        // Blocky Backrest
        drawPixelRect(x, y - 10, 40, 10, '#795548');
    };

    const drawFountain = (x: number, y: number, time: number) => {
        // Blocky Tiers
        drawPixelRect(x - 40, y, 80, 10, '#90a4ae');
        drawPixelRect(x - 25, y - 10, 50, 10, '#b0bec5');
        drawPixelRect(x - 10, y - 20, 20, 10, '#cfd8dc');
        
        // Water Spout
        drawPixelRect(x - 2, y - 40, 4, 20, '#4fc3f7');

        // Pixelated Water Arcs (Step-based)
        const frame = Math.floor(time / 200) % 3;
        const arcY = frame * 2;
        drawPixelRect(x - 20, y - 25 + arcY, 4, 4, '#e1f5fe');
        drawPixelRect(x + 16, y - 25 + arcY, 4, 4, '#e1f5fe');
        drawPixelRect(x - 30, y - 10 + arcY, 4, 4, '#e1f5fe');
        drawPixelRect(x + 26, y - 10 + arcY, 4, 4, '#e1f5fe');
    };

    const drawStickMan = (player: Player, time: number) => {
      const { x, y, username, color, action, actionUntil, isMoving, hat: playerHat } = player;
      const isActionActive = actionUntil && actionUntil > Date.now();
      
      let renderY = snap(y);
      let renderX = snap(x);

      if (isActionActive && action === 'jump') {
        renderY -= snap(Math.abs(Math.sin(time / 100) * 20));
      }

      // 1. Pixel Head (6x6 block with shaved corners)
      drawPixelRect(renderX - 6, renderY - 36, 12, 12, color);
      // Shave corners (over-draw with background or just draw inner parts)
      // Actually easier to just draw the blocks for the head
      
      // 2. Hat (Pixelated)
      if (playerHat !== 'none') {
          if (playerHat === 'tophat') {
              drawPixelRect(renderX - 10, renderY - 40, 20, 4, '#333'); // Brim
              drawPixelRect(renderX - 6, renderY - 54, 12, 14, '#333'); // Top
          } else if (playerHat === 'baseball') {
              drawPixelRect(renderX - 6, renderY - 40, 12, 4, color); // Cap
              drawPixelRect(renderX, renderY - 40, 10, 4, color); // Bill
          } else if (playerHat === 'crown') {
              drawPixelRect(renderX - 8, renderY - 44, 16, 4, '#ffd700');
              drawPixelRect(renderX - 8, renderY - 50, 4, 6, '#ffd700');
              drawPixelRect(renderX - 2, renderY - 50, 4, 6, '#ffd700');
              drawPixelRect(renderX + 4, renderY - 50, 4, 6, '#ffd700');
          } else if (playerHat === 'beanie') {
              drawPixelRect(renderX - 8, renderY - 40, 16, 8, color);
              drawPixelRect(renderX - 2, renderY - 44, 4, 4, '#fff'); // Pom pom
          }
      }

      // 3. Body (Thick pixel line)
      drawPixelRect(renderX - 2, renderY - 24, 4, 30, color);
      
      // 4. Arms
      if (isActionActive && action === 'wave') {
          drawPixelRect(renderX - 14, renderY - 18, 12, 4, color); // Left arm
          const waveUp = Math.sin(time / 100) > 0;
          if (waveUp) {
            drawPixelRect(renderX + 2, renderY - 28, 4, 10, color);
            drawPixelRect(renderX + 6, renderY - 32, 4, 4, color);
          } else {
            drawPixelRect(renderX + 2, renderY - 18, 12, 4, color);
          }
      } else {
          drawPixelRect(renderX - 14, renderY - 18, 28, 4, color);
      }
      
      // 5. Legs (Snappy frame animation)
      const legFrame = isMoving ? (Math.floor(time / 100) % 2) : -1;
      if (legFrame === 0) {
          // Frame 1: Spread
          drawPixelRect(renderX - 10, renderY + 6, 4, 14, color);
          drawPixelRect(renderX + 6, renderY + 6, 4, 14, color);
      } else if (legFrame === 1) {
          // Frame 2: Mid-walk
          drawPixelRect(renderX - 6, renderY + 6, 4, 14, color);
          drawPixelRect(renderX + 2, renderY + 6, 4, 14, color);
      } else {
          // Idle
          drawPixelRect(renderX - 8, renderY + 6, 4, 14, color);
          drawPixelRect(renderX + 4, renderY + 6, 4, 14, color);
      }

      // 6. Labels (Snap to grid)
      ctx.fillStyle = 'black';
      ctx.font = 'bold 12px "Courier New", monospace';
      ctx.textAlign = 'center';
      const labelY = renderY - 45 - (playerHat !== 'none' ? 15 : 0);
      ctx.fillText(username, renderX, snap(labelY));
      if (isActionActive) {
        ctx.fillStyle = '#666';
        ctx.font = 'italic 10px "Courier New", monospace';
        ctx.fillText(`*${action}*`, renderX, snap(labelY - 15));
      }
    };

    const render = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw Zones (Pixelated edges)
      ZONES.forEach(zone => {
        ctx.fillStyle = zone.color;
        ctx.fillRect(snap(zone.x), snap(zone.y), snap(zone.w), snap(zone.h));
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.font = 'bold 14px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(zone.name, snap(zone.x + zone.w/2), snap(zone.y + 20));
      });

      // Environment Objects
      drawFountain(400, 300, time);
      drawTree(100, 100); drawTree(200, 80); drawTree(70, 140);
      drawBench(580, 480); drawBench(650, 430);

      // Pixel Grid (Subtle)
      ctx.strokeStyle = '#f5f5f5';
      ctx.lineWidth = 1;
      for(let i=0; i<canvas.width; i+=snap(40)) {
        ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i, canvas.height); ctx.stroke();
      }
      for(let i=0; i<canvas.height; i+=snap(40)) {
        ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width, i); ctx.stroke();
      }

      playersRef.current.forEach((player) => drawStickMan(player, time));
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
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
        <canvas ref={canvasRef} width={800} height={600} style={{ border: '4px solid #333', backgroundColor: 'white', imageRendering: 'pixelated', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }} />
        <div style={{ position: 'absolute', bottom: '10px', left: '10px', width: '250px', height: '150px', backgroundColor: 'rgba(255,255,255,0.9)', border: '2px solid #333', borderRadius: '0px', padding: '5px', overflowY: 'auto', fontSize: '12px', display: 'flex', flexDirection: 'column', fontFamily: '"Courier New", monospace' }}>
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '5px' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: '2px' }}><span style={{ color: '#007bff', fontWeight: 'bold' }}>{m.username}:</span> {m.message}</div>
            ))}
          </div>
          <form onSubmit={sendChat} style={{ display: 'flex' }}>
            <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type and Enter..." style={{ flex: 1, border: '1px solid #333', padding: '4px', borderRadius: '0px', fontFamily: '"Courier New", monospace' }} />
          </form>
        </div>
      </div>
      <div style={{ fontSize: '14px', color: '#333', backgroundColor: '#eee', padding: '10px', border: '2px solid #333', fontFamily: '"Courier New", monospace' }}>
        <strong>PIXEL CONTROLS:</strong> <span style={{marginRight: '15px'}}>WASD to Move</span> <span style={{marginRight: '15px'}}>1: Wave</span> <span>2: Jump</span>
        <br/><small>(Click to enable 8-bit Sound!)</small>
      </div>
    </div>
  );
};

export default GameCanvas;
