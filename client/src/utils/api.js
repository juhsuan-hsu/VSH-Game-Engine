const API = (process.env.REACT_APP_API_BASE || '/api').replace(/\/+$/,'');
const getToken = () => localStorage.getItem('token');

async function request(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
    }
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('token_exp');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    window.location.assign('/login?reason=expired');
    throw new Error('Session expired');
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const t = await res.text();
  return t ? JSON.parse(t) : {};
}

export const api = {
  get: (p) => request(p),
  post: (p, b) => request(p, { method:'POST', body: JSON.stringify(b) }),
  put: (p, b) => request(p, { method:'PUT',  body: JSON.stringify(b) }),
  del: (p) => request(p, { method:'DELETE' }),
};
