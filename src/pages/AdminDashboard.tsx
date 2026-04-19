import React, { useEffect, useState, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, ChevronDown, CheckCircle, AlertCircle, XCircle,
  TrendingUp, Download, Eye, MapPin, ExternalLink, RefreshCw,
  Trash2, History, RotateCcw, ShieldAlert, Clock, LogOut, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { toast } from 'sonner';
import { useLang } from '../context/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeToggle from '../components/ThemeToggle';

export default function AdminDashboard() {
  const [apps, setApps] = useState<any[]>([]);
  const [trash, setTrash] = useState<any[]>([]);
  const [currentTab, setCurrentTab] = useState<'active' | 'trash'>('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  async function handleUpdateDecision(id: string, decision: 'APPROVED' | 'REJECTED') {
    const label = decision === 'APPROVED' ? 'approve' : 'reject';
    if (!confirm(`Are you sure you want to ${label} this application?`)) return;
    setIsProcessing(true);
    try {
      const resp = await fetch(`${API_BASE}/api/admin/applications/${id}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const data = await resp.json();
      if (data.success) {
        toast.success(`Application ${decision === 'APPROVED' ? 'approved' : 'rejected'} successfully`);
        // SSE will auto-update the list
      } else {
        toast.error(data.error || 'Update failed');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setIsProcessing(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('admin_token');
    navigate('/');
  }

  useEffect(() => {
    if (currentTab !== 'active') return;

    // Connect to Server-Sent Events stream
    const eventSource = new EventSource(`${API_BASE}/api/admin/applications/stream`);
    
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'connected') {
          console.log('🔗 Connected to Firebase Live Stream');
        } else if (payload.type === 'update') {
          setApps(payload.data || []);
          setLoading(false);
          setError('');
        }
      } catch (err) {
        console.error('SSE Error:', err);
      }
    };

    eventSource.onerror = () => {
      setError('Live stream connection lost. Attempting to reconnect...');
    };

    return () => {
      eventSource.close();
    };
  }, [API_BASE, currentTab]);

  useEffect(() => {
    if (currentTab === 'trash') {
      fetchTrash();
    }
  }, [currentTab]);

  async function fetchTrash() {
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/admin/trash`);
      const data = await resp.json();
      if (data.success) {
        setTrash(data.data || []);
      }
    } catch (err) {
      toast.error('Failed to fetch trash');
    } finally {
      setLoading(false);
    }
  }

  async function handleSoftDelete(id: string) {
    if (!confirm('Move this application to Expiry Section? It will be permanently deleted after 3 days.')) return;
    setIsProcessing(true);
    try {
      const resp = await fetch(`${API_BASE}/api/admin/applications/${id}`, { method: 'DELETE' });
      const data = await resp.json();
      if (data.success) {
        toast.success('Application moved to Expiry Section');
        // SSE will update active list automatically
      } else {
        toast.error(data.error || 'Delete failed');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleRestore(id: string) {
    setIsProcessing(true);
    try {
      const resp = await fetch(`${API_BASE}/api/admin/trash/${id}/restore`, { method: 'POST' });
      const data = await resp.json();
      if (data.success) {
        toast.success('Application restored');
        fetchTrash();
      } else {
        toast.error(data.error || 'Restore failed');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setIsProcessing(false);
    }
  }

  async function handlePermanentDelete(id: string) {
    if (!confirm('Permanently delete this application? This action cannot be undone.')) return;
    setIsProcessing(true);
    try {
      const resp = await fetch(`${API_BASE}/api/admin/trash/${id}`, { method: 'DELETE' });
      const data = await resp.json();
      if (data.success) {
        toast.success('Application permanently deleted');
        fetchTrash();
      } else {
        toast.error(data.error || 'Delete failed');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleEmptyTrash() {
    if (!confirm('Permanently delete ALL expired applications? This action cannot be undone.')) return;
    setIsProcessing(true);
    try {
      const resp = await fetch(`${API_BASE}/api/admin/trash`, { method: 'DELETE' });
      const data = await resp.json();
      if (data.success) {
        toast.success(`Successfully deleted ${data.count} applications`);
        fetchTrash();
      } else {
        toast.error(data.error || 'Failed to empty trash');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setIsProcessing(false);
    }
  }

  function DecisionBadge({ decision }: { decision: string }) {
    if (decision === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle size={12} /> Approved
        </span>
      );
    }
    if (decision === 'CONDITIONAL') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <AlertCircle size={12} /> Pending Review
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
        <XCircle size={12} /> Rejected
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-8 transition-colors duration-500">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[600px] h-[400px] bg-blue-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <Users className="text-blue-400" />
              Loan Applications Admin
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Live data from Firebase Firestore</p>
          </div>

          <div className="flex bg-secondary p-1 border border-border rounded-xl">
            <button
              onClick={() => setCurrentTab('active')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                currentTab === 'active' ? 'bg-primary text-white-always shadow-lg' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <History size={16} /> Applications
            </button>
            <button
              onClick={() => setCurrentTab('trash')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                currentTab === 'trash' ? 'bg-destructive text-white-always shadow-lg' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Trash2 size={16} /> Expiry Section
            </button>
            {currentTab === 'trash' && trash.length > 0 && (
              <button
                onClick={handleEmptyTrash}
                disabled={isProcessing}
                className="ml-2 px-4 py-2 rounded-lg text-sm font-bold bg-red-500 hover:bg-red-600 text-white transition-all flex items-center gap-2 shadow-sm"
              >
                <Trash2 size={16} /> Empty Trash
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <ThemeToggle />
            
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-medium hidden sm:inline">Connected</span>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-4 py-2 bg-secondary hover:bg-destructive/10 border border-border hover:border-destructive/30 text-muted-foreground hover:text-destructive rounded-xl transition-all text-sm font-medium"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 mb-6 flex gap-2">
            <XCircle size={20} />
            {error}
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-secondary/50 border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-medium">Applicant</th>
                  <th className="px-6 py-4 font-medium">Loan Details</th>
                  <th className="px-6 py-4 font-medium">Credit / Risk</th>
                  <th className="px-6 py-4 font-medium">Verification</th>
                  <th className="px-6 py-4 font-medium">Decision</th>
                  <th className="px-6 py-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
                      Loading...
                    </td>
                  </tr>
                ) : currentTab === 'active' && apps.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      No applications found.
                    </td>
                  </tr>
                ) : currentTab === 'trash' && trash.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      Recycle bin is empty.
                    </td>
                  </tr>
                ) : (
                  (currentTab === 'active' ? apps : trash).map((app) => (
                    <Fragment key={app.id}>
                      <tr className={`hover:bg-secondary/30 transition-colors ${currentTab === 'trash' ? 'opacity-80' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-foreground">{app.customerDetails?.name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">{app.id}</div>
                          {app.customerDetails?.location && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                              <MapPin size={10} /> Lat: {app.customerDetails.location.lat?.toFixed(2)}
                            </div>
                          )}
                        </td>
                        
                        <td className="px-6 py-4">
                          <div className="text-sm text-foreground font-medium">
                            ₹{(app.financialDetails?.requestedAmount || 0).toLocaleString('en-IN')}
                          </div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {app.financialDetails?.loanPurpose} ({app.financialDetails?.jobType})
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Income: ₹{(app.financialDetails?.income || 0).toLocaleString('en-IN')}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${
                              app.creditScore >= 751 ? 'text-emerald-400' : 
                              app.creditScore >= 491 ? 'text-amber-400' : 'text-red-400'
                            }`}>
                              {app.creditScore}
                            </span>
                            <span className="text-xs text-muted-foreground">/ 900</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Risk Level: <span className="text-foreground font-medium">{app.riskLevel}</span>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex gap-2 text-xs">
                            <span className={`px-2 py-0.5 rounded ${app.verification?.liveness ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                              Liveness: {app.verification?.liveness ? 'Pass' : 'Fail'}
                            </span>
                          </div>
                          <div className="flex gap-2 text-xs mt-1">
                            <span className={`px-2 py-0.5 rounded ${app.verification?.panVerified ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'}`}>
                              PAN: {app.verification?.panVerified ? 'Verified' : 'Missing'}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <DecisionBadge decision={app.decision} />
                          {app.offer && (
                            <div className="text-[10px] text-emerald-400 mt-1.5 font-medium">
                              Offered: ₹{app.offer.offeredAmount.toLocaleString('en-IN')}
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Approve / Reject for CONDITIONAL only */}
                            {currentTab === 'active' && app.decision === 'CONDITIONAL' && (
                              <>
                                <button
                                  disabled={isProcessing}
                                  onClick={(e) => { e.stopPropagation(); handleUpdateDecision(app.id, 'APPROVED'); }}
                                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/30 rounded-lg transition-all"
                                  title="Approve this application"
                                >
                                  <ThumbsUp size={14} /> Approve
                                </button>
                                <button
                                  disabled={isProcessing}
                                  onClick={(e) => { e.stopPropagation(); handleUpdateDecision(app.id, 'REJECTED'); }}
                                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500 border border-red-500/30 rounded-lg transition-all"
                                  title="Reject this application"
                                >
                                  <ThumbsDown size={14} /> Reject
                                </button>
                              </>
                            )}
                            {currentTab === 'active' ? (
                              <button
                                disabled={isProcessing}
                                onClick={(e) => { e.stopPropagation(); handleSoftDelete(app.id); }}
                                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                                title="Move to trash"
                              >
                                <Trash2 size={18} />
                              </button>
                            ) : (
                              <>
                                <button
                                  disabled={isProcessing}
                                  onClick={(e) => { e.stopPropagation(); handleRestore(app.id); }}
                                  className="p-2 text-muted-foreground hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-all"
                                  title="Restore"
                                >
                                  <RotateCcw size={18} />
                                </button>
                                <button
                                  disabled={isProcessing}
                                  onClick={(e) => { e.stopPropagation(); handlePermanentDelete(app.id); }}
                                  className="p-2 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                  title="Delete permanently"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
                              className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition"
                            >
                              <ChevronDown size={18} className={`transform transition-transform ${expandedId === app.id ? 'rotate-180' : ''}`} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded View */}
                      {expandedId === app.id && (
                        <tr className="bg-secondary/20 border-t border-border">
                          <td colSpan={6} className="px-6 py-6">
                            {currentTab === 'trash' && (
                              <div className="mb-4 flex items-center gap-2 p-3 bg-red-500/5 border border-red-500/10 rounded-lg text-red-400 text-xs">
                                <Clock size={14} />
                                <span>Expiring in approximately {Math.ceil(((app.expiryAt || 0) - Date.now()) / (24 * 60 * 60 * 1000))} days</span>
                              </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="bg-card border border-border p-4 rounded-xl">
                                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                                  <TrendingUp size={14} className="text-blue-400" /> AI Explanation
                                </h4>
                                <p className="text-sm text-foreground leading-relaxed bg-secondary/50 p-3 rounded-lg border border-border">
                                  {app.explanation}
                                </p>
                              </div>

                              <div className="bg-card border border-border p-4 rounded-xl">
                                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                                  <Eye size={14} className="text-violet-400" /> Score Adjustments
                                </h4>
                                <ul className="text-sm text-foreground space-y-1.5">
                                  {app.adjustments?.map((adj: any, i: number) => (
                                    <li key={i} className="flex justify-between items-center bg-secondary/30 px-3 py-1.5 rounded">
                                      <span className="text-muted-foreground">{adj.factor}</span>
                                      <span className={adj.delta >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                        {adj.delta >= 0 ? '+' : ''}{adj.delta}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
