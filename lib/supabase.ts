import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ctfxbeltcmmsvagecvyr.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const isWeb = Platform.OS === 'web';
const isServer = isWeb && typeof window === 'undefined';

if (isWeb && supabaseAnonKey.startsWith('sb_secret_')) {
  console.warn(
    '[Supabase Warning] EXPO_PUBLIC_SUPABASE_ANON_KEY contains a secret key (sb_secret_...). ' +
    'Supabase rejects secret keys sent from web browsers. Please replace it in .env with your ' +
    'Publishable API key (sb_publishable_... or anon key) from Project Settings -> API.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isServer ? undefined : AsyncStorage,
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    detectSessionInUrl: isWeb && !isServer,
  },
});
