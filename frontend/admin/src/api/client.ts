import axios from 'axios';

const client = axios.create({
  baseURL: '',
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('cside_admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('cside_admin_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default client;
