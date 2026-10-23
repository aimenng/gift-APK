import React from 'react';
import { Home, Calendar, User, Timer } from 'lucide-react';
import { View } from '../types';

interface BottomNavProps {
  currentView: View;
  onChangeView: (view: View) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentView, onChangeView }) => {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-50 pointer-events-none w-full">
      <div className="absolute inset-0 bg-eye-bg-primary/85 backdrop-blur-2xl border-t border-[var(--eye-border)] pointer-events-auto h-full pb-safe-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.03)]" />

      <nav className="relative pointer-events-auto grid grid-cols-4 items-end px-2 pt-2 pb-safe-bottom w-full" aria-label="主导航">
        <NavItem
          icon={Home}
          label="首页"
          isActive={currentView === View.TIMELINE}
          onClick={() => onChangeView(View.TIMELINE)}
        />

        <NavItem
          icon={Calendar}
          label="纪念日"
          isActive={currentView === View.ANNIVERSARY}
          onClick={() => onChangeView(View.ANNIVERSARY)}
        />

        <button
          onClick={() => onChangeView(View.FOCUS)}
          className="flex flex-col items-center gap-1 group w-full pb-3 relative -top-4"
          aria-label="专注计时器"
          aria-current={currentView === View.FOCUS ? 'page' : undefined}
        >
          <div
            className={`flex items-center justify-center w-14 h-14 rounded-2xl shadow-lg transition-all duration-300 group-active:scale-90 ${
              currentView === View.FOCUS
                ? 'bg-gradient-to-br from-primary to-[#9aad67] text-white shadow-glow scale-105'
                : 'bg-gradient-to-br from-primary to-[#9aad67] text-white shadow-primary/30'
            }`}
          >
            <Timer className="w-6 h-6" strokeWidth={2} />
          </div>
          <span
            className={`text-[11px] font-semibold transition-colors ${
              currentView === View.FOCUS ? 'text-primary' : 'text-gray-400'
            }`}
          >
            专注
          </span>
        </button>

        <NavItem
          icon={User}
          label="我的"
          isActive={currentView === View.PROFILE}
          onClick={() => onChangeView(View.PROFILE)}
        />
      </nav>
    </div>
  );
};

interface NavItemProps {
  icon: React.FC<any>;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`nav-pill ${isActive ? 'active' : ''} flex flex-col items-center gap-1 group w-full pb-3 pt-1 transition-all duration-300`}
    aria-label={label}
  >
    <div className={`relative p-2 rounded-xl transition-all duration-300 ${isActive ? 'bg-primary/10' : ''}`}>
      <Icon
        className={`w-6 h-6 transition-all duration-300 ${isActive ? 'text-primary scale-110' : 'text-gray-400 group-hover:text-gray-500'}`}
        strokeWidth={isActive ? 2.2 : 1.5}
      />
      {isActive && <div className="absolute inset-0 bg-primary/5 rounded-xl animate-bounce-in" />}
    </div>
    <span className={`text-[11px] font-semibold transition-colors ${isActive ? 'text-primary' : 'text-gray-400'}`}>
      {label}
    </span>
  </button>
);

