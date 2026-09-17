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

export type UserRole = 'admin' | 'member';

export type PieceGenre =
  | 'Folk'
  | 'Pop'
  | 'Classical'
  | 'Sacred'
  | 'Contemporary'
  | 'Jazz'
  | 'Spiritual'
  | 'Renaissance'
  | 'World'
  | 'Musical Theatre'
  | 'General';

export interface ScoreItem {
  id: string;
  title: string;
  composer: string;
  arranger?: string;
  lyricist?: string;
  voicing: Voicing;
  season: LiturgicalSeason;
  genre?: PieceGenre;
  keySignature?: string;
  tempo?: string;
  duration?: string; // e.g. "3:45"
  pageCount: number;
  sourceUrl: string; // Remote PDF URL or local file URI
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
  venue?: string;
  description?: string;
  scoreIds: string[];
  createdAt?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  voicePart?: string;
  createdAt: string;
}

export interface EnsembleMember {
  id: string;
  instanceCode: string;
  userId: string;
  fullName: string;
  email: string;
  role: UserRole; // 'admin' | 'member'
  isOwner?: boolean;
  voicePart?: string;
  joinedAt: string;
}

export interface RepertoireInstance {
  code: string;
  name: string;
  subtitle?: string;
  director: string;
  accompanist?: string;
  organization?: string;
  seasonName: string;
  creatorId?: string; // ID of the user who created this ensemble (admin by default)
  adminKey?: string; // Key / token identifying group creator / admin
  isCustom?: boolean;
  createdDate?: string;
  scores: ScoreItem[];
  setlists: Setlist[];
  lastUpdated: string;
  membersCount?: number;
}

export interface CreateGroupParams {
  name: string;
  director: string;
  subtitle?: string;
  seasonName?: string;
  customCode?: string;
}

export interface UploadScoreData {
  title: string;
  composer?: string;
  arranger?: string;
  voicing?: Voicing;
  season?: LiturgicalSeason;
  genre?: PieceGenre;
  keySignature?: string;
  tempo?: string;
  duration?: string;
  pageCount?: number;
  notes?: string;
  tags?: string[];
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
