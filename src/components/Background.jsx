import React from 'react';
import { motion } from 'framer-motion';

const Background = ({ mousePos = { x: 0.5, y: 0.5 } }) => {
  const x = (mousePos.x - 0.5) * 40;
  const y = (mousePos.y - 0.5) * 40;

  return (
    <div className="fixed inset-0 z-0 bg-[#0a0a0f] overflow-hidden">
      {/* Deep Space Layer */}
      <motion.div animate={{ x: x * 0.2, y: y * 0.2 }} className="absolute z-0" style={{ top: '-10%', left: '-10%', right: '-10%', bottom: '-10%' }}>
        <div className="absolute top-1/4 left-1/4 w-full h-full opacity-40 blur-[120px]" style={{ background: 'radial-gradient(circle, rgba(123, 97, 255, 0.3) 0%, transparent 70%)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-full h-full opacity-30 blur-[100px]" style={{ background: 'radial-gradient(circle, rgba(255, 92, 0, 0.2) 0%, transparent 70%)' }} />
        {[...Array(60)].map((_, i) => (
          <div key={i} className="absolute bg-white rounded-full opacity-20" style={{ top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`, width: '1px', height: '1px' }} />
        ))}
      </motion.div>

      {/* Frame Layer */}
      <motion.div animate={{ x: x * 0.5, y: y * 0.5 }} className="absolute z-10 pointer-events-none" style={{ top: '-5%', left: '-5%', right: '-5%', bottom: '-5%' }}>
        <div className="absolute top-0 left-0 right-0 opacity-30" style={{ height: '100px', background: 'linear-gradient(to bottom, #1a1a25, transparent)' }} />
        <div className="absolute bottom-0 left-0 right-0 opacity-20" style={{ height: '50%', backgroundImage: 'linear-gradient(to right, rgba(123, 97, 255, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(123, 97, 255, 0.1) 1px, transparent 1px)', backgroundSize: '80px 80px', transform: 'perspective(1000px) rotateX(75deg)', transformOrigin: 'bottom center' }} />
      </motion.div>

      {/* Top/Bottom Glows */}
      <div className="fixed top-0 left-0 right-0 z-20 opacity-20" style={{ height: '2px', background: 'linear-gradient(to right, transparent, #7b61ff, transparent)', boxShadow: '0 0 10px #7b61ff' }} />
      <div className="fixed bottom-0 left-0 right-0 z-20 opacity-20" style={{ height: '2px', background: 'linear-gradient(to right, transparent, #7b61ff, transparent)', boxShadow: '0 0 10px #7b61ff' }} />
    </div>
  );
};

export default Background;
