import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LoadingScreen = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [logs, setLogs] = useState([]);

  const messages = [
    "> Initializing Neural Core...",
    "> Booting Retro-OS v8.4.2...",
    "> Syncing Pixel Matrix...",
    "> System Check: OPTIMAL",
    "> Connection Established."
  ];

  useEffect(() => {
    let currentLog = 0;
    const logInterval = setInterval(() => {
      if (currentLog < messages.length) {
        setLogs(prev => [...prev, messages[currentLog]]);
        currentLog++;
      }
    }, 600);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setIsReady(true);
          return 100;
        }
        return prev + 0.5;
      });
    }, 20);

    return () => {
      clearInterval(logInterval);
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] bg-[#0a0a0f] flex flex-col items-center justify-center p-8 overflow-hidden"
    >
      {/* Background Starfield */}
      <div className="absolute inset-0 z-0 opacity-30">
        {[...Array(50)].map((_, i) => (
          <div 
            key={i} 
            className="absolute bg-white rounded-full"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: `${Math.random() * 2}px`,
              height: `${Math.random() * 2}px`,
              opacity: Math.random(),
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* Logo in Loading */}
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.8, 1, 0.8]
          }}
          transition={{ duration: 2, repeat: Infinity }}
          className="mb-12"
        >
          <img 
            src="/tv-screen.png" 
            alt="Logo" 
            style={{ 
              width: '180px', 
              height: 'auto', 
              borderRadius: '16px',
              boxShadow: '0 0 30px rgba(123, 97, 255, 0.3)' 
            }} 
          />
        </motion.div>

        <AnimatePresence mode="wait">
          {!isReady ? (
            <motion.div 
              key="loading-ui"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
              style={{ width: '256px' }}
            >
              <div className="font-mono" style={{ color: '#7b61ff', fontSize: '10px', marginBottom: '16px', height: '96px', overflow: 'hidden' }}>
                {logs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
              
              <div className="relative mb-2" style={{ width: '100%', height: '4px', backgroundColor: '#1a1a25' }}>
                <div 
                  className="h-full"
                  style={{ 
                    width: `${progress}%`, 
                    backgroundColor: '#7b61ff',
                    boxShadow: '0 0 10px #7b61ff',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
              <div className="font-mono" style={{ color: '#888888', fontSize: '10px', width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                <span>PREPARING...</span>
                <span>{Math.floor(progress)}%</span>
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="enter-btn"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.1, boxShadow: '0 0 40px #7b61ff' }}
              onClick={onComplete}
              className="uppercase font-bold rounded-sm relative overflow-hidden group"
              style={{
                padding: '16px 48px',
                backgroundColor: 'transparent',
                border: '2px solid #7b61ff',
                color: '#7b61ff',
                fontSize: '18px',
                letterSpacing: '0.3em',
                cursor: 'pointer'
              }}
            >
              <span className="relative z-10">ENTER CORE</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      
      {/* Decorative corners */}
      <div className="absolute top-12 left-12 w-24 h-24 border-t-2 border-l-2 border-[#7b61ff] opacity-10"></div>
      <div className="absolute bottom-12 right-12 w-24 h-24 border-b-2 border-r-2 border-[#7b61ff] opacity-10"></div>
    </motion.div>
  );
};

export default LoadingScreen;
