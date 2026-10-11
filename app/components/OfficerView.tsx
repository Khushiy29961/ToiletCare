'use client';

import React, { useState } from 'react';
import { Toilet, MaintenanceTask, Report, Worker, TelemetryRecord } from '../types';
import { WorkerMatchModal } from './WorkerMatchModal';
import { TaskDetailModal } from './TaskDetailModal';
import { SensorSimulatorCard } from './SensorSimulatorCard';
import { AiCopilotDrawer } from './AiCopilotDrawer';

interface OfficerViewProps {
  toilets: Toilet[];
  tasks: MaintenanceTask[];
  reports: Report[];
  workers: Worker[];
  telemetryList: TelemetryRecord[];
  onRefresh: () => void;
}

export const OfficerView: React.FC<OfficerViewProps> = ({
  toilets,
  tasks,
  reports,
  workers,
  telemetryList,
  onRefresh,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedTaskForMatch, setSelectedTaskForMatch] = useState<MaintenanceTask | null>(null);
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<MaintenanceTask | null>(null);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  // Metrics calculations
  const totalToilets = toilets.length;
  const healthyCount = toilets.filter((t) => t.status === 'Healthy').length;
  const attentionCount = toilets.filter((t) => t.status === 'Attention').length;
  const criticalCount = toilets.filter((t) => t.status === 'Critical').length;

  const pendingTasksCount = tasks.filter((t) => t.status === 'Pending').length;
  const activeTasksCount = tasks.filter((t) => t.status === 'Assigned' || t.status === 'In Progress').length;
  const resolvedTasksCount = tasks.filter((t) => t.status === 'Resolved').length;
  const verifiedTasksCount = tasks.filter((t) => t.status === 'Verified').length;

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter === 'All') return true;
    return t.status === statusFilter;
  });

  const getToiletForTask = (toiletId: string): Toilet | undefined => {
    return toilets.find((t) => t.id === toiletId);
  };

  const getWorkerForTask = (workerId?: string | null): Worker | undefined => {
    if (!workerId) return undefined;
    return workers.find((w) => w.id === workerId);
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (score >= 40) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Verified':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Resolved':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'In Progress':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Assigned':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="space-y-8">
      {/* AI Copilot Floating Button */}
      <button
        onClick={() => setIsCopilotOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center space-x-2.5 rounded-2xl bg-indigo-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg hover:bg-indigo-700 active:scale-95 transition-all border border-indigo-500"
      >
        <span className="text-lg">🤖</span>
        <span>AI Operations Copilot</span>
        <span className="rounded-md bg-indigo-500/40 px-1.5 py-0.5 text-[10px] font-bold border border-indigo-400/40">Beta</span>
      </button>

      {/* AI Copilot Drawer */}
      <AiCopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
      />

      {/* Executive Overview Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Facilities</span>
          <div className="mt-1 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">{totalToilets}</span>
            <span className="text-xs text-slate-400">Total</span>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Healthy</span>
          <div className="mt-1 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-emerald-800">{healthyCount}</span>
            <span className="text-xs text-emerald-600 font-semibold">≥70 score</span>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Attention</span>
          <div className="mt-1 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-amber-800">{attentionCount}</span>
            <span className="text-xs text-amber-600 font-semibold">40-69 score</span>
          </div>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Critical</span>
          <div className="mt-1 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-rose-800">{criticalCount}</span>
            <span className="text-xs text-rose-600 font-semibold">&lt;40 score</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pending Tasks</span>
          <div className="mt-1 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">{pendingTasksCount}</span>
            <span className="text-xs text-amber-600 font-semibold">Unassigned</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Work</span>
          <div className="mt-1 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">{activeTasksCount}</span>
            <span className="text-xs text-blue-600 font-semibold">In Field</span>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Needs Verify</span>
          <div className="mt-1 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-blue-700">{resolvedTasksCount}</span>
            <span className="text-xs text-slate-500">({verifiedTasksCount} done)</span>
          </div>
        </div>
      </div>

      {/* Live IoT Sensor Telemetry & Simulation Suite */}
      <SensorSimulatorCard
        toilets={toilets}
        telemetryList={telemetryList}
        onScenarioTriggered={onRefresh}
      />

      {/* Toilet Network Facility Health Overview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center space-x-2">
              <span>🚽</span>
              <span>Monitored Facility Network</span>
            </h3>
            <p className="text-xs text-slate-500">
              Real-time rule-based health scores, water/soap telemetry, bin fill levels, and priority actions.
            </p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {toilets.map((toilet) => (
            <div
              key={toilet.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-slate-900 text-base">{toilet.id}</span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        {toilet.service_zone || 'Zone-1'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{toilet.location}</p>
                  </div>

                  <div className={`rounded-xl border px-3 py-1 text-center font-black ${getScoreColor(toilet.score)}`}>
                    <span className="text-lg block leading-tight">{toilet.score}</span>
                    <span className="text-[9px] uppercase tracking-wider block font-bold">Health</span>
                  </div>
                </div>

                {/* Telemetry Status Grid */}
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 border border-slate-100 text-xs">
                  <div className="text-center">
                    <span className="text-slate-400 text-[10px] font-bold block">WATER</span>
                    <span className={`font-bold mt-0.5 inline-block ${toilet.water ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {toilet.water ? '💧 Available' : '🚫 Low/Dry'}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-slate-400 text-[10px] font-bold block">SOAP</span>
                    <span className={`font-bold mt-0.5 inline-block ${toilet.soap ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {toilet.soap ? '🧴 Available' : '🚫 Empty'}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-slate-400 text-[10px] font-bold block">BIN FILL</span>
                    <span
                      className={`font-bold mt-0.5 inline-block ${
                        toilet.bin >= 90 ? 'text-rose-600' : toilet.bin >= 70 ? 'text-amber-600' : 'text-emerald-700'
                      }`}
                    >
                      🗑️ {toilet.bin}%
                    </span>
                  </div>
                </div>

                {/* Priority & Action */}
                <div className="mt-3.5 space-y-1 text-xs">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-slate-500 font-semibold">Priority:</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        toilet.priority === 'Critical'
                          ? 'bg-rose-100 text-rose-800'
                          : toilet.priority === 'High'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {toilet.priority}
                    </span>
                  </div>
                  <div className="text-slate-700">
                    <span className="text-slate-500 font-semibold">Recommended Action:</span>{' '}
                    <span className="font-bold text-slate-800">{toilet.action}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Maintenance Operations & Dispatch Center */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center space-x-2">
              <span>⚡</span>
              <span>Maintenance Task Dispatch & Lifecycle Management</span>
            </h3>
            <p className="text-xs text-slate-500">
              Track tasks, dispatch optimal workers with the matching algorithm, and verify completed resolutions.
            </p>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center space-x-1 rounded-xl bg-slate-100 p-1 border border-slate-200 overflow-x-auto text-xs font-semibold">
            {['All', 'Pending', 'Assigned', 'In Progress', 'Resolved', 'Verified'].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`rounded-lg px-3 py-1.5 transition-all whitespace-nowrap ${
                  statusFilter === tab
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Task List */}
        <div className="space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              <span className="text-3xl block">📋</span>
              <p className="mt-2">No maintenance tasks matching filter &quot;{statusFilter}&quot;.</p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const toilet = getToiletForTask(task.toilet_id);
              const worker = getWorkerForTask(task.assigned_worker_id);

              return (
                <div
                  key={task.task_id}
                  className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div
                    onClick={() => setSelectedTaskForDetail(task)}
                    className="cursor-pointer flex-1 space-y-1"
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="font-mono text-xs font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {task.task_id}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">{task.issue_type}</span>
                      <span className="text-xs text-slate-500">at {task.toilet_id} ({toilet?.location})</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${getStatusBadge(task.status)}`}>
                        {task.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3">
                      <span>
                        <b className="text-slate-700">Action:</b> {task.action}
                      </span>
                      <span>
                        <b className="text-slate-700">Priority:</b>{' '}
                        <span className="text-rose-700 font-bold">{task.priority}</span>
                      </span>
                      <span>
                        <b className="text-slate-700">Worker:</b>{' '}
                        {worker ? `${worker.name} (${worker.id})` : task.assigned_worker_id || 'Unassigned'}
                      </span>
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex items-center space-x-2">
                    {task.status === 'Pending' && (
                      <button
                        onClick={() => setSelectedTaskForMatch(task)}
                        className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-xs"
                      >
                        🎯 Match & Assign Worker
                      </button>
                    )}

                    {task.status === 'Resolved' && (
                      <button
                        onClick={() => setSelectedTaskForDetail(task)}
                        className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-xs"
                      >
                        🔍 Inspect & Verify
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedTaskForDetail(task)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Details ↗
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedTaskForMatch && (
        <WorkerMatchModal
          task={selectedTaskForMatch}
          toilet={getToiletForTask(selectedTaskForMatch.toilet_id)}
          isOpen={true}
          onClose={() => setSelectedTaskForMatch(null)}
          onAssigned={() => {
            onRefresh();
            setSelectedTaskForMatch(null);
          }}
        />
      )}

      {selectedTaskForDetail && (
        <TaskDetailModal
          task={selectedTaskForDetail}
          toilet={getToiletForTask(selectedTaskForDetail.toilet_id)}
          worker={getWorkerForTask(selectedTaskForDetail.assigned_worker_id)}
          isOpen={true}
          onClose={() => setSelectedTaskForDetail(null)}
          onUpdated={() => {
            onRefresh();
            setSelectedTaskForDetail(null);
          }}
          onOpenMatchModal={() => {
            const taskToMatch = selectedTaskForDetail;
            setSelectedTaskForDetail(null);
            setSelectedTaskForMatch(taskToMatch);
          }}
        />
      )}
    </div>
  );
};
