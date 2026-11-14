import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { signIn, getProfile } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck,
  ArrowRight,
  AlertTriangle,
  Lock,
  Mail,
  ArrowLeft,
} from 'lucide-react';

export const Route = createFileRoute('/login')({
  head: () => ({
    meta: [
      { title: 'Log In — Survey Pay Kenya' },
      { name: 'description', content: 'Log in to your Survey Pay Kenya consumer panel account.' },
      { property: 'og:title', content: 'Log In — Survey Pay Kenya' },
      { property: 'og:description', content: 'Log in to access your consumer research panel and active studies.' },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

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

    setLoading(true);
    setError('');

    try {
      const data = await signIn(email.trim(), password);
      if (data.user) {
        try {
          await getProfile(data.user.id);
        } catch {
          // Handled gracefully
        }
      }
      navigate({ to: '/' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please check your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading SurveyPay...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950 flex flex-col justify-between text-slate-100">
      {/* Top Header */}
      <header className="container mx-auto px-4 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-xl font-black tracking-tight text-white hover:opacity-90">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500 text-slate-950 font-black text-sm">
            SP
          </span>
          <span>
            SurveyPay <span className="text-emerald-400 font-bold">Kenya</span>
          </span>
        </Link>

        <Link
          to="/"
          className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
        </Link>
      </header>

      {/* Main Content Card */}
      <main className="container mx-auto px-4 py-8 flex items-center justify-center flex-1">
        <div className="w-full max-w-md bg-white text-slate-900 rounded-2xl shadow-2xl p-6 sm:p-8 border border-slate-100">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="text-[10px] font-extrabold tracking-wider text-emerald-700 uppercase mb-1">
              PANEL MEMBER ACCESS
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Log in to your account</h1>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Access your saved consumer studies, participation history, and member dashboard.
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
              <label className="block text-[11px] font-bold tracking-wider text-slate-700 uppercase mb-1.5" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold tracking-wider text-slate-700 uppercase mb-1.5" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChange={e => {
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
              className="w-full py-3 h-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Logging In...</span>
                </>
              ) : (
                <>
                  <span>Log In & Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          <div className="text-center mt-6 pt-4 border-t border-slate-100 text-xs text-slate-600">
            Don't have an account yet?{' '}
            <Link to="/signup" className="font-bold text-emerald-700 hover:underline">
              Sign up free
            </Link>
          </div>
        </div>
      </main>

      {/* Footer Notice */}
      <footer className="container mx-auto px-4 py-6 text-center text-xs text-slate-400">
        <p className="max-w-md mx-auto leading-relaxed">
          Survey Pay Kenya · Consumer Research & Opinion Panels.
        </p>
        <span className="block mt-1 text-[11px] text-slate-500">© 2026 SurveyPay Kenya. All rights reserved.</span>
      </footer>
    </div>
  );
}
