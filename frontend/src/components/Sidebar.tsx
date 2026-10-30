import React from 'react';
import {
  LayoutDashboard,
  Map,
  Cpu,
  FileText,
  BellRing,
  Route,
  CloudRain,
  BarChart3,
  Settings,
  Layers,
  X,
} from 'lucide-react';
import { NavSectionId } from '../types';

interface SidebarProps {
  currentTab: NavSectionId;
  onSelectTab: (tab: NavSectionId) => void;
  mobileMenuOpen: boolean;
  onCloseMobileMenu: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  mobileMenuOpen,
  onCloseMobileMenu,
}) => {
  const navItems = [
    {
      id: 'overview' as NavSectionId,
      label: 'Overview',
      icon: LayoutDashboard,
      phaseBadge: 'Phases 1-8 Active',
      isPhaseCurrent: true,
      description: 'System health, risk legend & readiness overview',
    },
    {
      id: 'risk-map' as NavSectionId,
      label: 'Risk Map',
      icon: Map,
      phaseBadge: 'Live GIS',
      isPhaseCurrent: true,
      description: 'Pan-India GIS terrain & hazard monitoring',
    },
    {
      id: 'ai-prediction' as NavSectionId,
      label: 'AI Susceptibility',
      icon: Cpu,
      phaseBadge: 'Phase 6 Active',
      isPhaseCurrent: true,
      description: 'Explainable AI models & data readiness audit',
    },
    {
      id: 'field-reports' as NavSectionId,
      label: 'Field Reports',
      icon: FileText,
      phaseBadge: 'Phase 7 Active',
      isPhaseCurrent: true,
      description: 'Crowdsourced reports & field verification',
    },
    {
      id: 'alerts' as NavSectionId,
      label: 'Early Warnings',
      icon: BellRing,
      phaseBadge: 'Phase 7 Active',
      isPhaseCurrent: true,
      description: 'CAP v1.2 alerts & simulated emergency dispatches',
    },
    {
      id: 'road-connectivity' as NavSectionId,
      label: 'Road Connectivity',
      icon: Route,
      phaseBadge: 'Phase 4',
      isPhaseCurrent: false,
      description: 'Highway corridors & critical access routes',
    },
    {
      id: 'weather-monitoring' as NavSectionId,
      label: 'Weather Monitoring',
      icon: CloudRain,
      phaseBadge: 'Phase 4',
      isPhaseCurrent: false,
      description: 'Precipitation telemetry & soil moisture',
    },
    {
      id: 'analytics' as NavSectionId,
      label: 'Analytics',
      icon: BarChart3,
      phaseBadge: 'Phase 5',
      isPhaseCurrent: false,
      description: 'Historical landslide frequency & trends',
    },
    {
      id: 'settings' as NavSectionId,
      label: 'Settings',
      icon: Settings,
      phaseBadge: 'Phase 6',
      isPhaseCurrent: false,
      description: 'System parameters & notification preferences',
    },
  ];

  const handleItemClick = (id: NavSectionId) => {
    onSelectTab(id);
    onCloseMobileMenu();
  };

  const navContent = (
    <div className="flex flex-col h-full text-slate-300">
      {/* Sidebar Section Title */}
      <div className="p-4 border-b border-slate-800/90 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Layers className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />
          <span>Navigation Shell</span>
        </div>
        {/* Mobile close button */}
        <button
          type="button"
          onClick={onCloseMobileMenu}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          aria-label="Close navigation sidebar"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav aria-label="Main Navigation" className="p-3 space-y-1 overflow-y-auto flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3 truncate">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-white' : 'text-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </div>

              <span
                className={`text-[9px] uppercase tracking-wide font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                  isActive
                    ? 'bg-blue-700 border-blue-400/50 text-blue-100 font-bold'
                    : item.isPhaseCurrent
                    ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                {item.phaseBadge}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-3.5 border-t border-slate-800/90 bg-slate-950/60 text-[11px] text-slate-400 space-y-1.5">
        <div className="flex justify-between items-center">
          <span>Active Interface:</span>
          <span className="font-mono text-emerald-400 font-semibold">Phase 2 Shell</span>
        </div>
        <div className="flex justify-between items-center text-[10px]">
          <span>Database:</span>
          <span className="font-mono text-slate-400">PostGIS (Phase 3)</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={onCloseMobileMenu}
          className="fixed inset-0 bg-slate-950/75 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer (sliding) */}
      <aside
        id="mobile-navigation"
        aria-label="Mobile Navigation"
        className={`fixed inset-y-0 left-0 w-72 bg-slate-900 border-r border-slate-800 z-50 transform transition-transform duration-200 ease-in-out lg:hidden flex flex-col ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {navContent}
      </aside>

      {/* Desktop Persistent Sidebar */}
      <aside
        id="desktop-navigation"
        aria-label="Desktop Navigation"
        className="hidden lg:flex w-64 bg-slate-900 border-r border-slate-800 shrink-0 flex-col min-h-[calc(100vh-61px)]"
      >
        {navContent}
      </aside>
    </>
  );
};
