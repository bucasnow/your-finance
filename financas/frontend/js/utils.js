export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ── Números ──
export const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (v) => (Number(v) < 0 ? '− R$ ' : 'R$ ') + brl(Math.abs(v));
export const compact = (v) => (Math.abs(v) >= 1000 ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k' : brl(v));
export const pct = (v, d = 1) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: d });

export function parseBRL(str) {
  const n = Number(String(str || '').replace(/[^\d,]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Faz o campo se comportar como máquina de calcular: digita centavos, formata em R$. */
export function mascaraValor(input, inicial) {
  if (inicial) input.value = brl(inicial);
  input.addEventListener('input', () => {
    const digitos = input.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12);
    input.value = digitos ? brl(Number(digitos) / 100) : '';
  });
}

// ── Texto ──
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ── Datas (sempre no fuso do aparelho) ──
export const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hojeISO = () => isoDate(new Date());
export const ontemISO = () => { const d = new Date(); d.setDate(d.getDate() - 1); return isoDate(d); };
export const parseISO = (s) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d || 1); };
export const chaveMes = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const mesAtual = () => chaveMes(new Date());
export const mesValido = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s || '');

export function somarMeses(chave, n) {
  const [y, m] = chave.split('-').map(Number);
  return chaveMes(new Date(y, m - 1 + n, 1));
}
export const nomeMes = (chave) => { const [y, m] = chave.split('-').map(Number); return `${MESES[m - 1]} ${y}`; };
export const mesCurto = (chave) => { const [y, m] = chave.split('-'); return `${MESES_CURTOS[Number(m) - 1]}/${y.slice(2)}`; };
export const ddmm = (iso) => { const d = parseISO(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
export const dataLonga = (iso) => parseISO(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

export function rotuloDia(iso) {
  const d = parseISO(iso);
  const h = parseISO(hojeISO());
  const diff = Math.round((h - d) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return `${DIAS_CURTOS[d.getDay()]}, ${ddmm(iso)}`;
}

// ── Coleções ──
export function groupBy(lista, chave) {
  return lista.reduce((acc, item) => { (acc[chave(item)] ||= []).push(item); return acc; }, {});
}

// ── Estilo ──
export const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
export const alpha = (hex, a) => (/^#[0-9a-f]{6}$/i.test(hex) ? hex + Math.round(a * 255).toString(16).padStart(2, '0') : hex);
