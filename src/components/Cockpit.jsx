import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Play, Settings, Volume2 } from 'lucide-react';

const PixelTV = () => {
  return (
    <div className="relative" style={{ width: '320px', height: '320px' }}>
      <div className="absolute inset-0" style={{ backgroundColor: '#e6e2d3', border: '6px solid #1a1a1a', borderRadius: '16px', boxShadow: '0 0 50px rgba(255, 92, 0, 0.2)' }}>
        <div className="absolute" style={{ top: '24px', left: '24px', right: '72px', bottom: '64px', backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '6px', overflow: 'hidden' }}>
          <div className="w-full h-full flex items-center justify-center relative" style={{ backgroundColor: '#ff5c00', borderRadius: '4px' }}>
            <div className="absolute inset-0 opacity-20" style={{ background: 'repeating-linear-gradient(transparent, transparent 2px, black 2px, black 4px)' }}></div>
            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-8">
                <div style={{ width: '20px', height: '20px', backgroundColor: '#ffd600' }} />
                <div style={{ width: '20px', height: '20px', backgroundColor: '#ffd600' }} />
              </div>
              <div style={{ width: '80px', height: '4px', backgroundColor: '#ffd600' }} />
            </div>
          </div>
        </div>
        <div className="absolute flex flex-col justify-around items-center" style={{ top: '24px', right: '16px', bottom: '64px', width: '40px' }}>
          <div style={{ width: '6px', height: '60px', backgroundColor: '#1a1a1a', borderRadius: '10px' }} />
          <div style={{ width: '6px', height: '60px', backgroundColor: '#1a1a1a', borderRadius: '10px' }} />
        </div>
      </div>
    </div>
  );
};

const Cockpit = ({ mousePos }) => {
  const navigate = useNavigate();
  const [isWarping, setIsWarping] = useState(false);
  
  const handleStart = () => {
    setIsWarping(true);
    setTimeout(() => {
      navigate('/game');
    }, 1500); 
  };

  const x = (mousePos.x - 0.5) * 40;
  const y = (mousePos.y - 0.5) * 40;

  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none bg-[#050508]">
      
      {/* Warp Transition Overlay */}
      {isWarping && (
        <div className="fixed inset-0 z-[5000] bg-black flex items-center justify-center">
          {[...Array(120)].map((_, i) => (
            <motion.div 
              key={i}
              initial={{ scale: 0, x: 0, y: 0 }}
              animate={{ scale: [0, 1, 0], x: (Math.random() - 0.5) * 2000, y: (Math.random() - 0.5) * 2000 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "easeOut" }}
              className="absolute w-1 h-40 bg-green-400"
            />
          ))}
          <div className="text-green-400 font-mono text-2xl tracking-[1em] animate-pulse">INITIATING_DEPLOYMENT</div>
        </div>
      )}

      {/* Cockpit UI */}
      <motion.div 
        animate={{ x: x * 0.8, y: y * 0.8, rotateX: -y * 0.05, rotateY: x * 0.05 }}
        className="flex flex-col items-center gap-12"
      >

        <motion.button 
          onClick={handleStart}
          whileHover={{ scale: 1.1, boxShadow: '0 0 60px #7b61ff' }}
          whileTap={{ scale: 0.9 }}
          className="pointer-events-auto flex items-center gap-6 px-16 py-6 bg-[#7b61ff] text-white rounded-sm font-black tracking-[0.6em] transition-all cursor-pointer border-none"
          style={{ transform: 'skewX(-15deg)' }}
        >
          <div className="flex items-center gap-4" style={{ transform: 'skewX(15deg)' }}>
            <Play fill="white" size={28} />
            LAUNCH MISSION
          </div>
        </motion.button>

        <div className="font-mono text-[10px] text-[#7b61ff] tracking-[0.8em] opacity-40 animate-pulse">WARP_READY // SYSTEM_STABLE</div>
      </motion.div>

      {/* Global Vignette */}
      <div className="fixed inset-0 pointer-events-none z-[100]" style={{ boxShadow: 'inset 0 0 250px rgba(0,0,0,0.9)' }} />
    </div>
  );
};

export default Cockpit;
