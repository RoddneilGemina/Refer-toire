import { ScoreItem, SortOption, Voicing, LiturgicalSeason, PieceGenre } from '@/types/repertoire';

export const SORT_OPTIONS: SortOption[] = [
  { field: 'title', direction: 'asc', label: 'Title (A–Z)' },
  { field: 'composer', direction: 'asc', label: 'Composer (A–Z)' },
  { field: 'voicing', direction: 'asc', label: 'Voicing (SATB, SSA, TTBB)' },
  { field: 'season', direction: 'asc', label: 'Liturgical Season / Occasion' },
  { field: 'recently_added', direction: 'desc', label: 'Recently Added' },
];

const SEASON_ORDER: Record<LiturgicalSeason, number> = {
  Advent: 1,
  Christmas: 2,
  Epiphany: 3,
  Lent: 4,
  'Holy Week': 5,
  Easter: 6,
  Pentecost: 7,
  'Ordinary Time': 8,
  Evensong: 9,
  Concert: 10,
  General: 11,
};

const VOICING_ORDER: Record<Voicing, number> = {
  SATB: 1,
  'SATB div.': 2,
  SSAA: 3,
  SSA: 4,
  TTBB: 5,
  TTB: 6,
  SAB: 7,
  'Two-Part': 8,
  Unison: 9,
  'Solo & Choir': 10,
};

/**
 * Extract composer last name for natural choral sorting
 * e.g. "Wolfgang Amadeus Mozart" -> "Mozart"
 * "Giovanni Pierluigi da Palestrina" -> "Palestrina"
 */
function getComposerSortKey(composer: string): string {
  const parts = composer.trim().split(/\s+/);
  return parts[parts.length - 1].toLowerCase();
}

export function sortScores(scores: ScoreItem[], sortOption: SortOption): ScoreItem[] {
  const cloned = [...scores];

  return cloned.sort((a, b) => {
    switch (sortOption.field) {
      case 'title': {
        const cmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
        return sortOption.direction === 'asc' ? cmp : -cmp;
      }
      case 'composer': {
        const keyA = getComposerSortKey(a.composer);
        const keyB = getComposerSortKey(b.composer);
        const cmp = keyA.localeCompare(keyB);
        return sortOption.direction === 'asc' ? cmp : -cmp;
      }
      case 'voicing': {
        const orderA = VOICING_ORDER[a.voicing] ?? 99;
        const orderB = VOICING_ORDER[b.voicing] ?? 99;
        if (orderA !== orderB) {
          return sortOption.direction === 'asc' ? orderA - orderB : orderB - orderA;
        }
        return a.title.localeCompare(b.title);
      }
      case 'season': {
        const orderA = SEASON_ORDER[a.season] ?? 99;
        const orderB = SEASON_ORDER[b.season] ?? 99;
        if (orderA !== orderB) {
          return sortOption.direction === 'asc' ? orderA - orderB : orderB - orderA;
        }
        return a.title.localeCompare(b.title);
      }
      case 'recently_added': {
        const timeA = new Date(a.addedAt).getTime();
        const timeB = new Date(b.addedAt).getTime();
        return sortOption.direction === 'desc' ? timeB - timeA : timeA - timeB;
      }
      default:
        return 0;
    }
  });
}

export function filterScores(
  scores: ScoreItem[],
  query: string,
  voicingFilter: Voicing | 'ALL',
  seasonFilter: LiturgicalSeason | 'ALL',
  favoritesOnly: boolean,
  genreFilter?: PieceGenre | 'ALL'
): ScoreItem[] {
  const cleanQuery = query.trim().toLowerCase();

  return scores.filter(score => {
    if (favoritesOnly && !score.isFavorite) {
      return false;
    }

    if (voicingFilter !== 'ALL' && score.voicing !== voicingFilter) {
      return false;
    }

    if (seasonFilter !== 'ALL' && score.season !== seasonFilter) {
      return false;
    }

    if (genreFilter && genreFilter !== 'ALL' && (score.genre || 'General') !== genreFilter) {
      return false;
    }

    if (cleanQuery) {
      const matchTitle = score.title.toLowerCase().includes(cleanQuery);
      const matchComposer = score.composer.toLowerCase().includes(cleanQuery);
      const matchArranger = score.arranger?.toLowerCase().includes(cleanQuery);
      const matchTags = score.tags.some(t => t.toLowerCase().includes(cleanQuery));
      const matchNotes = score.notes?.toLowerCase().includes(cleanQuery);
      if (!matchTitle && !matchComposer && !matchArranger && !matchTags && !matchNotes) {
        return false;
      }
    }

    return true;
  });
}
