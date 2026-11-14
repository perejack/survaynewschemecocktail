import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ugfoapreveoacgdorctw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnZm9hcHJldmVvYWNnZG9yY3R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MTI4MDQsImV4cCI6MjEwODI4ODgwNH0.evTgPf6DdJVDYMzUP9BYiOyuj18NMtBkP5Qz91cPc94';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type UserProfile = {
  id: string;
  email: string;
  phone: string;
  plan: string;
  balance: number;
  completed_surveys: number[];
  unlocked_survey_ids: number[];
  daily_withdrawn: number;
  last_withdrawal_date: string | null;
  activated: boolean;
  created_at: string;
};
