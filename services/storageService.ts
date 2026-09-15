import AsyncStorage from '@react-native-async-storage/async-storage';
import { RepertoireInstance } from '@/types/repertoire';

const STORAGE_KEYS = {
  ACTIVE_CODE: '@refertoire:active_instance_code',
  CACHED_INSTANCE_PREFIX: '@refertoire:instance:',
  DOWNLOADED_URIS_PREFIX: '@refertoire:uris:',
  FAVORITES_PREFIX: '@refertoire:favorites:',
  VOICE_PART: '@refertoire:voice_part',
};

export class StorageService {
  /**
   * Get active choir instance code
   */
  static async getActiveInstanceCode(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_CODE);
    } catch {
      return null;
    }
  }

  /**
   * Set active choir instance code (or null on logout)
   */
  static async setActiveInstanceCode(code: string | null): Promise<void> {
    try {
      if (code) {
        await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_CODE, code);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_CODE);
      }
    } catch (e) {
      console.warn('Failed to set active instance code', e);
    }
  }

  /**
   * Store entire instance manifest for offline access
   */
  static async saveCachedInstance(instance: RepertoireInstance): Promise<void> {
    try {
      const key = `${STORAGE_KEYS.CACHED_INSTANCE_PREFIX}${instance.code}`;
      await AsyncStorage.setItem(key, JSON.stringify(instance));
    } catch (e) {
      console.warn('Failed to save cached instance', e);
    }
  }

  /**
   * Retrieve cached instance manifest
   */
  static async getCachedInstance(code: string): Promise<RepertoireInstance | null> {
    try {
      const key = `${STORAGE_KEYS.CACHED_INSTANCE_PREFIX}${code}`;
      const raw = await AsyncStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Get mapping of scoreId -> local file URI
   */
  static async getLocalScoreUris(instanceCode: string): Promise<Record<string, string>> {
    try {
      const key = `${STORAGE_KEYS.DOWNLOADED_URIS_PREFIX}${instanceCode}`;
      const raw = await AsyncStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  /**
   * Save a single downloaded score URI
   */
  static async saveLocalScoreUri(instanceCode: string, scoreId: string, uri: string): Promise<void> {
    try {
      const existing = await this.getLocalScoreUris(instanceCode);
      existing[scoreId] = uri;
      const key = `${STORAGE_KEYS.DOWNLOADED_URIS_PREFIX}${instanceCode}`;
      await AsyncStorage.setItem(key, JSON.stringify(existing));
    } catch (e) {
      console.warn('Failed to save local score URI', e);
    }
  }

  /**
   * Clear downloaded URIs for an instance
   */
  static async clearLocalScoreUris(instanceCode: string): Promise<void> {
    try {
      const key = `${STORAGE_KEYS.DOWNLOADED_URIS_PREFIX}${instanceCode}`;
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn('Failed to clear local score URIs', e);
    }
  }

  /**
   * Retrieve favorites for an instance
   */
  static async getFavorites(instanceCode: string): Promise<string[]> {
    try {
      const key = `${STORAGE_KEYS.FAVORITES_PREFIX}${instanceCode}`;
      const raw = await AsyncStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Toggle a score in favorites
   */
  static async toggleFavorite(instanceCode: string, scoreId: string): Promise<string[]> {
    try {
      const current = await this.getFavorites(instanceCode);
      const updated = current.includes(scoreId)
        ? current.filter(id => id !== scoreId)
        : [...current, scoreId];
      const key = `${STORAGE_KEYS.FAVORITES_PREFIX}${instanceCode}`;
      await AsyncStorage.setItem(key, JSON.stringify(updated));
      return updated;
    } catch {
      return [];
    }
  }

  /**
   * Get user voice part preference (e.g. "Soprano", "Tenor")
   */
  static async getPreferredVoicePart(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.VOICE_PART);
    } catch {
      return null;
    }
  }

  /**
   * Set user voice part preference
   */
  static async setPreferredVoicePart(part: string | null): Promise<void> {
    try {
      if (part) {
        await AsyncStorage.setItem(STORAGE_KEYS.VOICE_PART, part);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.VOICE_PART);
      }
    } catch (e) {
      console.warn('Failed to set preferred voice part', e);
    }
  }
}
