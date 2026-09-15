import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  RepertoireInstance,
  ScoreItem,
  SyncProgress,
  SortOption,
  Voicing,
  LiturgicalSeason,
} from '@/types/repertoire';
import { InstanceService } from '@/services/instanceService';
import { DownloadService } from '@/services/downloadService';
import { StorageService } from '@/services/storageService';
import { SORT_OPTIONS, sortScores, filterScores } from '@/utils/sorting';

interface RepertoireContextValue {
  currentInstance: RepertoireInstance | null;
  isLoading: boolean;
  isSyncing: boolean;
  syncProgress: SyncProgress | null;
  scores: ScoreItem[];
  filteredAndSortedScores: ScoreItem[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sortOption: SortOption;
  setSortOption: (opt: SortOption) => void;
  voicingFilter: Voicing | 'ALL';
  setVoicingFilter: (v: Voicing | 'ALL') => void;
  seasonFilter: LiturgicalSeason | 'ALL';
  setSeasonFilter: (s: LiturgicalSeason | 'ALL') => void;
  favoritesOnly: boolean;
  setFavoritesOnly: (fav: boolean) => void;
  preferredVoicePart: string | null;
  setPreferredVoicePart: (part: string | null) => Promise<void>;
  signInWithCode: (code: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  reSyncAll: () => Promise<void>;
  toggleFavorite: (scoreId: string) => Promise<void>;
  clearOfflineCache: () => Promise<void>;
}

const RepertoireContext = createContext<RepertoireContextValue | undefined>(undefined);

export function RepertoireProvider({ children }: { children: React.ReactNode }) {
  const [currentInstance, setCurrentInstance] = useState<RepertoireInstance | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [localUris, setLocalUris] = useState<Record<string, string>>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [preferredVoicePart, setPreferredVoicePartState] = useState<string | null>(null);

  // Sorting & Filtering State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOption, setSortOption] = useState<SortOption>(SORT_OPTIONS[0]);
  const [voicingFilter, setVoicingFilter] = useState<Voicing | 'ALL'>('ALL');
  const [seasonFilter, setSeasonFilter] = useState<LiturgicalSeason | 'ALL'>('ALL');
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(false);

  // Sync background downloads
  const syncScoresForInstance = useCallback(
    async (instance: RepertoireInstance) => {
      if (!instance.scores.length) return;
      setIsSyncing(true);
      try {
        const uris = await DownloadService.syncInstanceScores(
          instance.code,
          instance.scores,
          progress => {
            setSyncProgress(progress);
            setIsSyncing(progress.isSyncing);
          }
        );
        setLocalUris(prev => ({ ...prev, ...uris }));
      } catch (err) {
        console.warn('Sync failed:', err);
      } finally {
        setIsSyncing(false);
      }
    },
    []
  );

  // Initial boot: check for stored active code & restore state
  useEffect(() => {
    async function initSession() {
      try {
        const activeCode = await StorageService.getActiveInstanceCode();
        const preferredPart = await StorageService.getPreferredVoicePart();
        setPreferredVoicePartState(preferredPart);

        if (activeCode) {
          // Check local cache first for instant offline startup
          const cached = await StorageService.getCachedInstance(activeCode);
          const uris = await StorageService.getLocalScoreUris(activeCode);
          const favs = await StorageService.getFavorites(activeCode);
          setLocalUris(uris);
          setFavorites(favs);

          if (cached) {
            setCurrentInstance(cached);
          }

          // Fetch fresh instance in background
          const fresh = await InstanceService.fetchInstance(activeCode);
          if (fresh) {
            setCurrentInstance(fresh);
            await StorageService.saveCachedInstance(fresh);
            // Download any new scores in background
            syncScoresForInstance(fresh);
          }
        }
      } catch (err) {
        console.warn('Init error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    initSession();
  }, [syncScoresForInstance]);

  // Handle Login with Access Code
  const signInWithCode = async (rawCode: string): Promise<{ success: boolean; error?: string }> => {
    const instance = await InstanceService.fetchInstance(rawCode);
    if (!instance) {
      return { success: false, error: 'Invalid choir code. Try demo code CANTATE-2026 or CHORALE-LENT' };
    }

    try {
      await StorageService.setActiveInstanceCode(instance.code);
      await StorageService.saveCachedInstance(instance);
      const uris = await StorageService.getLocalScoreUris(instance.code);
      const favs = await StorageService.getFavorites(instance.code);

      setCurrentInstance(instance);
      setLocalUris(uris);
      setFavorites(favs);

      // Trigger automatic download of all PDFs
      syncScoresForInstance(instance);

      return { success: true };
    } catch (e) {
      return { success: false, error: 'Failed to initialize local choir storage' };
    }
  };

  // Sign out / Switch Choir
  const signOut = async () => {
    await StorageService.setActiveInstanceCode(null);
    setCurrentInstance(null);
    setLocalUris({});
    setFavorites([]);
  };

  // Force re-sync
  const reSyncAll = async () => {
    if (!currentInstance) return;
    await syncScoresForInstance(currentInstance);
  };

  // Clear offline files
  const clearOfflineCache = async () => {
    if (!currentInstance) return;
    await DownloadService.clearCache(currentInstance.code);
    setLocalUris({});
  };

  // Toggle favorite score
  const toggleFavorite = async (scoreId: string) => {
    if (!currentInstance) return;
    const updated = await StorageService.toggleFavorite(currentInstance.code, scoreId);
    setFavorites(updated);
  };

  // Update preferred voice part
  const setPreferredVoicePart = async (part: string | null) => {
    setPreferredVoicePartState(part);
    await StorageService.setPreferredVoicePart(part);
  };

  // Merge scores with local download status and favorite status
  const scores: ScoreItem[] = useMemo(() => {
    if (!currentInstance) return [];

    return currentInstance.scores.map(s => {
      const localUri = localUris[s.id];
      const isDownloaded = Boolean(localUri);
      return {
        ...s,
        localUri,
        downloadStatus: isDownloaded ? 'completed' : isSyncing ? 'downloading' : 'idle',
        isFavorite: favorites.includes(s.id),
      };
    });
  }, [currentInstance, localUris, favorites, isSyncing]);

  // Compute filtered & sorted scores
  const filteredAndSortedScores = useMemo(() => {
    const filtered = filterScores(scores, searchQuery, voicingFilter, seasonFilter, favoritesOnly);
    return sortScores(filtered, sortOption);
  }, [scores, searchQuery, voicingFilter, seasonFilter, favoritesOnly, sortOption]);

  return (
    <RepertoireContext.Provider
      value={{
        currentInstance,
        isLoading,
        isSyncing,
        syncProgress,
        scores,
        filteredAndSortedScores,
        searchQuery,
        setSearchQuery,
        sortOption,
        setSortOption,
        voicingFilter,
        setVoicingFilter,
        seasonFilter,
        setSeasonFilter,
        favoritesOnly,
        setFavoritesOnly,
        preferredVoicePart,
        setPreferredVoicePart,
        signInWithCode,
        signOut,
        reSyncAll,
        toggleFavorite,
        clearOfflineCache,
      }}>
      {children}
    </RepertoireContext.Provider>
  );
}

export function useRepertoire() {
  const ctx = useContext(RepertoireContext);
  if (!ctx) {
    throw new Error('useRepertoire must be used within a RepertoireProvider');
  }
  return ctx;
}
