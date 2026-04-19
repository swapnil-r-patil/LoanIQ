import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperProps {
  current: number;
  steps: string[];
}

export const Stepper = ({ current, steps }: StepperProps) => {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 mb-8">
      <div className="flex items-center justify-between">
        {steps.map((label, idx) => {
          const isDone = idx < current;
          const isActive = idx === current;
          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-smooth border-2",
                    isDone && "bg-primary border-primary text-primary-foreground",
                    isActive &&
                      "bg-primary border-primary text-primary-foreground shadow-elegant scale-110",
                    !isDone && !isActive && "bg-background border-border text-muted-foreground"
                  )}
                >
                  {isDone ? <Check className="w-4 h-4" /> : idx + 1}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium hidden sm:block whitespace-nowrap",
                    isActive ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 mb-6 sm:mb-6 bg-border relative overflow-hidden">
                  <div
                    className={cn(
                      "absolute inset-0 bg-primary transition-smooth",
                      isDone ? "w-full" : "w-0"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
