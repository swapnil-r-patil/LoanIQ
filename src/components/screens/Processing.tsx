import { useEffect, useState } from "react";
import { Brain, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onNext: () => void;
}

const STEPS = [
  "Verifying identity & liveness",
  "Analyzing video & voice patterns",
  "Fetching credit bureau data",
  "Running AI risk model",
  "Generating loan decision",
];

export const Processing = ({ onNext }: Props) => {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timers = STEPS.map((_, i) =>
      setTimeout(() => setActive(i + 1), (i + 1) * 900)
    );
    const done = setTimeout(onNext, STEPS.length * 900 + 600);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
    };
  }, [onNext]);

  return (
    <div className="w-full max-w-xl mx-auto animate-fade-in">
      <div className="bg-card rounded-3xl shadow-card border border-border/60 p-10 text-center">
        <div className="relative inline-flex items-center justify-center mb-8">
          <span className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-ring" />
          <span className="absolute inset-0 rounded-full bg-primary/10 animate-pulse-ring" style={{ animationDelay: "0.5s" }} />
          <div className="relative w-24 h-24 rounded-full bg-gradient-primary flex items-center justify-center shadow-elegant">
            <Brain className="w-11 h-11 text-primary-foreground" />
          </div>
        </div>

        <h2 className="text-2xl md:text-3xl font-bold mb-2">Analyzing your profile using AI</h2>
        <p className="text-muted-foreground mb-8">This will only take a few seconds...</p>

        <div className="space-y-3 text-left">
          {STEPS.map((label, i) => {
            const done = i < active;
            const current = i === active;
            return (
              <div
                key={label}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl transition-smooth",
                  done && "bg-success/5",
                  current && "bg-accent"
                )}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                    done && "bg-success text-success-foreground",
                    current && "bg-primary text-primary-foreground",
                    !done && !current && "bg-muted text-muted-foreground"
                  )}
                >
                  {done ? (
                    <Check className="w-4 h-4" />
                  ) : current ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span className="text-xs font-semibold">{i + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-sm font-medium",
                    !done && !current && "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
