import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLoan } from '../context/LoanContext';
import { useLang } from '../context/LanguageContext';
import { useUserAuth } from '../context/UserAuthContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeToggle from '../components/ThemeToggle';
import { Camera, Mic, Wifi, MapPin, CheckCircle, XCircle, AlertCircle, ChevronRight, Shield, UserCircle2, UserPlus } from 'lucide-react';

type CheckStatus = 'checking' | 'ready' | 'error' | 'warning';
interface Check { label: string; status: CheckStatus; detail: string; icon: React.ReactNode; }

export default function PreCheckScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setState } = useLoan();
  const { t } = useLang();
  const { user, isLoading: userLoading } = useUserAuth();
  
  const isAdmin = !!localStorage.getItem('admin_token');
  const isAuth = !!user || isAdmin;

  const isNewApplication = new URLSearchParams(location.search).get('new') === 'true';

  useEffect(() => {
    if (!userLoading && !isNewApplication) {
      if (user) {
        navigate('/user/dashboard');
      } else if (isAdmin) {
        navigate('/admin');
      }
    }
  }, [user, isAdmin, userLoading, navigate, isNewApplication]);

  const [checks, setChecks] = useState<Record<string, Check>>({
    camera: { label: t('camera'), status: 'checking', detail: t('checking'), icon: <Camera size={20} /> },
    mic: { label: t('microphone'), status: 'checking', detail: t('checking'), icon: <Mic size={20} /> },
    network: { label: t('network'), status: 'checking', detail: t('checking'), icon: <Wifi size={20} /> },
    location: { label: t('location'), status: 'checking', detail: t('checking'), icon: <MapPin size={20} /> },
  });

  const updateCheck = (key: string, partial: Partial<Check>) => {
    setChecks(prev => ({ ...prev, [key]: { ...prev[key], ...partial } }));
  };

  useEffect(() => { runChecks(); }, []);

  async function runChecks() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach(t => t.stop());
      updateCheck('camera', { status: 'ready', detail: t('cameraReady') });
      updateCheck('mic', { status: 'ready', detail: t('micReady') });
      setState(prev => ({ ...prev, cameraReady: true, micReady: true }));
    } catch (e: any) {
      if (e.name === 'NotFoundError') {
        updateCheck('camera', { status: 'error', detail: t('cameraNotFound') });
        updateCheck('mic', { status: 'error', detail: t('micNotFound') });
      } else {
        updateCheck('camera', { status: 'error', detail: t('permissionDenied') });
        updateCheck('mic', { status: 'error', detail: t('permissionDenied') });
      }
    }

    try {
      const conn = (navigator as any).connection;
      let quality: 'Good' | 'Medium' | 'Poor' = 'Good';
      let detail = '';
      if (conn) {
        const type = conn.effectiveType;
        if (type === '4g') { quality = 'Good'; detail = '4G — Excellent'; }
        else if (type === '3g') { quality = 'Medium'; detail = '3G — Adequate'; }
        else { quality = 'Poor'; detail = `${type} — Slow`; }
      } else {
        const start = Date.now();
        await fetch('https://www.google.com/generate_204', { mode: 'no-cors', cache: 'no-cache' }).catch(() => {});
        const ms = Date.now() - start;
        if (ms < 300) { quality = 'Good'; detail = `${ms}ms — Fast`; }
        else if (ms < 800) { quality = 'Medium'; detail = `${ms}ms — Moderate`; }
        else { quality = 'Poor'; detail = `${ms}ms — Slow`; }
      }
      const status = quality === 'Good' ? 'ready' : quality === 'Medium' ? 'warning' : 'error';
      updateCheck('network', { status, detail });
      setState(prev => ({ ...prev, networkQuality: quality }));
    } catch {
      updateCheck('network', { status: 'warning', detail: 'Could not measure' });
    }

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          updateCheck('location', { status: 'ready', detail: t('locationEnabled') });
          setState(prev => ({ ...prev, locationEnabled: true, location: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }) }));
        },
        () => { updateCheck('location', { status: 'warning', detail: t('locationDenied') }); },
        { timeout: 8000 }
      );
    } else {
      updateCheck('location', { status: 'warning', detail: t('notSupported') });
    }
  }

  const canProceed = checks.camera.status === 'ready' && checks.mic.status === 'ready';
  const allDone = Object.values(checks).every(c => c.status !== 'checking');

  function statusIcon(status: CheckStatus) {
    if (status === 'checking') return <div className="w-6 h-6 border-[3px] border-slate-200 dark:border-white/10 !border-t-blue-600 dark:!border-t-primary rounded-full animate-spin" />;
    if (status === 'ready') return <CheckCircle size={20} className="text-emerald-400" />;
    if (status === 'warning') return <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs border border-amber-500/30 px-2 py-1 rounded-lg bg-amber-500/10"><AlertCircle size={14} />{t('retry')}</div>;
    return <div className="flex items-center gap-2 text-red-400 font-semibold text-xs border border-red-500/30 px-2 py-1 rounded-lg bg-red-500/10"><XCircle size={14} />{t('retry')}</div>;
  }

  function statusBg(status: CheckStatus) {
    if (status === 'checking') return 'border-blue-500/30 bg-blue-500/5';
    if (status === 'ready') return 'border-emerald-500/30 bg-emerald-500/5';
    if (status === 'warning') return 'border-amber-500/30 bg-amber-500/5';
    return 'border-red-500/30 bg-red-500/5';
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start pt-12 sm:pt-20 px-4 transition-colors duration-500">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-3xl" />
      </div>

      {/* Global Controls - Positioned Top Right */}
      <div className="fixed top-6 right-6 z-50 flex items-center gap-3">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>

      <div className="relative w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 mb-4 shadow-lg shadow-blue-500/25">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">{t('precheck_title')}</h1>
          <p className="text-muted-foreground text-sm">{t('precheck_sub')}</p>
        </div>

        {/* Checks */}
        <div className="space-y-3 mb-8">
          {Object.entries(checks).map(([key, check]) => (
            <div
              key={key}
              onClick={() => {
                if (check.status === 'error' || check.status === 'warning') {
                  updateCheck(key, { status: 'checking', detail: t('checking') });
                  setTimeout(runChecks, 500);
                }
              }}
              className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-500 ${statusBg(check.status)} ${check.status === 'error' || check.status === 'warning' ? 'cursor-pointer hover:border-blue-500/50' : ''}`}
            >
              <div className="text-muted-foreground">{check.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-foreground font-medium text-sm">{check.label}</div>
                <div className="text-muted-foreground text-xs mt-0.5 truncate">{check.detail}</div>
              </div>
              <div className="flex-shrink-0">{statusIcon(check.status)}</div>
            </div>
          ))}
        </div>

        {allDone && !canProceed && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm text-center">
            {t('permissionsNote')}
          </div>
        )}

        <button
          id="btn-start-verification"
          onClick={() => navigate('/kyc')}
          disabled={!canProceed || !allDone}
          className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-base transition-all duration-300
            ${canProceed && allDone
              ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-secondary text-muted-foreground cursor-not-allowed'
            }`}
        >
          {allDone
            ? canProceed ? (<><span>{t('startVerification')}</span><ChevronRight size={18} /></>)
              : t('permissionsRequired')
            : t('runningChecks')
          }
        </button>

        {!isAuth && (
          <div className="mt-12 pt-6 border-t border-border flex flex-col items-center gap-6">
            <div className="flex flex-wrap justify-center gap-3">
              <button 
                onClick={() => navigate('/user/auth?mode=register')} 
                className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 border border-violet-500/20 text-violet-300 rounded-full text-xs font-medium hover:bg-violet-500/20 transition-all"
              >
                <UserPlus size={14} /> {t('register')}
              </button>
              <button 
                onClick={() => navigate('/user/auth')} 
                className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-full text-xs font-medium hover:bg-blue-500/20 transition-all"
              >
                <UserCircle2 size={14} /> {t('login')}
              </button>
              <button 
                onClick={() => navigate('/admin')} 
                className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border text-muted-foreground rounded-full text-xs font-medium hover:bg-accent transition-all"
              >
                <Shield size={14} /> {t('admin')}
              </button>
            </div>
            
            <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-medium">
              Powered by <span className="text-blue-500/80">CodeStorm</span> · {t('secure')}
            </p>
          </div>
        )}

        {isAuth && (
           <div className="mt-12 text-center">
             <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-medium">
               Powered by <span className="text-blue-500/80">CodeStorm</span> · {t('secure')}
             </p>
           </div>
        )}
      </div>
    </div>
  );
}
