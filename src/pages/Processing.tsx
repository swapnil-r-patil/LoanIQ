import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLoan } from '../context/LoanContext';
import { useUserAuth } from '../context/UserAuthContext';
import { processLoanData } from '../services/loanApi';
import { Brain, Fingerprint, FileSearch, BarChart3, Shield } from 'lucide-react';

const STEPS = [
  { icon: <FileSearch size={18} />, label: 'Parsing your transcript', duration: 1500 },
  { icon: <FileSearch size={18} />, label: 'Running PAN card OCR', duration: 2000 },
  { icon: <BarChart3 size={18} />, label: 'Computing credit score', duration: 1500 },
  { icon: <Shield size={18} />, label: 'Assessing risk profile', duration: 1500 },
  { icon: <Brain size={18} />, label: 'Generating AI explanation', duration: 2000 },
  { icon: <Fingerprint size={18} />, label: 'Finalizing your report', duration: 1000 },
];

export default function Processing() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, setState } = useLoan();
  const { user } = useUserAuth();

  const kycData = location.state as any;
  const hasPan = !!(kycData?.panImage || state.panImage);

  // Filter steps based on whether PAN is provided
  const activeSteps = STEPS.filter(step => {
    if (step.label === 'Running PAN card OCR' && !hasPan) return false;
    return true;
  });

  const [currentStep, setCurrentStep] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    setCurrentStep(0);
    setIsFinished(false);
    setProgressPct(0);

    let isMounted = true;
    let timeoutIds: NodeJS.Timeout[] = [];

    const runAnimations = async () => {
      for (let i = 0; i < activeSteps.length - 1; i++) {
        if (!isMounted) return;
        setCurrentStep(i);
        
        const duration = activeSteps[i].duration;
        await new Promise(resolve => {
          const id = setTimeout(resolve, duration);
          timeoutIds.push(id);
        });
        
        if (!isMounted) return;
        setProgressPct(((i + 1) / activeSteps.length) * 100);
      }
      
      // Pause at the final step (95%) until API is actually done
      if (!isMounted) return;
      setCurrentStep(activeSteps.length - 1);
      setProgressPct(95);
    };

    runAnimations();
    callApi(kycData);

    return () => {
      isMounted = false;
      timeoutIds.forEach(clearTimeout);
    };
  }, [hasPan]);

  async function callApi(kycData: any) {
    try {
      const payload = {
        transcript: kycData?.transcript || state.transcript || '',
        panImage: kycData?.panImage || state.panImage || null,
        userFaceImage: kycData?.userFaceImage || null,
        faceLandmarks: kycData?.faceLandmarks || null,
        liveness: kycData?.livenessPass ?? state.livenessPass ?? false,
        location: kycData?.location || state.location || null,
        userId: user?.userId || null,
        faceAge: kycData?.faceAge || state.faceAge || null,
        editedPanDetails: kycData?.editedPanDetails || null,
      };
      
      console.log('🚀 Sending API Payload:', {
        ...payload,
        panImage: payload.panImage ? `${payload.panImage.substring(0, 50)}... (${payload.panImage.length} chars)` : 'MISSING'
      });

      const result = await processLoanData(payload);
      setState(prev => ({ ...prev, result }));

      // Complete the animation when API succeeds
      setProgressPct(100);
      setIsFinished(true);

      // Wait a moment for the 100% checkmark to be seen before navigating
      setTimeout(() => {
        navigate('/result');
      }, 1500);
    } catch (err: any) {
      console.error('Processing error:', err);
      setError(err.message || 'Processing failed');
      setTimeout(() => {
        const mockResult = createMockResult();
        setState(prev => ({ ...prev, result: mockResult }));
        navigate('/result');
      }, 3000);
    }
  }

  function createMockResult() {
    return {
      success: true,
      creditScore: 680,
      riskLevel: 'MEDIUM' as const,
      decision: 'CONDITIONAL' as const,
      offer: {
        offeredAmount: 500000,
        maxAmount: 600000,
        interestRate: 14.5,
        tenure: 60,
        emi: 11681,
        processingFee: 5000,
      },
      report: {
        customerDetails: { name: 'Demo User', transcriptName: 'Demo User', location: null },
        financialDetails: { income: 60000, incomeTier: 'high', jobType: 'salaried', loanPurpose: 'home', requestedAmount: 500000 },
        panDetails: { panNumber: null, dob: null },
        creditScore: 720,
        adjustments: [
          { factor: 'High income', delta: 50 },
          { factor: 'Salaried employment', delta: 30 },
          { factor: 'Liveness verified', delta: 20 },
        ],
        riskScore: 68,
        riskComponents: { incomeScore: 90, verificationScore: 90, behaviorScore: 70 },
        riskLevel: 'MEDIUM' as const,
        verification: { liveness: true, panVerified: false },
        decision: 'CONDITIONAL' as const,
        offer: null,
        explanation: 'Backend not connected — this is a demo result. Your application shows a solid income profile suitable for conditional approval.',
      },
      docId: null,
    };
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 transition-colors duration-500">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Central spinner */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative w-28 h-28 mb-6">
            <div className="absolute inset-0 rounded-full border-2 border-blue-500/40 animate-spin" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-2 rounded-full border-2 border-violet-500/50 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
            <div className="absolute inset-4 rounded-full border-2 border-blue-400/60 animate-spin" style={{ animationDuration: '1.5s' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <Brain size={30} className="text-blue-400" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-2">Analyzing your data…</h2>
          <p className="text-muted-foreground text-sm text-center">Our AI is processing your application.<br />This usually takes 10–20 seconds.</p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Progress</span>
            <span>{Math.round(progressPct)}%</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {activeSteps.map((step, i) => {
            const isDone = i < currentStep || (i === currentStep && progressPct > (i / activeSteps.length) * 100 && i < activeSteps.length - 1) || (i === activeSteps.length - 1 && isFinished);
            
            // Simplified isDone: if the next step has started, this one is definitely done.
            const reallyDone = i < currentStep || (i === activeSteps.length - 1 && isFinished);
            const isActive = i === currentStep && !reallyDone;
            
            return (
              <div
                key={i}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-500 ${
                  reallyDone ? 'border-emerald-500/20 bg-emerald-500/10' :
                  isActive ? 'border-blue-500/40 bg-blue-500/10' :
                  'border-border opacity-40'
                }`}
              >
                <div className={`${reallyDone ? 'text-emerald-600 dark:text-emerald-400' : isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                  {step.icon}
                </div>
                <span className={`text-sm font-medium ${reallyDone ? 'text-emerald-700 dark:text-emerald-400' : isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
                {reallyDone && <div className="ml-auto text-emerald-600 dark:text-emerald-400 text-xs font-bold">✓</div>}
                {isActive && (
                  <div className="ml-auto">
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs text-center">
            {error} — Loading demo result…
          </div>
        )}
      </div>
    </div>
  );
}
