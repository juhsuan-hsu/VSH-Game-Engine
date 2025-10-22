import { BrowserRouter, Routes, Route } from 'react-router-dom';
import React, { useState } from 'react';
import { useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import BuilderPage from './pages/BuilderPage';
import MyGamesPage from './pages/MyGamesPage';
import ModerationPanel from './pages/ModerationPanel';
import GamePage from './pages/GamePage';
import Navbar from './components/Navbar';

function App() {
  const [role, setRole] = useState(null);

  useEffect(() => {
    const exp = Number(localStorage.getItem('token_exp') || 0);
    if (!exp) return;
    const msLeft = (exp * 1000) - Date.now();
    clearTimeout(window.__logoutTimer);
    if (msLeft <= 0) {
      localStorage.clear();
      window.location.assign('/login?reason=expired');
    } else {
      window.__logoutTimer = setTimeout(() => {
        localStorage.clear();
        window.location.assign('/login?reason=expired');
      }, msLeft);
    }
  }, []);


  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setRole(decoded.role);
      } catch (err) {
        console.error('Failed to decode token:', err);
      }
    } else {
      setRole(null);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setRole(decoded.role);
      } catch (err) {
        console.error("Invalid token:", err);
        setRole(null);
      }
    } else {
      setRole(null);
    }
  }, []);
  

  return (
    <BrowserRouter>
      <Navbar role={role} setRole={setRole} />
      <Routes>
        <Route path="/" element={<HomePage role={role} setRole={setRole} />} />
        <Route path="/login" element={<LoginPage setRole={setRole} />} />
        <Route path="/builder" element={<BuilderPage />} />
        <Route path="/builder/:gameId" element={<BuilderPage />} />
        <Route path="/moderate" element={<ModerationPanel role={role} setRole={setRole} />} />
        <Route path="/my-games" element={<MyGamesPage role={role} setRole={setRole} />} />
        <Route path="/game/:id" element={<GamePage />} />
        <Route path="*" element={<div>404 - Page Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
