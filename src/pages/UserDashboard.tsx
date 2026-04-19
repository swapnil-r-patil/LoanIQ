import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserAuth } from '../context/UserAuthContext';
import { useLoan } from '../context/LoanContext';
import { useLang } from '../context/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeToggle from '../components/ThemeToggle';
import {
  User, LogOut, TrendingUp, Clock, CheckCircle, XCircle, AlertCircle,
  Banknote, ChevronRight, FileText, LayoutDashboard, RefreshCw
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface LoanRecord {
  id: string;
  createdAt: string;
  creditScore: number;
  decision: 'APPROVED' | 'CONDITIONAL' | 'REJECTED';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  customerDetails?: { name: string; location: any };
  financialDetails?: { income: number; jobType: string; loanPurpose: string; requestedAmount: number };
  offer?: { offeredAmount: number; interestRate: number; tenure: number; emi: number } | null;
  verification?: { liveness: boolean; panVerified: boolean };
}

const decisionConfig = {
  APPROVED: { icon: <CheckCircle size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', label: 'Approved' },
  CONDITIONAL: { icon: <AlertCircle size={16} />, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', label: 'Pending' },
  REJECTED: { icon: <XCircle size={16} />, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', label: 'Rejected' },
};

const riskColors = { LOW: 'text-emerald-400', MEDIUM: 'text-amber-400', HIGH: 'text-red-400' };

export default function UserDashboard() {
  const navigate = useNavigate();
  const { user, logout, isLoading } = useUserAuth();
  const { setState } = useLoan();
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [fetching, setFetching] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [filter, setFilter] = useState<string | null>(null);

  function handleAction(loan: any, path: string) {
    // Populate the global loan context with this historical application's data
    setState(prev => ({
      ...prev,
      result: {
        success: true,
        creditScore: loan.creditScore,
        riskLevel: loan.riskLevel,
        decision: loan.decision,
        offer: loan.offer || null,
        report: loan, // loan object IS the report
        docId: loan.id,
      }
    }));
    navigate(path);
  }

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        navigate('/user/auth');
      } else if (user.isApplicant) {
        navigate('/user/auth?mode=upgrade');
      }
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user) fetchLoans();
  }, [user]);

  async function fetchLoans() {
    setFetching(true);
    try {
      const res = await fetch(`${API_BASE}/api/user/my-loans/${user?.userId}`);
      const data = await res.json();
      if (data.success) setLoans(data.loans || []);
    } catch {
      setLoans([]);
    } finally {
      setFetching(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

  if (isLoading) return null;

  const stats = {
    total: loans.length,
    approved: loans.filter(l => l.decision === 'APPROVED').length,
    conditional: loans.filter(l => l.decision === 'CONDITIONAL').length,
    rejected: loans.filter(l => l.decision === 'REJECTED').length,
  };

  const filteredLoans = filter ? loans.filter(l => l.decision === filter) : loans;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 transition-colors duration-500">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-violet-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <LayoutDashboard size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">My Dashboard</h1>
              <p className="text-muted-foreground text-xs">
                Welcome back, <span className="text-blue-400 font-medium">{user?.name}</span>
                {user?.isApplicant && <span className="ml-1.5 text-xs bg-violet-500/20 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded-md">Applicant</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LanguageSwitcher compact />
            <button
              onClick={fetchLoans}
              className="p-2 text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-secondary transition-all"
              title="Refresh"
            >
              <RefreshCw size={15} className={fetching ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-red-400 hover:text-red-300 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-all"
              title="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>

        {/* Stats row - Clickable for filtering */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Applications', value: stats.total, color: 'text-blue-400', icon: <FileText size={16} />, filterKey: null },
            { label: 'Approved', value: stats.approved, color: 'text-emerald-400', icon: <CheckCircle size={16} />, filterKey: 'APPROVED' },
            { label: 'Pending', value: stats.conditional, color: 'text-amber-400', icon: <AlertCircle size={16} />, filterKey: 'CONDITIONAL' },
            { label: 'Rejected', value: stats.rejected, color: 'text-red-400', icon: <XCircle size={16} />, filterKey: 'REJECTED' },
          ].map(s => {
            const isActive = filter === s.filterKey;
            return (
              <button 
                key={s.label} 
                onClick={() => setFilter(s.filterKey)}
                className={`bg-card border rounded-2xl p-4 text-left transition-all ${
                  isActive ? 'border-primary ring-1 ring-primary shadow-lg shadow-primary/10' : 'border-border hover:border-primary/50 hover:bg-secondary/20'
                }`}
              >
                <div className={`flex items-center gap-1.5 ${s.color} mb-2`}>{s.icon}<span className="text-xs">{s.label}</span></div>
                <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              </button>
            );
          })}
        </div>

        {/* Loan history */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock size={14} />
            Loan Application History
          </h2>

          {fetching ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <div className="w-6 h-6 border-[3px] border-primary/30 border-t-primary rounded-full animate-spin mr-2" />
              Loading applications…
            </div>
          ) : loans.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center">
              <div className="text-muted-foreground mx-auto mb-3">
                <TrendingUp size={32} />
              </div>
              <p className="text-muted-foreground font-medium">No loan applications yet</p>
              <p className="text-muted-foreground/60 text-sm mt-1">Complete a video KYC to apply for a loan</p>
              <button
                onClick={() => navigate('/?new=true')}
                className="mt-4 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-violet-600 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-all"
              >
                Start Application
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLoans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-2xl bg-secondary/10">
                  No applications found for the selected filter.
                </div>
              ) : filteredLoans.map((loan: any) => {
                const dc = decisionConfig[loan.decision as keyof typeof decisionConfig] || decisionConfig.REJECTED;
                const isOpen = expanded === loan.id;
                const dateStr = loan.createdAt ? new Date(loan.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

                return (
                  <div key={loan.id} className="bg-card border border-border rounded-2xl overflow-hidden transition-all">
                    {/* Card header */}
                    <button
                      onClick={() => setExpanded(isOpen ? null : loan.id)}
                      className="w-full flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors text-left"
                    >
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${dc.bg} ${dc.color}`}>
                        {dc.icon} {dc.label}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-foreground font-medium text-sm truncate">
                          {loan.customerDetails?.name || 'Applicant'} — {loan.financialDetails?.loanPurpose || 'Loan'}
                        </div>
                        <div className="text-muted-foreground text-xs mt-0.5">{dateStr} · Score {loan.creditScore}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {loan.offer && (
                          <div className="hidden sm:block text-right">
                            <div className="text-emerald-400 font-semibold text-sm">₹{(loan.offer.offeredAmount).toLocaleString('en-IN')}</div>
                            <div className="text-muted-foreground text-xs">{loan.offer.interestRate}% p.a.</div>
                          </div>
                        )}
                        <ChevronRight size={16} className={`text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isOpen && (
                      <div className="border-t border-border p-4 space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <InfoCell label="Credit Score" value={String(loan.creditScore)} sub="/900" />
                          <InfoCell label="Risk Level" value={loan.riskLevel} className={riskColors[loan.riskLevel]} />
                          <InfoCell label="Monthly Income" value={loan.financialDetails ? `₹${loan.financialDetails.income.toLocaleString('en-IN')}` : 'N/A'} />
                          <InfoCell label="Employment" value={loan.financialDetails?.jobType || 'N/A'} />
                        </div>

                        {loan.offer && (
                          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold mb-3">
                              <Banknote size={14} />
                              LOAN OFFER
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <InfoCell label="Amount" value={`₹${loan.offer.offeredAmount.toLocaleString('en-IN')}`} />
                              <InfoCell label="Interest" value={`${loan.offer.interestRate}% p.a.`} />
                              <InfoCell label="EMI" value={`₹${loan.offer.emi.toLocaleString('en-IN')}/mo`} />
                              <InfoCell label="Tenure" value={`${loan.offer.tenure} months`} />
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${loan.verification?.liveness ? 'border-emerald-500/20 text-emerald-400' : 'border-border text-muted-foreground'}`}>
                            {loan.verification?.liveness ? '✓' : '✗'} Liveness
                          </div>
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${loan.verification?.panVerified ? 'border-emerald-500/20 text-emerald-400' : 'border-border text-muted-foreground'}`}>
                            {loan.verification?.panVerified ? '✓' : '✗'} PAN Verified
                          </div>
                        </div>

                        {/* Actions for Approved Loans */}
                        {loan.decision === 'APPROVED' && (
                          <div className="flex gap-3 pt-2">
                            <button
                              onClick={() => handleAction(loan, '/report')}
                              className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border text-foreground rounded-xl hover:bg-secondary/80 transition-all text-xs font-medium"
                            >
                              <FileText size={14} />
                              Full Report
                            </button>
                            {loan.offer && (
                              <button
                                onClick={() => handleAction(loan, '/disbursement')}
                                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-2 rounded-xl text-xs font-semibold hover:opacity-90 transition-all shadow-lg shadow-emerald-500/20"
                              >
                                Accept Offer <ChevronRight size={14} />
                              </button>
                            )}
                          </div>
                        )}

                        {/* Rejection Reasons */}
                        {loan.decision === 'REJECTED' && loan.rejectionReasons && loan.rejectionReasons.length > 0 && (
                          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 mt-4 space-y-3">
                            <div className="flex items-center gap-2 text-destructive font-bold text-xs uppercase tracking-wider mb-2">
                              <XCircle size={16} /> Rejection Reasons
                            </div>
                            {loan.rejectionReasons.map((reason: any, i: number) => (
                              <div key={i} className="flex gap-3 items-start bg-card/50 p-3 rounded-lg border border-border/50">
                                <div className="min-w-[20px] h-[20px] rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 text-[10px] font-bold">
                                  {i + 1}
                                </div>
                                <div>
                                  <h4 className="text-foreground font-medium text-xs">{reason.title}</h4>
                                  <p className="text-muted-foreground text-[10px] mt-0.5 leading-relaxed">{reason.detail}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* New application CTA */}
        <div className="flex justify-center pt-2">
          <button
            onClick={() => navigate('/?new=true')}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-xl font-medium text-sm hover:opacity-90 transition-all shadow-lg shadow-blue-500/20"
          >
            <User size={16} />
            New Loan Application
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoCell({ label, value, sub = '', className = '' }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs mb-1">{label}</div>
      <div className={`font-semibold text-sm text-foreground ${className}`}>
        {value}<span className="text-muted-foreground text-xs">{sub}</span>
      </div>
    </div>
  );
}
