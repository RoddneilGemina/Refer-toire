import { supabase } from '@/lib/supabase';
import { StorageService } from './storageService';
import { UserProfile } from '@/types/repertoire';

export interface SignUpParams {
  email: string;
  password: string;
  fullName: string;
  voicePart?: string;
}

export interface SignInParams {
  email: string;
  password: string;
}

function generateLocalUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'usr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

export class AuthService {
  /**
   * Register a new user account (Supabase Auth + Database Profile + Offline Persistence)
   */
  static async signUp(params: SignUpParams): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const email = params.email.trim().toLowerCase();
    const fullName = params.fullName.trim();
    const voicePart = params.voicePart || 'General';

    if (!email || !params.password) {
      return { success: false, error: 'Email and password are required.' };
    }
    if (!fullName) {
      return { success: false, error: 'Full name is required.' };
    }
    if (params.password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    const localProfile: UserProfile = {
      id: generateLocalUUID(),
      email,
      fullName,
      voicePart,
      createdAt: new Date().toISOString(),
    };

    // Always register in local offline database first
    await StorageService.saveRegisteredUser(email, localProfile, params.password);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: params.password,
        options: {
          data: {
            full_name: fullName,
            voice_part: voicePart,
          },
        },
      });

      if (error) {
        console.warn('Supabase auth sign up notice:', error.message);
        if (error.message.toLowerCase().includes('already registered')) {
          return { success: false, error: 'An account with this email already exists.' };
        }
        // Seamlessly fallback for secret key restriction, network, or offline environment
        await StorageService.saveCurrentUser(localProfile);
        await StorageService.setPreferredVoicePart(voicePart);
        return { success: true, user: localProfile };
      }

      const authUser = data.user;
      if (!authUser) {
        await StorageService.saveCurrentUser(localProfile);
        await StorageService.setPreferredVoicePart(voicePart);
        return { success: true, user: localProfile };
      }

      const userProfile: UserProfile = {
        id: authUser.id,
        email: authUser.email || email,
        fullName,
        voicePart,
        createdAt: authUser.created_at || new Date().toISOString(),
      };

      // Upsert profile in public.profiles table
      try {
        await supabase.from('profiles').upsert({
          id: userProfile.id,
          email: userProfile.email,
          full_name: userProfile.fullName,
          voice_part: userProfile.voicePart,
          updated_at: new Date().toISOString(),
        });
      } catch (profileErr) {
        console.warn('Profile DB upsert notice:', profileErr);
      }

      // Persist user offline
      await StorageService.saveRegisteredUser(email, userProfile, params.password);
      await StorageService.saveCurrentUser(userProfile);
      await StorageService.setPreferredVoicePart(voicePart);

      return { success: true, user: userProfile };
    } catch (err: any) {
      console.warn('Auth sign up error, applying offline fallback:', err);
      await StorageService.saveCurrentUser(localProfile);
      await StorageService.setPreferredVoicePart(voicePart);
      return { success: true, user: localProfile };
    }
  }

  /**
   * Log in with email and password
   */
  static async signIn(params: SignInParams): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const email = params.email.trim().toLowerCase();

    if (!email || !params.password) {
      return { success: false, error: 'Email and password are required.' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: params.password,
      });

      if (error) {
        console.warn('Supabase sign in notice:', error.message);
        // Check offline database for registered account
        const localReg = await StorageService.findRegisteredUser(email);
        if (localReg) {
          if (localReg.password === params.password) {
            await StorageService.saveCurrentUser(localReg.profile);
            if (localReg.profile.voicePart) {
              await StorageService.setPreferredVoicePart(localReg.profile.voicePart);
            }
            return { success: true, user: localReg.profile };
          }
          return { success: false, error: 'Invalid email or password.' };
        }

        const cachedUser = await StorageService.getCurrentUser();
        if (cachedUser && cachedUser.email.toLowerCase() === email) {
          return { success: true, user: cachedUser };
        }
        return { success: false, error: error.message };
      }

      const authUser = data.user;
      if (!authUser) {
        return { success: false, error: 'Could not log in.' };
      }

      // Fetch profile from database
      let userProfile: UserProfile = {
        id: authUser.id,
        email: authUser.email || email,
        fullName: authUser.user_metadata?.full_name || email.split('@')[0],
        voicePart: authUser.user_metadata?.voice_part || 'General',
        createdAt: authUser.created_at || new Date().toISOString(),
      };

      try {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        if (profileRow) {
          userProfile = {
            id: profileRow.id,
            email: profileRow.email,
            fullName: profileRow.full_name || userProfile.fullName,
            voicePart: profileRow.voice_part || userProfile.voicePart,
            createdAt: profileRow.created_at || userProfile.createdAt,
          };
        } else {
          await supabase.from('profiles').upsert({
            id: userProfile.id,
            email: userProfile.email,
            full_name: userProfile.fullName,
            voice_part: userProfile.voicePart,
          });
        }
      } catch (e) {
        console.warn('Could not query profile table:', e);
      }

      // Persist user offline
      await StorageService.saveRegisteredUser(email, userProfile, params.password);
      await StorageService.saveCurrentUser(userProfile);
      if (userProfile.voicePart) {
        await StorageService.setPreferredVoicePart(userProfile.voicePart);
      }

      return { success: true, user: userProfile };
    } catch (err: any) {
      // Offline fallback
      const localReg = await StorageService.findRegisteredUser(email);
      if (localReg) {
        if (localReg.password === params.password) {
          await StorageService.saveCurrentUser(localReg.profile);
          if (localReg.profile.voicePart) {
            await StorageService.setPreferredVoicePart(localReg.profile.voicePart);
          }
          return { success: true, user: localReg.profile };
        }
        return { success: false, error: 'Invalid email or password.' };
      }

      const cachedUser = await StorageService.getCurrentUser();
      if (cachedUser && cachedUser.email.toLowerCase() === email) {
        return { success: true, user: cachedUser };
      }
      return { success: false, error: err?.message || 'Failed to sign in.' };
    }
  }

  /**
   * Log out of current account (clears auth session and active choir)
   */
  static async signOut(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Supabase sign out error:', e);
    }
    await StorageService.saveCurrentUser(null);
    await StorageService.setActiveInstanceCode(null);
  }

  /**
   * Get current authenticated user (always instant from offline storage)
   */
  static async getCurrentUser(): Promise<UserProfile | null> {
    // 1. Instant check in offline storage
    const cached = await StorageService.getCurrentUser();
    if (cached) {
      return cached;
    }

    // 2. Check Supabase session if online
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        const u = data.session.user;
        const profile: UserProfile = {
          id: u.id,
          email: u.email || '',
          fullName: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Choral Singer',
          voicePart: u.user_metadata?.voice_part || 'General',
          createdAt: u.created_at || new Date().toISOString(),
        };
        await StorageService.saveCurrentUser(profile);
        return profile;
      }
    } catch {
      // Ignored
    }

    return null;
  }
}
