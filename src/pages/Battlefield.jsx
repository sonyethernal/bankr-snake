import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

// ── Audio Engine ───────────────────────────────────────
let _ac = null;
function getAC() {
  if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
  return _ac;
}
function beep(freq, type, dur, vol, delay = 0) {
  try {
    const ac = getAC();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, ac.currentTime + delay);
    g.gain.setValueAtTime(0, ac.currentTime + delay);
    g.gain.linearRampToValueAtTime(vol || 0.15, ac.currentTime + delay + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + dur);
    o.start(ac.currentTime + delay);
    o.stop(ac.currentTime + delay + dur);
  } catch(_) {}
}
function sfxStep() { beep(520, 'sine', 0.07, 0.12); }
function sfxDice() {
  [0, 0.06, 0.12, 0.18, 0.24, 0.30].forEach((d, i) =>
    beep(300 + Math.random() * 400, 'square', 0.05, 0.08, d)
  );
}
function sfxSnake() {
  // Descending scary tone
  try {
    const ac = getAC();
    const o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(600, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 0.8);
    g.gain.setValueAtTime(0.2, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.8);
    o.start(); o.stop(ac.currentTime + 0.8);
  } catch(_) {}
}
function sfxLadder() {
  // Ascending happy tones
  const notes = [440, 550, 660, 880];
  notes.forEach((n, i) => beep(n, 'triangle', 0.12, 0.15, i * 0.1));
}
function sfxWin() {
  const melody = [523, 659, 784, 1047];
  melody.forEach((n, i) => beep(n, 'triangle', 0.2, 0.25, i * 0.15));
  setTimeout(() => melody.forEach((n, i) => beep(n * 1.5, 'sine', 0.15, 0.2, i * 0.1)), 800);
}
function sfxOver() { beep(200, 'sawtooth', 0.4, 0.2); }
function sfxTuk() {
  // Wooden knock / tuk sound for each ladder step
  try {
    const ac = getAC();
    // Knock thump (low)
    const o1 = ac.createOscillator(), g1 = ac.createGain();
    o1.connect(g1); g1.connect(ac.destination);
    o1.type = 'triangle';
    o1.frequency.setValueAtTime(280, ac.currentTime);
    o1.frequency.exponentialRampToValueAtTime(120, ac.currentTime + 0.06);
    g1.gain.setValueAtTime(0.25, ac.currentTime);
    g1.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.07);
    o1.start(); o1.stop(ac.currentTime + 0.07);
    // Click transient (high)
    const o2 = ac.createOscillator(), g2 = ac.createGain();
    o2.connect(g2); g2.connect(ac.destination);
    o2.type = 'square';
    o2.frequency.setValueAtTime(800, ac.currentTime);
    g2.gain.setValueAtTime(0.06, ac.currentTime);
    g2.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.025);
    o2.start(); o2.stop(ac.currentTime + 0.025);
  } catch(_) {}
}

// ── Board Config ───────────────────────────────────────
// Snake and Ladder positions matching the user's board image exactly
const SNAKES  = {
  99:21,  // long green snake top
  95:75,  // orange snake
  93:73,  // green snake top right
  89:67,  // blue snake
  82:60,  // green snake
  76:37,  // orange snake
  73:15,  // purple snake (very long)
  64:60,  // teal short snake
  62:19,  // purple long snake
  54:34,  // multicolor snake
  49:11,  // yellow snake
  46:25,  // red-orange snake
  17:7,   // small green snake
};
const LADDERS = {
  4:14,   // small ladder
  9:31,   // ladder
  20:38,  // ladder
  28:84,  // very tall center ladder
  40:59,  // ladder
  51:67,  // ladder
  63:81,  // ladder
  71:91,  // right side ladder
};
const CELL = 64;
const COLS = 10;
const BOARD_PX = CELL * COLS;  // 640px

// Build board squares row by row (snake pattern)
function buildBoard() {
  const rows = [];
  for (let r = 0; r < 10; r++) {
    const realRow = 9 - r;
    const row = [];
    for (let c = 0; c < 10; c++) {
      const col = (realRow % 2 === 0) ? c : 9 - c;
      row.push(realRow * 10 + col + 1);
    }
    rows.push(row);
  }
  return rows;
}
const BOARD = buildBoard();

function squareToXY(sq) {
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 10; c++)
      if (BOARD[r][c] === sq) return { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 };
  return { x: CELL / 2, y: BOARD_PX - CELL / 2 };
}

function getDiceEmoji(n) { return ['⚀','⚁','⚂','⚃','⚄','⚅'][n-1]; }

