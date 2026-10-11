'use client';

import React, { useState } from 'react';
import { MaintenanceTask, Toilet, Worker } from '../types';
import { api } from '../services/api';

interface TaskDetailModalProps {
  task: MaintenanceTask;
  toilet?: Toilet;
  worker?: Worker;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onOpenMatchModal: () => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  toilet,
  worker,
  isOpen,
  onClose,
  onUpdated,
  onOpenMatchModal,
}) => {
  const [officerId, setOfficerId] = useState('OFFICER-WARANGAL-01');
  const [verificationNotes, setVerificationNotes] = useState('Physical inspection complete. Condition restored.');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const res = await api.updateTaskStatus(
        task.task_id,
        'Verified',
        verificationNotes,
        officerId
      );
      setVerificationResult(res.toilet_health);
      onUpdated();
    } catch (err: any) {
      alert(err.message || 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center space-x-3">
            <span className="text-xl">📋</span>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-extrabold text-slate-900">{task.task_id}</h3>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${getStatusBadgeClass(task.status)}`}>
                  {task.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Created: {task.created_at || 'Just now'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[480px] overflow-y-auto">
          {/* Key Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 font-semibold block">Target Toilet</span>
              <span className="font-bold text-slate-900 text-sm">{task.toilet_id}</span>
              <p className="text-slate-500 text-[11px]">{toilet?.location || 'Public Facility'}</p>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Issue Category</span>
              <span className="font-bold text-slate-900 text-sm">{task.issue_type}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Priority Level</span>
              <span className="font-bold text-rose-700 text-sm">{task.priority}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Required Action</span>
              <span className="font-semibold text-slate-800">{task.action}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Assigned Worker</span>
              <span className="font-semibold text-slate-800">
                {task.assigned_worker_id ? (worker ? `${worker.name} (${worker.id})` : task.assigned_worker_id) : 'Unassigned'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Linked Report</span>
              <span className="font-semibold text-slate-800">
                {task.report_id ? `#${task.report_id}` : 'Direct / Sensor'}
              </span>
            </div>
          </div>

          {/* Resolution Notes Section */}
          {task.resolution_notes && (
            <div className="rounded-xl bg-blue-50/70 p-4 border border-blue-200 text-xs">
              <span className="font-bold text-blue-900 block mb-1">🛠️ Worker Resolution Notes:</span>
              <p className="text-blue-950 leading-relaxed">{task.resolution_notes}</p>
              {task.resolved_at && (
                <p className="mt-2 text-[10px] text-blue-700 font-medium">Marked resolved at: {task.resolved_at}</p>
              )}
            </div>
          )}

          {/* Verification Section */}
          {task.status === 'Resolved' && !verificationResult && (
            <div className="rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 p-4 space-y-3">
              <div className="flex items-center space-x-2 text-emerald-900">
                <span className="text-base">✅</span>
                <span className="font-extrabold text-sm">Supervisor / Officer Verification Required</span>
              </div>
              <p className="text-xs text-emerald-800">
                Review the completed work. Verifying this task will restore physical condition metrics and dynamically re-calculate the facility health score.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700">Officer ID / Name</label>
                  <input
                    type="text"
                    value={officerId}
                    onChange={(e) => setOfficerId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700">Verification Inspection Note</label>
                  <input
                    type="text"
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleVerify}
                disabled={isVerifying}
                className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {isVerifying ? 'Verifying & Recalculating Health...' : 'Confirm Verification & Update Toilet Health'}
              </button>
            </div>
          )}

          {/* Verification Result Feedback */}
          {verificationResult && (
            <div className="rounded-xl bg-emerald-100 p-4 border border-emerald-300 text-xs text-emerald-900 space-y-1">
              <p className="font-extrabold text-sm">🎉 Task Verified Successfully!</p>
              <p>
                Toilet <span className="font-bold">{verificationResult.toilet_id}</span> health score updated to{' '}
                <span className="font-extrabold text-emerald-950 text-sm">{verificationResult.score}/100</span> (Status:{' '}
                <span className="font-bold">{verificationResult.status}</span>, Priority: {verificationResult.priority}).
              </p>
            </div>
          )}

          {task.status === 'Verified' && task.verified_by && !verificationResult && (
            <div className="rounded-xl bg-emerald-50 p-3.5 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
              <div>
                <span className="font-bold">Verified By:</span> {task.verified_by}
                <p className="text-[10px] text-emerald-700">Verified at: {task.verified_at || 'Recorded'}</p>
              </div>
              <span className="rounded-full bg-emerald-200/80 px-2.5 py-1 text-[11px] font-extrabold text-emerald-900">
                Resolved & Verified
              </span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-3.5 flex justify-between items-center">
          {task.status === 'Pending' ? (
            <button
              onClick={() => {
                onClose();
                onOpenMatchModal();
              }}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-xs"
            >
              🎯 Find & Assign Worker
            </button>
          ) : (
            <div />
          )}

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
