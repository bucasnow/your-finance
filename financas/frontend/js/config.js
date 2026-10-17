window.FIN_CONFIG = {
  apiBase: ['localhost', '127.0.0.1'].includes(location.hostname)
    ? 'http://localhost:8000'
    : 'https://web-production-2dec0.up.railway.app',
};
