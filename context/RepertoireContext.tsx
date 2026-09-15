import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  RepertoireInstance,
  ScoreItem,
  SyncProgress,
  SortOption,
  Voicing,
  LiturgicalSeason,
  UserRole,
  CreateGroupParams,
  UploadScoreData,
} from '@/types/repertoire';
import { DatabaseService } from '@/services/databaseService';
import { DownloadService } from '@/services/downloadService';
import { StorageService } from '@/services/storageService';
import { SORT_OPTIONS, sortScores, filterScores } from '@/utils/sorting';

interface RepertoireContextValue {
  currentInstance: RepertoireInstance | null;
  userRole: UserRole;
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
  createGroup: (params: CreateGroupParams) => Promise<{ success: boolean; code?: string; error?: string }>;
  uploadScore: (
    scoreData: UploadScoreData,
    file: { uri: string; name: string; size?: number }
  ) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  reSyncAll: () => Promise<void>;
  toggleFavorite: (scoreId: string) => Promise<void>;
  clearOfflineCache: () => Promise<void>;
}

const RepertoireContext = createContext<RepertoireContextValue | undefined>(undefined);

export function RepertoireProvider({ children }: { children: React.ReactNode }) {
  const [currentInstance, setCurrentInstance] = useState<RepertoireInstance | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('member');
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
          const role = await StorageService.getUserRole(activeCode);
          setUserRole(role);

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
          const fresh = await DatabaseService.getGroupByCode(activeCode);
          if (fresh) {
            setCurrentInstance(fresh);
            await StorageService.saveCachedInstance(fresh);
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

  // Handle Login with Access Code (Links user to group and syncs)
  const signInWithCode = async (rawCode: string): Promise<{ success: boolean; error?: string }> => {
    const cleanCode = rawCode.trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, error: 'Please enter a choir access code.' };
    }

    const instance = await DatabaseService.getGroupByCode(cleanCode);
    if (!instance) {
      return {
        success: false,
        error: `Choir code "${cleanCode}" does not exist in the database. Please verify the code and try again.`,
      };
    }

    try {
      await StorageService.setActiveInstanceCode(instance.code);
      await StorageService.saveCachedInstance(instance);

      // Check stored role or default to member
      const role = await StorageService.getUserRole(instance.code);
      setUserRole(role);

      const uris = await StorageService.getLocalScoreUris(instance.code);
      const favs = await StorageService.getFavorites(instance.code);

      setCurrentInstance(instance);
      setLocalUris(uris);
      setFavorites(favs);

      // Trigger automatic download of all PDFs
      syncScoresForInstance(instance);

      return { success: true };
    } catch (e) {
      return { success: false, error: 'Failed to connect and sync repertoire.' };
    }
  };

  // Create a new Refer-toire Group (initially empty, user is admin)
  const createGroup = async (
    params: CreateGroupParams
  ): Promise<{ success: boolean; code?: string; error?: string }> => {
    try {
      const { instance, role } = await DatabaseService.createGroup(params);

      await StorageService.setActiveInstanceCode(instance.code);
      setCurrentInstance(instance);
      setUserRole(role);
      setLocalUris({});
      setFavorites([]);

      return { success: true, code: instance.code };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Could not create new group.' };
    }
  };

  // Upload a new PDF Score (available to admins)
  const uploadScore = async (
    scoreData: UploadScoreData,
    file: { uri: string; name: string; size?: number }
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentInstance) {
      return { success: false, error: 'No active choir group selected.' };
    }

    try {
      const createdScore = await DatabaseService.uploadScoreToGroup(currentInstance.code, scoreData, file);

      // Update local state immediately so dashboard reflects the new score
      setCurrentInstance(prev => {
        if (!prev) return prev;
        const otherScores = prev.scores.filter(s => s.id !== createdScore.id);
        return {
          ...prev,
          scores: [createdScore, ...otherScores],
          lastUpdated: new Date().toISOString(),
        };
      });

      setLocalUris(prev => ({
        ...prev,
        [createdScore.id]: createdScore.localUri || createdScore.sourceUrl,
      }));

      return { success: true };
    } catch (err: any) {
      console.error('Upload score error in context:', err);
      return { success: false, error: err?.message || 'Failed to upload score.' };
    }
  };

  // Sign out / Switch Choir
  const signOut = async () => {
    await StorageService.setActiveInstanceCode(null);
    setCurrentInstance(null);
    setUserRole('member');
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
        localUri: localUri || s.localUri,
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
        userRole,
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
        createGroup,
        uploadScore,
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