// ── Snake SVG path (wavy curve) ────────────────────────
function SnakeSVG({ from, to }) {
  const h = squareToXY(from);
  const t = squareToXY(to);
  const mx = (h.x + t.x) / 2 + 30, my = (h.y + t.y) / 2 - 30;
  const mx2 = (h.x + t.x) / 2 - 30, my2 = (h.y + t.y) / 2 + 20;
  const d = `M ${h.x} ${h.y} C ${mx} ${my}, ${mx2} ${my2}, ${t.x} ${t.y}`;
  return (
    <g>
      {/* Body shadow */}
      <path d={d} stroke="rgba(255,0,50,0.2)" strokeWidth={14} fill="none" strokeLinecap="round"/>
      {/* Body */}
      <path d={d} stroke="#cc0030" strokeWidth={9} fill="none" strokeLinecap="round"/>
      {/* Scales pattern */}
      <path d={d} stroke="#ff3366" strokeWidth={5} fill="none" strokeLinecap="round" strokeDasharray="8,6"/>
      {/* Head circle */}
      <circle cx={h.x} cy={h.y} r={9} fill="#ff1a4a" stroke="#ff6688" strokeWidth={2}/>
      {/* Eyes */}
      <circle cx={h.x - 3} cy={h.y - 2} r={2} fill="#fff"/>
      <circle cx={h.x + 3} cy={h.y - 2} r={2} fill="#fff"/>
      <circle cx={h.x - 3} cy={h.y - 2} r={1} fill="#000"/>
      <circle cx={h.x + 3} cy={h.y - 2} r={1} fill="#000"/>
      {/* Tongue */}
      <line x1={h.x} y1={h.y + 9} x2={h.x - 3} y2={h.y + 14} stroke="#ff4466" strokeWidth={1.5}/>
      <line x1={h.x} y1={h.y + 9} x2={h.x + 3} y2={h.y + 14} stroke="#ff4466" strokeWidth={1.5}/>
      {/* Tail */}
      <circle cx={t.x} cy={t.y} r={4} fill="#880020" opacity={0.8}/>
    </g>
  );
}

// ── Ladder SVG ─────────────────────────────────────────
function LadderSVG({ from, to }) {
  const b = squareToXY(from);
  const tp = squareToXY(to);
  const dx = tp.x - b.x, dy = tp.y - b.y;
  const len = Math.sqrt(dx*dx + dy*dy);
  const nx = -dy/len * 7, ny = dx/len * 7;
  const rungs = 5;
  return (
    <g opacity={0.9}>
      {/* Rails */}
      <line x1={b.x+nx} y1={b.y+ny} x2={tp.x+nx} y2={tp.y+ny} stroke="#00cc77" strokeWidth={3} strokeLinecap="round"/>
      <line x1={b.x-nx} y1={b.y-ny} x2={tp.x-nx} y2={tp.y-ny} stroke="#00cc77" strokeWidth={3} strokeLinecap="round"/>
      {/* Rungs */}
      {Array.from({length: rungs}).map((_, i) => {
        const t2 = (i+1)/(rungs+1);
        const rx = b.x + dx*t2, ry = b.y + dy*t2;
        return <line key={i} x1={rx+nx} y1={ry+ny} x2={rx-nx} y2={ry-ny} stroke="#00ffaa" strokeWidth={2.5} strokeLinecap="round"/>;
      })}
      {/* Endpoints */}
      <circle cx={b.x} cy={b.y} r={5} fill="#00ffaa" opacity={0.9}/>
      <circle cx={tp.x} cy={tp.y} r={5} fill="#00ffaa" opacity={0.9}/>
    </g>
  );
}

// ── Main ───────────────────────────────────────────────
const PixelTV = ({ scale = 1 }) => {
  const width = 320 * scale;
  const height = 280 * scale;
  
  return (
    <div className="relative flex flex-col items-center" style={{ width: `${width}px` }}>
      {/* Outer Case */}
      <div className="relative" style={{ 
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: '#E6E2D3', 
        border: `${6 * scale}px solid #000`, 
        borderRadius: `${32 * scale}px`,
        boxShadow: `0 ${12 * scale}px 0px #000`,
        overflow: 'hidden'
      }}>
        {/* Screen Area (Orange) */}
        <div className="absolute" style={{ top: `${24 * scale}px`, left: `${24 * scale}px`, right: `${90 * scale}px`, bottom: `${24 * scale}px`, backgroundColor: '#000', borderRadius: `${24 * scale}px`, border: `${4 * scale}px solid #000`, overflow: 'hidden' }}>
          <div className="w-full h-full flex flex-col items-center justify-center relative" style={{ backgroundColor: '#FF5C00' }}>
            <div className="absolute inset-0 opacity-10" style={{ background: 'repeating-linear-gradient(transparent, transparent 2px, black 2px, black 4px)' }}></div>
            
            {/* Pixel Smiley (Yellow) */}
            <div className="flex gap-4 mb-2" style={{ gap: `${16 * scale}px` }}>
              <div style={{ width: `${24 * scale}px`, height: `${24 * scale}px`, backgroundColor: '#FFD600' }} />
              <div style={{ width: `${24 * scale}px`, height: `${24 * scale}px`, backgroundColor: '#FFD600' }} />
            </div>
            {/* Smile Curve (Pixelated) */}
            <div className="flex flex-col items-center">
              <div className="flex" style={{ gap: `${4 * scale}px` }}>
                <div style={{ width: `${10 * scale}px`, height: `${10 * scale}px`, backgroundColor: '#FFD600', transform: `translateY(${4 * scale}px)` }} />
                <div style={{ width: `${10 * scale}px`, height: `${10 * scale}px`, backgroundColor: '#FFD600', transform: `translateY(${10 * scale}px)` }} />
                <div style={{ width: `${10 * scale}px`, height: `${10 * scale}px`, backgroundColor: '#FFD600', transform: `translateY(${10 * scale}px)` }} />
                <div style={{ width: `${10 * scale}px`, height: `${10 * scale}px`, backgroundColor: '#FFD600', transform: `translateY(${10 * scale}px)` }} />
                <div style={{ width: `${10 * scale}px`, height: `${10 * scale}px`, backgroundColor: '#FFD600', transform: `translateY(${10 * scale}px)` }} />
                <div style={{ width: `${10 * scale}px`, height: `${10 * scale}px`, backgroundColor: '#FFD600', transform: `translateY(${4 * scale}px)` }} />
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Side Panel */}
        <div className="absolute flex flex-col items-center" style={{ top: '0', right: '0', bottom: '0', width: `${90 * scale}px`, paddingTop: `${20 * scale}px` }}>
          {/* Vents */}
          <div className="flex flex-col gap-2 mb-6" style={{ gap: `${6 * scale}px` }}>
            <div style={{ width: `${40 * scale}px`, height: `${6 * scale}px`, backgroundColor: '#000', borderRadius: `${4 * scale}px` }} />
            <div style={{ width: `${40 * scale}px`, height: `${6 * scale}px`, backgroundColor: '#000', borderRadius: `${4 * scale}px` }} />
          </div>
          {/* Sliders */}
          <div className="flex" style={{ gap: `${12 * scale}px` }}>
            <div className="relative" style={{ width: `${6 * scale}px`, height: `${80 * scale}px`, backgroundColor: '#000', borderRadius: `${3 * scale}px` }}>
              <div style={{ position: 'absolute', top: `${20 * scale}px`, left: `${-10 * scale}px`, width: `${26 * scale}px`, height: `${8 * scale}px`, backgroundColor: '#000', borderRadius: `${2 * scale}px` }} />
            </div>
            <div className="relative" style={{ width: `${6 * scale}px`, height: `${80 * scale}px`, backgroundColor: '#000', borderRadius: `${3 * scale}px` }}>
              <div style={{ position: 'absolute', top: `${50 * scale}px`, left: `${-10 * scale}px`, width: `${26 * scale}px`, height: `${8 * scale}px`, backgroundColor: '#000', borderRadius: `${2 * scale}px` }} />
            </div>
          </div>
        </div>

        {/* Thick Black Bottom Border/Panel */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center px-6" style={{ backgroundColor: '#000', height: `${10 * scale}px` }}>
          <div style={{ width: `${30 * scale}px`, height: `${6 * scale}px`, backgroundColor: '#E6E2D3', borderRadius: `${3 * scale}px`, opacity: 0.3 }} />
        </div>
      </div>
    </div>
  );
};

