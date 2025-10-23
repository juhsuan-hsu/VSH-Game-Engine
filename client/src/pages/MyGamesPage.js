import React, { useEffect, useState, useCallback } from 'react';
import { fetchGames } from '../api';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import './MyGamesPage.css';
import LoadingSpinner from '../components/LoadingSpinner';

export default function MyGamesPage({ role, setRole }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const navigate = useNavigate();

  const loadGames = useCallback(async () => {
    try {
      const res = await fetchGames();
      const token = localStorage.getItem('token');
      const user = jwtDecode(token);
      const allGames = res.data.games || [];

      setTotal(allGames.length);
      const start = (page - 1) * limit;
      const paginated = filtered.slice(start, start + limit);

      setGames(paginated);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch games:", err);
    }
  }, [page]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const decoded = jwtDecode(token);
      setRole(decoded.role);
      loadGames();
    } catch (err) {
      console.error("Invalid token", err);
      navigate('/login');
    }
  }, [navigate, setRole, loadGames]);

  const totalPages = Math.ceil(total / limit);
  const handlePageClick = (p) => setPage(p);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="my-games-page">
      <h1>My Games</h1>
      <table className="games-table">
        <thead>
          <tr>
            <th>Game ID</th>
            <th>Title</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {games.map(game => (
            <tr key={game._id}>
              <td>{game._id}</td>
              <td>{game.title}</td>
              <td>
                <button onClick={() => navigate(`/builder/${game._id}`)}>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pagination">
        {Array.from({ length: totalPages }, (_, i) => (
          <button
            key={i + 1}
            className={page === i + 1 ? 'active' : ''}
            onClick={() => handlePageClick(i + 1)}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
