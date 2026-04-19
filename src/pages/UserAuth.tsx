import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUserAuth } from '../context/UserAuthContext';
import { useLang } from '../context/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeToggle from '../components/ThemeToggle';
import { Lock, Mail, User, KeyRound, ArrowRight, UserCircle2, AlertCircle, ChevronRight } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function UserAuth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginManual, user, logout } = useUserAuth();
  const { t } = useLang();

  const initialMode = searchParams.get('mode') as 'login' | 'register' | 'upgrade' || 'login';
  const [mode, setMode] = useState<'login' | 'register' | 'upgrade'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only redirect away if the user is fully logged in and not an applicant needing upgrade
    if (user && !user.isApplicant && mode !== 'upgrade') {
      navigate('/user/dashboard');
    }
    // If they are an applicant and landed here without upgrade mode, force upgrade mode
    if (user && user.isApplicant && mode !== 'upgrade') {
      setMode('upgrade');
    }
  }, [user, navigate, mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !password || (mode === 'register' && !name)) {
      setError(t('fillAllFields'));
      return;
    }
    setLoading(true);
    
    let endpoint = '/api/user/login';
    let bodyData: any = { email, password };
    
    if (mode === 'register') {
      endpoint = '/api/user/register';
      bodyData = { name, email, password };
    } else if (mode === 'upgrade') {
      endpoint = '/api/user/upgrade';
      bodyData = { userId: user?.userId, email, password };
    }

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Authentication failed');
      loginManual(data.token, data.name || user?.name || '', data.userId);
      navigate('/user/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 transition-colors duration-500">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-violet-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Controls */}
        <div className="flex justify-end items-center gap-3 mb-4">
          <ThemeToggle />
          <LanguageSwitcher compact />
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 mb-4 shadow-lg shadow-blue-500/25">
            <UserCircle2 size={30} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {mode === 'login' ? t('welcomeBack') : mode === 'upgrade' ? 'Complete Profile' : t('createAccount')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {mode === 'login' ? t('signInSub') : mode === 'upgrade' ? 'Set an email and password for your dashboard' : t('startJourney')}
          </p>
        </div>

        {/* Mode Toggle (Hidden in Upgrade Mode) */}
        {mode !== 'upgrade' && (
          <div className="flex bg-secondary border border-border p-1 rounded-xl mb-6">
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === m
                    ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-md'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m === 'login' ? t('login') : t('register')}
              </button>
            ))}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-card border border-border backdrop-blur-xl rounded-2xl p-6 shadow-2xl space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl">
              <AlertCircle size={16} className="flex-shrink-0" />
              {error}
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-muted-foreground text-xs font-medium mb-1.5 uppercase tracking-wider">{t('fullName')}</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl py-3 pl-9 pr-4 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-muted-foreground transition-colors text-sm"
                  placeholder="Swapnil Sharma" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-muted-foreground text-xs font-medium mb-1.5 uppercase tracking-wider">{t('email')}</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl py-3 pl-9 pr-4 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-muted-foreground transition-colors text-sm"
                placeholder="you@example.com" />
            </div>
          </div>

          <div>
            <label className="block text-muted-foreground text-xs font-medium mb-1.5 uppercase tracking-wider">{t('password')}</label>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl py-3 pl-9 pr-4 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-muted-foreground transition-colors text-sm"
                placeholder="••••••••" />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 mt-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:opacity-90 text-white py-3 rounded-xl font-medium transition-all shadow-lg shadow-blue-500/20">
            {loading ? (
              <div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><Lock size={16} />{mode === 'login' ? t('signIn') : mode === 'upgrade' ? 'Complete Registration' : t('createAccount')}<ArrowRight size={16} /></>
            )}
          </button>
        </form>

        {mode === 'upgrade' ? (
          <div className="mt-4 space-y-3">
            <button onClick={() => navigate('/?new=true')}
              className="w-full flex items-center justify-center gap-1 text-muted-foreground hover:text-foreground text-sm transition-colors">
              <ChevronRight size={14} className="rotate-180" />
              {t('backToHome')}
            </button>
            <button onClick={() => { logout(); navigate('/'); }}
              className="w-full text-center text-red-400 hover:text-red-300 text-xs transition-colors">
              Cancel & Logout
            </button>
          </div>
        ) : (
          <button onClick={() => navigate('/?new=true')}
            className="mt-4 w-full flex items-center justify-center gap-1 text-muted-foreground hover:text-foreground text-sm transition-colors">
            <ChevronRight size={14} className="rotate-180" />
            {t('backToHome')}
          </button>
        )}
      </div>
    </div>
  );
}
