import type { ChartSeries } from '../../../models/reporting.model';

const COLORS = [
  '#6366f1',
  '#22c55e',
  '#eab308',
  '#f97316',
  '#ec4899',
  '#0ea5e9',
  '#64748b',
  '#94a3b8'
];

export function donutData(series?: ChartSeries) {
  const labels = series?.labels ?? [];
  const data = series?.values?.map((v) => Number(v)) ?? [];
  return {
    labels,
    datasets: [{ data, backgroundColor: labels.map((_, i) => COLORS[i % COLORS.length]), borderWidth: 0 }]
  };
}

export function barData(series?: ChartSeries, label = '') {
  const labels = series?.labels ?? [];
  const data = series?.values?.map((v) => Number(v)) ?? [];
  return {
    labels,
    datasets: [
      {
        label,
        data,
        backgroundColor: COLORS[0],
        borderRadius: 4
      }
    ]
  };
}

export function lineData(series?: ChartSeries, label = '') {
  const labels = series?.labels ?? [];
  const data = series?.values?.map((v) => Number(v)) ?? [];
  return {
    labels,
    datasets: [
      {
        label,
        data,
        fill: false,
        tension: 0.3,
        borderColor: COLORS[0],
        backgroundColor: 'rgba(99,102,241,0.15)'
      }
    ]
  };
}

export const defaultChartOptions = {
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: { color: '#475569' }
    }
  },
  maintainAspectRatio: false
};

export const lineChartOptions = {
  ...defaultChartOptions,
  scales: {
    x: {
      ticks: { color: '#64748b', maxRotation: 45, minRotation: 0 },
      grid: { color: 'rgba(148,163,184,0.2)' }
    },
    y: {
      ticks: { color: '#64748b' },
      grid: { color: 'rgba(148,163,184,0.2)' },
      beginAtZero: true
    }
  }
};

export const barChartOptions = {
  ...defaultChartOptions,
  scales: {
    x: {
      ticks: { color: '#64748b' },
      grid: { display: false }
    },
    y: {
      ticks: { color: '#64748b' },
      grid: { color: 'rgba(148,163,184,0.2)' },
      beginAtZero: true
    }
  }
};
