import { useState } from "react";
import { Banknote, CheckCircle2, Landmark, Loader2, PartyPopper, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  onRestart: () => void;
}

export const Disbursement = ({ onRestart }: Props) => {
  const [acc, setAcc] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [state, setState] = useState<"idle" | "processing" | "done">("idle");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!acc || !ifsc) return;
    setState("processing");
    setTimeout(() => setState("done"), 1800);
  };

  if (state === "done") {
    const last4 = acc.slice(-4).padStart(4, "X");
    return (
      <div className="w-full max-w-xl mx-auto animate-scale-in">
        <div className="bg-card rounded-3xl shadow-card border border-border/60 p-10 text-center">
          <div className="relative inline-flex items-center justify-center mb-6">
            <span className="absolute inset-0 rounded-full bg-success/20 animate-pulse-ring" />
            <div className="relative w-20 h-20 rounded-full bg-success flex items-center justify-center shadow-elegant">
              <CheckCircle2 className="w-10 h-10 text-success-foreground" />
            </div>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 text-success text-xs font-semibold mb-3">
            <PartyPopper className="w-3.5 h-3.5" /> Disbursement Successful
          </div>
          <h2 className="text-3xl font-bold mb-2">₹2,00,000 Credited!</h2>
          <p className="text-muted-foreground mb-6">
            Funds have been transferred to A/c <span className="font-mono font-semibold text-foreground">XXXXX{last4}</span>
          </p>
          <div className="rounded-2xl bg-muted/40 p-5 text-left mb-6">
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-muted-foreground">Transaction ID</span>
              <span className="font-mono font-medium text-right">TXN8821094563</span>
              <span className="text-muted-foreground">Mode</span>
              <span className="font-medium text-right">IMPS</span>
              <span className="text-muted-foreground">Status</span>
              <span className="font-semibold text-right text-success">SUCCESS</span>
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium text-right">{new Date().toLocaleTimeString("en-IN")}</span>
            </div>
          </div>
          <Button variant="hero" size="lg" className="w-full" onClick={onRestart}>
            <RotateCcw className="w-4 h-4" /> Start New Application
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto animate-fade-in">
      <div className="bg-card rounded-3xl shadow-card border border-border/60 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-elegant">
            <Banknote className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Loan Disbursement</h2>
            <p className="text-sm text-muted-foreground">Enter your bank details to receive ₹2,00,000</p>
          </div>
        </div>

        <div className="rounded-2xl bg-accent/60 p-4 mb-6 flex items-center gap-3">
          <Landmark className="w-5 h-5 text-accent-foreground shrink-0" />
          <p className="text-sm text-accent-foreground">
            Funds will be transferred via <span className="font-semibold">IMPS</span> within 5 minutes of acceptance.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="acc">Account Number</Label>
            <Input
              id="acc"
              inputMode="numeric"
              placeholder="1234567890"
              value={acc}
              onChange={(e) => setAcc(e.target.value.replace(/\D/g, ""))}
              maxLength={18}
              className="h-12 text-base"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ifsc">IFSC Code</Label>
            <Input
              id="ifsc"
              placeholder="HDFC0001234"
              value={ifsc}
              onChange={(e) => setIfsc(e.target.value.toUpperCase())}
              maxLength={11}
              className="h-12 text-base font-mono"
              required
            />
          </div>

          <div className="rounded-2xl border border-border p-4 space-y-2 bg-muted/30">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Loan Amount</span>
              <span className="font-semibold">₹2,00,000</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Processing Fee</span>
              <span className="font-semibold">₹2,000</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between">
              <span className="font-semibold">Net Disbursal</span>
              <span className="font-bold text-primary">₹1,98,000</span>
            </div>
          </div>

          <Button
            type="submit"
            variant="hero"
            size="xl"
            className="w-full"
            disabled={state === "processing"}
          >
            {state === "processing" ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Processing transfer...
              </>
            ) : (
              "Accept Offer"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};
