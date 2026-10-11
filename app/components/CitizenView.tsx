'use client';

import React, { useState } from 'react';
import { Toilet, Report, MaintenanceTask, IssueClassificationResult } from '../types';
import { api } from '../services/api';

interface CitizenViewProps {
  toilets: Toilet[];
  reports: Report[];
  tasks: MaintenanceTask[];
  onReportSubmitted: () => void;
}

export const CitizenView: React.FC<CitizenViewProps> = ({
  toilets,
  reports,
  tasks,
  onReportSubmitted,
}) => {
  const [toiletId, setToiletId] = useState(toilets[0]?.id || 'TC-001');
  const [issueType, setIssueType] = useState('No Water');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [aiClassification, setAiClassification] = useState<IssueClassificationResult | null>(null);
  const [submitFeedback, setSubmitFeedback] = useState<{
    success: boolean;
    message: string;
    taskId?: string | null;
    isNewTask?: boolean;
  } | null>(null);

  const handleAutoClassify = async () => {
    if (!description.trim()) {
      alert('Please enter a description of the problem first.');
      return;
    }

    setIsClassifying(true);
    setAiClassification(null);

    try {
      const res = await api.classifyIssue(description.trim(), toiletId);
      setAiClassification(res);
      if (res.is_valid_category && res.issue_type !== 'Other') {
        setIssueType(res.issue_type);
      }
    } catch (err: any) {
      alert(err.message || 'AI Classification unavailable. You may manually select the issue category.');
    } finally {
      setIsClassifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toiletId) {
      alert('Please select a toilet facility');
      return;
    }
    if (!description.trim()) {
      alert('Please describe the issue observed');
      return;
    }

    setIsSubmitting(true);
    setSubmitFeedback(null);

    try {
      const res = await api.submitReport({
        toilet_id: toiletId,
        issue_type: issueType,
        description: description.trim(),
      });

      setSubmitFeedback({
        success: true,
        message: res.message,
        taskId: res.task?.task_id || res.report.task_id,
        isNewTask: res.is_new_task,
      });

      setDescription('');
      setAiClassification(null);
      onReportSubmitted();
    } catch (err: any) {
      setSubmitFeedback({
        success: false,
        message: err.message || 'Failed to submit report. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTaskForReport = (report: Report): MaintenanceTask | undefined => {
    if (!report.task_id) return undefined;
    return tasks.find((t) => t.task_id === report.task_id);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Verified':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Resolved':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'In Progress':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Assigned':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-800 to-teal-700 p-6 sm:p-8 text-white shadow-md">
        <div className="max-w-2xl">
          <span className="inline-block rounded-full bg-emerald-500/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur-xs">
            Public Sanitation Grievance Portal
          </span>
          <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight">
            Report a Public Toilet Issue
          </h2>
          <p className="mt-2 text-emerald-100 text-sm sm:text-base leading-relaxed">
            Report broken taps, overflowing bins, missing soap, or unhygienic conditions. Use AI auto-detection to categorize your issue or select manually.
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Report Form */}
        <div className="lg:col-span-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-4">
              <span className="text-xl">📝</span>
              <h3 className="text-lg font-bold text-slate-900">Submit New Issue Report</h3>
            </div>

            {submitFeedback && (
              <div
                className={`mt-4 rounded-xl p-4 text-sm border ${
                  submitFeedback.success
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : 'bg-rose-50 text-rose-900 border-rose-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{submitFeedback.message}</p>
                    {submitFeedback.taskId && (
                      <p className="mt-1 text-xs text-emerald-800">
                        {submitFeedback.isNewTask
                          ? `✨ New task created: ${submitFeedback.taskId}`
                          : `🔗 Linked to existing active task: ${submitFeedback.taskId}`}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setSubmitFeedback(null)}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Select Public Toilet Location
                </label>
                <select
                  value={toiletId}
                  onChange={(e) => setToiletId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  {toilets.map((toilet) => (
                    <option key={toilet.id} value={toilet.id}>
                      {toilet.id} — {toilet.location} ({toilet.service_zone || 'Zone-1'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Description & Details
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue in your own words (e.g. 'Tap in stall 2 is completely dry', 'Dustbin is overflowing')..."
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />

                {/* AI Auto-detect Action */}
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleAutoClassify}
                    disabled={isClassifying || !description.trim()}
                    className="flex items-center space-x-1.5 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50"
                  >
                    <span>⚡</span>
                    <span>{isClassifying ? 'Analyzing NLP Intent...' : 'AI Auto-Detect Issue'}</span>
                  </button>
                </div>
              </div>

              {/* AI Classification Insights Card */}
              {aiClassification && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5 text-xs text-indigo-950 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-indigo-900 flex items-center space-x-1">
                      <span>🤖 AI Classification:</span>
                      <span className="rounded bg-indigo-100 px-1.5 py-0.5 font-bold">{aiClassification.issue_type}</span>
                    </span>
                    <span className="text-[10px] font-semibold text-indigo-700">
                      Severity: <b>{aiClassification.severity}</b>
                    </span>
                  </div>
                  <p className="text-slate-700 mt-1">{aiClassification.reasoning}</p>
                  <p className="text-[10px] text-indigo-600 font-medium">
                    Suggested Action: {aiClassification.suggested_action}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Issue Category (Manual Override Available)
                </label>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="No Water">💧 No Water (Tap Dry / Low Pressure)</option>
                  <option value="No Soap">🧴 No Soap (Dispenser Empty)</option>
                  <option value="Bin Full">🗑️ Bin Overflowing / Garbage</option>
                  <option value="Wet Floor">💦 Wet Floor / Slippery Surface</option>
                  <option value="Dirty Toilet">🧹 Dirty Toilet / Odor Issue</option>
                  <option value="Broken Fixture">🔧 Broken Door / Lock / Flush / Tap</option>
                  <option value="Electrical">💡 Lighting / Electrical Issue</option>
                  <option value="Other">⚠️ Other (General Review)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {isSubmitting ? (
                  <span>Submitting Report...</span>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>Submit Grievance Report</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Live Issue Tracking List */}
        <div className="lg:col-span-6 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2">
                <span className="text-xl">📡</span>
                <h3 className="text-lg font-bold text-slate-900">Recent Grievances & Live Status</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {reports.length} Total
              </span>
            </div>

            <div className="mt-4 divide-y divide-slate-100 max-h-[480px] overflow-y-auto pr-1">
              {reports.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-3xl">📋</p>
                  <p className="mt-2 text-sm">No reports filed yet. Use the form to submit one.</p>
                </div>
              ) : (
                reports.map((rep) => {
                  const linkedTask = getTaskForReport(rep);
                  return (
                    <div key={rep.id} className="py-3.5 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 text-sm">{rep.toilet_id}</span>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                              {rep.issue_type}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600 line-clamp-2">{rep.description}</p>
                        </div>

                        <div className="flex flex-col items-end space-y-1">
                          {rep.task_id ? (
                            <span className="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              {rep.task_id}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Unlinked</span>
                          )}

                          {linkedTask && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${getStatusBadgeClass(
                                linkedTask.status
                              )}`}
                            >
                              {linkedTask.status}
                            </span>
                          )}
                        </div>
                      </div>

                      {linkedTask?.resolution_notes && (
                        <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-700 border border-slate-200">
                          <span className="font-semibold text-slate-900">Resolution Note:</span>{' '}
                          {linkedTask.resolution_notes}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
