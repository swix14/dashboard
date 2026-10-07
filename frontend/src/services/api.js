import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para inyectar token JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('vtf_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejar tokens expirados o desautorización
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const isLoginRequest = error.config.url.includes('/auth/login');
      if (!isLoginRequest) {
        localStorage.removeItem('vtf_token');
        localStorage.removeItem('vtf_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
