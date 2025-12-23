import { createClient } from '@supabase/supabase-js';

// Use environment variables or hardcoded fallback values provided
export const supabaseUrl = process.env.SUPABASE_URL || 'https://qpfkmfbwsfhlfvxkrfhv.supabase.co';
export const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwZmttZmJ3c2ZobGZ2eGtyZmh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0MjY2MjksImV4cCI6MjA4MjAwMjYyOX0.eJJaaaH1ghlvEpkxgLZu-Q4IxU8gOfDv0YU6tcdqZEI';

// Check if URL and Key are valid strings before creating client
export const supabase = (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'))
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;