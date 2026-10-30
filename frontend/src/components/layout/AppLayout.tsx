import React, { useState, useEffect } from 'react';
import { Header } from '../Header';
import { Sidebar } from '../Sidebar';
import { ConnectionState, NavSectionId } from '../../types';

interface AppLayoutProps {
  currentTab: NavSectionId;
  onSelectTab: (tab: NavSectionId) => void;
  connectionState: ConnectionState;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentTab,
  onSelectTab,
  connectionState,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Close mobile drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased">
      {/* Top Application Header */}
      <Header
        connectionState={connectionState}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
      />

      {/* Main Layout Body */}
      <div className="flex-1 flex w-full max-w-7xl mx-auto">
        {/* Navigation Sidebar (Desktop + Mobile Drawer) */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={onSelectTab}
          mobileMenuOpen={mobileMenuOpen}
          onCloseMobileMenu={() => setMobileMenuOpen(false)}
        />

        {/* Content Area */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto min-w-0"
        >
          {children}
        </main>
      </div>

      {/* Standard Disaster Management Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-3.5 px-4 sm:px-6 text-xs mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <p className="text-center sm:text-left text-slate-400">
            &copy; {new Date().getFullYear()} LandslideGuard AI &mdash; Early Warning and Landslide Risk Monitoring System (NER India)
          </p>
          <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-400">
            <span>FastAPI: 0.162+</span>
            <span>&bull;</span>
            <span>React: 18.2+</span>
            <span>&bull;</span>
            <span className="text-blue-400 font-semibold">Phase 2 Verified</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
