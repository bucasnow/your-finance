const PATHS = {
  logo: 'M4 17l5-5 4 4 7-8',
  inicio: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  lista: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  cartao: 'M3 6h18v12H3zM3 10h18M7 15h4',
  investimento: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  usuario: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  mais: 'M12 5v14M5 12h14',
  fechar: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  esquerda: 'M15 18l-6-6 6-6',
  direita: 'M9 18l6-6-6-6',
  sair: 'M17 16l4-4-4-4M7 12h14M13 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8',
  editar: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  lixo: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  busca: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  cadeado: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  escudo: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  sobe: 'M12 19V5M5 12l7-7 7 7',
  desce: 'M12 5v14M19 12l-7 7-7-7',
  pizza: 'M12 3v9h9A9 9 0 1 1 12 3zM15 3.5A9 9 0 0 1 20.5 9H15z',
  contactless: 'M8.5 7.5a6 6 0 0 1 0 9M12 5a9.5 9.5 0 0 1 0 14M5 10a2.5 2.5 0 0 1 0 4',
  calendario: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  tag: 'M3 12V3h9l9 9-9 9zM7.5 7.5h.01',
  // categorias
  comida: 'M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 3-3 6s1 3 3 3v9',
  cesta: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2M9 20.5h.01M17 20.5h.01',
  casa: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  carro: 'M5 17V11l2.2-5h9.6l2.2 5v6M3 17h18v2h-3M6 19H3v-2M7.5 14h.01M16.5 14h.01',
  saude: 'M3 12h4l2-5 4 10 2-5h6',
  estrela: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  livro: 'M4 19V5a2 2 0 0 1 2-2h14v14H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h14',
  sacola: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2',
  repete: 'M17 3l4 4-4 4M3 11V9a2 2 0 0 1 2-2h16M7 21l-4-4 4-4M21 13v2a2 2 0 0 1-2 2H3',
  raio: 'M13 3L5 13h6l-1 8 8-10h-6z',
  entrada: 'M12 4v12M6 10l6 6 6-6M4 20h16',
  maleta: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  pet: 'M5 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM19 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM15 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 12c-3 0-5 3-5 6 0 2 2 3 5 3s5-1 5-3c0-3-2-6-5-6z',
  presente: 'M4 10h16v11H4zM2 7h20v3H2zM12 7v14M12 7c-1-3-5-4-5-1 0 1 2 1 5 1zM12 7c1-3 5-4 5-1 0 1-2 1-5 1z',
  viagem: 'M2 16l20-8-6 13-3-5zM13 16l-3 5',
  outros: 'M5 12h.01M12 12h.01M19 12h.01',
};

// Nomes usados nas categorias antigas do banco
const APELIDOS = { meat: 'comida', 'device-gamepad': 'estrela', home: 'casa', tag: 'outros', 'trending-up': 'trend', heart: 'saude', car: 'carro' };

export const ICONES_CATEGORIA = ['comida', 'cesta', 'casa', 'carro', 'saude', 'estrela', 'livro', 'sacola', 'repete', 'raio', 'pet', 'presente', 'viagem', 'maleta', 'entrada', 'trend', 'outros'];

export function icon(name, size = 20, stroke = 2) {
  const d = PATHS[name] || PATHS[APELIDOS[name]] || PATHS.outros;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}
