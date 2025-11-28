import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Helper to check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

// Create client only if configured, otherwise create a dummy that will never be used
let _supabase: SupabaseClient<Database> | null = null;

function getSupabaseClient(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!_supabase) {
    _supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }

  return _supabase;
}

// Export a getter - consumers should check isSupabaseConfigured() before using
export const supabase = {
  get client() {
    return getSupabaseClient();
  },
  from(table: string) {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Supabase is not configured');
    }
    return client.from(table as any);
  },
  channel(name: string) {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Supabase is not configured');
    }
    return client.channel(name);
  },
};
