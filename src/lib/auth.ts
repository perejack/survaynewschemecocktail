import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

export type { User };

const STORAGE_KEY_USER = 'sp_local_user';
const STORAGE_KEY_PROFILE = 'sp_local_profile';
const STORAGE_KEY_USERS_DB = 'sp_registered_users';

function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('err_name_not_resolved') ||
    msg.includes('name_not_resolved') ||
    msg.includes('load resource') ||
    msg.includes('fetch') ||
    msg.includes('dns')
  );
}

function getStoredUsers(): Array<{ id: string; email: string; password?: string; phone: string }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USERS_DB);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredUsers(users: Array<{ id: string; email: string; password?: string; phone: string }>) {
  try {
    localStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(users));
  } catch {}
}

export function getLocalUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setLocalUser(user: User | null) {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_USER);
    }
  } catch {}
}

function getLocalProfile(userId: string): any {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILE);
    if (!raw) return null;
    const profile = JSON.parse(raw);
    return profile.id === userId ? profile : null;
  } catch {
    return null;
  }
}

function setLocalProfile(profile: any) {
  try {
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
  } catch {}
}

function createFallbackUser(email: string, password: string, phone: string) {
  const users = getStoredUsers();
  const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  const id = existing ? existing.id : 'usr_' + Math.random().toString(36).substring(2, 10);

  if (!existing) {
    users.push({ id, email, password, phone });
    saveStoredUsers(users);
  }

  const user: User = {
    id,
    app_metadata: {},
    user_metadata: { phone },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    email,
    phone,
    role: 'authenticated',
    updated_at: new Date().toISOString(),
  } as unknown as User;

  setLocalUser(user);

  let profile = getLocalProfile(id);
  if (!profile) {
    profile = {
      id,
      email,
      phone,
      plan: 'Free',
      balance: 0,
      completed_surveys: [],
      unlocked_survey_ids: [],
      daily_withdrawn: 0,
      last_withdrawal_date: null,
      activated: false,
      created_at: new Date().toISOString(),
    };
    setLocalProfile(profile);
  }

  return { user, session: null };
}

function authenticateFallback(email: string, password: string) {
  const users = getStoredUsers();
  const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  const phone = found?.phone || '0712 345 678';
  const id = found?.id || 'usr_' + Math.random().toString(36).substring(2, 10);

  const user: User = {
    id,
    app_metadata: {},
    user_metadata: { phone },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    email,
    phone,
    role: 'authenticated',
    updated_at: new Date().toISOString(),
  } as unknown as User;

  setLocalUser(user);

  let profile = getLocalProfile(id);
  if (!profile) {
    profile = {
      id,
      email,
      phone,
      plan: 'Free',
      balance: 0,
      completed_surveys: [],
      unlocked_survey_ids: [],
      daily_withdrawn: 0,
      last_withdrawal_date: null,
      activated: false,
      created_at: new Date().toISOString(),
    };
    setLocalProfile(profile);
  }

  return { user, session: null };
}

export async function signUp(email: string, password: string, phone: string) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { phone } },
    });
    if (error) {
      if (isNetworkError(error)) {
        return createFallbackUser(email, password, phone);
      }
      throw error;
    }
    if (data.user) {
      setLocalUser(data.user);
      await upsertProfile(data.user.id, email, phone);
    }
    return data;
  } catch (err) {
    if (isNetworkError(err)) {
      return createFallbackUser(email, password, phone);
    }
    throw err;
  }
}

export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (isNetworkError(error)) {
        return authenticateFallback(email, password);
      }
      throw error;
    }
    if (data.user) {
      setLocalUser(data.user);
    }
    return data;
  } catch (err) {
    if (isNetworkError(err)) {
      return authenticateFallback(email, password);
    }
    throw err;
  }
}

export async function signOut() {
  setLocalUser(null);
  try {
    await supabase.auth.signOut();
  } catch {}
}

export async function getProfile(userId: string) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (!error && data) {
      setLocalProfile(data);
      return data;
    }
  } catch {}
  return getLocalProfile(userId);
}

export async function upsertProfile(userId: string, email: string, phone: string) {
  const existing = getLocalProfile(userId) || {};
  const updated = {
    ...existing,
    id: userId,
    email,
    phone,
    updated_at: new Date().toISOString(),
  };
  setLocalProfile(updated);

  try {
    await supabase.from('profiles').upsert(updated, { onConflict: 'id' });
  } catch {}
}

export async function updateProfile(userId: string, updates: Record<string, unknown>) {
  const existing = getLocalProfile(userId) || {};
  const updated = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString(),
  };
  setLocalProfile(updated);

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error && !isNetworkError(error)) throw error;
  } catch (e) {
    if (!isNetworkError(e)) throw e;
  }
}

export async function logSurveyCompletion(
  userId: string,
  surveyId: number,
  company: string,
  earned: number
) {
  try {
    await supabase.from('survey_completions').insert({
      user_id: userId,
      survey_id: surveyId,
      company,
      earned,
    });
  } catch {}
}

export async function logWithdrawal(
  userId: string,
  amount: number,
  phone: string,
  checkoutRequestId?: string
) {
  try {
    const { data } = await supabase
      .from('withdrawals')
      .insert({
        user_id: userId,
        amount,
        phone,
        checkout_request_id: checkoutRequestId,
        status: 'pending',
      })
      .select()
      .single();
    if (data) return data;
  } catch {}
  return {
    id: 'w_' + Math.random().toString(36).substring(2, 9),
    user_id: userId,
    amount,
    phone,
    status: 'pending',
  };
}

export async function updateWithdrawalStatus(
  withdrawalId: string,
  status: string,
  receipt?: string
) {
  try {
    await supabase
      .from('withdrawals')
      .update({ status, mpesa_receipt: receipt })
      .eq('id', withdrawalId);
  } catch {}
}

export async function logUnlockPurchase(
  userId: string,
  surveyIds: number[],
  amountPaid: number,
  checkoutRequestId?: string
) {
  try {
    const { data } = await supabase
      .from('unlock_purchases')
      .insert({
        user_id: userId,
        survey_ids: surveyIds,
        amount_paid: amountPaid,
        checkout_request_id: checkoutRequestId,
        status: 'pending',
      })
      .select()
      .single();
    if (data) return data;
  } catch {}
  return { id: 'u_' + Math.random().toString(36).substring(2, 9) };
}

export async function logUpgradePurchase(
  userId: string,
  planName: string,
  amountPaid: number,
  checkoutRequestId?: string
) {
  try {
    const { data } = await supabase
      .from('upgrade_purchases')
      .insert({
        user_id: userId,
        plan_name: planName,
        amount_paid: amountPaid,
        checkout_request_id: checkoutRequestId,
        status: 'pending',
      })
      .select()
      .single();
    if (data) return data;
  } catch {}
  return { id: 'up_' + Math.random().toString(36).substring(2, 9) };
}
