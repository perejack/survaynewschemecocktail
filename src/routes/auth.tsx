import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { signIn, signUp, getProfile } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck,
  Smartphone,
  ArrowRight,
  AlertTriangle,
  Lock,
  Mail,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';

export const Route = createFileRoute('/auth')({
  validateSearch: (search: Record<string, unknown>): { mode?: 'signup' | 'login' } => {
    return {
      mode: search.mode === 'login' ? 'login' : 'signup',
    };
  },
  head: () => ({
    meta: [
      { title: 'Sign Up & Log In — Survey Pay Kenya' },
      { name: 'description', content: 'Create an account or sign in to Survey Pay Kenya to participate in consumer surveys and view rewards.' },
      { property: 'og:title', content: 'Sign Up & Log In — Survey Pay Kenya' },
      { property: 'og:description', content: 'Direct portal to join or access your Survey Pay Kenya consumer research panel account.' },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<'signup' | 'login'>(search.mode === 'login' ? 'login' : 'signup');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // If search param changes (e.g. from ?mode=login or ?mode=signup)
  useEffect(() => {
    if (search.mode === 'login' || search.mode === 'signup') {
      setMode(search.mode);
      setError('');
    }
  }, [search.mode]);

  // If user is already logged in, redirect to home
  useEffect(() => {
    let mounted = true;
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          navigate({ to: '/' });
        }
      } catch (err) {
        console.error('Session check failed:', err);
      } finally {
        if (mounted) setCheckingSession(false);
      }
    };
    checkUser();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please provide your email address and password.');
      return;
    }

    if (mode === 'signup') {
      if (!phone.trim()) {
        setError('Please enter your active Safaricom M-Pesa phone number.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      if (mode === 'signup') {
        const data = await signUp(email.trim(), password, phone.trim());
        if (data.user) {
          try {
            await getProfile(data.user.id);
          } catch {
            // Profile handled
          }
        }
        navigate({ to: '/' });
      } else {
        const data = await signIn(email.trim(), password);
        if (data.user) {
          try {
            await getProfile(data.user.id);
          } catch {
            // Profile handled
          }
        }
        navigate({ to: '/' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please check your details.';
      if (mode === 'signup' && (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('unique'))) {
        setError('This email is already registered. Please switch to Log In.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-400 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Connecting to SurveyPay Kenya...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-950 flex flex-col justify-between text-slate-100">
      {/* Top Header */}
      <header className="container mx-auto px-4 py-5 flex items-center justify-between border-b border-slate-800/60">
        <Link to="/" className="flex items-center gap-2.5 text-xl font-black tracking-tight text-white hover:opacity-90 transition-opacity">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500 text-slate-950 font-black text-sm shadow-md shadow-emerald-500/20">
            SP
          </span>
          <span className="flex items-center gap-1.5">
            SurveyPay <span className="text-emerald-400 font-bold">Kenya</span>
          </span>
        </Link>

        <Link
          to="/"
          className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 transition-colors border border-slate-700/50"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
        </Link>
      </header>

      {/* Main Authentication Card */}
      <main className="container mx-auto px-4 py-8 sm:py-12 flex items-center justify-center flex-1">
        <div className="w-full max-w-md bg-white text-slate-900 rounded-2xl shadow-2xl p-6 sm:p-8 border border-slate-100 relative">
          
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError('');
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'signup'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Log In
            </button>
          </div>

          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mb-2.5">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="text-[10px] font-extrabold tracking-wider text-emerald-700 uppercase mb-1">
              {mode === 'signup' ? 'JOIN CONSUMER RESEARCH PANEL' : 'PANEL MEMBER ACCESS'}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {mode === 'signup' ? 'Get Started with SurveyPay' : 'Welcome back'}
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              {mode === 'signup'
                ? 'Join Kenyans sharing feedback on local brands, products, and services.'
                : 'Log in to continue your surveys and view your earned rewards.'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold tracking-wider text-slate-700 uppercase mb-1.5" htmlFor="auth-email">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block text-[11px] font-bold tracking-wider text-slate-700 uppercase mb-1.5" htmlFor="auth-phone">
                  M-Pesa Phone Number
                </label>
                <div className="relative">
                  <Smartphone className="w-4 h-4 text-emerald-600 absolute left-3 top-3.5" />
                  <input
                    id="auth-phone"
                    type="tel"
                    required
                    autoComplete="tel"
                    placeholder="0712 345 678"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setError('');
                    }}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-mono"
                  />
                </div>
                <span className="block text-[10px] text-slate-400 mt-1">
                  Used for account verification and M-Pesa payouts.
                </span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold tracking-wider text-slate-700 uppercase mb-1.5" htmlFor="auth-password">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  id="auth-password"
                  type="password"
                  required
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full py-3 h-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{mode === 'signup' ? 'Creating Account...' : 'Logging In...'}</span>
                </>
              ) : (
                <>
                  <span>{mode === 'signup' ? 'Create Free Account' : 'Log In & Continue'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          {mode === 'signup' && (
            <div className="mt-5 p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-xs text-emerald-900 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Why join SurveyPay Kenya?</span>
              </div>
              <ul className="space-y-1 text-[11px] text-emerald-700">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                  <span>Access paid market research surveys in Kenya</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                  <span>Instant M-Pesa withdrawal integration ready</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                  <span>No payment needed to sign up or participate</span>
                </li>
              </ul>
            </div>
          )}

          <div className="text-center mt-6 pt-4 border-t border-slate-100 text-xs text-slate-600">
            {mode === 'signup' ? (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className="font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  Log in
                </button>
              </span>
            ) : (
              <span>
                Don't have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError('');
                  }}
                  className="font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  Sign up free
                </button>
              </span>
            )}
          </div>
        </div>
      </main>

      {/* Footer Notice */}
      <footer className="container mx-auto px-4 py-5 text-center text-xs text-slate-400 border-t border-slate-800/60">
        <p className="max-w-md mx-auto leading-relaxed">
          Survey Pay Kenya · Consumer Research & Opinion Panels.
        </p>
        <span className="block mt-1 text-[11px] text-slate-500">© 2026 SurveyPay Kenya. All rights reserved.</span>
      </footer>
    </div>
  );
}
