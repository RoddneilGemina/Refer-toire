export type Voicing =
  | 'SATB'
  | 'SATB div.'
  | 'SSAA'
  | 'SSA'
  | 'TTBB'
  | 'TTB'
  | 'SAB'
  | 'Two-Part'
  | 'Unison'
  | 'Solo & Choir';

export type LiturgicalSeason =
  | 'Advent'
  | 'Christmas'
  | 'Epiphany'
  | 'Lent'
  | 'Holy Week'
  | 'Easter'
  | 'Pentecost'
  | 'Ordinary Time'
  | 'Concert'
  | 'Evensong'
  | 'General';

export type DownloadStatus = 'idle' | 'downloading' | 'completed' | 'failed';

export interface ScoreItem {
  id: string;
  title: string;
  composer: string;
  arranger?: string;
  lyricist?: string;
  voicing: Voicing;
  season: LiturgicalSeason;
  keySignature?: string;
  tempo?: string;
  duration?: string; // e.g. "3:45"
  pageCount: number;
  sourceUrl: string; // Remote PDF URL
  localUri?: string; // Local file:// URI once downloaded
  fileSize: number; // in bytes
  downloadStatus: DownloadStatus;
  downloadProgress?: number; // 0 - 100
  notes?: string;
  tags: string[];
  addedAt: string;
  isFavorite?: boolean;
}

export interface Setlist {
  id: string;
  title: string;
  date?: string;
  description?: string;
  scoreIds: string[];
}

export interface RepertoireInstance {
  code: string;
  name: string;
  subtitle?: string;
  director: string;
  accompanist?: string;
  organization?: string;
  seasonName: string;
  scores: ScoreItem[];
  setlists: Setlist[];
  lastUpdated: string;
}

export interface SyncProgress {
  totalFiles: number;
  completedFiles: number;
  totalBytes: number;
  downloadedBytes: number;
  isSyncing: boolean;
  currentFileName?: string;
  errorMessage?: string;
}

export type SortField = 'title' | 'composer' | 'voicing' | 'season' | 'recently_added';
export type SortDirection = 'asc' | 'desc';

export interface SortOption {
  field: SortField;
  direction: SortDirection;
  label: string;
}
