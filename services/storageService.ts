import AsyncStorage from '@react-native-async-storage/async-storage';
import { RepertoireInstance, UserRole, UserProfile, EnsembleMember } from '@/types/repertoire';

const STORAGE_KEYS = {
  CURRENT_USER: '@refertoire:current_user',
  ACTIVE_CODE: '@refertoire:active_instance_code',
  CACHED_INSTANCE_PREFIX: '@refertoire:instance:',
  ENSEMBLE_MEMBERS_PREFIX: '@refertoire:members:',
  DOWNLOADED_URIS_PREFIX: '@refertoire:uris:',
  FAVORITES_PREFIX: '@refertoire:favorites:',
  VOICE_PART: '@refertoire:voice_part',
  USER_ROLE_PREFIX: '@refertoire:role:',
  CUSTOM_INSTANCES: '@refertoire:custom_instances_list',
  REGISTERED_USERS: '@refertoire:registered_users',
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
   * Get user role ('admin' | 'member') for a specific instance
   */
  static async getUserRole(instanceCode: string): Promise<UserRole> {
    try {
      const key = `${STORAGE_KEYS.USER_ROLE_PREFIX}${instanceCode}`;
      const role = await AsyncStorage.getItem(key);
      return role === 'admin' ? 'admin' : 'member';
    } catch {
      return 'member';
    }
  }

  /**
   * Set user role for a specific instance
   */
  static async setUserRole(instanceCode: string, role: UserRole): Promise<void> {
    try {
      const key = `${STORAGE_KEYS.USER_ROLE_PREFIX}${instanceCode}`;
      await AsyncStorage.setItem(key, role);
    } catch (e) {
      console.warn('Failed to set user role', e);
    }
  }

  /**
   * Retrieve list of custom user-created instances
   */
  static async getCustomInstances(): Promise<RepertoireInstance[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_INSTANCES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Save a newly created custom instance
   */
  static async saveCustomInstance(instance: RepertoireInstance): Promise<void> {
    try {
      const list = await this.getCustomInstances();
      const existingIdx = list.findIndex(i => i.code === instance.code);
      if (existingIdx >= 0) {
        list[existingIdx] = instance;
      } else {
        list.push(instance);
      }
      await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_INSTANCES, JSON.stringify(list));
      await this.saveCachedInstance(instance);
    } catch (e) {
      console.warn('Failed to save custom instance', e);
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

  /**
   * Retrieve current logged in user profile (persisted offline)
   */
  static async getCurrentUser(): Promise<UserProfile | null> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Save current logged in user profile (persists offline indefinitely)
   */
  static async saveCurrentUser(user: UserProfile | null): Promise<void> {
    try {
      if (user) {
        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
    } catch (e) {
      console.warn('Failed to save current user to storage', e);
    }
  }

  /**
   * Save a user account in offline database
   */
  static async saveRegisteredUser(email: string, profile: UserProfile, password: string): Promise<void> {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.REGISTERED_USERS);
      const map = raw ? JSON.parse(raw) : {};
      map[normalizedEmail] = { profile, password };
      await AsyncStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(map));
    } catch (e) {
      console.warn('Failed to save registered user', e);
    }
  }

  /**
   * Find a user account in offline database
   */
  static async findRegisteredUser(email: string): Promise<{ profile: UserProfile; password: string } | null> {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.REGISTERED_USERS);
      const map = raw ? JSON.parse(raw) : {};
      return map[normalizedEmail] || null;
    } catch {
      return null;
    }
  }

  /**
   * Retrieve cached ensemble members list (for offline access)
   */
  static async getEnsembleMembers(instanceCode: string): Promise<EnsembleMember[]> {
    try {
      const key = `${STORAGE_KEYS.ENSEMBLE_MEMBERS_PREFIX}${instanceCode}`;
      const raw = await AsyncStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Save ensemble members list to local storage
   */
  static async saveEnsembleMembers(instanceCode: string, members: EnsembleMember[]): Promise<void> {
    try {
      const key = `${STORAGE_KEYS.ENSEMBLE_MEMBERS_PREFIX}${instanceCode}`;
      await AsyncStorage.setItem(key, JSON.stringify(members));
    } catch (e) {
      console.warn('Failed to save ensemble members to storage', e);
    }
  }

  /**
   * Wipe all local data for a clean slate
   */
  static async clearAllData(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const refertoireKeys = allKeys.filter(k => k.startsWith('@refertoire:'));
      if (refertoireKeys.length > 0) {
        await AsyncStorage.multiRemove(refertoireKeys);
      }
    } catch (e) {
      console.warn('Failed to clear local data', e);
    }
  }
}
