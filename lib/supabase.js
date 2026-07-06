import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Sign in anonymously (once per session)
export async function signInAnonymously() {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error('Anon sign-in failed:', error);
    return null;
  }
  return data.session;
}

// Get current user session
export async function getCurrentSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}
