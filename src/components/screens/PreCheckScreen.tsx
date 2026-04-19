import { useEffect, useState } from "react";
import { Camera, Mic, Wifi, MapPin, Check, AlertTriangle, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CheckItem {
  key: string;
  label: string;
  icon: typeof Camera;
  status: "ok" | "warn" | "fail";
  detail: string;
}

interface Props {
  onNext: () => void;
}

export const PreCheckScreen = ({ onNext }: Props) => {
  const [checks, setChecks] = useState<CheckItem[]>([
    { key: "cam", label: "Camera", icon: Camera, status: "ok", detail: "Checking..." },
    { key: "mic", label: "Microphone", icon: Mic, status: "ok", detail: "Checking..." },
    { key: "net", label: "Network", icon: Wifi, status: "ok", detail: "Checking..." },
    { key: "loc", label: "Location", icon: MapPin, status: "ok", detail: "Checking..." },
  ]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const final: Record<string, { status: CheckItem["status"]; detail: string }> = {
      cam: { status: "ok", detail: "Camera Ready" },
      mic: { status: "ok", detail: "Microphone Ready" },
      net: { status: "warn", detail: "Network Medium · 12 Mbps" },
      loc: { status: "ok", detail: "Location Enabled" },
    };
    const timers = checks.map((c, i) =>
      setTimeout(() => {
        setChecks((prev) =>
          prev.map((p) => (p.key === c.key ? { ...p, ...final[c.key] } : p))
        );
        if (i === checks.length - 1) setLoaded(true);
      }, 600 + i * 500)
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const StatusBadge = ({ status }: { status: CheckItem["status"] }) => {
    if (status === "ok")
      return (
        <div className="w-7 h-7 rounded-full bg-success/15 flex items-center justify-center">
          <Check className="w-4 h-4 text-success" />
        </div>
      );
    if (status === "warn")
      return (
        <div className="w-7 h-7 rounded-full bg-warning/15 flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 text-warning" />
        </div>
      );
    return (
      <div className="w-7 h-7 rounded-full bg-destructive/15 flex items-center justify-center">
        <AlertTriangle className="w-4 h-4 text-destructive" />
      </div>
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in">
      <div className="bg-card rounded-3xl shadow-card border border-border/60 p-8 md:p-10">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-elegant mb-4">
            <ShieldCheck className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">System Pre-check</h1>
          <p className="text-muted-foreground mt-2 max-w-md">
            We're verifying your device readiness before starting the secure video KYC.
          </p>
        </div>

        <div className="space-y-3">
          {checks.map((c, i) => (
            <div
              key={c.key}
              className="flex items-center gap-4 p-4 rounded-2xl bg-muted/40 border border-border/50 animate-slide-in-right"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div
                className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                  c.status === "ok" && "bg-success/10 text-success",
                  c.status === "warn" && "bg-warning/10 text-warning",
                  c.status === "fail" && "bg-destructive/10 text-destructive"
                )}
              >
                <c.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground">{c.label}</div>
                <div className="text-sm text-muted-foreground truncate">{c.detail}</div>
              </div>
              <StatusBadge status={c.status} />
            </div>
          ))}
        </div>

        <Button
          variant="hero"
          size="xl"
          className="w-full mt-8"
          disabled={!loaded}
          onClick={onNext}
        >
          Start Video Verification
          <ArrowRight className="w-5 h-5" />
        </Button>

        <p className="text-xs text-muted-foreground text-center mt-4">
          🔒 Your session is end-to-end encrypted
        </p>
      </div>
    </div>
  );
};
