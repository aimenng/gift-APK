import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { CheckCircle2, AlertCircle, X, Heart } from 'lucide-react';

type ToastType = 'success' | 'error' | 'love';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  exiting?: boolean;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

let toastId = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const DURATION_MAP: Record<ToastType, number> = {
    success: 2000,
    error: 5000,
    love: 3000,
  };

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++toastId;
    const duration = DURATION_MAP[type];
    setToasts(prev => [...prev, { id, message, type }]);

    // Start exit animation
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    }, duration);

    // Remove
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration + 300);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 200);
  }, []);

  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 className="w-[1.125rem] h-[1.125rem] text-emerald-500 shrink-0" />,
    error: <AlertCircle className="w-[1.125rem] h-[1.125rem] text-red-500 shrink-0" />,
    love: <Heart className="w-[1.125rem] h-[1.125rem] text-rose-400 fill-current shrink-0" />,
  };

  const bgColors: Record<ToastType, string> = {
    success: 'bg-white dark:bg-[#232820] border-emerald-200 dark:border-emerald-800/40',
    error: 'bg-white dark:bg-[#232820] border-red-200 dark:border-red-800/40',
    love: 'bg-white dark:bg-[#232820] border-rose-200 dark:border-rose-800/40',
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Container */}
      <div className="fixed bottom-0 left-0 right-0 z-[100] flex flex-col items-center pb-safe-bottom pointer-events-none">
        <div className="flex flex-col-reverse items-center gap-2 mb-24 w-full max-w-sm px-4">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={`${toast.exiting ? 'toast-exit' : 'toast-enter'} ${bgColors[toast.type]} pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg border backdrop-blur-xl w-full`}
              onClick={() => dismissToast(toast.id)}
            >
              {icons[toast.type]}
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">{toast.message}</span>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
};
