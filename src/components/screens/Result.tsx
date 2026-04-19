import { useEffect, useState } from "react";
import { CheckCircle2, TrendingUp, Wallet, Calendar, Percent, ArrowRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onNext: () => void;
  onReport: () => void;
}

export const Result = ({ onNext, onReport }: Props) => {
  const score = 782;
  const max = 900;
  const [animScore, setAnimScore] = useState(0);
  const [animPct, setAnimPct] = useState(0);
  const pct = score / max;

  useEffect(() => {
    let s = 0;
    const id = setInterval(() => {
      s += 18;
      if (s >= score) {
        s = score;
        clearInterval(id);
      }
      setAnimScore(s);
      setAnimPct(s / max);
    }, 20);
    return () => clearInterval(id);
  }, []);

  const r = 70;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - animPct);

  return (
    <div className="w-full max-w-5xl mx-auto animate-fade-in">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-success/10 text-success text-sm font-semibold mb-3">
          <CheckCircle2 className="w-4 h-4" />
          Application Approved
        </div>
        <h1 className="text-3xl md:text-4xl font-bold">Congratulations! 🎉</h1>
        <p className="text-muted-foreground mt-2">
          Based on AI analysis, you qualify for the following loan offer.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-5 mb-6">
        {/* Credit score */}
        <div className="bg-card rounded-3xl shadow-card border border-border/60 p-6 flex flex-col items-center">
          <div className="text-sm font-medium text-muted-foreground mb-3">Credit Score</div>
          <div className="relative w-44 h-44">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r={r} stroke="hsl(var(--muted))" strokeWidth="12" fill="none" />
              <circle
                cx="80"
                cy="80"
                r={r}
                stroke="hsl(var(--primary))"
                strokeWidth="12"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={offset}
                style={{ transition: "stroke-dashoffset 0.05s linear" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-4xl font-bold tabular-nums">{animScore}</div>
              <div className="text-xs text-muted-foreground">out of {max}</div>
            </div>
          </div>
          <div className="mt-3 text-sm font-semibold text-success flex items-center gap-1">
            <TrendingUp className="w-4 h-4" /> Excellent
          </div>
        </div>

        {/* Risk */}
        <div className="bg-card rounded-3xl shadow-card border border-border/60 p-6 flex flex-col">
          <div className="text-sm font-medium text-muted-foreground mb-4">Risk Level</div>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-success/15 flex items-center justify-center mb-3">
              <div className="w-16 h-16 rounded-full bg-success flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-success-foreground" />
              </div>
            </div>
            <div className="text-2xl font-bold text-success">Low Risk</div>
            <div className="text-sm text-muted-foreground mt-1">Strong repayment profile</div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mt-4">
            <div className="h-2 rounded-full bg-success" />
            <div className="h-2 rounded-full bg-muted" />
            <div className="h-2 rounded-full bg-muted" />
          </div>
        </div>

        {/* Decision */}
        <div className="bg-gradient-dark rounded-3xl shadow-elegant p-6 text-secondary-foreground flex flex-col">
          <div className="text-sm font-medium text-secondary-foreground/70 mb-4">AI Decision</div>
          <div className="flex-1 flex flex-col justify-center">
            <div className="text-4xl font-bold mb-2">Approved</div>
            <p className="text-sm text-secondary-foreground/70">
              Verified through video KYC, liveness check, and AI risk model.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-secondary-foreground/10 text-xs text-secondary-foreground/70">
            Confidence: <span className="text-primary font-semibold">96.4%</span>
          </div>
        </div>
      </div>

      {/* Loan offer */}
      <div className="bg-card rounded-3xl shadow-card border border-border/60 overflow-hidden">
        <div className="bg-gradient-primary px-6 py-4 flex items-center justify-between">
          <div className="text-primary-foreground">
            <div className="text-xs uppercase tracking-wider opacity-90">Personalized Loan Offer</div>
            <div className="text-xl font-bold">Pre-approved for you</div>
          </div>
          <div className="hidden sm:block text-primary-foreground/90 text-sm">Valid for 7 days</div>
        </div>
        <div className="p-6 grid sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-muted/40">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Wallet className="w-4 h-4" /> Loan Amount
            </div>
            <div className="text-2xl font-bold">₹2,00,000</div>
          </div>
          <div className="p-4 rounded-2xl bg-muted/40">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Percent className="w-4 h-4" /> Interest Rate
            </div>
            <div className="text-2xl font-bold">10.5% <span className="text-sm text-muted-foreground font-normal">p.a.</span></div>
          </div>
          <div className="p-4 rounded-2xl bg-muted/40">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Calendar className="w-4 h-4" /> Monthly EMI
            </div>
            <div className="text-2xl font-bold">₹4,292 <span className="text-sm text-muted-foreground font-normal">/ 60 mo</span></div>
          </div>
        </div>
        <div className="px-6 pb-6 flex flex-col sm:flex-row gap-3">
          <Button variant="outline" size="lg" className="sm:flex-1" onClick={onReport}>
            <FileText className="w-4 h-4" /> View Detailed Report
          </Button>
          <Button variant="hero" size="lg" className="sm:flex-1" onClick={onNext}>
            Accept & Continue <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
