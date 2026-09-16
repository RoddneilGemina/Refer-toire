import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  RepertoireInstance,
  ScoreItem,
  SyncProgress,
  SortOption,
  Voicing,
  LiturgicalSeason,
  PieceGenre,
  Setlist,
  UserRole,
  CreateGroupParams,
  UploadScoreData,
  UserProfile,
  EnsembleMember,
} from '@/types/repertoire';
import { AuthService, SignUpParams, SignInParams } from '@/services/authService';
import { DatabaseService } from '@/services/databaseService';
import { DownloadService } from '@/services/downloadService';
import { StorageService } from '@/services/storageService';
import { NetworkService } from '@/services/networkService';
import { SORT_OPTIONS, sortScores, filterScores } from '@/utils/sorting';

interface RepertoireContextValue {
  currentUser: UserProfile | null;
  currentInstance: RepertoireInstance | null;
  userRole: UserRole;
  ensembleMembers: EnsembleMember[];
  isLoading: boolean;
  isSyncing: boolean;
  syncProgress: SyncProgress | null;
  scores: ScoreItem[];
  localUris: Record<string, string>;
  filteredAndSortedScores: ScoreItem[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sortOption: SortOption;
  setSortOption: (opt: SortOption) => void;
  voicingFilter: Voicing | 'ALL';
  setVoicingFilter: (v: Voicing | 'ALL') => void;
  seasonFilter: LiturgicalSeason | 'ALL';
  setSeasonFilter: (s: LiturgicalSeason | 'ALL') => void;
  genreFilter: PieceGenre | 'ALL';
  setGenreFilter: (g: PieceGenre | 'ALL') => void;
  favoritesOnly: boolean;
  setFavoritesOnly: (fav: boolean) => void;
  isOfflineMode: boolean;
  setOfflineMode: (enabled: boolean) => Promise<void>;
  preferredVoicePart: string | null;
  setPreferredVoicePart: (part: string | null) => Promise<void>;
  signUp: (params: SignUpParams) => Promise<{ success: boolean; user?: UserProfile; error?: string }>;
  signIn: (params: SignInParams) => Promise<{ success: boolean; user?: UserProfile; error?: string }>;
  signOutUser: () => Promise<void>;
  signInWithCode: (code: string) => Promise<{ success: boolean; error?: string }>;
  createGroup: (params: CreateGroupParams) => Promise<{ success: boolean; code?: string; error?: string }>;
  loadEnsembleMembers: () => Promise<void>;
  promoteMember: (targetUserId: string) => Promise<{ success: boolean; error?: string }>;
  demoteMember: (targetUserId: string) => Promise<{ success: boolean; error?: string }>;
  createProgram: (data: {
    title: string;
    date?: string;
    venue?: string;
    description?: string;
    scoreIds: string[];
  }) => Promise<{ success: boolean; program?: Setlist; error?: string }>;
  updateProgram: (programId: string, data: Partial<Setlist>) => Promise<{ success: boolean; error?: string }>;
  deleteProgram: (programId: string) => Promise<{ success: boolean; error?: string }>;
  uploadScore: (
    scoreData: UploadScoreData,
    file: { uri: string; name: string; size?: number }
  ) => Promise<{ success: boolean; error?: string }>;
  deleteScore: (scoreId: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  reSyncAll: () => Promise<void>;
  toggleFavorite: (scoreId: string) => Promise<void>;
  clearOfflineCache: () => Promise<void>;
  purgeCleanSlate: () => Promise<void>;
}

const RepertoireContext = createContext<RepertoireContextValue | undefined>(undefined);

export function RepertoireProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [currentInstance, setCurrentInstance] = useState<RepertoireInstance | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('member');
  const [ensembleMembers, setEnsembleMembers] = useState<EnsembleMember[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [localUris, setLocalUris] = useState<Record<string, string>>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [preferredVoicePart, setPreferredVoicePartState] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineModeState] = useState<boolean>(false);

  // Sorting & Filtering State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOption, setSortOption] = useState<SortOption>(SORT_OPTIONS[0]);
  const [voicingFilter, setVoicingFilter] = useState<Voicing | 'ALL'>('ALL');
  const [seasonFilter, setSeasonFilter] = useState<LiturgicalSeason | 'ALL'>('ALL');
  const [genreFilter, setGenreFilter] = useState<PieceGenre | 'ALL'>('ALL');
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

  // Load ensemble members
  const loadEnsembleMembers = useCallback(async () => {
    if (!currentInstance) return;
    try {
      const members = await DatabaseService.getEnsembleMembers(currentInstance.code);
      setEnsembleMembers(members);
    } catch (e) {
      console.warn('Failed to load ensemble members:', e);
    }
  }, [currentInstance]);

  // Initial boot: restore authenticated user and active ensemble from offline storage
  useEffect(() => {
    async function initSession() {
      try {
        // 1. Restore authenticated user (persisted offline indefinitely)
        const user = await AuthService.getCurrentUser();
        setCurrentUser(user);

        // 2. Restore voice part preference
        const preferredPart = await StorageService.getPreferredVoicePart();
        setPreferredVoicePartState(preferredPart || user?.voicePart || null);

        // 3. Restore offline mode preference
        const offlineModeStored = await StorageService.getOfflineMode();
        setIsOfflineModeState(offlineModeStored);

        // 4. Restore active choir instance
        const activeCode = await StorageService.getActiveInstanceCode();
        if (activeCode) {
          const role = await StorageService.getUserRole(activeCode);
          setUserRole(role);

          const cached = await StorageService.getCachedInstance(activeCode);
          const uris = await StorageService.getLocalScoreUris(activeCode);
          const favs = await StorageService.getFavorites(activeCode);
          const cachedMembers = await StorageService.getEnsembleMembers(activeCode);

          setLocalUris(uris);
          setFavorites(favs);
          setEnsembleMembers(cachedMembers);

          if (cached) {
            setCurrentInstance(cached);
          }

          // Fetch fresh cloud instance & members in background if not in offline mode
          if (!offlineModeStored) {
            DatabaseService.getGroupByCode(activeCode).then(fresh => {
              if (fresh) {
                setCurrentInstance(fresh);
                StorageService.saveCachedInstance(fresh);
                syncScoresForInstance(fresh);
              }
            });

            DatabaseService.getEnsembleMembers(activeCode).then(members => {
              if (members.length > 0) {
                setEnsembleMembers(members);
                // Update user role if changed in cloud
                if (user) {
                  const myMembership = members.find(m => m.userId === user.id);
                  if (myMembership) {
                    setUserRole(myMembership.role);
                    StorageService.setUserRole(activeCode, myMembership.role);
                  }
                }
              }
            });
          }
        }
      } catch (err) {
        console.warn('Init session error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    initSession();
  }, [syncScoresForInstance]);

  // Automatic Online / Offline synchronization based on real-time internet connectivity
  useEffect(() => {
    const unsubscribe = NetworkService.subscribe((isOnline) => {
      const offline = !isOnline;
      setIsOfflineModeState(offline);
      StorageService.setOfflineMode(offline);

      if (isOnline && currentInstance) {
        // Automatically refresh cloud instance and sync when internet access is restored
        DatabaseService.getGroupByCode(currentInstance.code).then(fresh => {
          if (fresh) {
            setCurrentInstance(fresh);
            syncScoresForInstance(fresh);
          }
        });
        loadEnsembleMembers();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentInstance, syncScoresForInstance, loadEnsembleMembers]);

  // Handle Sign Up
  const signUp = async (params: SignUpParams) => {
    const res = await AuthService.signUp(params);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      if (res.user.voicePart) {
        setPreferredVoicePartState(res.user.voicePart);
      }
    }
    return res;
  };

  // Handle Sign In
  const signIn = async (params: SignInParams) => {
    const res = await AuthService.signIn(params);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      if (res.user.voicePart) {
        setPreferredVoicePartState(res.user.voicePart);
      }
    }
    return res;
  };

  // Handle Sign Out from User Account
  const signOutUser = async () => {
    await AuthService.signOut();
    setCurrentUser(null);
    setCurrentInstance(null);
    setUserRole('member');
    setEnsembleMembers([]);
    setLocalUris({});
    setFavorites([]);
  };

  // Handle Joining an Ensemble via Code
  const signInWithCode = async (rawCode: string): Promise<{ success: boolean; error?: string }> => {
    const cleanCode = rawCode.trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, error: 'Please enter a choir access code.' };
    }

    try {
      const { instance, role, error } = await DatabaseService.joinGroupByCode(cleanCode, currentUser);
      if (!instance || error) {
        return {
          success: false,
          error: error || `Ensemble code "${cleanCode}" was not found in the database.`,
        };
      }

      await StorageService.setActiveInstanceCode(instance.code);
      await StorageService.saveCachedInstance(instance);
      await StorageService.setUserRole(instance.code, role);

      setCurrentInstance(instance);
      setUserRole(role);

      const uris = await StorageService.getLocalScoreUris(instance.code);
      const favs = await StorageService.getFavorites(instance.code);
      setLocalUris(uris);
      setFavorites(favs);

      // Load members for this group
      const members = await DatabaseService.getEnsembleMembers(instance.code);
      setEnsembleMembers(members);

      // Trigger automatic download of sheet music
      syncScoresForInstance(instance);

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to connect and sync repertoire.' };
    }
  };

  // Create a new Refer-toire Group (initially empty, creator is ADMIN by default)
  const createGroup = async (
    params: CreateGroupParams
  ): Promise<{ success: boolean; code?: string; error?: string }> => {
    try {
      const { instance, role } = await DatabaseService.createGroup(params, currentUser);

      await StorageService.setActiveInstanceCode(instance.code);
      setCurrentInstance(instance);
      setUserRole(role);
      setLocalUris({});
      setFavorites([]);

      const members = await DatabaseService.getEnsembleMembers(instance.code);
      setEnsembleMembers(members);

      return { success: true, code: instance.code };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Could not create new group.' };
    }
  };

  // Promote a member to Admin
  const promoteMember = async (targetUserId: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentInstance) return { success: false, error: 'No active ensemble selected.' };
    if (userRole !== 'admin') return { success: false, error: 'Only admins can promote other members.' };

    const res = await DatabaseService.promoteMemberToAdmin(currentInstance.code, targetUserId);
    if (res.success) {
      await loadEnsembleMembers();
    }
    return res;
  };

  // Demote an Admin to Member (Owner or Admins can perform this; owner cannot be demoted)
  const demoteMember = async (targetUserId: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentInstance) return { success: false, error: 'No active ensemble selected.' };
    if (userRole !== 'admin') return { success: false, error: 'Only admins can demote other members.' };

    const res = await DatabaseService.demoteAdminToMember(currentInstance.code, targetUserId);
    if (res.success) {
      await loadEnsembleMembers();
      if (currentUser?.id === targetUserId) {
        setUserRole('member');
      }
    }
    return res;
  };

  // Create a new concert program
  const createProgram = async (data: {
    title: string;
    date?: string;
    venue?: string;
    description?: string;
    scoreIds: string[];
  }): Promise<{ success: boolean; program?: Setlist; error?: string }> => {
    if (!currentInstance) return { success: false, error: 'No active ensemble.' };
    if (userRole !== 'admin') return { success: false, error: 'Only admins can create programs.' };

    try {
      const program = await DatabaseService.createProgram(currentInstance.code, data);
      const updated = await DatabaseService.getGroupByCode(currentInstance.code);
      if (updated) setCurrentInstance(updated);
      return { success: true, program };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to create program' };
    }
  };

  // Update a concert program
  const updateProgram = async (
    programId: string,
    data: Partial<Setlist>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentInstance) return { success: false, error: 'No active ensemble.' };
    if (userRole !== 'admin') return { success: false, error: 'Only admins can edit programs.' };

    try {
      await DatabaseService.updateProgram(currentInstance.code, programId, data);
      const updated = await DatabaseService.getGroupByCode(currentInstance.code);
      if (updated) setCurrentInstance(updated);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update program' };
    }
  };

