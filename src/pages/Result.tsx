import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoan } from '../context/LoanContext';
import { useUserAuth } from '../context/UserAuthContext';
import { useLang } from '../context/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeToggle from '../components/ThemeToggle';
import { CheckCircle, XCircle, AlertCircle, TrendingUp, FileText, Banknote, ChevronRight, RotateCcw, LayoutDashboard, Calendar } from 'lucide-react';

function CreditMeter({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, (score / 900) * 100));
  const color = score >= 751 ? '#10b981' : score >= 491 ? '#f59e0b' : '#ef4444';

  const r = 80;
  const cx = 100;
  const cy = 100;
  
  // Calculate polar to cartesian for the arc
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 180) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  const start = polarToCartesian(cx, cy, r, 0);
  const end = polarToCartesian(cx, cy, r, 180);
  const current = polarToCartesian(cx, cy, r, pct * 1.8);

  const largeArcFlag = pct * 1.8 <= 180 ? '0' : '1';

  return (
    <div className="flex flex-col items-center relative">
      <svg viewBox="0 0 200 120" className="w-64 h-36">
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        
        {/* Background Track */}
        <path
          d={`M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`}
          fill="none"
          stroke="#1e293b"
          strokeWidth="12"
          strokeLinecap="round"
        />
        
        {/* Active Score Arc with subtle animation via stroke-dasharray */}
        <path
          d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${current.x} ${current.y}`}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          style={{ 
            filter: `drop-shadow(0 0 8px ${color}60)`,
          }}
        />

        {/* Indicator Needle point */}
        <circle 
          cx={current.x} 
          cy={current.y} 
          r="6" 
          fill="currentColor" 
          className="text-foreground transition-all duration-1000 ease-out"
          style={{ stroke: color, strokeWidth: 3 }}
        />

        {/* Center Labels */}
        <text x="100" y="80" textAnchor="middle" className="fill-foreground text-[32px] font-bold tracking-tight">
          {score}
        </text>
        <text x="100" y="102" textAnchor="middle" className="fill-muted-foreground text-[10px] font-medium tracking-widest uppercase">
          Score Out of 900
        </text>
      </svg>

      {/* Ticks/Labels positioned accurately */}
      <div className="flex justify-between w-full max-w-[220px] -mt-6 px-1">
        <div className="flex flex-col items-center">
          <div className="w-0.5 h-1.5 bg-border mb-1" />
          <span className="text-muted-foreground text-[10px] font-bold">0</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-0.5 h-1.5 bg-border mb-1" />
          <span className="text-muted-foreground text-[10px] font-bold">450</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-0.5 h-1.5 bg-border mb-1" />
          <span className="text-muted-foreground text-[10px] font-bold">900</span>
        </div>
      </div>
    </div>
  );
}

export default function Result() {
  const navigate = useNavigate();
  const { state } = useLoan();
  const { loginAsApplicant, user } = useUserAuth();
  const { t } = useLang();
  const result = state.result;

  useEffect(() => {
    if (!result) navigate('/');
  }, [result]);

  // Auto-login approved/conditional applicants
  useEffect(() => {
    if (result && (result.decision === 'APPROVED' || result.decision === 'CONDITIONAL') && !user) {
      const name = result.report?.customerDetails?.name || 'Applicant';
      const pan = result.report?.panDetails?.panNumber || null;
      loginAsApplicant(name, pan, result.docId || null);
    }
  }, [result]);

  if (!result) return null;

  const { creditScore, riskLevel, decision, offer, report } = result;

  const decisionConfig = {
    APPROVED: {
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/30',
      icon: <CheckCircle size={24} className="text-emerald-400" />,
      label: t('loanApproved'),
      sub: t('loanApprovedSub'),
    },
    CONDITIONAL: {
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/30',
      icon: <AlertCircle size={24} className="text-amber-400" />,
      label: 'Application Pending Review',
      sub: 'Your credit score (491–750) qualifies you for manual review. An admin will approve or reject your loan shortly.',
    },
    REJECTED: {
      color: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/30',
      icon: <XCircle size={24} className="text-red-400" />,
      label: t('applicationRejected'),
      sub: t('rejectedSub'),
    },
  };

  const dc = decisionConfig[decision] || decisionConfig.REJECTED;

  const riskColors = { LOW: 'text-emerald-400', MEDIUM: 'text-amber-400', HIGH: 'text-red-400' };

  return (
    <div className="min-h-screen bg-background py-8 px-4 transition-colors duration-500">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-2xl mx-auto space-y-5">
        {/* Decision Banner */}
        <div className={`p-5 rounded-2xl border ${dc.bg} flex items-start gap-4`}>
          {dc.icon}
          <div>
            <h2 className={`text-xl font-bold ${dc.color}`}>{dc.label}</h2>
            <p className="text-muted-foreground text-sm mt-1">{dc.sub}</p>
          </div>
        </div>

        {/* Credit Score */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
              <TrendingUp size={16} className="text-blue-400" />
              {t('creditScore')}
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <LanguageSwitcher compact />
            </div>
          </div>
          <div className="flex flex-col items-center">
            <CreditMeter score={creditScore} />
          </div>

          {/* Score bands */}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className={`p-2 rounded-lg ${creditScore <= 490 ? 'bg-red-500/20 border border-red-500/30' : 'bg-secondary/50 border border-border'}`}>
              <div className="text-red-400 text-xs font-medium">{t('poor')}</div>
              <div className="text-muted-foreground text-xs">0–490</div>
            </div>
            <div className={`p-2 rounded-lg ${creditScore >= 491 && creditScore <= 750 ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-secondary/50 border border-border'}`}>
              <div className="text-amber-400 text-xs font-medium">{t('fair')}</div>
              <div className="text-muted-foreground text-xs">491–750</div>
            </div>
            <div className={`p-2 rounded-lg ${creditScore >= 751 ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-secondary/50 border border-border'}`}>
              <div className="text-emerald-400 text-xs font-medium">{t('excellent')}</div>
              <div className="text-muted-foreground text-xs">751–900</div>
            </div>
          </div>
        </div>

        {/* Risk & Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="text-muted-foreground text-xs mb-2">{t('riskLevel')}</div>
            <div className={`text-2xl font-bold ${riskColors[riskLevel] || 'text-foreground'}`}>{riskLevel}</div>
            <div className="text-muted-foreground text-xs mt-1">{t('composite')}</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="text-muted-foreground text-xs mb-2">{t('riskScore')}</div>
            <div className="text-2xl font-bold text-foreground">{report?.riskScore}<span className="text-muted-foreground text-sm">/100</span></div>
            <div className="text-muted-foreground text-xs mt-1">{t('weighted')}</div>
          </div>
        </div>

        {/* Loan Offer */}
        {offer && (
          <div className="bg-gradient-to-br from-emerald-900/30 to-teal-900/20 border border-emerald-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-emerald-300 font-semibold mb-4">
              <Banknote size={18} />
              {t('loanOffer')}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-muted-foreground text-xs">{t('loanAmount')}</div>
                <div className="text-foreground text-2xl font-bold">₹{(offer.offeredAmount).toLocaleString('en-IN')}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">{t('interestRate')}</div>
                <div className="text-foreground text-2xl font-bold">{offer.interestRate}%<span className="text-muted-foreground text-sm"> p.a.</span></div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">{t('monthlyEmi')}</div>
                <div className="text-foreground text-lg font-semibold">₹{(offer.emi).toLocaleString('en-IN')}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">{t('tenure')}</div>
                <div className="text-foreground text-lg font-semibold">{offer.tenure} months</div>
              </div>
            </div>
          </div>
        )}

        {/* AI Assessment */}
        {report?.explanation && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="text-muted-foreground text-xs font-medium mb-2 uppercase tracking-wider">{t('aiAssessment')}</div>
            <p className="text-foreground text-sm leading-relaxed">{report.explanation}</p>
          </div>
        )}

        {/* Point System Breakdown */}
        {report?.adjustments && report.adjustments.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="text-muted-foreground text-xs font-medium mb-4 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp size={14} className="text-primary" />
              Point System Breakdown
            </div>
            <div className="space-y-2">
              {report.adjustments.map((adj: any, i: number) => (
                <div key={i} className="flex justify-between items-center p-3 bg-secondary/30 rounded-xl border border-border/50">
                  <div className="flex items-center gap-3">
                    {adj.delta > 0 && <CheckCircle size={16} className="text-emerald-400" />}
                    {adj.delta < 0 && <XCircle size={16} className="text-red-400" />}
                    {adj.delta === 0 && <AlertCircle size={16} className="text-amber-400" />}
                    <span className="text-foreground text-sm">{adj.factor}</span>
                  </div>
                  <span className={`text-sm font-bold ${adj.delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {adj.delta >= 0 ? '+' : ''}{adj.delta} pts
                  </span>
                </div>
              ))}
              <div className="pt-2 mt-2 border-t border-border flex justify-between items-center px-3">
                <span className="text-foreground font-semibold">Final Credit Score</span>
                <span className="text-primary text-lg font-bold">{creditScore} / 900</span>
              </div>
            </div>
          </div>
        )}

        {/* PAN Verification & Identity Match */}
        {report?.panDetails && (report.panDetails.panNumber || report.panDetails.nameMatch || report.panDetails.quality) && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="text-muted-foreground text-xs font-medium mb-4 uppercase tracking-wider flex items-center gap-2">
              <FileText size={14} className="text-primary" />
              PAN Card Verification & Identity Match
            </div>

            <div className="space-y-3">
              {/* PAN Number */}
              {report.panDetails.panNumber && (
                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
                  <span className="text-muted-foreground text-xs">PAN Number</span>
                  <span className="text-foreground text-sm font-mono font-semibold tracking-wider">{report.panDetails.panNumber}</span>
                </div>
              )}

              {/* Name Match */}
              {report.panDetails.nameMatch && report.panDetails.nameMatch.panName && (
                <>
                  <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
                    <span className="text-muted-foreground text-xs">Name on PAN Card</span>
                    <span className="text-foreground text-sm font-medium">{report.panDetails.nameMatch.panName}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
                    <span className="text-muted-foreground text-xs">Name Stated in Interview</span>
                    <span className="text-foreground text-sm font-medium">{report.panDetails.nameMatch.spokenName || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
                    <span className="text-muted-foreground text-xs">Name Match Score</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${
                        report.panDetails.nameMatch.score >= 85 ? 'text-emerald-400' :
                        report.panDetails.nameMatch.score >= 65 ? 'text-blue-400' :
                        report.panDetails.nameMatch.score >= 40 ? 'text-amber-400' :
                        'text-red-400'
                      }`}>
                        {report.panDetails.nameMatch.score}%
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        report.panDetails.nameMatch.score >= 85 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' :
                        report.panDetails.nameMatch.score >= 65 ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' :
                        report.panDetails.nameMatch.score >= 40 ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' :
                        'bg-red-500/10 border-red-500/30 text-red-300'
                      }`}>
                        {report.panDetails.nameMatch.label}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Image Quality */}
              {report.panDetails.quality && (
                <div className="flex items-center justify-between p-3 bg-secondary/60 rounded-xl">
                  <span className="text-muted-foreground text-xs">Image Quality</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          report.panDetails.quality.score >= 70 ? 'bg-emerald-500' :
                          report.panDetails.quality.score >= 50 ? 'bg-blue-500' :
                          report.panDetails.quality.score >= 30 ? 'bg-amber-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${report.panDetails.quality.score}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium ${
                      report.panDetails.quality.score >= 70 ? 'text-emerald-400' :
                      report.panDetails.quality.score >= 50 ? 'text-blue-400' :
                      report.panDetails.quality.score >= 30 ? 'text-amber-400' :
                      'text-red-400'
                    }`}>
                      {report.panDetails.quality.label} ({report.panDetails.quality.score}/100)
                    </span>
                  </div>
                </div>
              )}

              {/* PAN Issue */}
              {report.panDetails.panIssue && (
                <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                  <div className="text-red-300 text-xs font-semibold mb-1">⚠️ Issue Detected</div>
                  <div className="text-muted-foreground text-xs leading-relaxed">{report.panDetails.panIssueReason}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Age Verification Summary */}
        {report?.ageAnalysis && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="text-muted-foreground text-xs font-medium mb-4 uppercase tracking-wider flex items-center gap-2">
              <Calendar size={14} className="text-primary" />
              AI Age Verification
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-secondary/40 p-3 rounded-xl border border-border/50 text-center">
                <div className="text-muted-foreground text-[10px] uppercase font-bold mb-1">Stated (User)</div>
                <div className="text-foreground text-xl font-bold">{report.ageAnalysis.statedAge || '—'}</div>
                <div className="text-[9px] text-muted-foreground mt-1">From Interview</div>
              </div>
              <div className="bg-secondary/40 p-3 rounded-xl border border-border/50 text-center">
                <div className="text-muted-foreground text-[10px] uppercase font-bold mb-1">Identity (ID)</div>
                <div className="text-foreground text-xl font-bold">{report.ageAnalysis.idAge || '—'}</div>
                <div className="text-[9px] text-muted-foreground mt-1">From PAN OCR</div>
              </div>
              <div className="bg-secondary/40 p-3 rounded-xl border border-border/50 text-center flex flex-col items-center justify-center">
                <div className="text-muted-foreground text-[10px] uppercase font-bold mb-1">AI Inference</div>
                {report.ageAnalysis.aiModelConnected ? (
                  <>
                    <div className="text-foreground text-xl font-bold">{report.ageAnalysis.realAiAge || '—'}</div>
                    <div className="text-[9px] text-emerald-400 mt-1 font-bold">Confidence: {report.ageAnalysis.realAiConfidence}%</div>
                  </>
                ) : (
                  <div className="text-red-400 text-[10px] font-bold leading-tight px-1">
                    No AI model connected
                  </div>
                )}
              </div>
            </div>

            {/* Validation Logic */}
            <div className="mt-4 space-y-2">
              {report.ageAnalysis.realAiAge && report.ageAnalysis.idAge && (
                <div className="p-2 bg-secondary/20 rounded-lg flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">AI vs ID</span>
                  <div className="text-xs font-bold">
                    {Math.abs(report.ageAnalysis.realAiAge - report.ageAnalysis.idAge) <= 5 ? (
                      <span className="text-emerald-400 flex items-center gap-1"><CheckCircle size={12}/> Verified</span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-1"><XCircle size={12}/> Mismatch</span>
                    )}
                  </div>
                </div>
              )}

              {report.ageAnalysis.statedAge && report.ageAnalysis.idAge && (
                <div className="p-2 bg-secondary/20 rounded-lg flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Stated vs ID</span>
                  <div className="text-xs font-bold">
                    {Math.abs(report.ageAnalysis.statedAge - report.ageAnalysis.idAge) <= 3 ? (
                      <span className="text-emerald-400 flex items-center gap-1"><CheckCircle size={12}/> Verified</span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-1"><XCircle size={12}/> Mismatch</span>
                    )}
                  </div>
                </div>
              )}

              {report.ageAnalysis.realAiAge && report.ageAnalysis.statedAge && (
                <div className="p-2 bg-secondary/20 rounded-lg flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Interview vs AI</span>
                  <div className="text-xs font-bold">
                    {Math.abs(report.ageAnalysis.realAiAge - report.ageAnalysis.statedAge) <= 10 ? (
                      <span className="text-emerald-400 flex items-center gap-1"><CheckCircle size={12}/> Consistent</span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-1"><XCircle size={12}/> Inconsistent</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Detailed Rejection Reasons — always visible for REJECTED */}
        {decision === 'REJECTED' && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-500/20 text-red-400">
                <XCircle size={20} />
              </div>
              <div>
                <div className="text-destructive font-bold text-sm uppercase tracking-wider">
                  {t('rejectionReasons')}
                </div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  Specific issues found with your application
                </div>
              </div>
            </div>

            {/* Reason cards */}
            {report?.rejectionReasons && report.rejectionReasons.length > 0 ? (
              <div className="space-y-3">
                {report.rejectionReasons.map((reason: any, i: number) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-4 flex gap-3 items-start">
                    {/* Number badge */}
                    <div className="min-w-[26px] h-[26px] rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 text-xs font-bold">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-foreground font-semibold text-sm">{reason.title}</h4>
                      <p className="text-muted-foreground text-xs mt-1 leading-relaxed">{reason.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl p-4 flex gap-3 items-start">
                <div className="min-w-[26px] h-[26px] rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 text-xs font-bold">1</div>
                <div>
                  <h4 className="text-foreground font-semibold text-sm">Application Did Not Meet Criteria</h4>
                  <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                    Your application did not meet our eligibility criteria. Please ensure you provide a valid PAN card, state your income clearly in the interview, and complete the liveness check.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}


        {/* Conditional Approval Note */}
        {decision === 'CONDITIONAL' && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex gap-4 items-start">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 mt-0.5">
              <AlertCircle size={18} />
            </div>
            <div>
              <h4 className="text-amber-500 font-semibold text-sm">⏳ Pending Admin Review</h4>
              <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                Your application has been submitted and is awaiting review by our loan officer. 
                Your credit score (491–750) requires manual verification. You will be notified once a decision is made.
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 flex-wrap">
          <button
            id="btn-view-report"
            onClick={() => navigate('/report')}
            className="flex items-center gap-2 px-5 py-3 bg-secondary border border-border text-foreground rounded-xl hover:bg-secondary/80 transition-all text-sm font-medium"
          >
            <FileText size={16} />
            {t('fullReport')}
          </button>

          {(decision === 'APPROVED' || decision === 'CONDITIONAL') && (
            <button id="btn-my-dashboard" onClick={() => navigate('/user/dashboard')}
              className="flex items-center gap-2 px-5 py-3 bg-violet-600/20 border border-violet-500/30 text-violet-300 rounded-xl hover:bg-violet-600/30 transition-all text-sm font-medium">
              <LayoutDashboard size={16} />
              {t('myDashboard')}
            </button>
          )}

          {decision === 'APPROVED' && offer && (
            <button id="btn-accept-offer" onClick={() => navigate('/disbursement')}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3 rounded-xl font-semibold hover:opacity-90 transition-all shadow-lg shadow-emerald-500/20">
              {t('acceptOffer')}
              <ChevronRight size={18} />
            </button>
          )}

          {decision === 'REJECTED' && (
            <button id="btn-try-again" onClick={() => navigate('/')}
              className="flex-1 flex items-center justify-center gap-2 bg-secondary border border-border text-foreground py-3 rounded-xl hover:bg-secondary/80 transition-all text-sm font-medium">
              <RotateCcw size={16} />
              {t('tryAgain')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
