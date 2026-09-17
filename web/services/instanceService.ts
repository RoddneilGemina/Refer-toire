import { RepertoireInstance } from '@/types/repertoire';

// Clean slate: all preloaded demo instances cleared
export const DEMO_INSTANCES: Record<string, RepertoireInstance> = {};

export class InstanceService {
  /**
   * Validate and retrieve choir repertoire instance by code
   */
  static async fetchInstance(rawCode: string): Promise<RepertoireInstance | null> {
    const normalizedCode = rawCode.trim().toUpperCase();
    if (DEMO_INSTANCES[normalizedCode]) {
      return JSON.parse(JSON.stringify(DEMO_INSTANCES[normalizedCode]));
    }
    return null;
  }

  /**
   * List available demo instances for quick testing
   */
  static getAvailableDemoInstances(): Array<{ code: string; name: string; scoreCount: number }> {
    return Object.values(DEMO_INSTANCES).map(instance => ({
      code: instance.code,
      name: instance.name,
      scoreCount: instance.scores.length,
    }));
  }
}
