import axios from 'axios';

const API = axios.create({baseURL: process.env.REACT_APP_API_URL || "/api"});

API.interceptors.request.use((req) => {
  const token = localStorage.getItem('token');
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

export const login = (formData) => API.post('/auth/login', formData);
export const fetchGames = () => API.get('/games');
export const fetchUsers = (page = 1, limit = 20) => API.get(`/users?page=${page}&limit=${limit}`);
export const deleteUser = (id) => API.delete(`/users/${id}`);
export const addUser = (userData) => API.post('/users', userData);
export const saveGame = (gameData) => API.post('/games', gameData);
export const updateGame = (id, gameData) => API.put(`/games/${id}`, gameData);
export const deleteGame = (id) => API.delete(`/games/${id}`);
export const togglePublicStatus = (id) => API.patch(`/games/${id}/public`);
export const fetchPublicGames = () => API.get('/games/public');
export const fetchGameById = (id) => API.get(`/games/${id}`);

