import { Platform } from 'react-native';
import { Paths, Directory, File } from 'expo-file-system';
import {
  RepertoireInstance,
  ScoreItem,
  CreateGroupParams,
  UploadScoreData,
  UserRole,
} from '@/types/repertoire';
import { DEMO_INSTANCES } from './instanceService';
import { StorageService } from './storageService';
import { supabase } from '@/lib/supabase';

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
   * Create a new, initially empty Refer-toire group
   * Syncs to Supabase instances table and caches locally
   */
  static async createGroup(params: CreateGroupParams): Promise<{
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
      adminKey,
      isCustom: true,
      createdDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      scores: [], // Starts completely empty
      setlists: [],
    };

    // 1. Persist to Supabase if connected
    try {
      const { error: sbError } = await supabase.from('instances').insert({
        code: finalCode,
        name: newInstance.name,
        director: newInstance.director,
        subtitle: newInstance.subtitle,
        season_name: newInstance.seasonName,
        admin_key: adminKey,
      });
      if (sbError) {
        console.warn('Supabase group insert notice:', sbError.message);
      }
    } catch (e) {
      console.warn('Supabase offline fallback:', e);
    }

    // 2. Always save locally for offline performance
    await StorageService.saveCustomInstance(newInstance);
    await StorageService.setUserRole(finalCode, 'admin');

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

    // 1. Try Supabase cloud database
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
          keySignature: row.key_signature || undefined,
          tempo: row.tempo || undefined,
          duration: row.duration || '3:00',
          pageCount: row.page_count || 2,
          sourceUrl: row.file_url,
          fileSize: Number(row.file_size) || 150000,
          downloadStatus: 'idle',
          notes: row.notes || undefined,
          tags: row.tags || ['Uploaded'],
          addedAt: row.created_at,
        }));

        const cloudInstance: RepertoireInstance = {
          code: instData.code,
          name: instData.name,
          director: instData.director,
          subtitle: instData.subtitle || undefined,
          seasonName: instData.season_name || 'Current Season',
          adminKey: instData.admin_key || undefined,
          isCustom: true,
          createdDate: instData.created_at,
          lastUpdated: instData.last_updated || instData.created_at,
          scores,
          setlists: [],
        };

        // Cache locally for offline use
        await StorageService.saveCustomInstance(cloudInstance);
        return cloudInstance;
      }
    } catch (e) {
      console.warn('Supabase query error, checking local store:', e);
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

    // 4. Check demo instances
    if (DEMO_INSTANCES[code]) {
      return JSON.parse(JSON.stringify(DEMO_INSTANCES[code]));
    }

    // 5. Synthesize valid code pattern if valid syntax
    if (/^[A-Z0-9]{3,8}-[A-Z0-9]{2,6}$/.test(code)) {
      const synthetic: RepertoireInstance = {
        code,
        name: `Repertoire [${code}]`,
        director: 'Choir Director',
        seasonName: 'Current Season',
        scores: [],
        setlists: [],
        lastUpdated: new Date().toISOString(),
      };
      return synthetic;
    }

    return null;
  }

  /**
   * Upload a new PDF sheet music file into a group's repertoire
   * Uploads to Supabase Storage and inserts record in Supabase scores table
   */
  static async uploadScoreToGroup(
    instanceCode: string,
    scoreData: UploadScoreData,
    fileData: { uri: string; name: string; size?: number }
  ): Promise<ScoreItem> {
    const instance = await this.getGroupByCode(instanceCode);
    if (!instance) {
      throw new Error(`Group instance ${instanceCode} not found.`);
    }

    const scoreId = `score_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fileName = `${scoreId}.pdf`;

    // Ensure local document directory exists
    const dir = new Directory(Paths.document, 'refertoire_scores', instanceCode);
    try {
      if (!dir.exists) {
        dir.create({ intermediates: true });
      }
    } catch {
      // Ignored
    }

    let localFileUri = fileData.uri;

    // Save copy to local app storage
    try {
      const targetFile = new File(dir, fileName);
      if (Platform.OS !== 'web' && fileData.uri.startsWith('file://')) {
        const sourceFile = new File(fileData.uri);
        if (sourceFile.exists) {
          await sourceFile.copy(targetFile);
          localFileUri = targetFile.uri;
        }
      } else {
        localFileUri = targetFile.uri || fileData.uri;
      }
    } catch (copyErr) {
      console.warn('Could not copy PDF to storage folder:', copyErr);
      localFileUri = fileData.uri;
    }

    let cloudFileUrl = localFileUri;

    // Upload to Supabase Storage bucket 'scores'
    try {
      const response = await fetch(fileData.uri);
      const blob = await response.blob();
      const storagePath = `${instanceCode}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('scores')
        .upload(storagePath, blob, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage.from('scores').getPublicUrl(storagePath);
        if (urlData?.publicUrl) {
          cloudFileUrl = urlData.publicUrl;
        }
      }
    } catch (storageErr) {
      console.warn('Supabase storage upload notice (using local file):', storageErr);
    }

    const newScore: ScoreItem = {
      id: scoreId,
      title: scoreData.title.trim(),
      composer: scoreData.composer?.trim() || 'Choral',
      arranger: scoreData.arranger?.trim() || undefined,
      voicing: scoreData.voicing || 'SATB',
      season: scoreData.season || 'General',
      keySignature: scoreData.keySignature?.trim() || undefined,
      tempo: scoreData.tempo?.trim() || undefined,
      duration: scoreData.duration?.trim() || '3:00',
      pageCount: scoreData.pageCount || 2,
      sourceUrl: cloudFileUrl,
      localUri: localFileUri,
      fileSize: fileData.size || 185000,
      downloadStatus: 'completed',
      downloadProgress: 100,
      notes: scoreData.notes?.trim() || undefined,
      tags: scoreData.tags && scoreData.tags.length > 0 ? scoreData.tags : ['Uploaded', scoreData.season || 'General'],
      addedAt: new Date().toISOString(),
    };

    // Insert record in Supabase scores table
    try {
      await supabase.from('scores').insert({
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
      });
    } catch (dbErr) {
      console.warn('Supabase DB score insert notice:', dbErr);
    }

    // Save to local instance catalog & cache
    instance.scores.unshift(newScore);
    instance.lastUpdated = new Date().toISOString();
    await StorageService.saveCustomInstance(instance);
    await StorageService.saveLocalScoreUri(instanceCode, scoreId, localFileUri);

    return newScore;
  }

  /**
   * Delete a score from group
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
}
