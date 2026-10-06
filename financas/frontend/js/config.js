window.FIN_CONFIG = {
  useMock: false,
  apiBase: 'https://web-production-2dec0.up.railway.app',
  orcamentoPadrao: 8500,
  getToken: async () => localStorage.getItem('finapp_token') ?? null,
};
