import { useState, useEffect } from 'react'
import GameCanvas from './components/GameCanvas'
import './App.css'

function App() {
  const [joined, setJoined] = useState(false);
  const [username, setUsername] = useState(localStorage.getItem('stickman_username') || '');
  const [color, setColor] = useState(localStorage.getItem('stickman_color') || '#' + Math.floor(Math.random()*16777215).toString(16));

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      localStorage.setItem('stickman_username', username);
      localStorage.setItem('stickman_color', color);
      setJoined(true);
    }
  };

  if (!joined) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#f0f0f0',
        fontFamily: 'Arial, sans-serif'
      }}>
        <h1>Stick-Man Community</h1>
        <form onSubmit={handleJoin} style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '15px',
          padding: '20px',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Username:</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              required
              style={{ padding: '8px', width: '200px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Pick a Color:</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ width: '100%', height: '40px', padding: '0', border: 'none', cursor: 'pointer' }}
            />
          </div>
          <button type="submit" style={{
            padding: '10px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          }}>
            Join Game
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="App" style={{ textAlign: 'center' }}>
      <h1>Stick-Man Community</h1>
      <p>Welcome, {username}!</p>
      <GameCanvas username={username} color={color} />
      <button 
        onClick={() => setJoined(false)}
        style={{ marginTop: '20px', padding: '5px 10px', cursor: 'pointer' }}
      >
        Leave Game
      </button>
    </div>
  )
}

export default App
