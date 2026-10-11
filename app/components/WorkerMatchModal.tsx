'use client';

import React, { useEffect, useState } from 'react';
import { MaintenanceTask, WorkerMatchCandidate, Toilet } from '../types';
import { api } from '../services/api';

interface WorkerMatchModalProps {
  task: MaintenanceTask;
  toilet?: Toilet;
  isOpen: boolean;
  onClose: () => void;
  onAssigned: () => void;
}

export const WorkerMatchModal: React.FC<WorkerMatchModalProps> = ({
  task,
  toilet,
  isOpen,
  onClose,
  onAssigned,
}) => {
  const [candidates, setCandidates] = useState<WorkerMatchCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAssigning, setIsAssigning] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    setErrorMessage(null);

    api
      .matchWorkers(task.task_id)
      .then((data) => {
        setCandidates(data);
      })
      .catch((err) => {
        setErrorMessage(err.message || 'Failed to load candidate rankings');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, task.task_id]);

  if (!isOpen) return null;

  const handleAssign = async (workerId: string) => {
    setIsAssigning(workerId);
    try {
      await api.assignTask(task.task_id, workerId);
      onAssigned();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to assign worker');
    } finally {
      setIsAssigning(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl">🎯</span>
              <h3 className="text-lg font-extrabold text-slate-900">
                AI / Rule-Based Worker Dispatcher
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Ranking candidate workers for <span className="font-mono font-bold text-slate-800">{task.task_id}</span> ({task.issue_type} at {task.toilet_id})
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Task Context Card */}
        <div className="border-b border-slate-100 bg-slate-50/40 px-6 py-3.5 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-900">Target Toilet:</span>
            <span>{task.toilet_id} {toilet ? `(${toilet.location})` : ''}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-900">Priority:</span>
            <span className="rounded bg-rose-100 px-2 py-0.5 font-bold text-rose-800">{task.priority}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-900">Action:</span>
            <span>{task.action}</span>
          </div>
        </div>

        {/* Candidates List */}
        <div className="max-h-[420px] overflow-y-auto p-6 space-y-3.5">
          {isLoading ? (
            <div className="py-12 text-center text-slate-500">
              <span className="inline-block animate-spin text-2xl">⚙️</span>
              <p className="mt-2 text-sm">Evaluating skills, service zone, and active workloads...</p>
            </div>
          ) : errorMessage ? (
            <div className="rounded-xl bg-rose-50 p-4 text-xs text-rose-800 border border-rose-200">
              {errorMessage}
            </div>
          ) : candidates.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">No worker candidates found.</div>
          ) : (
            candidates.map((cand, idx) => {
              const isAssignedToThis = task.assigned_worker_id === cand.worker.id;
              return (
                <div
                  key={cand.worker.id}
                  className={`rounded-xl border p-4 transition-all ${
                    idx === 0 && cand.match_score > 0
                      ? 'border-emerald-300 bg-emerald-50/30 ring-1 ring-emerald-400/30'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-sm">{cand.worker.name}</span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          {cand.worker.id}
                        </span>
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          {cand.worker.role}
                        </span>
                        {idx === 0 && cand.match_score > 0 && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                            ★ Top Recommendation
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-slate-600">
                        <span className="font-semibold">Skills:</span> {cand.worker.skills.join(', ')}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">Reasoning:</span> {cand.recommendation_reason}
                      </p>
                    </div>

                    {/* Score & Assign button */}
                    <div className="flex flex-col items-end space-y-2">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs text-slate-500 font-medium">Match:</span>
                        <span
                          className={`rounded-lg px-2.5 py-1 text-xs font-black ${
                            cand.match_score >= 80
                              ? 'bg-emerald-100 text-emerald-800'
                              : cand.match_score >= 50
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {cand.match_score}%
                        </span>
                      </div>

                      <button
                        onClick={() => handleAssign(cand.worker.id)}
                        disabled={!cand.worker.is_available || isAssigning !== null}
                        className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all shadow-xs ${
                          isAssignedToThis
                            ? 'bg-purple-100 text-purple-800 border border-purple-300'
                            : cand.worker.is_available
                            ? 'bg-slate-900 text-white hover:bg-slate-800'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {isAssigning === cand.worker.id ? (
                          'Assigning...'
                        ) : isAssignedToThis ? (
                          'Currently Assigned'
                        ) : cand.worker.is_available ? (
                          'Assign Worker'
                        ) : (
                          'Unavailable'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-3.5 flex justify-between items-center text-xs text-slate-500">
          <span>Roster consists of verified synthetic demo workers.</span>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
