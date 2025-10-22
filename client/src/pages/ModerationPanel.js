import React, { useEffect, useState, useCallback } from 'react';
import { fetchUsers, addUser as apiAddUser, deleteUser as apiDeleteUser } from '../api';
import './ModerationPanel.css';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import LoadingSpinner from '../components/LoadingSpinner';

export default function ModerationPanel({ role, setRole }) {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'Player' });
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetchUsers(page);
      setUsers(res.data.users || []);
      setTotal(res.data.total || 0);
      console.log("Fetched users:", res.data);

    } catch (err) {
      console.error("Failed to fetch users:", err);
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

      if (decoded.role !== 'Mod') {
        navigate('/');
      }
    } catch (err) {
      console.error("Invalid token", err);
      navigate('/login');
    }
  }, [navigate, setRole]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleDeleteUser = async (id) => {
    try {
      await apiDeleteUser(id);
      loadUsers(); 
    } catch (err) {
      console.error("Delete user failed:", err);
    }
  };

  const handleAddUser = async () => {
    try {
      await apiAddUser(newUser);
      setNewUser({ username: '', password: '', role: 'Player' });
      loadUsers();
    } catch (err) {
      console.error("Add user failed:", err);
    }
  };

  useEffect(() => {
    loadUsers().finally(() => setLoading(false));
  }, [loadUsers]);

  const totalPages = Math.ceil(total / limit);
  const handlePageClick = (p) => setPage(p);
  if (loading) return <LoadingSpinner />;

  return (
    <div className="moderation-panel">
      <h1>Moderation Panel</h1>
      <div className="add-user-form">
        <input
          placeholder="Username"
          value={newUser.username}
          onChange={e => setNewUser({ ...newUser, username: e.target.value })}
        />
        <input
          placeholder="Password"
          type="password"
          value={newUser.password}
          onChange={e => setNewUser({ ...newUser, password: e.target.value })}
        />
        <select
          value={newUser.role}
          onChange={e => setNewUser({ ...newUser, role: e.target.value })}
        >
          <option value="Player">Player</option>
          <option value="Mod">Mod</option>
        </select>
        <button onClick={handleAddUser}>＋ Add User</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>User ID</th><th>Username</th><th>Role</th><th>Games</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u._id}>
              <td>{u._id}</td>
              <td>{u.username}</td>
              <td>{u.role}</td>
              <td>{u.gameCount}</td>
              <td><button onClick={() => handleDeleteUser(u._id)}>Delete</button></td>
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
