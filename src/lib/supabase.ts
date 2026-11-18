'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicConfigurationIssue } from './config';
let client: SupabaseClient | undefined;
export const configurationIssue = publicConfigurationIssue(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
export const onlineConfigured = configurationIssue === null;
export function supabase() {
  if (!onlineConfigured) throw new Error(configurationIssue!);
  return (client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  ));
}
