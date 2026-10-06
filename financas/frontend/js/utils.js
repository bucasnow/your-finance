export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** 1234.5 → "1.234,50" */
export const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** 1234.5 → "R$ 1.234,50" */
export const money = (v) => 'R$ ' + brl(v);
/** 1234.5 → "1,2k" */
export const compact = (v) => (v >= 1000 ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k' : brl(v));
export const pct = (v, d = 1) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: d });

/** "1.234,56" | "1234.56" → 1234.56 */
export function parseBRL(str) {
  if (typeof str === 'number') return str;
  const s = String(str).replace(/[^\d,.-]/g, '');
  if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  return parseFloat(s) || 0;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function today() {
  return new Date();
}

export const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d || 1); };
export const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return monthKey(d);
}
export const monthLabel = (key) => { const [y, m] = key.split('-').map(Number); return `${MESES[m - 1]} ${y}`; };
export const monthShort = (key) => MESES_CURTOS[Number(key.split('-')[1]) - 1];
export const monthShortYear = (key) => { const [y, m] = key.split('-'); return `${MESES_CURTOS[m - 1].toLowerCase()}/${y.slice(2)}`; };
export const ddmm = (iso) => { const d = parseISO(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };

export function dayLabel(iso, long = false) {
  const d = parseISO(iso);
  const t = today();
  const diff = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - d) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff < 0) return `Agendado · ${ddmm(iso)}`;
  return `${(long ? DIAS : DIAS_CURTOS)[d.getDay()]}, ${ddmm(iso)}`;
}

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const alpha = (hex, a) => hex + Math.round(a * 255).toString(16).padStart(2, '0');

export const isDesktop = () => window.matchMedia('(min-width: 821px)').matches;

export function animateBars(root) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.querySelectorAll('[data-w]').forEach((el) => { el.style.width = Math.min(100, Number(el.dataset.w)) + '%'; });
  }));
}

let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
