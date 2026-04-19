import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoan } from '../context/LoanContext';
import { useLang } from '../context/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeToggle from '../components/ThemeToggle';
// Import removed to bypass Vite production build WASM path corruption.
// We now use the global FaceMesh loaded from the CDN in index.html.
const FaceMesh = (window as any).FaceMesh || (window as any).faceMesh?.FaceMesh;
import {
  Mic, MicOff, Upload, Eye, CheckCircle, ChevronRight,
  AlertCircle, FileText, User, Banknote, Briefcase, Target, DollarSign
} from 'lucide-react';
import { detectAnsweredQuestions } from '../utils/nlpMatcher';

const QUESTION_META = [
  { id: 'name'    as const, textKey: 'q_name'    as const, hintKey: 'q_name_hint'    as const, icon: <User size={16} /> },
  { id: 'income'  as const, textKey: 'q_income'  as const, hintKey: 'q_income_hint'  as const, icon: <Banknote size={16} /> },
  { id: 'jobType' as const, textKey: 'q_jobType' as const, hintKey: 'q_jobType_hint' as const, icon: <Briefcase size={16} /> },
  { id: 'purpose' as const, textKey: 'q_purpose' as const, hintKey: 'q_purpose_hint' as const, icon: <Target size={16} /> },
  { id: 'amount'  as const, textKey: 'q_amount'  as const, hintKey: 'q_amount_hint'  as const, icon: <DollarSign size={16} /> },
];


type SpeechRecognitionType = any;

