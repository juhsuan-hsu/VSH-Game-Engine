import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Navbar.css';

export default function Navbar({ role, setRole }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setRole(null);
    navigate('/');
  };

  return (
    <nav className="navbar">
      <Link to="/" className="nav-brand">VSH Game Engine</Link>
      <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
      <ul className={`nav-links ${menuOpen ? 'show' : ''}`}>
        <li><Link to="/">Home</Link></li>
        {role && <li><Link to="/builder">Create</Link></li>}
        {role && <li><Link to="/my-games">My Games</Link></li>}
        {role === 'Mod' && <li><Link to="/moderate">Moderation</Link></li>}
        {role ? (
          <li><span className="nav-button" onClick={handleLogout}>Logout</span></li>
        ) : (
          <li><Link to="/login">Login</Link></li>
        )}
      </ul>
    </nav>
  );
}
