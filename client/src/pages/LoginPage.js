import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api';
import './LoginPage.css';

export default function LoginPage({ setRole }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

const handleLogin = async () => {
  if (loading) return;
  setLoading(true);

  try {
      const res = await login({ username, password });
      const data = res.data;

      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role);
      localStorage.setItem('token_exp', String(data.exp));
      localStorage.setItem('username', data.username);
      setRole(data.role);

      const msLeft = Math.max(0, (data.exp * 1000) - Date.now());
      clearTimeout(window.__logoutTimer);
      window.__logoutTimer = setTimeout(() => {
        localStorage.clear();
        window.location.assign('/login?reason=expired');
      }, msLeft);

      window.location.href = '/';
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Login</h2>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyPress}
        />
        <button onClick={handleLogin} disabled={loading}>
          {loading ? 'Logging in...' : 'Log In'}
        </button>
        {error && <div className="login-error">{error}</div>}
      </div>
    </div>
  );
}