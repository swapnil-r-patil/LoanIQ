import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoan } from '../context/LoanContext';
import { useUserAuth } from '../context/UserAuthContext';
import { CheckCircle, Banknote, Lock, ArrowLeft, AlertCircle, Download, FileText } from 'lucide-react';
import { downloadLoanSanctionPDF } from '../services/loanPdfGenerator';

function maskAccount(acc: string) {
  if (acc.length < 4) return acc;
  return 'X'.repeat(acc.length - 4) + acc.slice(-4);
}

export default function Disbursement() {
  const navigate = useNavigate();
  const { state, setState } = useLoan();
  const { user } = useUserAuth();
  const result = state.result;

  const [accountNumber, setAccountNumber] = useState(state.accountNumber);
  const [ifscCode, setIfscCode] = useState(state.ifscCode);
  const [loading, setLoading] = useState(false);
  const [disbursed, setDisbursed] = useState(state.disbursed);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (!result || (result.decision !== 'APPROVED' && result.decision !== 'CONDITIONAL')) {
      navigate('/result');
    }
  }, [result]);

  if (!result) return null;

  const offer = result.offer;
  const name = result.report?.customerDetails?.name || 'Customer';

  function validate() {
    const e: Record<string, string> = {};
    if (!accountNumber.trim() || accountNumber.length < 9 || accountNumber.length > 18) {
      e.account = 'Please enter a valid account number (9–18 digits)';
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase())) {
      e.ifsc = 'Invalid IFSC code format (e.g. SBIN0001234)';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleAcceptOffer() {
    if (!validate()) return;
    setLoading(true);

    // Simulate bank processing delay
    await new Promise(r => setTimeout(r, 2500));

    setLoading(false);
    setDisbursed(true);
    setState(prev => ({ ...prev, accountNumber, ifscCode, disbursed: true }));
  }

  async function handleDownloadPDF() {
    setPdfLoading(true);
    try {
      await downloadLoanSanctionPDF(result, accountNumber, ifscCode, user?.userId || null);
    } catch (e) {
      console.error('PDF generation failed:', e);
      alert('Could not generate PDF. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  }

  if (disbursed && offer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-emerald-600/5 animate-pulse" />
        </div>

        <div className="relative max-w-md w-full text-center">
          {/* Success animation */}
          <div className="relative inline-flex mb-6">
            <div className="w-24 h-24 bg-emerald-500/20 rounded-full animate-ping absolute inset-0" />
            <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30">
              <CheckCircle size={40} className="text-white" />
            </div>
          </div>

          <h2 className="text-3xl font-bold text-foreground mb-2">Amount Credited!</h2>
          <p className="text-muted-foreground mb-6">Your loan has been successfully disbursed</p>

          <div className="bg-gradient-to-br from-emerald-900/40 to-teal-900/30 border border-emerald-500/30 rounded-2xl p-6 mb-6 space-y-4">
            <div className="text-4xl font-bold text-emerald-400">
              ₹{offer.offeredAmount.toLocaleString('en-IN')}
            </div>
            <div className="text-foreground/80">credited to</div>
            <div className="bg-secondary/60 rounded-xl px-4 py-3 border border-border">
              <div className="text-muted-foreground text-xs">Account</div>
              <div className="text-foreground font-mono font-semibold text-lg">{maskAccount(accountNumber)}</div>
              <div className="text-muted-foreground text-xs mt-1">IFSC: {ifscCode.toUpperCase()}</div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-secondary/40 rounded-xl p-3 border border-border">
                <div className="text-muted-foreground text-xs">Monthly EMI</div>
                <div className="text-foreground font-semibold">₹{offer.emi.toLocaleString('en-IN')}</div>
              </div>
              <div className="bg-secondary/40 rounded-xl p-3 border border-border">
                <div className="text-muted-foreground text-xs">Interest</div>
                <div className="text-foreground font-semibold">{offer.interestRate}% p.a.</div>
              </div>
            </div>
          </div>

          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-6 text-left">
            <p className="text-primary text-sm">
              Dear <span className="font-semibold">{name}</span>, your EMI of{' '}
              <span className="font-semibold text-foreground">₹{offer.emi.toLocaleString('en-IN')}</span> will start
              from next month. Please ensure sufficient balance in your account.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Download PDF - Primary CTA */}
            <button
              onClick={handleDownloadPDF}
              disabled={pdfLoading}
              className="w-full flex items-center justify-center gap-2.5 py-4 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-2xl font-semibold hover:opacity-90 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-70"
            >
              {pdfLoading ? (
                <><div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />Generating Document…</>
              ) : (
                <><Download size={18} />Download Official Sanction Letter (PDF)</>
              )}
            </button>

            {/* View Full Report */}
            <button
              id="btn-view-full-report"
              onClick={() => navigate('/report')}
              className="w-full flex items-center justify-center gap-2 py-3 bg-secondary border border-border text-foreground rounded-2xl font-medium text-sm hover:bg-secondary/80 transition-all"
            >
              <FileText size={16} />
              View Full AI Credit Report
            </button>

            <button
              id="btn-done"
              onClick={() => navigate('/')}
              className="w-full py-3 text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-emerald-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-md mx-auto">
        {/* Back */}
        <button
          id="btn-disbursement-back"
          onClick={() => navigate('/result')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm mb-6"
        >
          <ArrowLeft size={16} />
          Back to Result
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4 shadow-lg shadow-emerald-500/25">
            <Banknote size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Loan Disbursement</h1>
          <p className="text-muted-foreground text-sm">Enter your bank details to receive your loan</p>
        </div>

        {/* Offer Summary */}
        {offer && (
          <div className="bg-gradient-to-r from-emerald-900/30 to-teal-900/20 border border-emerald-500/20 rounded-2xl p-5 mb-6">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-muted-foreground text-xs">Approved Amount</div>
                <div className="text-emerald-500 text-2xl font-bold">₹{offer.offeredAmount.toLocaleString('en-IN')}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Rate</div>
                <div className="text-foreground text-xl font-bold">{offer.interestRate}%</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Monthly EMI</div>
                <div className="text-foreground font-semibold">₹{offer.emi.toLocaleString('en-IN')}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Tenure</div>
                <div className="text-foreground font-semibold">{offer.tenure} months</div>
              </div>
            </div>
          </div>
        )}

        {/* Bank Details Form */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-foreground font-semibold mb-2">
            <Lock size={16} className="text-primary" />
            Bank Account Details
          </div>

          {/* Account Number */}
          <div>
            <label className="block text-muted-foreground text-sm mb-1.5" htmlFor="account-number">
              Account Number
            </label>
            <input
              id="account-number"
              type="text"
              value={accountNumber}
              onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter your bank account number"
              maxLength={18}
              className={`w-full bg-secondary border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-2 transition-all ${
                errors.account ? 'border-destructive focus:ring-destructive/30' : 'border-border focus:ring-primary/30 focus:border-primary'
              }`}
            />
            {errors.account && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <AlertCircle size={12} className="text-red-400" />
                <p className="text-red-400 text-xs">{errors.account}</p>
              </div>
            )}
          </div>

          {/* IFSC Code */}
          <div>
            <label className="block text-muted-foreground text-sm mb-1.5" htmlFor="ifsc-code">
              IFSC Code
            </label>
            <input
              id="ifsc-code"
              type="text"
              value={ifscCode}
              onChange={e => setIfscCode(e.target.value.toUpperCase())}
              placeholder="e.g. SBIN0001234"
              maxLength={11}
              className={`w-full bg-secondary border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-2 transition-all font-mono ${
                errors.ifsc ? 'border-destructive focus:ring-destructive/30' : 'border-border focus:ring-primary/30 focus:border-primary'
              }`}
            />
            {errors.ifsc && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <AlertCircle size={12} className="text-red-400" />
                <p className="text-red-400 text-xs">{errors.ifsc}</p>
              </div>
            )}
          </div>

          {/* Security note */}
          <div className="flex items-start gap-2 p-3 bg-blue-500/5 border border-blue-500/15 rounded-xl">
            <Lock size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-blue-300/70 text-xs">Your banking details are encrypted and secure. We use 256-bit SSL encryption.</p>
          </div>

          {/* Submit */}
          <button
            id="btn-accept-offer"
            onClick={handleAcceptOffer}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-70"
          >
            {loading ? (
              <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />Processing…</>
            ) : (
              <><CheckCircle size={18} />Accept Offer & Disburse</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
