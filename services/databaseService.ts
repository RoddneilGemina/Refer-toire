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
   * Automatically sets the creator's role to 'admin'
   */
  static async createGroup(params: CreateGroupParams): Promise<{
    instance: RepertoireInstance;
    role: UserRole;
  }> {
    let finalCode = params.customCode?.trim().toUpperCase();
    if (!finalCode) {
      finalCode = this.generateUniqueCode(params.name);
    }

    // Check collision with demo or existing
    const existing = await this.getGroupByCode(finalCode);
    if (existing) {
      // Add random digits if duplicate
      finalCode = `${finalCode}-${Math.floor(100 + Math.random() * 900)}`;
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
      scores: [], // Starts completely empty as requested
      setlists: [],
    };

    // Save to persistent storage
    await StorageService.saveCustomInstance(newInstance);
    await StorageService.setUserRole(finalCode, 'admin');

    return {
      instance: newInstance,
      role: 'admin',
    };
  }

  /**
   * Look up group by code (checks custom instances first, then demo catalog)
   */
  static async getGroupByCode(rawCode: string): Promise<RepertoireInstance | null> {
    const code = rawCode.trim().toUpperCase();

    // 1. Check custom instances
    const customList = await StorageService.getCustomInstances();
    const foundCustom = customList.find(i => i.code === code);
    if (foundCustom) {
      return JSON.parse(JSON.stringify(foundCustom));
    }

    // 2. Check cached instance in AsyncStorage
    const cached = await StorageService.getCachedInstance(code);
    if (cached) {
      return cached;
    }

    // 3. Check demo instances
    if (DEMO_INSTANCES[code]) {
      return JSON.parse(JSON.stringify(DEMO_INSTANCES[code]));
    }

    // 4. Synthesize valid code pattern if not found
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

    // Ensure target local folder exists
    const dir = new Directory(Paths.document, 'refertoire_scores', instanceCode);
    try {
      if (!dir.exists) {
        dir.create({ intermediates: true });
      }
    } catch {
      // Ignored
    }

    let localFileUri = fileData.uri;

    // Copy or write file to local app storage directory
    try {
      const targetFile = new File(dir, fileName);
      if (Platform.OS !== 'web' && fileData.uri.startsWith('file://')) {
        const sourceFile = new File(fileData.uri);
        if (sourceFile.exists) {
          await sourceFile.copy(targetFile);
          localFileUri = targetFile.uri;
        }
      } else {
        // On web or content URI, save URI reference
        localFileUri = targetFile.uri || fileData.uri;
      }
    } catch (copyErr) {
      console.warn('Could not copy PDF to storage folder, using source URI:', copyErr);
      localFileUri = fileData.uri;
    }

    const newScore: ScoreItem = {
      id: scoreId,
      title: scoreData.title.trim(),
      composer: scoreData.composer.trim(),
      arranger: scoreData.arranger?.trim() || undefined,
      voicing: scoreData.voicing,
      season: scoreData.season,
      keySignature: scoreData.keySignature?.trim() || undefined,
      tempo: scoreData.tempo?.trim() || undefined,
      duration: scoreData.duration?.trim() || '3:00',
      pageCount: scoreData.pageCount || 2,
      sourceUrl: localFileUri,
      localUri: localFileUri,
      fileSize: fileData.size || 185000,
      downloadStatus: 'completed',
      downloadProgress: 100,
      notes: scoreData.notes?.trim() || undefined,
      tags: scoreData.tags && scoreData.tags.length > 0 ? scoreData.tags : ['Uploaded', scoreData.season],
      addedAt: new Date().toISOString(),
    };

    // Add to instance scores list
    instance.scores.unshift(newScore);
    instance.lastUpdated = new Date().toISOString();

    // Persist to custom storage & cache
    await StorageService.saveCustomInstance(instance);
    await StorageService.saveLocalScoreUri(instanceCode, scoreId, localFileUri);

    return newScore;
  }

  /**
   * Delete a score from group
   */
  static async deleteScoreFromGroup(instanceCode: string, scoreId: string): Promise<void> {
    const instance = await this.getGroupByCode(instanceCode);
    if (!instance) return;

    instance.scores = instance.scores.filter(s => s.id !== scoreId);
    instance.lastUpdated = new Date().toISOString();
    await StorageService.saveCustomInstance(instance);
  }
}
