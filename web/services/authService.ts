import { supabase } from '@/lib/supabase';
import { StorageService } from './storageService';
import { NetworkService } from './networkService';
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

export interface AuthResult {
  success: boolean;
  user?: UserProfile;
  requiresEmailConfirmation?: boolean;
  message?: string;
  error?: string;
}

export class AuthService {
  /**
   * Register a new user account (Supabase Auth + Database Profile + Offline Persistence)
   */
  static async signUp(params: SignUpParams): Promise<AuthResult> {
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

    if (!NetworkService.isOnline()) {
      return {
        success: false,
        error: 'Cannot create an account while offline. Please connect to the internet to register.',
      };
    }

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
        console.warn('Supabase auth sign up error:', error.message);
        if (error.message.toLowerCase().includes('already registered')) {
          return { success: false, error: 'An account with this email already exists. Please sign in instead.' };
        }
        if (error.message.toLowerCase().includes('rate limit')) {
          return {
            success: false,
            error: 'Email rate limit exceeded. Please wait a few minutes before trying again, or log in if you already registered.',
          };
        }
        return { success: false, error: error.message };
      }

      const authUser = data.user;
      if (!authUser) {
        return { success: false, error: 'Failed to create user account in database.' };
      }

      const userProfile: UserProfile = {
        id: authUser.id,
        email: authUser.email || email,
        fullName,
        voicePart,
        createdAt: authUser.created_at || new Date().toISOString(),
      };

      // Ensure profile exists in public.profiles table
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

      // Save credentials locally for offline access
      await StorageService.saveRegisteredUser(email, userProfile, params.password);

      // Check whether session was issued or email verification is required
      if (data.session) {
        await StorageService.saveCurrentUser(userProfile);
        await StorageService.setPreferredVoicePart(voicePart);
        return { success: true, user: userProfile };
      } else {
        return {
          success: true,
          requiresEmailConfirmation: true,
          user: userProfile,
          message: 'Account created! Please check your email to verify your address before signing in.',
        };
      }
    } catch (err: any) {
      console.warn('Auth sign up exception:', err);
      return { success: false, error: err?.message || 'Failed to create account in database.' };
    }
  }

  /**
   * Log in with email and password
   */
  static async signIn(params: SignInParams): Promise<AuthResult> {
    const email = params.email.trim().toLowerCase();

    if (!email || !params.password) {
      return { success: false, error: 'Email and password are required.' };
    }

    const isOnline = NetworkService.isOnline();

    if (isOnline) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: params.password,
        });

        if (error) {
          console.warn('Supabase sign in notice:', error.message);
          if (error.message.toLowerCase().includes('email not confirmed')) {
            return {
              success: false,
              error: 'Your email address is not confirmed. Please check your inbox or spam folder for the confirmation email.',
            };
          }
          if (error.message.toLowerCase().includes('invalid login credentials')) {
            return { success: false, error: 'Invalid email or password.' };
          }
          return { success: false, error: error.message };
        }

        const authUser = data.user;
        if (!authUser) {
          return { success: false, error: 'Could not log in.' };
        }

        // Fetch or create profile in public.profiles
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
              updated_at: new Date().toISOString(),
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
        return { success: false, error: err?.message || 'Failed to sign in.' };
      }
    } else {
      // Offline fallback: verify against local registered database
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

      return {
        success: false,
        error: 'You are currently offline. Please connect to the internet to sign in.',
      };
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
   * Get current authenticated user
   */
  static async getCurrentUser(): Promise<UserProfile | null> {
    // 1. Check Supabase session if online
    if (NetworkService.isOnline()) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          const u = data.session.user;
          let fullName = u.user_metadata?.full_name || u.email?.split('@')[0] || 'Choral Singer';
          let voicePart = u.user_metadata?.voice_part || 'General';

          try {
            const { data: profileRow } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', u.id)
              .maybeSingle();

            if (profileRow) {
              fullName = profileRow.full_name || fullName;
              voicePart = profileRow.voice_part || voicePart;
            } else {
              await supabase.from('profiles').upsert({
                id: u.id,
                email: u.email || '',
                full_name: fullName,
                voice_part: voicePart,
                updated_at: new Date().toISOString(),
              });
            }
          } catch {
            // Ignored
          }

          const profile: UserProfile = {
            id: u.id,
            email: u.email || '',
            fullName,
            voicePart,
            createdAt: u.created_at || new Date().toISOString(),
          };
          await StorageService.saveCurrentUser(profile);
          return profile;
        } else {
          // If online and no active Supabase session, clear any stale fake cached user
          const cached = await StorageService.getCurrentUser();
          if (cached) {
            console.log('[Auth] No active Supabase session. Purging stale local session.');
            await StorageService.saveCurrentUser(null);
          }
          return null;
        }
      } catch (e) {
        console.warn('Supabase getSession notice:', e);
      }
    }

    // 2. Offline check
    const cached = await StorageService.getCurrentUser();
    return cached || null;
  }
}