export default function VideoKYC() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const { state, setState } = useLoan();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionType>(null);
  const silenceTimerRef = useRef<any>(null);

  const [transcript, setTranscript] = useState('');
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [faceDetected, setFaceDetected] = useState(true);
  const [faceInFrame, setFaceInFrame] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [maskWarning, setMaskWarning] = useState(false);
  const faceTrackingRef = useRef<boolean>(true);
  
  const [panImage, setPanImage] = useState<string | null>(null);
  const [panFileName, setPanFileName] = useState('');
  const [livenessStep, setLivenessStep] = useState<'idle' | 'straight' | 'left' | 'right' | 'smile' | 'blink' | 'done'>('straight');
  const activeLivenessStepRef = useRef<'idle' | 'straight' | 'left' | 'right' | 'smile' | 'blink' | 'done'>('straight');
  const turnDirectionRef = useRef<'high'|'low'|''>('');
  const blinkCountRef = useRef(0);
  const eyesOpenRef = useRef(true);
  const [blinkCount, setBlinkCount] = useState(0);
  
  const [livenessPass, setLivenessPass] = useState(false);
  const [phase, setPhase] = useState<'liveness' | 'questions' | 'pan' | 'complete'>('liveness');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [answeredQuestions, setAnsweredQuestions] = useState<string[]>([]);

  // Build display questions from translations
  const QUESTIONS = QUESTION_META.map(q => ({ ...q, text: t(q.textKey), hint: t(q.hintKey) }));

  // Reset answered questions when language changes to avoid stale detection state
  useEffect(() => {
    setAnsweredQuestions([]);
  }, [lang]);

  // Detect which questions have been answered based on keywords in transcript
  useEffect(() => {
    const newAnswered = detectAnsweredQuestions(transcript);
    if (JSON.stringify(newAnswered.sort()) !== JSON.stringify([...answeredQuestions].sort())) {
      setAnsweredQuestions(newAnswered);
    }
  }, [transcript]);

  useEffect(() => {
    faceTrackingRef.current = true;
    startCamera();
    return () => {
      faceTrackingRef.current = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
      recognitionRef.current?.stop();
    };
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      setError('Camera access failed. Please check permissions.');
      return;
    }

    try {
      if (videoRef.current) {
        const faceMesh = new FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true, // Crucial for precise eye boundaries (Iris included)
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        faceMesh.onResults((results) => {
          if (!faceTrackingRef.current) return;
          if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            setFaceDetected(true);
            const landmarks = results.multiFaceLandmarks[0];
            
            // Nose tip is index 1
            const nose = landmarks[1];
            // Center check has been made much more lenient
            if (nose.x > 0.15 && nose.x < 0.85 && nose.y > 0.15 && nose.y < 0.85) {
              setFaceInFrame(true);
            } else {
              setFaceInFrame(false);
            }

            // Since FaceMesh is highly robust, we disable the hackathon mock mask-warning 
            setMaskWarning(false);

            // Real Biometric Liveness Math
            const step = activeLivenessStepRef.current;
            if (step !== 'idle' && step !== 'done') {
              // 33 is Left Eye Outer, 263 is Right Eye Outer, 1 is Nose
              const rEye = landmarks[263];
              const lEye = landmarks[33];
              
              const distR = Math.abs(nose.x - rEye.x);
              const distL = Math.abs(nose.x - lEye.x);
              const ratio = distR / (distL + 0.0001); 

              // High Precision Eye Aspect Ratio (EAR) Math
              // Right Eye: 362 (inner), 385/387 (top), 263 (outer), 373/380 (bottom)
              const reV1 = Math.hypot(landmarks[385].x - landmarks[380].x, landmarks[385].y - landmarks[380].y);
              const reV2 = Math.hypot(landmarks[387].x - landmarks[373].x, landmarks[387].y - landmarks[373].y);
              const reH = Math.hypot(landmarks[362].x - landmarks[263].x, landmarks[362].y - landmarks[263].y);
              const rightEAR = (reV1 + reV2) / (2.0 * reH);

              // Left Eye: 33 (outer), 160/158 (top), 133 (inner), 153/144 (bottom)
              const leV1 = Math.hypot(landmarks[160].x - landmarks[144].x, landmarks[160].y - landmarks[144].y);
              const leV2 = Math.hypot(landmarks[158].x - landmarks[153].x, landmarks[158].y - landmarks[153].y);
              const leH = Math.hypot(landmarks[33].x - landmarks[133].x, landmarks[33].y - landmarks[133].y);
              const leftEAR = (leV1 + leV2) / (2.0 * leH);

              const avgEAR = (rightEAR + leftEAR) / 2.0;

              if (step === 'straight') {
                if (ratio > 0.75 && ratio < 1.25) {
                  activeLivenessStepRef.current = 'left';
                  setLivenessStep('left');
                }
              } else if (step === 'left') {
                if (ratio > 1.6) {
                  turnDirectionRef.current = 'high';
                  activeLivenessStepRef.current = 'right';
                  setLivenessStep('right');
                } else if (ratio < 0.6) {
                  turnDirectionRef.current = 'low';
                  activeLivenessStepRef.current = 'right';
                  setLivenessStep('right');
                }
              } else if (step === 'right') {
                if (turnDirectionRef.current === 'high' && ratio < 0.6) {
                   activeLivenessStepRef.current = 'smile';
                   setLivenessStep('smile');
                } else if (turnDirectionRef.current === 'low' && ratio > 1.6) {
                   activeLivenessStepRef.current = 'smile';
                   setLivenessStep('smile');
                }
              } else if (step === 'smile') {
                // Smile ratio: Mouth width / Eye distance
                // 61: Left mouth corner, 291: Right mouth corner
                // 33: Left eye outer, 263: Right eye outer
                const mouthWidth = Math.hypot(landmarks[61].x - landmarks[291].x, landmarks[61].y - landmarks[291].y);
                const eyeDist = Math.hypot(landmarks[33].x - landmarks[263].x, landmarks[33].y - landmarks[263].y);
                const smileRatio = mouthWidth / (eyeDist + 0.0001);

                if (smileRatio > 0.52) { // 0.45 is neutral, >0.52 is a smile
                   activeLivenessStepRef.current = 'blink';
                   setLivenessStep('blink');
                }
              } else if (step === 'blink') {
                const EAR_THRESHOLD = 0.22;
                if (avgEAR < EAR_THRESHOLD) {
                   if (eyesOpenRef.current) {
                     eyesOpenRef.current = false;
                     const newCount = blinkCountRef.current + 1;
                     blinkCountRef.current = newCount;
                     setBlinkCount(newCount);
                     
                     if (newCount >= 3) {
                       activeLivenessStepRef.current = 'done';
                       setLivenessStep('done');
                       setLivenessPass(true);
                     }
                   }
                } else if (avgEAR > EAR_THRESHOLD + 0.04) {
                   eyesOpenRef.current = true;
                }
              }
            }
          } else {
            setFaceDetected(false);
          }
        });

        async function detectFrame() {
          if (!faceTrackingRef.current) return;
          if (videoRef.current && videoRef.current.readyState >= 2) {
            try {
              await faceMesh.send({ image: videoRef.current });
            } catch(e){}
          }
          requestAnimationFrame(detectFrame);
        }

        // Start detection loop immediately if video is already playing
        if (videoRef.current.readyState >= 2) {
          detectFrame();
        } else {
          videoRef.current.onloadeddata = () => {
            detectFrame();
          };
        }
      }
    } catch (e) {
      console.warn('FaceMesh initialization delayed or encountered an issue:', e);
      // We don't set a hard error here because the camera stream is still running.
    }
  }

  function startListening() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition not supported. Please type your answer.');
      return;
    }

    // Map app language to BCP-47 speech recognition locale
    const speechLangMap: Record<string, string> = {
      en: 'en-IN',
      hi: 'hi-IN',
      mr: 'mr-IN',
    };

    const recognition = new SpeechRecognition();
    recognition.lang = speechLangMap[lang] || 'en-IN';
    recognition.continuous = true;
    recognition.interimResults = true;   // get real-time partial results
    recognition.maxAlternatives = 3;     // consider 3 best guesses per utterance
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      resetSilenceTimer();
    };

    // Auto-restart if recognition drops unexpectedly (network blip, browser timeout)
    recognition.onend = () => {
      clearSilenceTimer();
      if (recognitionRef.current === recognition && isListening) {
        // Still supposed to be listening — restart immediately
        try { recognition.start(); } catch (_) { setIsListening(false); }
      } else {
        setIsListening(false);
      }
    };

    recognition.onerror = (e: any) => {
      // 'no-speech' is not fatal — just reset the timer and continue
      if (e.error === 'no-speech') {
        resetSilenceTimer();
        return;
      }
      setIsListening(false);
      clearSilenceTimer();
    };

    recognition.onresult = (e: any) => {
      resetSilenceTimer();

      let interimText = '';
      let finalText = '';

      for (let i = e.resultIndex; i < e.results.length; i++) {
        // Pick the best alternative transcript for each result
        const best = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalText += best + ' ';
        } else {
          interimText += best;
        }
      }

      // ⚡ Run NLP on INTERIM text too so questions light up while user is still speaking
      if (interimText) {
        setCurrentTranscript(interimText);
        // Trigger NLP on committed transcript + current interim for live green feedback
        const liveAnswered = detectAnsweredQuestions(transcript + ' ' + interimText);
        setAnsweredQuestions(prev => {
          const sorted = [...liveAnswered].sort();
          if (JSON.stringify(sorted) !== JSON.stringify([...prev].sort())) return liveAnswered;
          return prev;
        });
      }

      // Commit final text to permanent transcript
      if (finalText.trim()) {
        setTranscript(prev => (prev + ' ' + finalText).trim());
        setCurrentTranscript('');
      }
    };

    recognition.start();
  }

  function resetSilenceTimer() {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      stopListening();
    }, 20000); // Auto-mute after 20 seconds of silence
  }

  function clearSilenceTimer() {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
  }

  function stopListening() {
    // Null the ref first so onend doesn't auto-restart
    const r = recognitionRef.current;
    recognitionRef.current = null;
    r?.stop();
    setIsListening(false);
    clearSilenceTimer();
  }

  // No longer needed, phase progresses directly to pan

  function handlePanUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPanFileName(file.name);

    if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPanImage(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
      return;
    }

    // Compress image to avoid Vercel 4.5MB serverless payload limit
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Max dimension 1200px
        const maxDim = 1200;
        if (width > height && width > maxDim) {
          height *= maxDim / width;
          width = maxDim;
        } else if (height > maxDim) {
          width *= maxDim / height;
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Compress to 60% quality JPEG (reduces 5MB photo to ~200KB base64)
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
          setPanImage(compressedBase64);
        } else {
          setPanImage(ev.target?.result as string); // fallback
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

    // function startLiveness() was removed because it now auto-starts

  async function handleSubmit() {
    setIsProcessing(true);
    try {
      setState(prev => ({
        ...prev,
        transcript,
        panImage,
        livenessPass,
        location: state.location,
      }));

      navigate('/processing', {
        state: { transcript, panImage, livenessPass, location: state.location }
      });
    } catch (e: any) {
      setError(e.message);
      setIsProcessing(false);
    }
  }

  const livenessInstructions = {
    idle: '',
    straight: t('lookStraight'),
    left: t('turnLeft'),
    right: t('turnRight'),
    smile: t('smile'),
    blink: `${t('blink')} (${blinkCount}/3)`,
    done: t('livenessDone'),
  };

  return (
    <div className="min-h-screen bg-background py-6 px-4 transition-colors duration-500">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-violet-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">{t('videoKYC')}</h1>
            <p className="text-muted-foreground text-sm">{t('videoKYCSub')}</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LanguageSwitcher compact />
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-muted-foreground text-xs">{t('live')}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Video Panel */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl overflow-hidden bg-card border border-border aspect-[3/4] relative">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-xl px-3 py-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-white-always text-xs font-medium">Camera Active</span>
                </div>
              </div>
              {/* Face guide */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`w-52 h-64 border-2 rounded-[50%] transition-colors duration-300 ${
                  faceInFrame ? 'border-blue-400/50 shadow-[0_0_20px_rgba(96,165,250,0.2)]' : 'border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)]'
                }`} />
              </div>
              
              {/* Overlay Alert */}
              {!faceDetected ? (
                <div className="absolute inset-0 bg-red-950/40 backdrop-blur-[2px] flex flex-col items-center justify-center z-10 transition-all duration-300">
                  <div className="bg-red-500 text-white-always px-6 py-3 rounded-full font-semibold shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-bounce flex items-center gap-2">
                    <AlertCircle size={20} />
                    {t('faceNotDetected')}
                  </div>
                </div>
              ) : !faceInFrame ? (
                <div className="absolute inset-0 bg-red-950/40 backdrop-blur-[2px] flex flex-col items-center justify-center z-10 transition-all duration-300">
                  <div className="bg-red-500 text-white-always px-6 py-3 rounded-full font-semibold shadow-[0_0_20px_rgba(239,68,68,0.5)] flex items-center gap-2">
                    <AlertCircle size={20} />
                    {t('centerFace')}
                  </div>
                </div>
              ) : maskWarning ? (
                <div className="absolute inset-0 bg-amber-950/40 backdrop-blur-[1px] flex flex-col items-center justify-center z-10 transition-all duration-300">
                  <div className="bg-amber-500 text-white-always px-6 py-3 rounded-full font-semibold shadow-[0_0_20px_rgba(245,158,11,0.5)] flex items-center gap-2 animate-pulse">
                    <AlertCircle size={20} />
                    {t('maskDetected')}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Right Panel */}
          <div className="lg:col-span-3 space-y-4">
            {/* Progress */}
            <div className="grid grid-cols-3 gap-2">
              {['Liveness', 'Questions', 'PAN Upload'].map((step, i) => {
                const phaseIndex = { liveness: 0, questions: 1, pan: 2, complete: 3 }[phase];
                const active = i === phaseIndex;
                const done = i < phaseIndex;
                return (
                  <div key={step} className={`rounded-xl p-3 border text-center transition-all ${
                    done ? 'border-emerald-500/30 bg-emerald-500/5' :
                    active ? 'border-primary/50 bg-primary/10' :
                    'border-border bg-secondary/30'
                  }`}>
                    <div className={`text-xs font-medium ${done ? 'text-emerald-400' : active ? 'text-primary' : 'text-muted-foreground'}`}>
                      {done ? '✓ ' : ''}{step}
                    </div>
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-2 items-start">
                <AlertCircle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-amber-300 text-sm">{error}</p>
              </div>
            )}

            {/* Liveness Phase (Now Phase 1) */}
            {phase === 'liveness' && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <Eye size={18} className="text-primary" />
                  {t('livenessDetection')}
                </div>
                <p className="text-muted-foreground text-sm">{t('livenessSub')}</p>

                {livenessStep !== 'done' && (
                  <div className={`p-4 rounded-xl text-center ${livenessPass ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-primary/10 border border-primary/20'}`}>
                    <p className="text-foreground text-lg font-medium">{livenessInstructions[livenessStep]}</p>
                    <div className="mt-4 flex justify-center">
                      <div className="w-14 h-14 border-[5px] border-slate-200 dark:border-white/10 !border-t-blue-600 dark:!border-t-primary rounded-full animate-spin shadow-md" />
                    </div>
                  </div>
                )}

                {livenessPass && (
                  <button
                    onClick={() => setPhase('questions')}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-4 rounded-xl font-semibold hover:opacity-90 transition-all"
                  >
                    {t('continueToQuestions')} <ChevronRight size={18} />
                  </button>
                )}
              </div>
            )}

            {/* Questions Phase (Now Phase 2) */}
            {phase === 'questions' && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
                    <FileText size={14} />
                    {t('pleaseAnswerAll')}
                  </div>
                  <div className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                    {answeredQuestions.length} / {QUESTION_META.length} {t('answered')}
                  </div>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {QUESTIONS.map((q, idx) => {
                    const isAnswered = answeredQuestions.includes(q.id);
                    return (
                      <div key={q.id} className={`transition-all duration-500 rounded-xl p-3 border ${
                        isAnswered 
                          ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                          : 'bg-blue-500/10 border-blue-500/20'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className={`flex items-center gap-2 text-sm transition-colors ${isAnswered ? 'text-emerald-600' : 'text-primary'}`}>
                            {isAnswered ? <CheckCircle size={16} /> : q.icon}
                            <span className={`text-xs transition-colors ${isAnswered ? 'text-emerald-600' : 'text-muted-foreground'}`}>{q.hint}</span>
                          </div>
                          {isAnswered && <span className="text-[10px] font-bold text-emerald-500 uppercase">{t('detected')}</span>}
                        </div>
                        <p className={`font-medium text-sm transition-colors ${isAnswered ? 'text-emerald-700' : 'text-foreground'}`}>{idx + 1}. {q.text}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Live transcript */}
                {(transcript || currentTranscript) && (
                  <div className="bg-secondary/50 rounded-xl p-3 border border-border mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <FileText size={12} />
                        {t('transcriptCaptured')}
                      </p>
                      <button 
                        onClick={() => setIsEditing(!isEditing)}
                        className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wider"
                      >
                        {isEditing ? 'Save' : 'Edit'}
                      </button>
                    </div>
                    
                    {isEditing ? (
                      <textarea
                        value={transcript}
                        onChange={(e) => setTranscript(e.target.value)}
                        className="w-full bg-transparent text-sm text-foreground outline-none resize-none min-h-[80px]"
                        placeholder="Edit your answer here..."
                        autoFocus
                      />
                    ) : (
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {transcript}
                        {currentTranscript && <span className="text-primary"> {currentTranscript}</span>}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    id={`btn-${isListening ? 'stop' : 'listen'}`}
                    onClick={isListening ? stopListening : startListening}
                    className={`flex items-center justify-center gap-2 w-1/3 py-3 rounded-xl font-medium text-sm transition-all ${
                      isListening
                        ? 'bg-destructive/20 text-destructive border border-destructive/30 animate-pulse'
                        : 'bg-secondary text-foreground border border-border hover:bg-secondary/80'
                    }`}
                  >
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                    {isListening ? t('stop') : t('speak')}
                  </button>

                  <button
                    id="btn-next-question"
                    onClick={() => setPhase('pan')}
                    disabled={!transcript.trim()}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all ${
                      !transcript.trim()
                        ? 'bg-secondary text-muted-foreground cursor-not-allowed border border-border'
                        : 'bg-primary text-white-always hover:opacity-90'
                    }`}
                  >
                    {transcript.trim() ? t('continueToPAN') : t('pleaseAnswerQuestions')}
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* PAN Upload Phase (Now Phase 3) */}
            {phase === 'pan' && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <Upload size={18} className="text-primary" />
                  {t('uploadPAN')}
                </div>
                <p className="text-muted-foreground text-sm">{t('uploadPANSub')}</p>

                <label
                  htmlFor="pan-upload"
                  className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all ${
                    panImage ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-border hover:border-primary/50 hover:bg-primary/5'
                  }`}
                >
                  {panImage
                    ? <><CheckCircle size={28} className="text-emerald-400" /><span className="text-emerald-300 text-sm font-medium">{panFileName}</span></>
                    : <><Upload size={28} className="text-muted-foreground" /><span className="text-muted-foreground text-sm">{t('clickToUpload')}</span><span className="text-muted-foreground/60 text-xs">{t('fileTypes')}</span></>
                  }
                  <input id="pan-upload" type="file" accept="image/*,.pdf" className="hidden" onChange={handlePanUpload} />
                </label>

                <div className="flex gap-3">
                  <button
                    id="btn-proceed-submit"
                    onClick={() => { setPhase('complete'); handleSubmit(); }}
                    disabled={isProcessing || !panImage}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all ${
                      !panImage || isProcessing
                        ? 'bg-secondary text-muted-foreground cursor-not-allowed border border-border'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:opacity-90'
                    }`}
                  >
                    {isProcessing ? (
                      <div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <><CheckCircle size={18} /> {panImage ? t('submitAndAnalyze') : t('pleaseUploadPAN')}</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
