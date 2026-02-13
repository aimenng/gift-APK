import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface TimerDisplayProps {
  clockStyle: 'ring' | 'digital' | 'minimal';
  mode: 'countdown' | 'countup';
  formattedTime: string;
  progress: number;
  initialTime: number;
  isActive: boolean;
  isSciTheme: boolean;
  colorTheme: any;
  cardBg: string;
  borderColor: string;
  textColor: string;
  textSecondary: string;
  adjustTime: (delta: number) => void;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({
  clockStyle,
  mode,
  formattedTime,
  progress,
  initialTime,
  isActive,
  isSciTheme,
  colorTheme,
  cardBg,
  borderColor,
  textColor,
  textSecondary,
  adjustTime,
}) => {
  if (clockStyle === 'ring') {
    return (
      <div className="relative flex items-center justify-center size-64 mb-6 shrink-0 focus-timer-shell">
        <div
          className="absolute inset-0 rounded-full shadow-lg border transition-colors"
          style={{ backgroundColor: cardBg, borderColor }}
        />

        <div
          className={`focus-timer-orbit ${isActive ? 'focus-timer-orbit-active' : ''}`}
          style={{ borderColor: `${colorTheme.primary}66` }}
        />

        <svg className="relative w-full h-full -rotate-90 p-4" viewBox="0 0 100 100">
          <circle
            style={{ color: borderColor }}
            cx="50"
            cy="50"
            fill="none"
            r="45"
            stroke="currentColor"
            strokeWidth="3"
          />
          <circle
            className={`${colorTheme.ring} ${isActive ? 'focus-timer-progress-active' : 'focus-timer-progress-idle'} ${colorTheme.glow}`}
            cx="50"
            cy="50"
            fill="none"
            r="45"
            stroke="currentColor"
            strokeDasharray="283"
            strokeDashoffset={283 - progress}
            strokeLinecap="round"
            strokeWidth="3"
          />
          <circle
            className={isActive ? 'focus-timer-anchor-active' : ''}
            fill={colorTheme.primary}
            cx="50"
            cy="5"
            r="4"
            style={{ transformOrigin: '50px 50px', transform: `rotate(${(progress / 283) * 360}deg)` }}
          />
        </svg>

        <div className="absolute flex flex-col items-center justify-center inset-0">
          <span
            className={`text-5xl font-light tracking-tighter tabular-nums ${isSciTheme ? colorTheme.glow : ''} ${isActive ? 'focus-time-live' : ''}`}
            style={{ color: textColor }}
          >
            {formattedTime}
          </span>
          <span className={`text-xs font-semibold mt-2 px-3 py-1 rounded-full ${colorTheme.bg} text-white`}>
            {mode === 'countup' ? '正计时' : `${Math.round(initialTime / 60)} 分钟`}
          </span>
        </div>
      </div>
    );
  }

  if (clockStyle === 'digital') {
    return (
      <div className="flex flex-col items-center mb-6 shrink-0">
        <div
          className={`px-8 py-6 rounded-3xl border-2 shadow-xl transition-colors ${isActive ? 'focus-digital-live' : ''}`}
          style={{ backgroundColor: cardBg, borderColor: colorTheme.primary }}
        >
          <span
            className={`text-6xl font-mono font-bold tracking-widest ${isSciTheme ? colorTheme.glow : ''}`}
            style={{ color: textColor }}
          >
            {formattedTime}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={() => adjustTime(-5)}
            className="p-2 rounded-full transition-colors"
            style={{ backgroundColor: cardBg, color: textSecondary }}
          >
            <ChevronDown className="w-5 h-5" />
          </button>
          <span className="text-sm" style={{ color: textSecondary }}>
            {Math.round(initialTime / 60)} 分钟
          </span>
          <button
            onClick={() => adjustTime(5)}
            className="p-2 rounded-full transition-colors"
            style={{ backgroundColor: cardBg, color: textSecondary }}
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center mb-6 shrink-0">
      <span
        className={`text-8xl font-extralight tracking-tight tabular-nums ${isSciTheme ? colorTheme.glow : ''} ${isActive ? 'focus-time-live' : ''}`}
        style={{ color: textColor }}
      >
        {formattedTime}
      </span>
      <div className="w-48 h-1 rounded-full mt-4 overflow-hidden" style={{ backgroundColor: borderColor }}>
        <div
          className={`h-full ${colorTheme.bg} transition-all duration-1000`}
          style={{ width: `${(progress / 283) * 100}%` }}
        />
      </div>
    </div>
  );
};
