import { useEffect, useRef, useState } from "react";
import { Send, Upload, Mic, Video, CircleDot, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  onNext: (data: Record<string, string>) => void;
}

const QUESTIONS = [
  { key: "name", q: "Hi! 👋 I'm Aria, your AI loan assistant. What's your full name?" },
  { key: "income", q: "Great to meet you! What is your monthly income (in ₹)?" },
  { key: "employment", q: "Are you salaried or self-employed?" },
  { key: "purpose", q: "What is the purpose of the loan?" },
  { key: "amount", q: "Lastly, how much loan do you need (in ₹)?" },
];

interface Msg {
  from: "bot" | "user";
  text: string;
}

export const VideoKYC = ({ onNext }: Props) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [step, setStep] = useState(0);
  const [input, setInput] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [panUploaded, setPanUploaded] = useState(false);
  const [typing, setTyping] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Camera
  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => {});
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  // Bot questions
  useEffect(() => {
    if (step >= QUESTIONS.length) return;
    setTyping(true);
    const t = setTimeout(() => {
      setMessages((prev) => [...prev, { from: "bot", text: QUESTIONS[step].q }]);
      setTyping(false);
    }, 900);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const send = () => {
    if (!input.trim() || step >= QUESTIONS.length) return;
    const key = QUESTIONS[step].key;
    setMessages((p) => [...p, { from: "user", text: input.trim() }]);
    setAnswers((a) => ({ ...a, [key]: input.trim() }));
    setInput("");
    setStep((s) => s + 1);
  };

  const allDone = step >= QUESTIONS.length && panUploaded;

  return (
    <div className="w-full max-w-6xl mx-auto animate-fade-in">
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Video panel */}
        <div className="lg:col-span-3 bg-card rounded-3xl shadow-card border border-border/60 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="relative">
                <CircleDot className="w-4 h-4 text-destructive" />
                <span className="absolute inset-0 rounded-full bg-destructive/40 animate-pulse-ring" />
              </div>
              <span className="text-sm font-semibold">LIVE · Recording</span>
            </div>
            <span className="text-xs text-muted-foreground font-mono">KYC-2024-08821</span>
          </div>

          <div className="relative flex-1 rounded-2xl overflow-hidden bg-secondary aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {/* Frame overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-8 border-2 border-primary/70 rounded-3xl" />
              <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-secondary/80 backdrop-blur text-secondary-foreground text-xs font-medium flex items-center gap-1.5">
                <Video className="w-3 h-3" /> Face Centered
              </div>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-secondary/85 backdrop-blur text-secondary-foreground text-sm font-medium flex items-center gap-2 animate-fade-in">
                <Eye className="w-4 h-4 text-primary" />
                Please blink or turn your head
              </div>
            </div>
            {/* Fallback when no camera */}
            <div className="absolute inset-0 flex items-center justify-center text-secondary-foreground/40 -z-0">
              <Video className="w-16 h-16" />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <label className="flex-1">
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={() => setPanUploaded(true)}
              />
              <div
                className={cn(
                  "cursor-pointer rounded-2xl border-2 border-dashed p-4 text-center transition-smooth",
                  panUploaded
                    ? "border-success bg-success/5 text-success"
                    : "border-border hover:border-primary hover:bg-accent"
                )}
              >
                <div className="flex items-center justify-center gap-2 font-medium">
                  <Upload className="w-4 h-4" />
                  {panUploaded ? "PAN Uploaded ✓" : "Upload PAN Card"}
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Chat panel */}
        <div className="lg:col-span-2 bg-card rounded-3xl shadow-card border border-border/60 flex flex-col h-[600px] lg:h-auto">
          <div className="p-4 border-b border-border flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold">
              A
            </div>
            <div>
              <div className="font-semibold leading-tight">Aria</div>
              <div className="text-xs text-success flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success" /> AI Assistant · Online
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex animate-fade-in", m.from === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-soft",
                    m.from === "bot"
                      ? "bg-card text-card-foreground rounded-tl-sm"
                      : "bg-gradient-primary text-primary-foreground rounded-tr-sm"
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start animate-fade-in">
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-card shadow-soft">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            {step >= QUESTIONS.length && (
              <div className="flex justify-start animate-fade-in">
                <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm bg-success/10 text-success text-sm font-medium">
                  ✓ All questions answered. {panUploaded ? "Ready to proceed!" : "Please upload your PAN card."}
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-border">
            {step < QUESTIONS.length ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="shrink-0">
                  <Mic className="w-5 h-5 text-primary" />
                </Button>
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Type your answer..."
                  className="rounded-full bg-muted/50 border-border"
                />
                <Button onClick={send} size="icon" variant="hero" className="shrink-0 rounded-full">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="hero"
                size="lg"
                className="w-full"
                disabled={!allDone}
                onClick={() => onNext(answers)}
              >
                {allDone ? "Submit & Analyze" : "Upload PAN to continue"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
