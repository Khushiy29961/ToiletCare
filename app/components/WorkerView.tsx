'use client';

import React, { useState } from 'react';
import { Worker, MaintenanceTask, Toilet } from '../types';
import { api } from '../services/api';

interface WorkerViewProps {
  workers: Worker[];
  tasks: MaintenanceTask[];
  toilets: Toilet[];
  onTaskUpdated: () => void;
}

export const WorkerView: React.FC<WorkerViewProps> = ({
  workers,
  tasks,
  toilets,
  onTaskUpdated,
}) => {
  const [selectedWorkerId, setSelectedWorkerId] = useState(workers[0]?.id || 'WRK-001');
  const [resolutionNotes, setResolutionNotes] = useState<{ [taskId: string]: string }>({});
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId) || workers[0];
  const assignedTasks = tasks.filter((t) => t.assigned_worker_id === selectedWorkerId);

  const getToiletForTask = (toiletId: string): Toilet | undefined => {
    return toilets.find((t) => t.id === toiletId);
  };

  const handleStartTask = async (taskId: string) => {
    setIsUpdating(taskId);
    try {
      await api.updateTaskStatus(taskId, 'In Progress');
      onTaskUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to start task');
    } finally {
      setIsUpdating(null);
    }
  };

  const handleResolveTask = async (taskId: string) => {
    const notes = resolutionNotes[taskId] || 'Maintenance performed and facility restored.';
    setIsUpdating(taskId);
    try {
      await api.updateTaskStatus(taskId, 'Resolved', notes);
      onTaskUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to resolve task');
    } finally {
      setIsUpdating(null);
    }
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
    <div className="space-y-6">
      {/* Top Banner & Worker Profile */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-[11px] font-bold text-blue-800 uppercase tracking-wider">
              Field Technician Console
            </span>
            <h2 className="mt-1.5 text-xl font-extrabold text-slate-900">
              Active Field Worker Workstation
            </h2>
            <p className="text-xs text-slate-500">
              Switch worker perspective to accept assigned tasks, update work in progress, and submit completion proof.
            </p>
          </div>

          {/* Worker Selector */}
          <div className="w-full sm:w-72">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Select Demo Worker
            </label>
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
            >
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} — {w.role} {w.is_available ? '' : '(Off-duty)'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Worker Badge Summary */}
        {selectedWorker && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl bg-slate-50/70 p-4 border border-slate-100 text-xs">
            <div>
              <span className="text-slate-500 font-semibold block">Worker ID & Role</span>
              <span className="font-bold text-slate-900">{selectedWorker.id}</span>
              <span className="text-slate-600 block">{selectedWorker.role}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Service Zone</span>
              <span className="font-bold text-slate-900">{selectedWorker.service_zone}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Primary Skills</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {selectedWorker.skills.map((s) => (
                  <span key={s} className="rounded bg-white px-1.5 py-0.5 font-medium text-slate-700 border border-slate-200 text-[10px]">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Active Workload</span>
              <span className={`font-black text-sm ${selectedWorker.active_tasks > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {selectedWorker.active_tasks} Active Task{selectedWorker.active_tasks === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Task Queue Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
            <span>🛠️</span>
            <span>Assigned Maintenance Tasks ({assignedTasks.length})</span>
          </h3>
          <span className="text-xs text-slate-500">
            Assigned to {selectedWorker?.name}
          </span>
        </div>

        {assignedTasks.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
            <span className="text-4xl">🎉</span>
            <h4 className="mt-3 font-bold text-slate-800 text-sm">No tasks currently assigned</h4>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              This worker currently has 0 active maintenance assignments. Switch to the <b>Officer Ops</b> view to dispatch new tasks to this worker.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {assignedTasks.map((task) => {
              const toilet = getToiletForTask(task.toilet_id);
              return (
                <div
                  key={task.task_id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                      <div>
                        <span className="font-mono text-xs font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {task.task_id}
                        </span>
                        <h4 className="mt-1.5 font-bold text-slate-900 text-sm">{task.issue_type}</h4>
                        <p className="text-xs text-slate-500">
                          📍 {task.toilet_id} — {toilet?.location || 'Public Facility'}
                        </p>
                      </div>

                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${getStatusBadge(task.status)}`}>
                        {task.status}
                      </span>
                    </div>

                    {/* Action Required */}
                    <div className="mt-3 space-y-1 text-xs">
                      <div className="flex items-center space-x-1.5 text-slate-700">
                        <span className="font-semibold text-slate-900">Priority:</span>
                        <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
                          {task.priority}
                        </span>
                      </div>
                      <div className="text-slate-700">
                        <span className="font-semibold text-slate-900">Required Action:</span> {task.action}
                      </div>
                    </div>

                    {/* Existing Resolution Notes */}
                    {task.resolution_notes && (
                      <div className="mt-3 rounded-lg bg-slate-50 p-2.5 border border-slate-200 text-xs">
                        <span className="font-bold text-slate-900">Completion Note:</span> {task.resolution_notes}
                      </div>
                    )}
                  </div>

                  {/* Action Controls */}
                  <div className="border-t border-slate-100 pt-3">
                    {task.status === 'Assigned' && (
                      <button
                        onClick={() => handleStartTask(task.task_id)}
                        disabled={isUpdating === task.task_id}
                        className="w-full rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center space-x-1.5"
                      >
                        <span>▶️</span>
                        <span>{isUpdating === task.task_id ? 'Starting Task...' : 'Accept & Start Work'}</span>
                      </button>
                    )}

                    {task.status === 'In Progress' && (
                      <div className="space-y-2">
                        <textarea
                          rows={2}
                          placeholder="Enter resolution details (e.g. Replaced leaking valve, refilled soap dispenser)..."
                          value={resolutionNotes[task.task_id] || ''}
                          onChange={(e) =>
                            setResolutionNotes({ ...resolutionNotes, [task.task_id]: e.target.value })
                          }
                          className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => handleResolveTask(task.task_id)}
                          disabled={isUpdating === task.task_id}
                          className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-1.5"
                        >
                          <span>✅</span>
                          <span>{isUpdating === task.task_id ? 'Submitting Resolution...' : 'Mark Task as Resolved'}</span>
                        </button>
                      </div>
                    )}

                    {task.status === 'Resolved' && (
                      <div className="rounded-lg bg-blue-50 p-2.5 text-center text-xs font-semibold text-blue-800 border border-blue-200">
                        ⏳ Resolved. Awaiting supervisor inspection and verification.
                      </div>
                    )}

                    {task.status === 'Verified' && (
                      <div className="rounded-lg bg-emerald-50 p-2.5 text-center text-xs font-semibold text-emerald-800 border border-emerald-200">
                        🎉 Work Verified by {task.verified_by || 'Officer'}. Facility fully restored.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
