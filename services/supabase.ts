import { createClient } from '@supabase/supabase-js';

// Safe environment variable retrieval
const getEnv = (key: string) => {
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) return process.env[key];
  } catch (e) { }
  return undefined;
};

// Prioritize environment variables, fallback to hardcoded constants
export const supabaseUrl = getEnv('SUPABASE_URL') || 'https://qpfkmfbwsfhlfvxkrfhv.supabase.co';
export const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwZmttZmJ3c2ZobGZ2eGtyZmh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0MjY2MjksImV4cCI6MjA4MjAwMjYyOX0.eJJaaaH1ghlvEpkxgLZu-Q4IxU8gOfDv0YU6tcdqZEI';

// Ensure valid client creation
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;