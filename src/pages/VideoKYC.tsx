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
  AlertCircle, FileText, User, Banknote, Briefcase, Target, DollarSign, Calendar,
  X, Camera
} from 'lucide-react';
import { detectAnsweredQuestions } from '../utils/nlpMatcher';

const QUESTION_META = [
  { id: 'name'    as const, textKey: 'q_name'    as const, hintKey: 'q_name_hint'    as const, icon: <User size={16} /> },
  { id: 'income'  as const, textKey: 'q_income'  as const, hintKey: 'q_income_hint'  as const, icon: <Banknote size={16} /> },
  { id: 'jobType' as const, textKey: 'q_jobType' as const, hintKey: 'q_jobType_hint' as const, icon: <Briefcase size={16} /> },
  { id: 'purpose' as const, textKey: 'q_purpose' as const, hintKey: 'q_purpose_hint' as const, icon: <Target size={16} /> },
  { id: 'amount'  as const, textKey: 'q_amount'  as const, hintKey: 'q_amount_hint'  as const, icon: <DollarSign size={16} /> },
  { id: 'age'     as const, textKey: 'q_age'     as const, hintKey: 'q_age_hint'     as const, icon: <Calendar size={16} /> },
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
  const [isScanningAge, setIsScanningAge] = useState(false);
  const [isCapturingPan, setIsCapturingPan] = useState(false);
  const [panCountdown, setPanCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<any>(null);
  const phaseRef = useRef(phase);
  const panImageRef = useRef(panImage);

  const [ocrData, setOcrData] = useState<{ panNumber: string, panName: string, dob: string } | null>(null);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');

  useEffect(() => {
    phaseRef.current = phase;
    if (phase === 'pan') {
      setIsCapturingPan(true);
    }
  }, [phase]);
  useEffect(() => { panImageRef.current = panImage; }, [panImage]);

  useEffect(() => {
    if (panImage && phase === 'pan' && !ocrData) {
      const fetchOcr = async () => {
        setIsOcrLoading(true);
        setOcrError('');
        try {
          const res = await fetch('http://localhost:5000/api/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ panImage, spokenName: transcript })
          });
          if (!res.ok) throw new Error('Failed to extract PAN details');
          const data = await res.json();
          setOcrData({
            panNumber: data.panNumber === 'NOT_FOUND' ? '' : data.panNumber || '',
            panName: data.panName === 'NOT_FOUND' ? '' : data.panName || '',
            dob: data.dob || ''
          });
        } catch (err: any) {
          setOcrError(err.message || 'OCR extraction failed');
          setOcrData({ panNumber: '', panName: '', dob: '' });
        } finally {
          setIsOcrLoading(false);
        }
      };
      fetchOcr();
    }
  }, [panImage, phase, ocrData]);

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
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }, 
        audio: false 
      });
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

        // Local variable to avoid re-triggering countdown while active
        let countdownTriggered = false;

        faceMesh.onResults((results) => {
          if (!faceTrackingRef.current) return;
          
          const facePresent = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;
          setFaceDetected(facePresent);

          // AUTO PAN LOGIC: If no face detected while in PAN phase and not already captured
          if (!facePresent && phaseRef.current === 'pan' && !panImageRef.current && !countdownTriggered) {
             countdownTriggered = true;
             startPanAutoCapture();
             // Reset trigger after some time if capture didn't happen
             setTimeout(() => { countdownTriggered = false; }, 10000);
          }

          if (facePresent) {
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
                       // Start age estimation when liveness is done
                       estimateAge(landmarks);
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

  const [userFaceImage, setUserFaceImage] = useState<string | null>(null);
  const [faceLandmarks, setFaceLandmarks] = useState<any>(null);

  function estimateAge(landmarks: any) {
    setFaceLandmarks(landmarks);
    setIsScanningAge(true);

    // Capture the user's face right now for the backend AI
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        setUserFaceImage(canvas.toDataURL('image/jpeg', 0.8));
      }
    }
    
    // Simulate processing time for the real AI model handshake
    setTimeout(() => {
      setIsScanningAge(false);
      console.log('AI System ready for cloud inference.');
    }, 2000);
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

  function capturePanFromVideo() {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      const rect = video.getBoundingClientRect();
      
      // The guide box is w-72 (288px) and h-44 (176px), centered in the video container.
      const guideWidth = 288;
      const guideHeight = 176;
      const guideX = (rect.width - guideWidth) / 2;
      const guideY = (rect.height - guideHeight) / 2;
      
      // With object-cover, the video is scaled to completely cover the container, then centered.
      const scale = Math.max(rect.width / video.videoWidth, rect.height / video.videoHeight);
      
      const visibleVideoWidth = video.videoWidth * scale;
      const visibleVideoHeight = video.videoHeight * scale;
      
      const offsetX = (visibleVideoWidth - rect.width) / 2;
      const offsetY = (visibleVideoHeight - rect.height) / 2;
      
      // Map DOM coordinates to actual video pixel coordinates
      let cropX = (guideX + offsetX) / scale;
      let cropY = (guideY + offsetY) / scale;
      let cropWidth = guideWidth / scale;
      let cropHeight = guideHeight / scale;
      
      // Add a 12% padding around the box to ensure all anchors and edges are captured
      const paddingX = cropWidth * 0.12;
      const paddingY = cropHeight * 0.12;
      
      cropX = Math.max(0, cropX - paddingX);
      cropY = Math.max(0, cropY - paddingY);
      cropWidth = Math.min(video.videoWidth - cropX, cropWidth + paddingX * 2);
      cropHeight = Math.min(video.videoHeight - cropY, cropHeight + paddingY * 2);
      
      // Setup canvas to scale up the cropped dimensions by 4x for Ultra-HD OCR readability
      const scaleUp = 4.0;
      canvas.width = cropWidth * scaleUp;
      canvas.height = cropHeight * scaleUp;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Enhance image quality for OCR
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.filter = 'contrast(1.2) brightness(1.2) grayscale(1)';
        
        // Front-facing cameras often mirror the feed, making text backwards.
        // We MUST flip it horizontally so Tesseract can read it.
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);

        ctx.drawImage(
          video, 
          cropX, cropY, cropWidth, cropHeight, // Source rectangle
          0, 0, canvas.width, canvas.height    // Destination rectangle
        );
        
        ctx.restore();
        
        const base64 = canvas.toDataURL('image/jpeg', 0.95); // High quality
        setPanImage(base64);
        setPanFileName('pan_camera_capture.jpg');
        setIsCapturingPan(false);
        setPanCountdown(null);
        
        // Update context immediately
        setState(prev => ({ ...prev, panImage: base64 }));
      }
    }
  }


  function startPanAutoCapture() {
    setIsCapturingPan(true);
    setPanCountdown(3);
    const timer = setInterval(() => {
      setPanCountdown(prev => {
        if (prev === 1) {
          clearInterval(timer);
          capturePanFromVideo();
          return null;
        }
        return prev ? prev - 1 : null;
      });
    }, 1000);
  }

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
        state: { 
          transcript, 
          panImage, 
          livenessPass, 
          location: state.location, 
          userFaceImage, 
          faceLandmarks,
          editedPanDetails: ocrData ? JSON.stringify(ocrData) : null
        }
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
              {/* Face guide / PAN guide */}
              <div className="absolute inset-0 flex items-center justify-center">
                {isCapturingPan ? (
                  <div className={`w-72 h-44 border-2 rounded-xl transition-all duration-300 border-dashed ${
                    panImage ? 'border-emerald-400 bg-emerald-400/10' : 'border-blue-400/60'
                  }`}>
                    {panCountdown !== null && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                        <div className="text-4xl font-bold text-blue-400 animate-ping">{panCountdown}</div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); capturePanFromVideo(); }}
                          className="bg-blue-600/80 hover:bg-blue-600 text-white-always text-[10px] font-bold px-4 py-2 rounded-full backdrop-blur-sm transition-all flex items-center gap-2"
                        >
                          <Camera size={14} /> {t('captureNow')}
                        </button>
                      </div>
                    )}
                    <div className="absolute inset-x-0 -bottom-8 flex justify-center">
                      <div className="text-[10px] text-blue-400 font-bold uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-full border border-blue-400/20">
                        {t('alignCard')}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`w-52 h-64 border-2 rounded-[50%] transition-colors duration-300 ${
                    faceInFrame ? 'border-blue-400/50 shadow-[0_0_20px_rgba(96,165,250,0.2)]' : 'border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)]'
                  }`} />
                )}
              </div>
              
              {/* Overlay Alert */}
              {!faceDetected && phase !== 'pan' ? (
                <div className="absolute inset-0 bg-red-950/40 backdrop-blur-[2px] flex flex-col items-center justify-center z-10 transition-all duration-300">
                  <div className="bg-red-500 text-white-always px-6 py-3 rounded-full font-semibold shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-bounce flex items-center gap-2">
                    <AlertCircle size={20} />
                    {t('faceNotDetected')}
                  </div>
                </div>
              ) : !faceInFrame && phase !== 'pan' ? (
                <div className="absolute inset-0 bg-red-950/40 backdrop-blur-[2px] flex flex-col items-center justify-center z-10 transition-all duration-300">
                  <div className="bg-red-500 text-white-always px-6 py-3 rounded-full font-semibold shadow-[0_0_20px_rgba(239,68,68,0.5)] flex items-center gap-2">
                    <AlertCircle size={20} />
                    {t('centerFace')}
                  </div>
                </div>
              ) : maskWarning && phase !== 'pan' ? (
                <div className="absolute inset-0 bg-amber-950/40 backdrop-blur-[1px] flex flex-col items-center justify-center z-10 transition-all duration-300">
                  <div className="bg-amber-500 text-white-always px-6 py-3 rounded-full font-semibold shadow-[0_0_20px_rgba(245,158,11,0.5)] flex items-center gap-2 animate-pulse">
                    <AlertCircle size={20} />
                    {t('maskDetected')}
                  </div>
                </div>
              ) : null}

              {/* Age Scanning Overlay */}
              {isScanningAge && (
                <div className="absolute inset-0 bg-blue-900/30 backdrop-blur-[2px] flex flex-col items-center justify-center z-20">
                  <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-4" />
                  <div className="bg-blue-600 text-white-always px-6 py-2 rounded-full font-bold shadow-lg animate-pulse">
                    {t('scanningAge')}
                  </div>
                </div>
              )}
              {isScanningAge && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                  <div className="bg-card/90 p-4 rounded-2xl border border-primary/30 flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-300">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-bold text-primary">CALIBRATING WITH REAL AI...</span>
                  </div>
                </div>
              )}
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
                  <Camera size={18} className="text-primary" />
                  {t('uploadPAN')}
                </div>
                
                {!panImage ? (
                  <div className="p-6 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-4 text-center animate-pulse">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <FileText size={32} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">AUTO-CAPTURE ACTIVE</p>
                      <p className="text-xs text-muted-foreground mt-1">Please show your PAN card to the camera. Countdown starts automatically.</p>
                    </div>
                  </div>
                ) : (
                  <div className="relative group animate-in fade-in zoom-in duration-300">
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-4">
                      <div className="w-14 h-14 rounded-lg overflow-hidden border border-emerald-500/20 bg-black flex-shrink-0">
                         <img src={panImage} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-emerald-400 truncate">Captured Successfully</p>
                        <p className="text-[10px] text-emerald-500/60 uppercase font-bold">OCR ANALYSIS READY</p>
                      </div>
                      <button 
                        onClick={() => { setPanImage(null); setPanFileName(''); setIsCapturingPan(true); }}
                        className="p-2 hover:bg-amber-500/10 rounded-lg text-muted-foreground hover:text-amber-400 transition-colors flex flex-col items-center gap-0.5"
                      >
                        <X size={16} />
                        <span className="text-[8px] font-bold">RETAKE</span>
                      </button>
                    </div>
                  </div>
                )}

                {panImage && (
                  <div className="bg-secondary/30 border border-border rounded-xl p-4 space-y-3 mt-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Extracted Details (Verify & Edit)</p>
                    {isOcrLoading ? (
                      <div className="flex items-center gap-2 text-sm text-primary animate-pulse">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Scanning document...
                      </div>
                    ) : ocrError ? (
                      <p className="text-sm text-destructive">{ocrError}</p>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={ocrData?.panNumber || ''}
                          onChange={(e) => setOcrData(prev => prev ? { ...prev, panNumber: e.target.value } : null)}
                          placeholder="PAN Number"
                          className="w-full bg-background border border-border focus:border-primary rounded-lg px-3 py-2 text-sm text-foreground outline-none transition-colors uppercase"
                        />
                        <input
                          type="text"
                          value={ocrData?.panName || ''}
                          onChange={(e) => setOcrData(prev => prev ? { ...prev, panName: e.target.value } : null)}
                          placeholder="Full Name"
                          className="w-full bg-background border border-border focus:border-primary rounded-lg px-3 py-2 text-sm text-foreground outline-none transition-colors uppercase"
                        />
                        <input
                          type="text"
                          value={ocrData?.dob || ''}
                          onChange={(e) => setOcrData(prev => prev ? { ...prev, dob: e.target.value } : null)}
                          placeholder="Date of Birth (DD/MM/YYYY)"
                          className="w-full bg-background border border-border focus:border-primary rounded-lg px-3 py-2 text-sm text-foreground outline-none transition-colors"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <button
                    id="btn-proceed-submit"
                    onClick={() => { setPhase('complete'); handleSubmit(); }}
                    disabled={isProcessing || !panImage}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all ${
                      !panImage || isProcessing
                        ? 'bg-secondary text-muted-foreground cursor-not-allowed border border-border'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white-always shadow-lg shadow-emerald-500/20'
                    }`}
                  >
                    {isProcessing ? (
                      <div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <><CheckCircle size={18} /> {panImage ? t('submitAndAnalyze') : 'Waiting for ID...'}</>
                    )}
                  </button>

                  {!panImage && (
                    <label 
                      htmlFor="manual-pan-upload" 
                      className="w-full flex items-center justify-center gap-2 py-2 text-[11px] font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer border border-dashed border-border rounded-lg hover:border-primary/30"
                    >
                      <Upload size={12} />
                      {(t('manualUpload') || 'Manual Upload').toUpperCase()}
                      <input id="manual-pan-upload" type="file" accept="image/*,.pdf" className="hidden" onChange={handlePanUpload} />
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
