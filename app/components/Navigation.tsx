'use client';

import React from 'react';
import { UserRole } from '../types';

interface NavigationProps {
  activeRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  apiConnected: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeRole,
  onSelectRole,
  apiConnected,
  onRefresh,
  isRefreshing,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur shadow-xs">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <span className="text-xl">🚽</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-slate-900 text-lg tracking-tight">ToiletCare</span>
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                  Operations MVP
                </span>
              </div>
              <p className="text-xs text-slate-500">Autonomous Sanitation & Field Dispatch</p>
            </div>
          </div>

          {/* Role Switcher */}
          <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              onClick={() => onSelectRole('citizen')}
              className={`flex items-center space-x-2 rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
                activeRole === 'citizen'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>👤</span>
              <span>Citizen Portal</span>
            </button>
            <button
              onClick={() => onSelectRole('officer')}
              className={`flex items-center space-x-2 rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
                activeRole === 'officer'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🛡️</span>
              <span>Officer Ops</span>
            </button>
            <button
              onClick={() => onSelectRole('worker')}
              className={`flex items-center space-x-2 rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
                activeRole === 'worker'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>👷</span>
              <span>Worker Console</span>
            </button>
          </div>

          {/* Connection Status & Refresh */}
          <div className="flex items-center space-x-3">
            <div className="hidden md:flex items-center space-x-1.5 text-xs font-medium">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  apiConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className={apiConnected ? 'text-slate-600' : 'text-rose-600 font-semibold'}>
                {apiConnected ? 'Backend Live' : 'Backend Offline'}
              </span>
            </div>

            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh Data"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50"
            >
              <span className={`text-base ${isRefreshing ? 'animate-spin' : ''}`}>🔄</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
