import React from 'react';
import {
  ShieldAlert,
  MapPin,
  Menu,
  X,
  Server,
  User,
} from 'lucide-react';
import { ConnectionState } from '../types';

interface HeaderProps {
  connectionState: ConnectionState;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  connectionState,
  mobileMenuOpen,
  onToggleMobileMenu,
}) => {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 shadow-sm sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Brand Info & Mobile Toggle */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Mobile menu trigger */}
            <button
              type="button"
              onClick={onToggleMobileMenu}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="lg:hidden p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 cursor-pointer"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" aria-hidden="true" />
              ) : (
                <Menu className="w-5 h-5" aria-hidden="true" />
              )}
            </button>

            {/* Logo */}
            <div className="p-2 bg-blue-600/20 border border-blue-500/40 rounded-lg flex items-center justify-center text-blue-400 shrink-0">
              <ShieldAlert className="w-6 h-6" aria-hidden="true" />
            </div>

            {/* Title & Subtitle */}
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base sm:text-lg font-bold tracking-tight text-white font-sans">
                  LandslideGuard AI
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-900/70 text-blue-200 border border-blue-700/60 uppercase tracking-wide">
                  NER Platform
                </span>
              </div>
              <p className="text-xs text-slate-400 font-normal hidden sm:block truncate max-w-sm lg:max-w-none">
                Early Warning and Landslide Risk Monitoring System
              </p>
            </div>
          </div>

          {/* Right Status Group */}
          <div className="flex items-center space-x-2 sm:space-x-3 text-xs">
            {/* Region Indicator */}
            <div className="hidden md:flex items-center space-x-1.5 bg-slate-800/90 px-2.5 py-1.5 rounded-lg border border-slate-700/80">
              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
              <span className="text-slate-300 font-medium">Coverage:</span>
              <span className="text-slate-200 font-mono text-[11px]">NER India</span>
            </div>

            {/* Live Backend Connection Indicator */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors ${
                connectionState === 'success'
                  ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                  : connectionState === 'loading'
                  ? 'bg-amber-950/60 border-amber-700/60 text-amber-300'
                  : 'bg-rose-950/60 border-rose-700/60 text-rose-300'
              }`}
              title={`Backend Status: ${
                connectionState === 'success'
                  ? 'Connected to FastAPI'
                  : connectionState === 'loading'
                  ? 'Connecting...'
                  : 'Backend Offline'
              }`}
            >
              <Server className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">API:</span>
              <span className="font-semibold uppercase font-mono">
                {connectionState === 'success'
                  ? 'Online'
                  : connectionState === 'loading'
                  ? 'Syncing'
                  : 'Offline'}
              </span>
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  connectionState === 'success'
                    ? 'bg-emerald-400 animate-pulse'
                    : connectionState === 'loading'
                    ? 'bg-amber-400 animate-spin'
                    : 'bg-rose-400'
                }`}
                aria-hidden="true"
              />
            </div>

            {/* Accessible Profile / Account Placeholder */}
            <div
              className="flex items-center space-x-1.5 bg-slate-800/90 px-2.5 py-1.5 rounded-lg border border-slate-700/80 text-slate-300"
              title="Disaster Management Operations Console (Auth planned for Phase 6)"
            >
              <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 shrink-0">
                <User className="w-3 h-3" aria-hidden="true" />
              </div>
              <div className="hidden lg:flex flex-col text-left leading-none">
                <span className="text-[11px] font-semibold text-slate-200">Operations Console</span>
                <span className="text-[9px] text-slate-400 font-mono">Demo Mode</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
