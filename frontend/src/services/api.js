import axios from 'axios';

export const api = axios.create({
  // En el build de producción la API vive en el mismo dominio (/api); en desarrollo, en el puerto 4000
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:4000/api'),
  // Margen para el arranque en frío de la app en cPanel (Passenger + conexión MySQL)
  timeout: 20000,
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
      // Un 401 del login (directiva o socia) es "clave incorrecta": se muestra en el formulario.
      // Antes el login de socias recargaba la página hacia /login y la socia nunca veía el error.
      const url = error.config?.url || '';
      const isLoginRequest = url.includes('/auth/login') || url.includes('/socia/login');
      if (!isLoginRequest) {
        let esSocia = false;
        try {
          const saved = JSON.parse(localStorage.getItem('vtf_user') || 'null');
          esSocia = (saved?.role?.code || saved?.role) === 'SOCIA';
        } catch {
          esSocia = false;
        }
        localStorage.removeItem('vtf_token');
        localStorage.removeItem('vtf_user');
        window.location.href = esSocia ? '/socia/login' : '/login';
      }
    }
    return Promise.reject(error);
  }
);
