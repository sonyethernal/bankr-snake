import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Battlefield from './pages/Battlefield';

function App() {
  return (
    <Router>
      <div className="relative min-h-screen w-full overflow-hidden bg-[#f4f4f0]">
        <Routes>
          <Route path="/" element={<Battlefield />} />
          <Route path="/game" element={<Battlefield />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
