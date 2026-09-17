const tintColorLight = '#B45309'; // Warm amber gold
const tintColorDark = '#F59E0B'; // Bright choral gold

export default {
  light: {
    text: '#0F172A',
    subtext: '#64748B',
    background: '#F8FAFC',
    card: '#FFFFFF',
    border: '#E2E8F0',
    tint: tintColorLight,
    tabIconDefault: '#94A3B8',
    tabIconSelected: tintColorLight,
    badgeBackground: '#FEF3C7',
    badgeText: '#92400E',
    surfaceSubtle: '#F1F5F9',
  },
  dark: {
    text: '#F8FAFC',
    subtext: '#94A3B8',
    background: '#0B0F17',
    card: '#151D2A',
    border: '#243044',
    tint: tintColorDark,
    tabIconDefault: '#64748B',
    tabIconSelected: tintColorDark,
    badgeBackground: '#2E220D',
    badgeText: '#FBBF24',
    surfaceSubtle: '#1C2638',
  },
  voicings: {
    SATB: { bg: '#DBEAFE', text: '#1E40AF', darkBg: '#1E3A8A44', darkText: '#93C5FD' },
    'SATB div.': { bg: '#E0E7FF', text: '#3730A3', darkBg: '#312E8144', darkText: '#A5B4FC' },
    SSAA: { bg: '#FCE7F3', text: '#9D174D', darkBg: '#83184344', darkText: '#F472B6' },
    SSA: { bg: '#FDF2F8', text: '#BE185D', darkBg: '#701A7544', darkText: '#F472B6' },
    TTBB: { bg: '#D1FAE5', text: '#065F46', darkBg: '#064E3B44', darkText: '#6EE7B7' },
    TTB: { bg: '#ECFDF5', text: '#047857', darkBg: '#064E3B33', darkText: '#34D399' },
    SAB: { bg: '#EDE9FE', text: '#5B21B6', darkBg: '#4C1D9544', darkText: '#C4B5FD' },
    'Two-Part': { bg: '#FEF3C7', text: '#92400E', darkBg: '#78350F44', darkText: '#FCD34D' },
    Unison: { bg: '#FEF9C3', text: '#854D0E', darkBg: '#713F1244', darkText: '#FDE047' },
    'Solo & Choir': { bg: '#FFE4E6', text: '#9F1239', darkBg: '#88133744', darkText: '#FDA4AF' },
  },
  status: {
    completed: '#10B981',
    downloading: '#3B82F6',
    failed: '#EF4444',
    idle: '#94A3B8',
  },
};
