import React from 'react';
import { Palette, Clock, Check, X } from 'lucide-react';
import { COLOR_THEMES, CLOCK_STYLES } from './constants';

interface SettingsPanelProps {
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  isSciTheme: boolean;
  colorTheme: any;
  setColorTheme: (theme: any) => void;
  clockStyle: 'ring' | 'digital' | 'minimal';
  setClockStyle: (style: 'ring' | 'digital' | 'minimal') => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  showSettings,
  setShowSettings,
  isSciTheme,
  colorTheme,
  setColorTheme,
  clockStyle,
  setClockStyle,
}) => {
  if (!showSettings) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => setShowSettings(false)}
    >
      <div
        className="w-full max-w-md rounded-t-3xl p-6 animate-slide-up-fade transition-colors"
        style={{ backgroundColor: isSciTheme ? '#1a1a2e' : 'var(--eye-bg-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold" style={{ color: isSciTheme ? '#ffffff' : 'var(--eye-text-primary)' }}>
            时钟设置
          </h3>
          <button
            onClick={() => setShowSettings(false)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            style={{ color: isSciTheme ? 'rgba(255,255,255,0.7)' : 'var(--eye-text-secondary)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Palette
              className="w-4 h-4"
              style={{ color: isSciTheme ? 'rgba(255,255,255,0.7)' : 'var(--eye-text-secondary)' }}
            />
            <span className="text-sm font-medium" style={{ color: isSciTheme ? '#ffffff' : 'var(--eye-text-primary)' }}>
              主题配色
            </span>
          </div>

          <p className="text-xs mb-2" style={{ color: isSciTheme ? 'rgba(255,255,255,0.5)' : 'var(--eye-text-secondary)' }}>
            柔和色调
          </p>
          <div className="grid grid-cols-5 gap-2 mb-4">
            {COLOR_THEMES.slice(0, 5).map((theme) => (
              <button
                key={theme.id}
                onClick={() => setColorTheme(theme)}
                className={`relative flex flex-col items-center gap-1.5 transition-all ${
                  colorTheme.id === theme.id ? 'scale-105' : 'hover:scale-105'
                }`}
              >
                <div
                  className={`w-full aspect-square rounded-xl ${theme.bg} transition-all ${
                    colorTheme.id === theme.id ? 'ring-2 ring-white ring-offset-2 ring-offset-black/20 shadow-lg' : ''
                  }`}
                >
                  {colorTheme.id === theme.id && (
                    <Check className="absolute inset-0 m-auto w-5 h-5 text-white drop-shadow-md" />
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium ${colorTheme.id === theme.id ? 'opacity-100' : 'opacity-60'}`}
                  style={{ color: isSciTheme ? '#ffffff' : 'var(--eye-text-primary)' }}
                >
                  {theme.name}
                </span>
              </button>
            ))}
          </div>

          <p className="text-xs mb-2" style={{ color: isSciTheme ? 'rgba(255,255,255,0.5)' : 'var(--eye-text-secondary)' }}>
            科幻霓虹
          </p>
          <div className="grid grid-cols-4 gap-3">
            {COLOR_THEMES.slice(5).map((theme) => (
              <button
                key={theme.id}
                onClick={() => setColorTheme(theme)}
                className={`relative flex flex-col items-center gap-1.5 transition-all ${
                  colorTheme.id === theme.id ? 'scale-105' : 'hover:scale-105'
                }`}
              >
                <div
                  className={`w-full aspect-square rounded-xl ${theme.bg} ${theme.glow} transition-all ${
                    colorTheme.id === theme.id ? 'ring-2 ring-white ring-offset-2 ring-offset-black/20 shadow-lg' : ''
                  }`}
                >
                  {colorTheme.id === theme.id && (
                    <Check className="absolute inset-0 m-auto w-5 h-5 text-white drop-shadow-md" />
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium ${colorTheme.id === theme.id ? 'opacity-100' : 'opacity-60'}`}
                  style={{ color: isSciTheme ? '#ffffff' : 'var(--eye-text-primary)' }}
                >
                  {theme.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock
              className="w-4 h-4"
              style={{ color: isSciTheme ? 'rgba(255,255,255,0.7)' : 'var(--eye-text-secondary)' }}
            />
            <span className="text-sm font-medium" style={{ color: isSciTheme ? '#ffffff' : 'var(--eye-text-primary)' }}>
              时钟样式
            </span>
          </div>
          <div className="flex gap-2">
            {CLOCK_STYLES.map((style) => {
              const Icon = style.icon;
              return (
                <button
                  key={style.id}
                  onClick={() => setClockStyle(style.id)}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${
                    clockStyle === style.id ? `${colorTheme.bg} text-white ${isSciTheme ? colorTheme.glow : ''}` : ''
                  }`}
                  style={
                    clockStyle !== style.id
                      ? {
                          backgroundColor: isSciTheme ? 'rgba(255,255,255,0.1)' : 'var(--eye-bg-secondary)',
                          color: isSciTheme ? 'rgba(255,255,255,0.7)' : 'var(--eye-text-secondary)',
                        }
                      : {}
                  }
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{style.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => setShowSettings(false)}
          className={`w-full h-12 rounded-xl ${colorTheme.bg} text-white font-bold text-lg shadow-lg active:scale-95 transition-all ${
            isSciTheme ? colorTheme.glow : ''
          }`}
        >
          完成
        </button>
      </div>
    </div>
  );
};
