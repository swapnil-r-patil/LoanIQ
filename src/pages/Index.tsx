import { useState } from "react";
import { Stepper } from "@/components/Stepper";
import { PreCheckScreen } from "@/components/screens/PreCheckScreen";
import { VideoKYC } from "@/components/screens/VideoKYC";
import { Processing } from "@/components/screens/Processing";
import { Result } from "@/components/screens/Result";
import { Report } from "@/components/screens/Report";
import { Disbursement } from "@/components/screens/Disbursement";
import { Sparkles } from "lucide-react";

const STEPS = ["Pre-check", "Video KYC", "Processing", "Result", "Report", "Disburse"];

const Index = () => {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Record<string, string>>({});

  const go = (n: number) => setStep(n);

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-elegant">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-bold leading-tight">CodeStorm</div>
              <div className="text-[11px] text-muted-foreground">Video-based Origination</div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground hidden sm:block">
            🔒 Secure · Encrypted Session
          </div>
        </div>
      </header>

      <main className="py-8 md:py-12 px-4">
        <Stepper current={step} steps={STEPS} />

        <div key={step}>
          {step === 0 && <PreCheckScreen onNext={() => go(1)} />}
          {step === 1 && (
            <VideoKYC
              onNext={(d) => {
                setData(d);
                go(2);
              }}
            />
          )}
          {step === 2 && <Processing onNext={() => go(3)} />}
          {step === 3 && <Result onNext={() => go(5)} onReport={() => go(4)} />}
          {step === 4 && <Report data={data} onBack={() => go(3)} onNext={() => go(5)} />}
          {step === 5 && <Disbursement onRestart={() => { setData({}); go(0); }} />}
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground">
        Powered by AI · Demo UI
      </footer>
    </div>
  );
};

export default Index;
