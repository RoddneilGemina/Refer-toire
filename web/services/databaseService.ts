import { Platform } from 'react-native';
import { Paths, Directory, File } from 'expo-file-system';
import {
  RepertoireInstance,
  ScoreItem,
  CreateGroupParams,
  UploadScoreData,
  UserRole,
  UserProfile,
  EnsembleMember,
  Setlist,
  PieceGenre,
} from '@/types/repertoire';
import { StorageService } from './storageService';
import { NetworkService } from './networkService';
import { supabase } from '@/lib/supabase';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class DatabaseService {
  /**
   * Generate a clean, memorable choir access code (e.g. "CANTOR-4819")
   */
  static generateUniqueCode(ensembleName?: string): string {
    let prefix = 'CHOIR';
    if (ensembleName) {
      const sanitized = ensembleName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .substring(0, 6);
      if (sanitized.length >= 3) {
        prefix = sanitized;
      }
    }
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${suffix}`;
  }

  /**
   * Create a new, initially empty Refer-toire group.
   * The creating account is registered as ADMIN by default.
   */
  static async createGroup(
    params: CreateGroupParams,
    currentUser?: UserProfile | null
  ): Promise<{
    instance: RepertoireInstance;
    role: UserRole;
  }> {
    let finalCode = params.customCode?.trim().toUpperCase();
    if (!finalCode) {
      finalCode = this.generateUniqueCode(params.name);
    }

    const adminKey = `adm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const newInstance: RepertoireInstance = {
      code: finalCode,
      name: params.name.trim(),
      subtitle: params.subtitle?.trim() || `${params.director.trim()}'s Choir Repertoire`,
      director: params.director.trim(),
      seasonName: params.seasonName?.trim() || `${new Date().getFullYear()} Season`,
      creatorId: currentUser?.id,
      adminKey,
      isCustom: true,
      createdDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      scores: [], // Starts completely clean
      setlists: [],
      membersCount: 1,
    };

    // 1. Persist to Supabase instances table
    try {
      // Ensure creator profile is synced in public.profiles first
      if (currentUser?.id && NetworkService.isOnline()) {
        try {
          await supabase.from('profiles').upsert({
            id: currentUser.id,
            email: currentUser.email,
            full_name: currentUser.fullName,
            voice_part: currentUser.voicePart || 'General',
            updated_at: new Date().toISOString(),
          });
        } catch (pErr) {
          console.warn('[Supabase Cloud] Profile sync before createGroup notice:', pErr);
        }
      }

      const fullPayload: any = {
        code: finalCode,
        name: newInstance.name,
        director: newInstance.director,
        subtitle: newInstance.subtitle,
        season_name: newInstance.seasonName,
        admin_key: adminKey,
      };
      if (currentUser?.id) {
        fullPayload.creator_id = currentUser.id;
      }
      if (newInstance.setlists) {
        fullPayload.setlists = newInstance.setlists;
      }

      const { error: sbError } = await supabase.from('instances').insert(fullPayload);
      if (sbError) {
        if (sbError.code === 'PGRST204') {
          // Retry with core columns if optional columns (creator_id/setlists) are not migrated yet
          const corePayload = {
            code: finalCode,
            name: newInstance.name,
            director: newInstance.director,
            subtitle: newInstance.subtitle,
            season_name: newInstance.seasonName,
            admin_key: adminKey,
          };
          const { error: retryErr } = await supabase.from('instances').insert(corePayload);
          if (retryErr) {
            console.warn('[Supabase Cloud] Group insert fallback error:', retryErr.message);
          } else {
            console.log(`[Supabase Cloud] Group "${finalCode}" published successfully with core columns!`);
          }
        } else {
          console.warn('[Supabase Cloud] Group insert notice:', sbError.message);
        }
      } else {
        console.log(`[Supabase Cloud] Group "${finalCode}" published successfully!`);
      }

      // Automatically register creator in ensemble_members table as ADMIN if available
      if (currentUser?.id && NetworkService.isOnline()) {
        try {
          const { error: memberErr } = await supabase.from('ensemble_members').upsert({
            instance_code: finalCode,
            user_id: currentUser.id,
            role: 'admin',
            voice_part: currentUser.voicePart || 'General',
            joined_at: new Date().toISOString(),
          });
          if (memberErr) {
            console.warn('[Supabase Cloud] Creator membership insert notice:', memberErr.message);
          }
        } catch {
          // ensemble_members table might not exist yet
        }
      }
    } catch (e) {
      console.warn('Supabase offline fallback for group create:', e);
    }

    // 2. Local persistence (Offline First)
    await StorageService.saveCustomInstance(newInstance);
    await StorageService.setUserRole(finalCode, 'admin');

    if (currentUser) {
      const initialMember: EnsembleMember = {
        id: generateUUID(),
        instanceCode: finalCode,
        userId: currentUser.id,
        fullName: currentUser.fullName,
        email: currentUser.email,
        role: 'admin',
        voicePart: currentUser.voicePart,
        joinedAt: new Date().toISOString(),
      };
      await StorageService.saveEnsembleMembers(finalCode, [initialMember]);
    }

    return {
      instance: newInstance,
      role: 'admin',
    };
  }

  /**
   * Look up group by code (queries Supabase with offline cache fallback)
   */
  static async getGroupByCode(rawCode: string): Promise<RepertoireInstance | null> {
    const code = rawCode.trim().toUpperCase();
    if (!code) return null;

    // Check offline mode
    const isOffline = await StorageService.getOfflineMode();

    // 1. Try Supabase cloud database if not in explicit offline mode
    if (!isOffline) {
      try {
        const { data: instData, error: instError } = await supabase
          .from('instances')
          .select('*')
          .eq('code', code)
          .maybeSingle();

        if (instData && !instError) {
          // Query linked scores from Supabase
          const { data: scoreRows } = await supabase
            .from('scores')
            .select('*')
            .eq('instance_code', code)
            .order('created_at', { ascending: false });

          const scores: ScoreItem[] = (scoreRows || []).map(row => ({
            id: row.id,
            title: row.title,
            composer: row.composer || 'Choral',
            arranger: row.arranger || undefined,
            voicing: row.voicing || 'SATB',
            season: row.season || 'General',
            genre: row.genre || 'General',
            keySignature: row.key_signature || undefined,
            tempo: row.tempo || undefined,
            duration: row.duration || '3:00',
            pageCount: row.page_count || 2,
            sourceUrl: row.file_url,
            fileSize: Number(row.file_size) || 150000,
            downloadStatus: 'completed',
            notes: row.notes || undefined,
            tags: row.tags || ['Uploaded'],
            addedAt: row.created_at,
          }));

          // Count members
          let membersCount = 1;
          try {
            const { count } = await supabase
              .from('ensemble_members')
              .select('*', { count: 'exact', head: true })
              .eq('instance_code', code);
            if (typeof count === 'number') {
              membersCount = count;
            }
          } catch {
            // Ignored
          }

          // Preserve existing local setlists if cloud doesn't have any yet
          const cachedLocal = await StorageService.getCachedInstance(code);
          const cloudSetlists = Array.isArray(instData.setlists) && instData.setlists.length > 0
            ? instData.setlists
            : (cachedLocal?.setlists || []);

          const cloudInstance: RepertoireInstance = {
            code: instData.code,
            name: instData.name,
            director: instData.director,
            subtitle: instData.subtitle || undefined,
            seasonName: instData.season_name || 'Current Season',
            creatorId: instData.creator_id || undefined,
            adminKey: instData.admin_key || undefined,
            isCustom: true,
            createdDate: instData.created_at,
            lastUpdated: instData.last_updated || instData.created_at,
            scores,
            setlists: cloudSetlists,
            membersCount,
          };

          // Cache locally for offline use
          await StorageService.saveCustomInstance(cloudInstance);
          return cloudInstance;
        }
      } catch (e) {
        console.warn('Supabase query error, checking local store:', e);
      }
    }

    // 2. Check local custom instances in AsyncStorage
    const customList = await StorageService.getCustomInstances();
    const foundCustom = customList.find(i => i.code === code);
    if (foundCustom) {
      return JSON.parse(JSON.stringify(foundCustom));
    }

    // 3. Check cached instance in AsyncStorage
    const cached = await StorageService.getCachedInstance(code);
    if (cached) {
      return cached;
    }

    return null;
  }

  /**
   * Fetch all ensembles for a given user account across devices.
   */
  static async getUserEnsembles(userId: string): Promise<RepertoireInstance[]> {
    if (!userId) return [];
    const instancesMap = new Map<string, RepertoireInstance>();

    // 1. Try querying cloud ensemble_members table
    try {
      const { data: memberships, error } = await supabase
        .from('ensemble_members')
        .select('instance_code, role')
        .eq('user_id', userId);

      if (memberships && !error) {
        for (const m of memberships) {
          const inst = await this.getGroupByCode(m.instance_code);
          if (inst) {
            instancesMap.set(inst.code, inst);
            await StorageService.setUserRole(inst.code, m.role as UserRole);
          }
        }
      }
    } catch {
      // Ignored if table doesn't exist yet
    }

    // 2. Try querying instances created by user (creator_id)
    try {
      const { data: created, error } = await supabase
        .from('instances')
        .select('code')
        .eq('creator_id', userId);

      if (created && !error) {
        for (const c of created) {
          if (!instancesMap.has(c.code)) {
            const inst = await this.getGroupByCode(c.code);
            if (inst) {
              instancesMap.set(inst.code, inst);
              await StorageService.setUserRole(inst.code, 'admin');
            }
          }
        }
      }
    } catch {
      // Ignored if column doesn't exist yet
    }

    // 3. Merge with local custom instances
    const localCustom = await StorageService.getCustomInstances();
    for (const inst of localCustom) {
      if (!instancesMap.has(inst.code)) {
        instancesMap.set(inst.code, inst);
      }
    }

    return Array.from(instancesMap.values());
  }

  /**
   * Join an ensemble using code and track the user account in the database.
   * If the user is the creator or already an admin, role 'admin' is preserved;
   * otherwise, the user joins as 'member'.
   */
  static async joinGroupByCode(
    rawCode: string,
    currentUser?: UserProfile | null
  ): Promise<{
    instance: RepertoireInstance | null;
    role: UserRole;
    error?: string;
  }> {
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      return { instance: null, role: 'member', error: 'Please enter an ensemble code.' };
    }

    const instance = await this.getGroupByCode(code);
    if (!instance) {
      return {
        instance: null,
        role: 'member',
        error: `Ensemble code "${code}" not found. Verify the code with your director.`,
      };
    }

    let role: UserRole = 'member';

    // Strictly: Only the creator / owner is admin by default. Other accounts joining in are members only.
    if (currentUser?.id && instance.creatorId === currentUser.id) {
      role = 'admin';
    } else if (currentUser?.id) {
      // Check if user was explicitly promoted to admin in local cache
      const localMembers = await StorageService.getEnsembleMembers(code);
      const found = localMembers.find(m => m.userId === currentUser.id);
      if (found?.role === 'admin') {
        role = 'admin';
      } else {
        // If online, check Supabase
        const isOffline = await StorageService.getOfflineMode();
        if (!isOffline) {
          try {
            const { data: existingMember } = await supabase
              .from('ensemble_members')
              .select('role')
              .eq('instance_code', code)
              .eq('user_id', currentUser.id)
              .maybeSingle();

            if (existingMember?.role === 'admin') {
              role = 'admin';
            }
          } catch {
            // Ignored
          }
        }
      }
    }

    // Record user in Supabase ensemble_members table if online
    if (currentUser?.id) {
      try {
        const isOffline = await StorageService.getOfflineMode();
        if (!isOffline && NetworkService.isOnline()) {
          // Ensure profile is synced to public.profiles first
          try {
            await supabase.from('profiles').upsert({
              id: currentUser.id,
              email: currentUser.email,
              full_name: currentUser.fullName,
              voice_part: currentUser.voicePart || 'General',
              updated_at: new Date().toISOString(),
            });
          } catch (pErr) {
            console.warn('[Supabase Cloud] Profile sync before join notice:', pErr);
          }

          const { error: memberErr } = await supabase.from('ensemble_members').upsert({
            instance_code: code,
            user_id: currentUser.id,
            role: role,
            voice_part: currentUser.voicePart || 'General',
            joined_at: new Date().toISOString(),
          });
          if (memberErr) {
            console.warn('[Supabase Cloud] Member join insert notice:', memberErr.message);
          }
        }
      } catch (err) {
        console.warn('Could not record ensemble member in Supabase:', err);
      }
    }

    // Save local state
    await StorageService.setUserRole(code, role);
    await StorageService.saveCachedInstance(instance);

    if (currentUser) {
      const members = await StorageService.getEnsembleMembers(code);
      const existingIdx = members.findIndex(m => m.userId === currentUser.id);
      const isOwner = instance.creatorId === currentUser.id;
      if (existingIdx >= 0) {
        members[existingIdx] = {
          ...members[existingIdx],
          role: role,
          isOwner,
          voicePart: currentUser.voicePart || members[existingIdx].voicePart,
        };
      } else {
        members.push({
          id: generateUUID(),
          instanceCode: code,
          userId: currentUser.id,
          fullName: currentUser.fullName,
          email: currentUser.email,
          role: role,
          isOwner,
          voicePart: currentUser.voicePart,
          joinedAt: new Date().toISOString(),
        });
      }
      await StorageService.saveEnsembleMembers(code, members);
    }

    return { instance, role };
  }

  /**
   * Retrieve all members of an ensemble.
   * Returns a list sorted with Owner first, other Admins next, followed by Members.
   */
  static async getEnsembleMembers(instanceCode: string): Promise<EnsembleMember[]> {
    const code = instanceCode.trim().toUpperCase();
    if (!code) return [];

    const instance = await this.getGroupByCode(code);
    const creatorId = instance?.creatorId;

    // 1. Try Supabase cloud query if not offline
    const isOffline = await StorageService.getOfflineMode();
    if (!isOffline && NetworkService.isOnline()) {
      try {
        const { data: memberRows, error: memberErr } = await supabase
          .from('ensemble_members')
          .select('id, instance_code, user_id, role, voice_part, joined_at')
          .eq('instance_code', code);

        if (!memberErr && memberRows && memberRows.length > 0) {
          const userIds = Array.from(new Set(memberRows.map((r: any) => r.user_id)));
          const { data: profileRows } = await supabase
            .from('profiles')
            .select('id, email, full_name, voice_part')
            .in('id', userIds);

          const profileMap = new Map<string, any>((profileRows || []).map((p: any) => [p.id, p]));

          const members: EnsembleMember[] = memberRows.map((r: any) => {
            const isOwner = creatorId ? r.user_id === creatorId : false;
            const prof = profileMap.get(r.user_id);
            return {
              id: r.id,
              instanceCode: r.instance_code,
              userId: r.user_id,
              fullName: prof?.full_name || 'Ensemble Singer',
              email: prof?.email || '',
              role: isOwner ? 'admin' : (r.role === 'admin' ? 'admin' : 'member'),
              isOwner,
              voicePart: r.voice_part || prof?.voice_part || 'General',
              joinedAt: r.joined_at,
            };
          });

          // Sort: Owner at top, then other admins, then members, alphabetical
          members.sort((a, b) => {
            if (a.isOwner && !b.isOwner) return -1;
            if (!a.isOwner && b.isOwner) return 1;
            if (a.role === 'admin' && b.role !== 'admin') return -1;
            if (a.role !== 'admin' && b.role === 'admin') return 1;
            return a.fullName.localeCompare(b.fullName);
          });

          // Cache locally for offline use
          await StorageService.saveEnsembleMembers(code, members);
          return members;
        }
      } catch (e) {
        console.warn('Error fetching ensemble members from Supabase:', e);
      }
    }

    // 2. Offline fallback: load from local storage
    const cached = await StorageService.getEnsembleMembers(code);
    cached.forEach(m => {
      m.isOwner = creatorId ? m.userId === creatorId : false;
      if (m.isOwner) m.role = 'admin';
    });
    cached.sort((a, b) => {
      if (a.isOwner && !b.isOwner) return -1;
      if (!a.isOwner && b.isOwner) return 1;
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (a.role !== 'admin' && b.role === 'admin') return 1;
      return a.fullName.localeCompare(b.fullName);
    });
    return cached;
  }

  /**
   * Promote a member to Admin. Only admins can perform this.
   */
  static async promoteMemberToAdmin(
    instanceCode: string,
    targetUserId: string
  ): Promise<{ success: boolean; error?: string }> {
    const code = instanceCode.trim().toUpperCase();

    // 1. Update in Supabase if online
    try {
      const isOffline = await StorageService.getOfflineMode();
      if (!isOffline) {
        const { error } = await supabase
          .from('ensemble_members')
          .update({ role: 'admin' })
          .eq('instance_code', code)
          .eq('user_id', targetUserId);

        if (error) {
          console.warn('Supabase promote notice:', error.message);
        }
      }
    } catch (err) {
      console.warn('Supabase offline promote error:', err);
    }

    // 2. Update in local cache
    const members = await StorageService.getEnsembleMembers(code);
    const updated = members.map(m => {
      if (m.userId === targetUserId) {
        return { ...m, role: 'admin' as UserRole };
      }
      return m;
    });
    await StorageService.saveEnsembleMembers(code, updated);

    // If target is currently logged in user on this device, update user role
    const currentUser = await StorageService.getCurrentUser();
    if (currentUser?.id === targetUserId) {
      await StorageService.setUserRole(code, 'admin');
    }

    return { success: true };
  }

  /**
   * Demote an Admin back to Member.
   * The ensemble owner cannot be demoted.
   */
  static async demoteAdminToMember(
    instanceCode: string,
    targetUserId: string
  ): Promise<{ success: boolean; error?: string }> {
    const code = instanceCode.trim().toUpperCase();
    const instance = await this.getGroupByCode(code);
    if (instance?.creatorId === targetUserId) {
      return { success: false, error: 'The ensemble owner cannot be demoted.' };
    }

    // 1. Update in Supabase (if online)
    try {
      const isOffline = await StorageService.getOfflineMode();
      if (!isOffline) {
        const { error } = await supabase
          .from('ensemble_members')
          .update({ role: 'member' })
          .eq('instance_code', code)
          .eq('user_id', targetUserId);

        if (error) {
          console.warn('Supabase demote notice:', error.message);
        }
      }
    } catch (err) {
      console.warn('Supabase offline demote notice:', err);
    }

    // 2. Update in local cache
    const members = await StorageService.getEnsembleMembers(code);
    const updated = members.map(m => {
      if (m.userId === targetUserId) {
        return { ...m, role: 'member' as UserRole, isOwner: false };
      }
      return m;
    });
    await StorageService.saveEnsembleMembers(code, updated);

    // If target is currently logged in user on this device, update stored role
    const currentUser = await StorageService.getCurrentUser();
    if (currentUser?.id === targetUserId) {
      await StorageService.setUserRole(code, 'member');
    }

    return { success: true };
  }

  /**
   * Create a concert program / setlist for an ensemble.
   * Only admins can create programs.
   */
  static async createProgram(
    instanceCode: string,
    programData: {
      title: string;
      date?: string;
      venue?: string;
      description?: string;
      scoreIds: string[];
    }
  ): Promise<Setlist> {
    const code = instanceCode.trim().toUpperCase();
    const instance = await this.getGroupByCode(code);
    if (!instance) {
      throw new Error(`Ensemble ${code} not found.`);
    }

    const newProgram: Setlist = {
      id: generateUUID(),
      title: programData.title.trim(),
      date: programData.date?.trim() || undefined,
      venue: programData.venue?.trim() || undefined,
      description: programData.description?.trim() || undefined,
      scoreIds: programData.scoreIds || [],
      createdAt: new Date().toISOString(),
    };

    instance.setlists = [newProgram, ...(instance.setlists || [])];
    instance.lastUpdated = new Date().toISOString();

    // 1. Update in Supabase if online
    try {
      const isOffline = await StorageService.getOfflineMode();
      if (!isOffline) {
        await supabase
          .from('instances')
          .update({ setlists: instance.setlists })
          .eq('code', code);
      }
    } catch (e) {
      console.warn('Supabase program save notice:', e);
    }

    // 2. Update local storage
    await StorageService.saveCustomInstance(instance);
    await StorageService.saveCachedInstance(instance);

    return newProgram;
  }

  /**
   * Edit an existing concert program / setlist.
   * Only admins can edit programs.
   */
  static async updateProgram(
    instanceCode: string,
    programId: string,
    updates: Partial<Setlist>
  ): Promise<Setlist> {
    const code = instanceCode.trim().toUpperCase();
    const instance = await this.getGroupByCode(code);
    if (!instance) {
      throw new Error(`Ensemble ${code} not found.`);
    }

    const existingIdx = (instance.setlists || []).findIndex(p => p.id === programId);
    if (existingIdx === -1) {
      throw new Error(`Program ${programId} not found.`);
    }

    const updatedProgram: Setlist = {
      ...instance.setlists[existingIdx],
      ...updates,
      id: programId,
    };

    instance.setlists[existingIdx] = updatedProgram;
    instance.lastUpdated = new Date().toISOString();

    // 1. Update in Supabase if online
    try {
      const isOffline = await StorageService.getOfflineMode();
      if (!isOffline) {
        await supabase
          .from('instances')
          .update({ setlists: instance.setlists })
          .eq('code', code);
      }
    } catch (e) {
      console.warn('Supabase program update notice:', e);
    }

    // 2. Update local storage
    await StorageService.saveCustomInstance(instance);
    await StorageService.saveCachedInstance(instance);

    return updatedProgram;
  }

  /**
   * Delete a concert program / setlist.
   * Only admins can delete programs.
   */
  static async deleteProgram(
    instanceCode: string,
    programId: string
  ): Promise<void> {
    const code = instanceCode.trim().toUpperCase();
    const instance = await this.getGroupByCode(code);
    if (!instance) return;

    instance.setlists = (instance.setlists || []).filter(p => p.id !== programId);
    instance.lastUpdated = new Date().toISOString();

    // 1. Update in Supabase if online
    try {
      const isOffline = await StorageService.getOfflineMode();
      if (!isOffline) {
        await supabase
          .from('instances')
          .update({ setlists: instance.setlists })
          .eq('code', code);
      }
    } catch (e) {
      console.warn('Supabase program delete notice:', e);
    }

    // 2. Update local storage
    await StorageService.saveCustomInstance(instance);
    await StorageService.saveCachedInstance(instance);
  }

  /**
   * Upload a new PDF sheet music file into a group's repertoire.
   * Only admins can call this.
   */
  static async uploadScoreToGroup(
    instanceCode: string,
    scoreData: UploadScoreData,
    fileData: { uri: string; name: string; size?: number },
    uploaderId?: string
  ): Promise<ScoreItem> {
    const instance = await this.getGroupByCode(instanceCode);
    if (!instance) {
      throw new Error(`Group instance ${instanceCode} not found.`);
    }

    const isOffline = await StorageService.getOfflineMode();
    if (isOffline || !NetworkService.isOnline()) {
      throw new Error('Upload unavailable: device is in Offline Mode or has no internet connection. Please connect online to upload scores.');
    }

    const scoreId = generateUUID();
    const fileName = `${scoreId}.pdf`;

    let localFileUri = fileData.uri;

    // Save copy to local app storage on native mobile only
    if (Platform.OS !== 'web') {
      try {
        const dir = new Directory(Paths.document, 'refertoire_scores', instanceCode);
        if (!dir.exists) {
          dir.create({ intermediates: true });
        }
        const targetFile = new File(dir, fileName);
        if (fileData.uri.startsWith('file://')) {
          const sourceFile = new File(fileData.uri);
          if (sourceFile.exists) {
            await sourceFile.copy(targetFile);
            localFileUri = targetFile.uri;
          }
        } else {
          localFileUri = targetFile.uri || fileData.uri;
        }
      } catch (fsErr) {
        console.warn('Native FS copy notice:', fsErr);
        localFileUri = fileData.uri;
      }
    }

    let cloudFileUrl = localFileUri;

    let detectedPageCount = scoreData.pageCount;

    // Upload to Supabase Storage bucket 'scores'
    try {
      let uploadBody: any = null;
      if ((fileData as any).file instanceof Blob) {
        uploadBody = (fileData as any).file;
      } else if (fileData.uri) {
        const response = await fetch(fileData.uri);
        uploadBody = await response.blob();
      }

      // Automatically detect accurate PDF page count from file buffer
      if (uploadBody) {
        try {
          let pdfString = '';
          if (typeof uploadBody.arrayBuffer === 'function') {
            const arrBuf = await uploadBody.arrayBuffer();
            pdfString = new TextDecoder('latin1').decode(new Uint8Array(arrBuf));
          }
          if (pdfString) {
            const countMatch = pdfString.match(/\/Type\s*\/Pages[^>]*\/Count\s+(\d+)/);
            if (countMatch && countMatch[1]) {
              detectedPageCount = parseInt(countMatch[1], 10);
            } else {
              const pageMatches = pdfString.match(/\/Type\s*\/Page\b/g);
              if (pageMatches && pageMatches.length > 0) {
                detectedPageCount = pageMatches.length;
              }
            }
          }
        } catch (cntErr) {
          console.warn('PDF page count detection notice:', cntErr);
        }
      }

      if (uploadBody) {
        const storagePath = `${instanceCode}/${fileName}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('scores')
          .upload(storagePath, uploadBody, {
            contentType: 'application/pdf',
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`Cloud storage upload failed: ${uploadError.message}. Please check your internet connection.`);
        }

        if (uploadData) {
          const { data: urlData } = supabase.storage.from('scores').getPublicUrl(storagePath);
          if (urlData?.publicUrl) {
            cloudFileUrl = urlData.publicUrl;
          }
        }
      }
    } catch (storageErr: any) {
      console.warn('Supabase storage upload exception:', storageErr);
      throw new Error(storageErr?.message || 'Failed to upload PDF file to cloud storage.');
    }

    const newScore: ScoreItem = {
      id: scoreId,
      title: scoreData.title.trim(),
      composer: scoreData.composer?.trim() || 'Choral',
      arranger: scoreData.arranger?.trim() || undefined,
      voicing: scoreData.voicing || 'SATB',
      season: scoreData.season || 'General',
      genre: scoreData.genre || 'General',
      keySignature: scoreData.keySignature?.trim() || undefined,
      tempo: scoreData.tempo?.trim() || undefined,
      duration: scoreData.duration?.trim() || '3:00',
      pageCount: detectedPageCount || 2,
      sourceUrl: cloudFileUrl,
      localUri: localFileUri,
      fileSize: fileData.size || 185000,
      downloadStatus: 'completed',
      downloadProgress: 100,
      notes: scoreData.notes?.trim() || undefined,
      tags: scoreData.tags && scoreData.tags.length > 0 ? scoreData.tags : ['Uploaded', scoreData.season || 'General', scoreData.genre || 'General'],
      addedAt: new Date().toISOString(),
    };

    // Insert record in Supabase scores table
    try {
      const fullScorePayload: any = {
        id: scoreId,
        instance_code: instanceCode,
        title: newScore.title,
        composer: newScore.composer,
        arranger: newScore.arranger || null,
        voicing: newScore.voicing,
        season: newScore.season,
        genre: newScore.genre,
        key_signature: newScore.keySignature || null,
        tempo: newScore.tempo || null,
        duration: newScore.duration,
        page_count: newScore.pageCount,
        file_url: cloudFileUrl,
        file_size: newScore.fileSize,
        notes: newScore.notes || null,
        tags: newScore.tags,
        uploaded_by: uploaderId || null,
      };

      const { data: insertedScore, error: dbErr } = await supabase
        .from('scores')
        .insert(fullScorePayload)
        .select()
        .single();

      if (dbErr) {
        if (dbErr.code === 'PGRST204') {
          // Retry with standard base columns (excluding genre and uploaded_by if not migrated)
          const baseScorePayload: any = {
            id: scoreId,
            instance_code: instanceCode,
            title: newScore.title,
            composer: newScore.composer,
            arranger: newScore.arranger || null,
            voicing: newScore.voicing,
            season: newScore.season,
            key_signature: newScore.keySignature || null,
            tempo: newScore.tempo || null,
            duration: newScore.duration,
            page_count: newScore.pageCount,
            file_url: cloudFileUrl,
            file_size: newScore.fileSize,
            notes: newScore.notes || null,
            tags: newScore.tags,
          };
          const { error: retryErr } = await supabase.from('scores').insert(baseScorePayload);
          if (retryErr) {
            console.warn('[Supabase Cloud] Score base insert error:', retryErr.message);
            throw new Error(`Database score registration failed: ${retryErr.message}`);
          } else {
            console.log(`[Supabase Cloud] Score "${newScore.title}" saved to cloud database!`);
          }
        } else {
          console.warn('[Supabase Cloud] DB score insert notice:', dbErr.message);
          throw new Error(`Database score registration failed: ${dbErr.message}`);
        }
      } else if (insertedScore) {
        newScore.id = insertedScore.id;
        console.log(`[Supabase Cloud] Score "${newScore.title}" saved to cloud database!`);
      }
    } catch (dbErr: any) {
      console.warn('Supabase DB score insert notice:', dbErr);
      throw new Error(dbErr?.message || 'Database error while saving score.');
    }

    // Save to local instance catalog & cache
    const existingScores = instance.scores.filter(s => s.id !== newScore.id);
    instance.scores = [newScore, ...existingScores];
    instance.lastUpdated = new Date().toISOString();
    await StorageService.saveCustomInstance(instance);
    await StorageService.saveLocalScoreUri(instanceCode, newScore.id, localFileUri);

    return newScore;
  }

  /**
   * Delete a score from group. Only admins can call this.
   */
  static async deleteScoreFromGroup(instanceCode: string, scoreId: string): Promise<void> {
    try {
      await supabase.from('scores').delete().eq('id', scoreId);
    } catch {
      // Ignored
    }

    const instance = await this.getGroupByCode(instanceCode);
    if (!instance) return;

    instance.scores = instance.scores.filter(s => s.id !== scoreId);
    instance.lastUpdated = new Date().toISOString();
    await StorageService.saveCustomInstance(instance);
  }

  /**
   * Update the verified page count of a score across Supabase and local cache
   */
  static async updateScorePageCount(
    instanceCode: string,
    scoreId: string,
    pageCount: number
  ): Promise<void> {
    if (!scoreId || !pageCount || pageCount < 1) return;

    // 1. Update in Supabase if online
    try {
      const isOffline = await StorageService.getOfflineMode();
      if (!isOffline && NetworkService.isOnline()) {
        await supabase
          .from('scores')
          .update({ page_count: pageCount })
          .eq('id', scoreId);
      }
    } catch (e) {
      console.warn('Supabase page count update notice:', e);
    }

    // 2. Update in local instance cache
    try {
      const instance = await this.getGroupByCode(instanceCode);
      if (instance) {
        const target = instance.scores.find(s => s.id === scoreId);
        if (target && target.pageCount !== pageCount) {
          target.pageCount = pageCount;
          await StorageService.saveCustomInstance(instance);
          await StorageService.saveCachedInstance(instance);
        }
      }
    } catch {
      // Ignored
    }
  }

  /**
   * Purge all uploaded ensembles and scores for a clean slate
   */
  static async purgeCleanSlateDatabase(): Promise<void> {
    try {
      // Delete scores and instances in cloud if permissions allow
      await supabase.from('scores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('ensemble_members').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('instances').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch (e) {
      console.warn('Cloud purge notice:', e);
    }

    // Clear all local storage
    await StorageService.clearAllData();
  }
}
