import { useState } from 'react';
import { useLang } from '../context/LanguageContext';
import { Language } from '../i18n/translations';
import { Globe } from 'lucide-react';

const LANGUAGES: { code: Language; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिंदी' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
];

export default function LanguageSwitcher() {
  const { lang, setLang } = useLang();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div 
      className={`flex items-center gap-2 p-1 rounded-2xl transition-all duration-300 ${
        isExpanded ? 'bg-secondary/50 border border-border pr-2 shadow-xl' : ''
      }`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
          isExpanded ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-secondary'
        }`}
        title="Change Language"
      >
        <Globe size={18} />
      </button>

      {isExpanded && (
        <div className="flex bg-card/80 border border-border rounded-xl p-0.5 gap-0.5 animate-in fade-in slide-in-from-left-2 duration-300">
          {LANGUAGES.map(({ code, native }) => (
            <button
              key={code}
              onClick={() => {
                setLang(code);
                // Optionally auto-collapse after selection
                // setIsExpanded(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                lang === code
                  ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {native}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