  // Delete a concert program
  const deleteProgram = async (programId: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentInstance) return { success: false, error: 'No active ensemble.' };
    if (userRole !== 'admin') return { success: false, error: 'Only admins can delete programs.' };

    try {
      await DatabaseService.deleteProgram(currentInstance.code, programId);
      const updated = await DatabaseService.getGroupByCode(currentInstance.code);
      if (updated) setCurrentInstance(updated);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to delete program' };
    }
  };

  // Set Offline Mode toggle
  const setOfflineMode = async (enabled: boolean) => {
    NetworkService.setSimulatedStatus(!enabled);
    await StorageService.setOfflineMode(enabled);
    setIsOfflineModeState(enabled);
    if (!enabled && currentInstance) {
      // Switching to online mode: refresh cloud instance in background
      DatabaseService.getGroupByCode(currentInstance.code).then(fresh => {
        if (fresh) setCurrentInstance(fresh);
      });
      loadEnsembleMembers();
    }
  };

  // Upload a new PDF Score (Restricted to Admins)
  const uploadScore = async (
    scoreData: UploadScoreData,
    file: { uri: string; name: string; size?: number }
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentInstance) {
      return { success: false, error: 'No active choir group selected.' };
    }
    if (userRole !== 'admin') {
      return { success: false, error: 'Permission denied. Only admins can upload scores.' };
    }

    try {
      const createdScore = await DatabaseService.uploadScoreToGroup(
        currentInstance.code,
        scoreData,
        file,
        currentUser?.id
      );

      // Update local state immediately
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

  // Delete a score (Restricted to Admins)
  const deleteScore = async (scoreId: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentInstance) return { success: false, error: 'No active ensemble.' };
    if (userRole !== 'admin') return { success: false, error: 'Only admins can delete scores.' };

    await DatabaseService.deleteScoreFromGroup(currentInstance.code, scoreId);

    setCurrentInstance(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        scores: prev.scores.filter(s => s.id !== scoreId),
        lastUpdated: new Date().toISOString(),
      };
    });

    return { success: true };
  };

  // Switch Choir / Sign Out of active group (leaves user account logged in)
  const signOut = async () => {
    await StorageService.setActiveInstanceCode(null);
    setCurrentInstance(null);
    setUserRole('member');
    setEnsembleMembers([]);
    setLocalUris({});
    setFavorites([]);
  };

  // Force re-sync
  const reSyncAll = async () => {
    if (!currentInstance) return;
    await syncScoresForInstance(currentInstance);
    await loadEnsembleMembers();
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

  // Clean slate purge
  const purgeCleanSlate = async () => {
    await DatabaseService.purgeCleanSlateDatabase();
    setCurrentInstance(null);
    setCurrentUser(null);
    setUserRole('member');
    setEnsembleMembers([]);
    setLocalUris({});
    setFavorites([]);
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
    const filtered = filterScores(
      scores,
      searchQuery,
      voicingFilter,
      seasonFilter,
      favoritesOnly,
      genreFilter
    );
    return sortScores(filtered, sortOption);
  }, [scores, searchQuery, voicingFilter, seasonFilter, favoritesOnly, genreFilter, sortOption]);

  return (
    <RepertoireContext.Provider
      value={{
        currentUser,
        currentInstance,
        userRole,
        ensembleMembers,
        isLoading,
        isSyncing,
        syncProgress,
        scores,
        localUris,
        filteredAndSortedScores,
        searchQuery,
        setSearchQuery,
        sortOption,
        setSortOption,
        voicingFilter,
        setVoicingFilter,
        seasonFilter,
        setSeasonFilter,
        genreFilter,
        setGenreFilter,
        favoritesOnly,
        setFavoritesOnly,
        isOfflineMode,
        setOfflineMode,
        preferredVoicePart,
        setPreferredVoicePart,
        signUp,
        signIn,
        signOutUser,
        signInWithCode,
        createGroup,
        loadEnsembleMembers,
        promoteMember,
        demoteMember,
        createProgram,
        updateProgram,
        deleteProgram,
        uploadScore,
        deleteScore,
        signOut,
        reSyncAll,
        toggleFavorite,
        clearOfflineCache,
        purgeCleanSlate,
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