export default function UlarTangga() {
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const [gameState, setGameState] = useState('menu'); // 'menu' | 'waiting' | 'playing' | 'disconnected'
  const [roomId, setRoomId] = useState(null);
  const [playerRole, setPlayerRole] = useState(null); // 0 (P1) or 1 (P2)
  const [pos, setPos] = useState([0, 0]);
  const [displayPos, setDisplayPos] = useState([0, 0]); // animated position
  const [turn, setTurn] = useState(0);
  const [dice, setDice] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [isSliding, setIsSliding] = useState(false);
  const [showingResult, setShowingResult] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10);
  const [msg, setMsg] = useState('Player 1 — Roll Dice!');
  const [winner, setWinner] = useState(null);
  const [log, setLog] = useState([]);
  const [highlight, setHighlight] = useState(null); // square being stepped on
  const [isMuted, setIsMuted] = useState(true);
  const animRef = useRef(null);

  // ── BGM Engine ───────────────────────────────────────
  useEffect(() => {
    if (isMuted) return;
    // Simple retro lo-fi loop
    const melody = [261.63, 329.63, 392.00, 440.00, 349.23, 440.00, 392.00, 329.63];
    let step = 0;
    const interval = setInterval(() => {
      const freq = melody[step % melody.length];
      // Gentle sine pulse
      beep(freq, 'sine', 0.5, 0.015);
      // Soft bass every 2 beats
      if (step % 2 === 0) {
        beep(freq / 2, 'triangle', 0.8, 0.01);
      }
      step++;
    }, 500);
    return () => clearInterval(interval);
  }, [isMuted]);

  const addLog = (txt) => setLog(l => [txt, ...l].slice(0, 10));

  const turnRef = useRef(turn);
  const posRef = useRef(pos);
  const playerRoleRef = useRef(playerRole);
  const animatingRef = useRef(animating);
  const isSlidingRef = useRef(isSliding);
  const winnerRef = useRef(winner);
  const rollProcessingRef = useRef(false);

  useEffect(() => { turnRef.current = turn; }, [turn]);
  useEffect(() => { posRef.current = pos; }, [pos]);
  useEffect(() => { playerRoleRef.current = playerRole; }, [playerRole]);
  useEffect(() => { animatingRef.current = animating; }, [animating]);
  useEffect(() => { isSlidingRef.current = isSliding; }, [isSliding]);
  useEffect(() => { winnerRef.current = winner; }, [winner]);

  useEffect(() => {
    setTimeLeft(10);
  }, [turn, gameState]);

  useEffect(() => {
    if (gameState !== 'playing' || winner !== null || rolling || showingResult || animating || isSliding) return;
    if (turn !== playerRole) return; // Only count down for the current player
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // AFK KICK
          socketRef.current.disconnect();
          setGameState('afk_kicked');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [gameState, winner, rolling, showingResult, animating, isSliding, turn, playerRole]);

  useEffect(() => {
    socketRef.current = io('http://localhost:3001');

    socketRef.current.on('waiting_for_match', () => {
      setGameState('waiting');
    });

    socketRef.current.on('game_start', (data) => {
      setRoomId(data.room);
      setPlayerRole(data.playerIndex);
      // Reset game state for new match
      setPos([0,0]); setDisplayPos([0,0]); setTurn(0); setDice(1); setWinner(null); setLog([]);
      setGameState('playing');
      setMsg(data.playerIndex === 0 ? 'Your turn! Roll Dice!' : 'Waiting for P1 to roll...');
    });

    socketRef.current.on('roll_result', (data) => {
      applyDiceRoll(data.dice);
    });

    socketRef.current.on('opponent_disconnected', () => {
      setGameState('disconnected');
    });

    return () => {
      socketRef.current.disconnect();
      clearTimeout(animRef.current);
    };
  }, []);

  function findMatch() {
    setIsMuted(false);
    getAC().resume();
    if (socketRef.current && !socketRef.current.connected) {
      socketRef.current.connect();
    }
    socketRef.current.emit('find_match');
    setGameState('waiting');
  }

  function cancelSearch() {
    socketRef.current.emit('cancel_search');
    setGameState('menu');
  }

  function handleBack() {
    if (gameState === 'playing' || gameState === 'waiting') {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current.connect();
      }
    }
    setGameState('menu');
  }

  // Animate piece moving step by step
  const animateMove = useCallback((player, startSq, steps, onDone) => {
    let current = startSq;
    let step = 0;

    const moveOne = () => {
      if (step >= steps) {
        onDone(current);
        return;
      }
      current = Math.min(current + 1, 100);
      step++;
      setDisplayPos(prev => {
        const next = [...prev];
        next[player] = current;
        return next;
      });
      sfxStep();
      setHighlight(current);
      setTimeout(() => setHighlight(null), 320);
      animRef.current = setTimeout(moveOne, 480);
    };
    animRef.current = setTimeout(moveOne, 150);
  }, []);

  // Animate snake/ladder slide smoothly directly to target
  const animateSpecial = useCallback((player, from, to, type, onDone) => {
    if (type === 'snake') sfxSnake(); else sfxLadder();
    setMsg(type === 'snake'
      ? `🐍 SNAKE! Player ${player+1} drops from ${from} to ${to}!`
      : `🪜 LADDER! Player ${player+1} climbs from ${from} to ${to}!`
    );
    
    setIsSliding(true);
    // Directly set the final position to allow CSS transition to glide
    setDisplayPos(prev => { const n=[...prev]; n[player]=to; return n; });
    setHighlight(to);
    
    // Play climbing sounds if ladder
    if (type === 'ladder') {
      let count = 0;
      const t = setInterval(() => {
        sfxTuk();
        count++;
        if (count >= 4) clearInterval(t);
      }, 200);
    }

    // Wait for the 1-second CSS transition to finish
    animRef.current = setTimeout(() => {
      setIsSliding(false);
      setHighlight(null);
      onDone();
    }, 1000);
  }, []);

  function rollDice() {
    if (rolling || showingResult || animating || isSliding || winner || turn !== playerRole) return;
    setRolling(true); // Provide instant UI feedback, hiding the button
    socketRef.current.emit('roll_request', roomId);
  }

  function applyDiceRoll(finalDice) {
    if (rollProcessingRef.current || animatingRef.current || isSlidingRef.current || winnerRef.current !== null) return;
    rollProcessingRef.current = true;
    setRolling(true);
    sfxDice();
    let count = 0;
    const interval = setInterval(() => {
      setDice(Math.ceil(Math.random()*6));
      count++;
      if (count >= 12) {
        clearInterval(interval);
        setDice(finalDice);
        setRolling(false);
        setShowingResult(true);

        setTimeout(() => {
          setShowingResult(false);
          setAnimating(true); // Begin full animation sequence
          rollProcessingRef.current = false;

          const currentTurn = turnRef.current;
        const curPos = posRef.current[currentTurn];
        const newRaw = curPos + finalDice;

        if (newRaw > 100) {
          setMsg(`Player ${currentTurn+1} needs ${100-curPos} but rolled ${finalDice}. Stay!`);
          addLog(`P${currentTurn+1}: ${curPos} +${finalDice} → over! Stays at ${curPos}`);
          setTimeout(() => {
            setAnimating(false);
            const nextTurn = 1 - currentTurn;
            setTurn(nextTurn);
            setMsg(playerRoleRef.current === nextTurn ? 'Your turn! Roll Dice!' : `Waiting for Player ${nextTurn+1}...`);
          }, 1200);
          return;
        }

        setMsg(`Player ${currentTurn+1} rolled ${finalDice}...`);
        addLog(`P${currentTurn+1}: ${curPos||'Start'} +${finalDice} → ${newRaw}`);

        // Step-by-step walk animation
        animateMove(currentTurn, curPos, finalDice, (landed) => {
          // Check snake or ladder
          if (SNAKES[landed]) {
            const snakeTo = SNAKES[landed];
            animateSpecial(currentTurn, landed, snakeTo, 'snake', () => {
              setPos(prev => { const n=[...prev]; n[currentTurn]=snakeTo; return n; });
              addLog(`  🐍 ${landed}→${snakeTo}`);
              if (snakeTo === 100) { setAnimating(false); setWinner(currentTurn); return; }
              setTimeout(() => {
                setAnimating(false);
                const nextTurn = 1 - currentTurn;
                setTurn(nextTurn);
                setMsg(playerRoleRef.current === nextTurn ? 'Your turn! Roll Dice!' : `Waiting for Player ${nextTurn+1}...`);
              }, 800);
            });
          } else if (LADDERS[landed]) {
            const ladderTo = LADDERS[landed];
            animateSpecial(currentTurn, landed, ladderTo, 'ladder', () => {
              setPos(prev => { const n=[...prev]; n[currentTurn]=ladderTo; return n; });
              addLog(`  🪜 ${landed}→${ladderTo}`);
              if (ladderTo === 100) { setAnimating(false); sfxWin(); setWinner(currentTurn); setMsg(`🏆 Player ${currentTurn+1} WINS!`); return; }
              setTimeout(() => {
                setAnimating(false);
                const nextTurn = 1 - currentTurn;
                setTurn(nextTurn);
                setMsg(playerRoleRef.current === nextTurn ? 'Your turn! Roll Dice!' : `Waiting for Player ${nextTurn+1}...`);
              }, 800);
            });
          } else {
            setPos(prev => { const n=[...prev]; n[currentTurn]=landed; return n; });
            if (landed === 100) { setAnimating(false); sfxWin(); setWinner(currentTurn); setMsg(`🏆 Player ${currentTurn+1} WINS!`); return; }
            setMsg(`Player ${currentTurn+1} is on square ${landed}. Player ${1-currentTurn===0?1:2}'s turn!`);
            setTimeout(() => {
              setAnimating(false);
              const nextTurn = 1 - currentTurn;
              setTurn(nextTurn);
              setMsg(playerRoleRef.current === nextTurn ? 'Your turn! Roll Dice!' : `Waiting for Player ${nextTurn+1}...`);
            }, 600);
          }
        });
        }, 1200); // Close the 1.2s delay timeout
      }
    }, 75);
  }

  function reset() {
    clearTimeout(animRef.current);
    setPos([0,0]); setDisplayPos([0,0]);
    setTurn(0); setDice(1); setWinner(null);
    setLog([]); setRolling(false); setAnimating(false); setHighlight(null); setIsSliding(false); setShowingResult(false);
    rollProcessingRef.current = false;
    setMsg('Player 1 — Roll Dice!');
  }

  // Removed empty useEffect array since it's now handled by the big socket useEffect

  const p1xy = displayPos[0] > 0 ? squareToXY(displayPos[0]) : null;
  const p2xy = displayPos[1] > 0 ? squareToXY(displayPos[1]) : null;

  if (gameState !== 'playing') {
    return (
      <div style={{ position:'fixed', inset:0, background:'#f4f4f0', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:'"Courier New",monospace', gap:32 }}>
        <div style={{ 
          color: '#000', 
          fontSize: '48px', 
          fontWeight: '900', 
          letterSpacing: '8px',
          textShadow: '4px 4px 0px #FF4911',
          zIndex: 10
        }}>
          BANKR SNAKE
        </div>
        
        <PixelTV />
        
        {gameState === 'menu' && (
          <button onClick={findMatch} style={{ background:'#00FF66', border:'4px solid #000', color:'#000', padding:'15px 40px', fontSize:20, fontWeight:'bold', cursor:'pointer', boxShadow:'6px 6px 0px #000', transition:'all 0.1s', textTransform:'uppercase' }}
            onMouseDown={e => { e.currentTarget.style.transform = 'translate(4px, 4px)'; e.currentTarget.style.boxShadow = '2px 2px 0px #000'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'translate(0px, 0px)'; e.currentTarget.style.boxShadow = '6px 6px 0px #000'; }}
          >
            FIND ENEMY
          </button>
        )}

        {gameState === 'menu' && (
          <a href="https://x.com/bankrsnake" target="_blank" rel="noreferrer" style={{ 
            color:'#000', 
            fontSize:14, 
            fontWeight:'900', 
            textDecoration:'none', 
            borderBottom:'4px solid #000',
            letterSpacing:2,
            transition:'all 0.1s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#FFE100'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            @BANKRSNAKE
          </a>
        )}

        {gameState === 'waiting' && (
          <div style={{ textAlign:'center' }}>
            <div style={{ color:'#000', fontSize:22, fontWeight:'bold', marginBottom:20, background:'#FFE100', padding:'10px 20px', border:'4px solid #000', boxShadow:'4px 4px 0px #000' }}>SEARCHING FOR OPPONENT...</div>
            <button onClick={cancelSearch} style={{ background:'#FF4911', border:'4px solid #000', color:'#fff', padding:'10px 20px', fontSize:16, fontWeight:'bold', cursor:'pointer', boxShadow:'4px 4px 0px #000' }}>CANCEL</button>
          </div>
        )}

        {gameState === 'disconnected' && (
          <div style={{ textAlign:'center' }}>
            <div style={{ color:'#fff', background:'#FF4911', fontSize:24, fontWeight:'bold', marginBottom:20, padding:'10px 20px', border:'4px solid #000', boxShadow:'4px 4px 0px #000' }}>OPPONENT DISCONNECTED!</div>
            <button onClick={() => setGameState('menu')} style={{ background:'#3300FF', border:'4px solid #000', color:'#fff', padding:'10px 20px', fontSize:16, fontWeight:'bold', cursor:'pointer', boxShadow:'4px 4px 0px #000' }}>RETURN TO MENU</button>
          </div>
        )}

        {gameState === 'afk_kicked' && (
          <div style={{ textAlign:'center' }}>
            <div style={{ color:'#fff', background:'#FF4911', fontSize:24, fontWeight:'bold', marginBottom:20, padding:'10px 20px', border:'4px solid #000', boxShadow:'4px 4px 0px #000' }}>KICKED FOR AFK!</div>
            <button onClick={() => { setGameState('menu'); setTimeLeft(10); }} style={{ background:'#3300FF', border:'4px solid #000', color:'#fff', padding:'10px 20px', fontSize:16, fontWeight:'bold', cursor:'pointer', boxShadow:'4px 4px 0px #000' }}>RETURN TO MENU</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'#f4f4f0', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'"Courier New",monospace', overflow:'auto', padding:16 }}>
      <style>{`
        @keyframes diceShake {
          0% { transform: rotate(-10deg) scale(1); }
          50% { transform: rotate(10deg) scale(1.1); }
          100% { transform: rotate(-10deg) scale(1); }
        }
      `}</style>
      <div style={{ display:'flex', gap:20, alignItems:'flex-start' }}>

        {/* ── PAPAN (full SVG) ── */}
        <div style={{ position:'relative', flexShrink:0, border:'6px solid #000', boxShadow:'10px 10px 0px #000', background:'#000', overflow:'hidden' }}>
          <svg width={BOARD_PX} height={BOARD_PX}>
            {/* Outer board bg */}
            <rect width={BOARD_PX} height={BOARD_PX} fill="#f5f0e0"/>

            {/* Colored cells */}
            {BOARD.map((row, ri) => row.map((num, ci) => {
              const palette = [
                '#FFE100', '#00FF66', '#3300FF', '#FF4911', '#FF00FF',
                '#fff', '#00CCFF', '#FF00FF', '#00FF66', '#FFE100'
              ];
              const isHl = highlight === num;
              const isFinish = num === 100;
              const isStart = num === 1;
              const colorIdx = (ri * 3 + ci * 7) % palette.length;
              const cellColor = isFinish ? '#00FF66' : isStart ? '#FFE100' : palette[colorIdx];
              const textColor = (cellColor === '#3300FF' || cellColor === '#FF4911') ? '#fff' : '#000';
              return (
                <g key={num}>
                  <rect x={ci*CELL} y={ri*CELL} width={CELL} height={CELL}
                    fill={isHl ? '#fff' : cellColor}
                    stroke="#000" strokeWidth={4}/>
                  {/* Number */}
                  <text x={ci*CELL+6} y={ri*CELL+16} fontSize={14} fontWeight="900"
                    fill={textColor} fontFamily='"Courier New",monospace'>{num}</text>
                  {/* FINISH */}
                  {isFinish && <>
                    <text x={ci*CELL+CELL/2} y={ri*CELL+CELL/2} fontSize={28}
                      textAnchor="middle" dominantBaseline="middle">🏁</text>
                    <text x={ci*CELL+CELL/2} y={ri*CELL+CELL-8} fontSize={12}
                      textAnchor="middle" fill="#000" fontWeight="900" fontFamily='"Courier New",monospace'>FINISH</text>
                  </>}
                  {/* START */}
                  {isStart && <text x={ci*CELL+CELL/2} y={ri*CELL+CELL/2+10} fontSize={20}
                    textAnchor="middle">🚀</text>}
                  {/* Highlight glow */}
                  {isHl && <rect x={ci*CELL+4} y={ri*CELL+4} width={CELL-8} height={CELL-8}
                    fill="none" stroke="#000" strokeWidth={4}/>}
                </g>
              );
            }))}

            {/* Ladders (drawn first, behind snakes) */}
            {Object.entries(LADDERS).map(([b, t]) => {
              const bt = squareToXY(Number(b)), tp = squareToXY(t);
              const dx = tp.x-bt.x, dy = tp.y-bt.y;
              const len = Math.sqrt(dx*dx+dy*dy);
              const nx=-dy/len*8, ny=dx/len*8;
              const rungs = Math.max(3, Math.round(len/40));
              return (
                <g key={`l${b}`}>
                  {/* Black outline */}
                  <line x1={bt.x+nx} y1={bt.y+ny} x2={tp.x+nx} y2={tp.y+ny} stroke="#000" strokeWidth={10} strokeLinecap="square"/>
                  <line x1={bt.x-nx} y1={bt.y-ny} x2={tp.x-nx} y2={tp.y-ny} stroke="#000" strokeWidth={10} strokeLinecap="square"/>
                  {Array.from({length:rungs}).map((_,i)=>{
                    const t2=(i+1)/(rungs+1);
                    const rx=bt.x+dx*t2, ry=bt.y+dy*t2;
                    return <line key={`ro${i}`} x1={rx+nx} y1={ry+ny} x2={rx-nx} y2={ry-ny} stroke="#000" strokeWidth={10} strokeLinecap="square"/>;
                  })}
                  {/* Inner color */}
                  <line x1={bt.x+nx} y1={bt.y+ny} x2={tp.x+nx} y2={tp.y+ny} stroke="#00FF66" strokeWidth={4} strokeLinecap="square"/>
                  <line x1={bt.x-nx} y1={bt.y-ny} x2={tp.x-nx} y2={tp.y-ny} stroke="#00FF66" strokeWidth={4} strokeLinecap="square"/>
                  {Array.from({length:rungs}).map((_,i)=>{
                    const t2=(i+1)/(rungs+1);
                    const rx=bt.x+dx*t2, ry=bt.y+dy*t2;
                    return <line key={`ri${i}`} x1={rx+nx} y1={ry+ny} x2={rx-nx} y2={ry-ny} stroke="#00FF66" strokeWidth={4} strokeLinecap="square"/>;
                  })}
                  {/* Blocks at ends */}
                  <rect x={bt.x-6} y={bt.y-6} width={12} height={12} fill="#00FF66" stroke="#000" strokeWidth={4}/>
                  <rect x={tp.x-6} y={tp.y-6} width={12} height={12} fill="#00FF66" stroke="#000" strokeWidth={4}/>
                </g>
              );
            })}

            {/* Snakes */}
            {Object.entries(SNAKES).map(([head, tail], idx) => {
              const h = squareToXY(Number(head)), t = squareToXY(tail);
              const colors = ['#FF4911','#FF00FF','#3300FF'];
              const col = colors[idx % colors.length];
              const midX = (h.x+t.x)/2 + (idx%2===0?50:-50);
              const midY = (h.y+t.y)/2 + (idx%3===0?30:-30);
              const d = `M${h.x},${h.y} Q${midX},${midY} ${t.x},${t.y}`;
              return (
                <g key={`s${head}`}>
                  {/* Body outline */}
                  <path d={d} stroke="#000" strokeWidth={16} fill="none" strokeLinecap="square"/>
                  {/* Body inner */}
                  <path d={d} stroke={col} strokeWidth={8} fill="none" strokeLinecap="square"/>
                  {/* Stripe pattern */}
                  <path d={d} stroke="#fff" strokeWidth={8} fill="none" strokeLinecap="square" strokeDasharray="15,20"/>
                  
                  {/* Blocky Head */}
                  <rect x={h.x-12} y={h.y-12} width={24} height={24} fill={col} stroke="#000" strokeWidth={4}/>
                  {/* Blocky Eyes */}
                  <rect x={h.x-6} y={h.y-6} width={4} height={4} fill="#fff" stroke="#000" strokeWidth={2}/>
                  <rect x={h.x+2} y={h.y-6} width={4} height={4} fill="#fff" stroke="#000" strokeWidth={2}/>
                  {/* Blocky Tongue */}
                  <line x1={h.x-2} y1={h.y+12} x2={h.x-6} y2={h.y+20} stroke="#000" strokeWidth={4} strokeLinecap="square"/>
                  <line x1={h.x+2} y1={h.y+12} x2={h.x+6} y2={h.y+20} stroke="#000" strokeWidth={4} strokeLinecap="square"/>
                  <line x1={h.x-2} y1={h.y+12} x2={h.x-6} y2={h.y+20} stroke="#FF4911" strokeWidth={2} strokeLinecap="square"/>
                  <line x1={h.x+2} y1={h.y+12} x2={h.x+6} y2={h.y+20} stroke="#FF4911" strokeWidth={2} strokeLinecap="square"/>
                  
                  {/* Blocky Tail tip */}
                  <rect x={t.x-6} y={t.y-6} width={12} height={12} fill={col} stroke="#000" strokeWidth={4}/>
                </g>
              );
            })}

            {/* Player 2 token */}
            {p2xy && (
              <g style={{ transform: `translate(${p2xy.x}px, ${p2xy.y}px)`, transition: isSliding ? 'transform 1s ease-in-out' : 'transform 0.3s ease-in-out' }}>
                <circle cx={13} cy={3} r={15} fill="#000"/>
                <circle cx={10} cy={0} r={14} fill="#FF4911" stroke="#000" strokeWidth={4}/>
                <text x={10} y={2} fontSize={12} fontWeight="900" fill="#fff" textAnchor="middle" dominantBaseline="middle" fontFamily="Arial">P2</text>
              </g>
            )}
            {/* Player 1 token */}
            {p1xy && (
              <g style={{ transform: `translate(${p1xy.x}px, ${p1xy.y}px)`, transition: isSliding ? 'transform 1s ease-in-out' : 'transform 0.3s ease-in-out' }}>
                <circle cx={-10} cy={0} r={14} fill="#3300FF" stroke="#000" strokeWidth={4}/>
                <text x={-10} y={2} fontSize={12} fontWeight="900" fill="#fff" textAnchor="middle" dominantBaseline="middle" fontFamily="Arial">P1</text>
              </g>
            )}
          </svg>

          {/* Vignette & Dice Overlay */}
          <div style={{
            position:'absolute', inset:0, background:'radial-gradient(circle, transparent 20%, rgba(0,0,0,0.85) 100%)',
            opacity: (rolling || showingResult) ? 1 : 0, transition:'opacity 0.3s ease', pointerEvents:'none', zIndex:10
          }} />
          <div style={{
            position:'absolute', inset:0, background:'rgba(0,0,0,0.4)',
            opacity: (rolling || showingResult) ? 1 : 0, transition:'opacity 0.3s ease', pointerEvents:'none', zIndex:11
          }} />

          {/* Center UI */}
          <div style={{
            position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none', zIndex:20
          }}>
            {/* Rolling/Result Dice */}
            {(rolling || showingResult) && (
              <div style={{ 
                fontSize:150, color:'#FFE100', textShadow:'6px 6px 0px #000', 
                animation: rolling ? 'diceShake 0.15s infinite' : 'none', 
                filter: rolling ? 'blur(1px)' : 'none',
                transform: showingResult ? 'scale(1.2)' : 'scale(1)',
                transition: 'all 0.2s ease-out'
              }}>
                {getDiceEmoji(dice)}
              </div>
            )}
            
            {/* ROLL DICE Button */}
            {!winner && turn === playerRole && !rolling && !showingResult && !animating && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:20, pointerEvents:'auto' }}>
                <button onClick={rollDice} style={{
                  background: '#00FF66', border:'6px solid #000', color: '#000',
                  fontSize:32, fontWeight:'900', letterSpacing:4, padding:'20px 40px', cursor:'pointer',
                  fontFamily:'"Courier New",monospace', boxShadow:'12px 12px 0px #000',
                  transition:'all 0.1s', textTransform:'uppercase'
                }}
                onMouseDown={e => { e.currentTarget.style.transform = 'translate(6px, 6px)'; e.currentTarget.style.boxShadow = '6px 6px 0px #000'; }}
                onMouseUp={e => { e.currentTarget.style.transform = 'translate(0px, 0px)'; e.currentTarget.style.boxShadow = '12px 12px 0px #000'; }}
                >
                  ROLL DICE
                </button>
                <div style={{ background:'#fff', border:'4px solid #000', color:'#FF4911', fontSize:24, fontWeight:'900', padding:'5px 20px', boxShadow:'6px 6px 0px #000' }}>
                  {timeLeft}s
                </div>
              </div>
            )}

            {/* WAITING status */}
            {!winner && turn !== playerRole && !rolling && !showingResult && !animating && (
              <div style={{
                background: '#fff', border:'4px dashed #000', color: '#000',
                fontSize:20, fontWeight:'900', letterSpacing:2, padding:'15px 30px',
                fontFamily:'"Courier New",monospace', boxShadow:'8px 8px 0px #000'
              }}>
                WAITING FOR P{turn+1}...
              </div>
            )}
          </div>
        </div>



        {/* ── PANEL KANAN ── */}
        <div style={{ width:240, display:'flex', flexDirection:'column', gap:16 }}>
          {/* Title Logo */}
          <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}>
            <PixelTV scale={0.7} />
          </div>

          {/* Player cards */}
          {[0,1].map(i => (
            <div key={i} style={{
              background: turn===i&&!winner ? '#FFE100' : '#fff',
              border:'4px solid #000',
              padding:'12px',
              boxShadow:'6px 6px 0px #000',
              transition:'all 0.1s',
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ color:i===0?'#3300FF':'#FF4911', fontWeight:'900', fontSize:14, letterSpacing:1 }}>P{i+1} {i===0?'(BLUE)':'(RED)'}</span>
                <span style={{ color:'#000', fontSize:12, fontWeight:'bold' }}>SQUARE: <b>{displayPos[i]||'0'}</b></span>
              </div>
              <div style={{ marginTop:10, height:6, background:'#000', border:'2px solid #000' }}>
                <div style={{ height:'100%', width:`${displayPos[i]}%`, background:i===0?'#3300FF':'#FF4911', transition:'width 0.3s' }}/>
              </div>
            </div>
          ))}


          {/* Winner */}
          {winner !== null && (
            <div style={{ background:'#FF4911', border:'4px solid #000', padding:16, textAlign:'center', boxShadow:'6px 6px 0px #000' }}>
              <div style={{ fontSize:32, marginBottom:8 }}>🏆</div>
              <div style={{ color:'#fff', fontWeight:'900', fontSize:18, letterSpacing:1 }}>PLAYER {winner+1} WINS!</div>
              <button onClick={reset} style={{ marginTop:14, background:'#3300FF', border:'4px solid #000', color:'#fff', padding:'10px 20px', cursor:'pointer', fontWeight:'bold', fontFamily:'"Courier New",monospace', fontSize:14, boxShadow:'4px 4px 0px #000' }}>
                PLAY AGAIN
              </button>
            </div>
          )}

          {/* Message */}
          <div style={{ background:'#fff', border:'4px solid #000', padding:'12px', minHeight:48, boxShadow:'4px 4px 0px #000' }}>
            <div style={{ color:'#000', fontSize:12, fontWeight:'bold', lineHeight:1.4 }}>{msg}</div>
          </div>

          {/* Legend */}
          <div style={{ background:'#fff', border:'4px solid #000', padding:'10px', boxShadow:'4px 4px 0px #000' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <div style={{ width:20, height:4, background:'#FF4911', border:'1px solid #000' }}/>
              <span style={{ color:'#000', fontSize:10, fontWeight:'bold' }}>= Snake (down)</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:20, height:4, background:'#00FF66', border:'1px solid #000' }}/>
              <span style={{ color:'#000', fontSize:10, fontWeight:'bold' }}>= Ladder (up)</span>
            </div>
          </div>

          <div style={{ display:'flex', gap:8 }}>
            <button onClick={handleBack} style={{ flex:1, background:'#fff', border:'4px solid #000', color:'#000', fontSize:12, fontWeight:'bold', letterSpacing:2, padding:'10px 0', cursor:'pointer', fontFamily:'"Courier New",monospace', boxShadow:'4px 4px 0px #000', textTransform:'uppercase' }}>
              ← BACK
            </button>
            <button onClick={() => { setIsMuted(!isMuted); getAC().resume(); }} style={{ flex:1, background:isMuted?'#f0f0f0':'#00FF66', border:'4px solid #000', color:'#000', fontSize:10, fontWeight:'900', cursor:'pointer', fontFamily:'"Courier New",monospace', boxShadow:'4px 4px 0px #000', textTransform:'uppercase' }}>
              {isMuted ? '🔇 Muted' : '🔊 Music'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
