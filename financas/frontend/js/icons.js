export const PATHS = {
  logo: 'M4 17l5-5 4 4 7-8',
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  card: 'M3 6h18v12H3zM3 10h18M7 15h4',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  sun: 'M12 3v2M12 19v2M5 5l1.4 1.4M17.6 17.6L19 19M3 12h2M19 12h2M5 19l1.4-1.4M17.6 6.4L19 5M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  logout: 'M17 16l4-4-4-4M7 12h14M13 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8',
  contactless: 'M8.5 7.5a6 6 0 0 1 0 9M12 5a9.5 9.5 0 0 1 0 14M5 10a2.5 2.5 0 0 1 0 4',
  // categorias
  casa: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  cesta: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2M9 20.5h.01M17 20.5h.01',
  carro: 'M5 17V11l2.2-5h9.6l2.2 5v6M3 17h18v2h-3M6 19H3v-2M7.5 14h.01M16.5 14h.01',
  estrela: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  saude: 'M3 12h4l2-5 4 10 2-5h6',
  sacola: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2',
  repete: 'M17 3l4 4-4 4M3 11V9a2 2 0 0 1 2-2h16M7 21l-4-4 4-4M21 13v2a2 2 0 0 1-2 2H3',
  livro: 'M4 19V5a2 2 0 0 1 2-2h14v14H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h14',
  entrada: 'M12 4v12M6 10l6 6 6-6M4 20h16',
  outros: 'M5 12h.01M12 12h.01M19 12h.01'
};

export function icon(name, size = 20, stroke = 2) {
  const d = PATHS[name] || PATHS.outros;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    const name = el.dataset.icon === 'theme'
      ? (document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon')
      : el.dataset.icon;
    const size = el.closest('.tab-add') ? 26 : el.closest('.tab') ? 22 : 20;
    el.innerHTML = icon(name, size, name === 'plus' || name === 'logo' ? 2.6 : 2);
  });
}
