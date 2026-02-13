import React, { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Heart } from 'lucide-react';
import { Layout } from './components/Layout';
import { BottomNav } from './components/BottomNav';
import { LandingPage } from './pages/Landing';
import { ConnectionPage } from './pages/Connection';
import { TimelinePage } from './pages/Timeline';
import { FocusPage } from './pages/Focus';
import { AnniversaryPage } from './pages/Anniversary';
import { ProfilePage } from './pages/Profile';
import { AuthPage } from './pages/Auth';
import { EditProfilePage } from './pages/EditProfile';
import { View } from './types';
import { AppProvider } from './context';
import { AuthProvider } from './authContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import { syncTime } from './utils/timeService';
import { cleanupLegacyLocalDataOnce } from './utils/cloudStorageCleanup';

type BootSplashState = 'visible' | 'hiding' | 'hidden';

const BOOT_SPLASH_VISIBLE_MS = 880;
const BOOT_SPLASH_FADE_MS = 360;

const StartupTransition: React.FC<{ state: Exclude<BootSplashState, 'hidden'> }> = ({ state }) => (
  <div
    className={`startup-overlay ${state === 'hiding' ? 'startup-overlay-exit' : 'startup-overlay-enter'}`}
    aria-hidden="true"
  >
    <div className="startup-bloom startup-bloom-left" />
    <div className="startup-bloom startup-bloom-right" />

    <div className="startup-content">
      <div className="startup-emblem-wrap">
        <div className="startup-emblem-ring" />
        <div className="startup-emblem-core">
          <Heart className="startup-heart-icon" />
        </div>
      </div>

      <p className="startup-title">GIFTS</p>
      <p className="startup-subtitle">正在进入你们的小世界...</p>

      <div className="startup-progress" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  </div>
);

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.LANDING);
  const [transitioning, setTransitioning] = useState(false);
  const [displayView, setDisplayView] = useState<View>(View.LANDING);

  const navigateTo = (view: View) => {
    if (view === currentView) return;
    setTransitioning(true);
    setTimeout(() => {
      setCurrentView(view);
      setDisplayView(view);
      setTransitioning(false);
    }, 80);
  };

  const renderView = () => {
    const viewToRender = displayView;

    if (viewToRender === View.LANDING) {
      return <LandingPage onEnter={() => navigateTo(View.TIMELINE)} />;
    }

    if (viewToRender === View.ACCOUNT_SECURITY) {
      return <AuthPage onBack={() => navigateTo(View.PROFILE)} />;
    }

    if (viewToRender === View.EDIT_PROFILE) {
      return <EditProfilePage onBack={() => navigateTo(View.PROFILE)} />;
    }

    switch (viewToRender) {
      case View.CONNECTION:
        return (
          <ConnectionPage
            onComplete={() => navigateTo(View.TIMELINE)}
            onLogin={() => navigateTo(View.ACCOUNT_SECURITY)}
            onBack={() => navigateTo(View.PROFILE)}
          />
        );
      case View.TIMELINE:
        return <TimelinePage />;
      case View.FOCUS:
        return <FocusPage />;
      case View.ANNIVERSARY:
        return <AnniversaryPage />;
      case View.PROFILE:
        return (
          <ProfilePage
            onNavigateToAuth={() => navigateTo(View.ACCOUNT_SECURITY)}
            onEditProfile={() => navigateTo(View.EDIT_PROFILE)}
            onManageConnection={() => navigateTo(View.CONNECTION)}
          />
        );
      default:
        return <TimelinePage />;
    }
  };

  const showNav =
    currentView !== View.LANDING &&
    currentView !== View.CONNECTION &&
    currentView !== View.ACCOUNT_SECURITY &&
    currentView !== View.EDIT_PROFILE;

  return (
    <Layout fullScreen={!showNav}>
      <div
        key={displayView}
        className={transitioning ? 'page-transition-exit' : 'page-transition-enter'}
        style={{ display: 'contents' }}
      >
        {renderView()}
      </div>
      {showNav && <BottomNav currentView={currentView} onChangeView={navigateTo} />}
    </Layout>
  );
};

const App: React.FC = () => {
  const [bootSplashState, setBootSplashState] = useState<BootSplashState>('visible');

  useEffect(() => {
    cleanupLegacyLocalDataOnce();
    syncTime();
    const interval = setInterval(() => syncTime(), 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const visibleMs = prefersReducedMotion ? 280 : BOOT_SPLASH_VISIBLE_MS;
    const fadeMs = prefersReducedMotion ? 140 : BOOT_SPLASH_FADE_MS;

    const fadeTimer = window.setTimeout(() => {
      setBootSplashState('hiding');
    }, visibleMs);

    const hideTimer = window.setTimeout(() => {
      setBootSplashState('hidden');
    }, visibleMs + fadeMs);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  return (
    <ErrorBoundary>
      <AppProvider>
        <AuthProvider>
          <ToastProvider>
            <AppContent />
            {bootSplashState !== 'hidden' && <StartupTransition state={bootSplashState} />}
            <Analytics />
            <SpeedInsights />
          </ToastProvider>
        </AuthProvider>
      </AppProvider>
    </ErrorBoundary>
  );
};

export default App;
