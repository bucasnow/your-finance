import { money, compact, cssVar } from './utils.js';

const live = new Set();

export function destroyCharts() {
  live.forEach((c) => c.destroy());
  live.clear();
}

function t() {
  return {
    text: cssVar('--text'), muted: cssVar('--muted'), line: cssVar('--line'), faint: cssVar('--faint'),
    accent: cssVar('--accent'), neg: cssVar('--neg'), surface: cssVar('--surface'), surface2: cssVar('--surface2')
  };
}

function base() {
  const c = t();
  Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";
  Chart.defaults.color = c.muted;
  return c;
}

function tooltip(c) {
  return {
    backgroundColor: c.surface2,
    titleColor: c.text,
    bodyColor: c.text,
    borderColor: c.line,
    borderWidth: 1,
    padding: 10,
    cornerRadius: 10,
    displayColors: false,
    titleFont: { weight: '700' },
    callbacks: { label: (ctx) => money(ctx.parsed.y ?? ctx.parsed) }
  };
}

function make(canvas, config) {
  if (!canvas || !window.Chart) return null;
  const chart = new Chart(canvas, config);
  live.add(chart);
  return chart;
}

export function donutChart(canvas, { labels, values, colors, cutout = '74%' }) {
  const c = base();
  return make(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: c.surface, borderWidth: 3, hoverOffset: 6, borderRadius: 4 }] },
    options: {
      cutout,
      maintainAspectRatio: false,
      animation: { animateRotate: true, duration: 900 },
      plugins: { legend: { display: false }, tooltip: { ...tooltip(c), callbacks: { label: (ctx) => `${ctx.label}: ${money(ctx.parsed)}` } } }
    }
  });
}

export function barChart(canvas, { labels, values, highlight = -1, highlightColor, budget, showValues = true, radius = 10 }) {
  const c = base();
  const colors = values.map((_, i) => (i === highlight ? (highlightColor || c.accent) : c.faint));
  const datasets = [{
    type: 'bar', data: values, backgroundColor: colors, hoverBackgroundColor: colors.map((x, i) => (i === highlight ? x : c.muted)),
    borderRadius: { topLeft: radius, topRight: radius, bottomLeft: 4, bottomRight: 4 }, borderSkipped: false, maxBarThickness: 64, order: 2
  }];
  if (budget) {
    datasets.push({
      type: 'line', data: values.map(() => budget), borderColor: c.neg, borderDash: [6, 6], borderWidth: 2,
      pointRadius: 0, pointHoverRadius: 0, fill: false, order: 1, label: 'Orçamento'
    });
  }
  const max = Math.max(...values, budget || 0) * 1.18 || 1;
  return make(canvas, {
    data: { labels, datasets },
    options: {
      maintainAspectRatio: false,
      animation: { duration: 900, easing: 'easeOutQuart' },
      layout: { padding: { top: showValues ? 22 : 4 } },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: c.muted, font: { weight: '600' } } },
        y: { display: false, beginAtZero: true, max }
      },
      plugins: {
        legend: { display: false },
        tooltip: { ...tooltip(c), filter: (item) => item.dataset.type === 'bar' }
      }
    },
    plugins: showValues ? [valueLabels(c, highlight)] : []
  });
}

export function sparkBars(canvas, values, highlight = values.length - 1) {
  const c = base();
  return make(canvas, {
    type: 'bar',
    data: { labels: values.map((_, i) => i), datasets: [{ data: values, backgroundColor: values.map((_, i) => (i === highlight ? c.accent : c.faint)), borderRadius: 4, borderSkipped: false }] },
    options: {
      maintainAspectRatio: false,
      animation: { duration: 700 },
      scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });
}

export function areaChart(canvas, { labels, values }) {
  const c = base();
  return make(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: values, borderColor: c.accent, borderWidth: 3, tension: 0.35, pointRadius: 0, pointHoverRadius: 5,
        pointBackgroundColor: c.accent, fill: true,
        backgroundColor: (ctx) => {
          const { chart } = ctx;
          const area = chart.chartArea;
          if (!area) return 'transparent';
          const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
          g.addColorStop(0, c.accent + '55');
          g.addColorStop(1, c.accent + '00');
          return g;
        }
      }]
    },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 900 },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: c.muted, font: { weight: '600' } } },
        y: { display: false, grace: '8%' }
      },
      plugins: { legend: { display: false }, tooltip: tooltip(c) }
    }
  });
}

function valueLabels(c, highlight) {
  return {
    id: 'valueLabels',
    afterDatasetsDraw(chart) {
      const meta = chart.getDatasetMeta(0);
      const { ctx } = chart;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = "700 11px 'Plus Jakarta Sans', system-ui, sans-serif";
      meta.data.forEach((bar, i) => {
        const v = chart.data.datasets[0].data[i];
        if (!v) return;
        ctx.fillStyle = i === highlight ? c.text : c.muted;
        ctx.fillText(compact(v), bar.x, bar.y - 8);
      });
      ctx.restore();
    }
  };
}
