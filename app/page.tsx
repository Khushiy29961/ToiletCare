'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { UserRole, Toilet, MaintenanceTask, Report, Worker, TelemetryRecord } from './types';
import { api } from './services/api';
import { Navigation } from './components/Navigation';
import { CitizenView } from './components/CitizenView';
import { OfficerView } from './components/OfficerView';
import { WorkerView } from './components/WorkerView';

export default function Home() {
  const [activeRole, setActiveRole] = useState<UserRole>('officer');
  const [toilets, setToilets] = useState<Toilet[]>([]);
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [telemetryList, setTelemetryList] = useState<TelemetryRecord[]>([]);
  const [apiConnected, setApiConnected] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchAllData = useCallback(async (isInitial = false) => {
    if (isInitial) setIsLoading(true);
    else setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const [toiletsData, tasksData, reportsData, workersData, telemetryData] = await Promise.all([
        api.getToilets(),
        api.getTasks(),
        api.getReports(),
        api.getWorkers(),
        api.getLatestTelemetry().catch(() => []),
      ]);

      setToilets(toiletsData);
      setTasks(tasksData);
      setReports(reportsData);
      setWorkers(workersData);
      setTelemetryList(telemetryData);
      setApiConnected(true);
    } catch (err: any) {
      console.error('Error fetching ToiletCare data:', err);
      setApiConnected(false);
      setErrorMessage(
        err.message || 'Unable to connect to ToiletCare backend at http://127.0.0.1:8000'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData(true);
  }, [fetchAllData]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* Top Header & Role Switcher */}
      <Navigation
        activeRole={activeRole}
        onSelectRole={(role) => setActiveRole(role)}
        apiConnected={apiConnected}
        onRefresh={() => fetchAllData(false)}
        isRefreshing={isRefreshing}
      />

      {/* Role Context Bar */}
      <div className="border-b border-slate-200 bg-white px-4 py-2 text-xs">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-700">Active View:</span>
            <span className="rounded-md bg-slate-100 px-2.5 py-0.5 font-extrabold text-slate-900 capitalize border border-slate-200">
              {activeRole === 'citizen' && '👤 Citizen Public Grievance Portal'}
              {activeRole === 'officer' && '🛡️ Municipal Sanitation Officer Command Center'}
              {activeRole === 'worker' && '👷 Field Technician Workstation'}
            </span>
          </div>

          <div className="flex items-center space-x-3 text-slate-500 text-[11px]">
            <span>💡 Switch tabs above to demo the full autonomous grievance-to-resolution lifecycle.</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {errorMessage && (
          <div className="mb-6 rounded-2xl bg-rose-50 p-5 border border-rose-200 text-sm text-rose-900 shadow-xs flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-bold">{errorMessage}</p>
                <p className="text-xs text-rose-700 mt-0.5">
                  Ensure the FastAPI backend is running at <code className="bg-rose-100 px-1 py-0.5 rounded">http://127.0.0.1:8000</code>.
                </p>
              </div>
            </div>
            <button
              onClick={() => fetchAllData(false)}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
            >
              Retry Connection
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="py-24 text-center text-slate-400">
            <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-600" />
            <p className="mt-4 text-sm font-semibold text-slate-600">Connecting to ToiletCare Operations Engine...</p>
          </div>
        ) : (
          <>
            {activeRole === 'citizen' && (
              <CitizenView
                toilets={toilets}
                reports={reports}
                tasks={tasks}
                onReportSubmitted={() => fetchAllData(false)}
              />
            )}

            {activeRole === 'officer' && (
              <OfficerView
                toilets={toilets}
                tasks={tasks}
                reports={reports}
                workers={workers}
                telemetryList={telemetryList}
                onRefresh={() => fetchAllData(false)}
              />
            )}

            {activeRole === 'worker' && (
              <WorkerView
                workers={workers}
                tasks={tasks}
                toilets={toilets}
                onTaskUpdated={() => fetchAllData(false)}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-800">ToiletCare</span>
            <span>—</span>
            <span>Autonomous Sanitation Operations Platform</span>
          </div>

          <div className="flex items-center space-x-4 text-[11px] text-slate-400">
            <span>Telangana Pilot Prototype</span>
            <span>•</span>
            <span>Deterministic Scoring Engine</span>
            <span>•</span>
            <span>Synthetic Worker Dispatch</span>
            <span>•</span>
            <span>IoT Telemetry Simulator</span>
          </div>
        </div>
      </footer>
    </div>
  );
}