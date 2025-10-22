import React, { useEffect, useState } from 'react';
import { fetchPublicGames } from '../api';
import { Link } from 'react-router-dom';
import './HomePage.css';
import LoadingSpinner from '../components/LoadingSpinner';

export default function HomePage() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublicGames()
      .then(res => {
        setGames(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching public games", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-content">
          <h1>Create Real-World Adventures.</h1>
          <p>
            With our VSH Game Engine, you can design captivating missions with QR codes, GPS, and AR triggers and bring your stories into the real world.
          </p>
          <Link to="/game/68174fe8e20359868e9ecbfd" className="demo-button">
            Play Demo
          </Link>
        </div>
        <div className="hero-image">
          <img src="/cover.jpg" alt="Players exploring with VSH" />
        </div>
      </section>

      <section className="featured-section">
        <h2 className="section-title">Featured Games</h2>

        {loading ? (
          <LoadingSpinner />
        ) : games.length === 0 ? (
          <p className="no-games">No featured games yet.</p>
        ) : (
          <div className="game-grid">
            {games.map((game) => (
              <Link to={`/game/${game._id}`} key={game._id} className="game-card">
                <div
                  className="game-thumbnail"
                  style={
                    game.coverImage
                      ? { backgroundImage: `url(${game.coverImage})` }
                      : {}
                  }
                >
                  {!game.coverImage && <span className="placeholder">🎮</span>}
                  <div className="game-title">{game.title}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
