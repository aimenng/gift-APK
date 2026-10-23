import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  className?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, className = '' }) => {
  return (
    <div className="bg-[var(--eye-bg-primary)] h-[100dvh] w-full flex flex-col items-center relative overflow-hidden text-[var(--eye-text-primary)] transition-colors duration-300 font-sans">
      {/* Subtle ambient gradient */}
      <div className="fixed top-0 left-0 w-full h-64 bg-gradient-to-b from-primary/[0.03] to-transparent pointer-events-none z-0"></div>
      <div className="fixed bottom-0 left-0 w-full h-40 bg-gradient-to-t from-primary/[0.02] to-transparent pointer-events-none z-0"></div>
      
      {/* Content */}
      <main className={`relative z-10 w-full max-w-md mx-auto flex-1 flex flex-col h-full overflow-hidden ${className}`}>
        {children}
      </main>
    </div>
  );
};