'use client';

import React, { useState } from 'react';
import { Toilet, TelemetryRecord, SimulationScenario, TelemetryResponse } from '../types';
import { api } from '../services/api';

interface SensorSimulatorCardProps {
  toilets: Toilet[];
  telemetryList: TelemetryRecord[];
  onScenarioTriggered: () => void;
}

export const SensorSimulatorCard: React.FC<SensorSimulatorCardProps> = ({
  toilets,
  telemetryList,
  onScenarioTriggered,
}) => {
  const [selectedToiletId, setSelectedToiletId] = useState<string>(toilets[0]?.id || 'TC-001');
  const [isTriggering, setIsTriggering] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<{
    scenario: string;
    message: string;
    actionTaken: string;
    issueDetected: string | null;
    taskId?: string | null;
    isNewTask: boolean;
  } | null>(null);

  const currentTelemetry = telemetryList.find((t) => t.toilet_id === selectedToiletId) || {
    id: 0,
    toilet_id: selectedToiletId,
    water_level: 80,
    soap_level: 80,
    bin_fill: 30,
    wetness: 10,
    occupancy: 4,
    data_source: 'simulator',
    recorded_at: 'Initial Seed',
  };

  const handleTriggerScenario = async (scenario: SimulationScenario) => {
    setIsTriggering(scenario);
    setSimulationResult(null);

    try {
      const res = await api.simulateScenario(selectedToiletId, scenario);
      setSimulationResult({
        scenario: res.scenario,
        message: res.message,
        actionTaken: res.result.action_taken,
        issueDetected: res.result.issue_detected,
        taskId: res.result.task?.task_id,
        isNewTask: res.result.is_new_task,
      });

      onScenarioTriggered();
    } catch (err: any) {
      alert(err.message || 'Simulation trigger failed');
    } finally {
      setIsTriggering(null);
    }
  };

  const getGaugeColor = (val: number, inverse = false) => {
    if (!inverse) {
      if (val >= 60) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      if (val >= 20) return 'text-amber-700 bg-amber-50 border-amber-200';
      return 'text-rose-700 bg-rose-50 border-rose-200';
    } else {
      if (val >= 80) return 'text-rose-700 bg-rose-50 border-rose-200';
      if (val >= 50) return 'text-amber-700 bg-amber-50 border-amber-200';
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xl">📡</span>
            <h3 className="text-lg font-extrabold text-slate-900">
              Live IoT Sensor Telemetry & Simulation Suite
            </h3>
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-800 border border-indigo-200">
              DEMO / SIMULATED IoT
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Hardware-agnostic telemetry ingestion pipeline. Simulate realistic sensor events or connect real ESP32 boards via <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">POST /api/telemetry</code>.
          </p>
        </div>

        {/* Facility Selector */}
        <div className="flex items-center space-x-2">
          <label className="text-xs font-bold text-slate-600 whitespace-nowrap">Target Facility:</label>
          <select
            value={selectedToiletId}
            onChange={(e) => setSelectedToiletId(e.target.value)}
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {toilets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id} — {t.location}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Real-time Telemetry Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* Water Level */}
        <div className={`rounded-xl border p-3.5 ${getGaugeColor(currentTelemetry.water_level)}`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider">💧 Water Level</span>
            <span className="text-[10px] font-extrabold">{currentTelemetry.water_level < 20 ? 'CRITICAL' : 'OK'}</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black">{currentTelemetry.water_level}%</span>
            <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-current rounded-full transition-all duration-300"
                style={{ width: `${currentTelemetry.water_level}%` }}
              />
            </div>
          </div>
        </div>

        {/* Soap Level */}
        <div className={`rounded-xl border p-3.5 ${getGaugeColor(currentTelemetry.soap_level)}`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider">🧴 Soap Level</span>
            <span className="text-[10px] font-extrabold">{currentTelemetry.soap_level < 20 ? 'LOW' : 'OK'}</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black">{currentTelemetry.soap_level}%</span>
            <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-current rounded-full transition-all duration-300"
                style={{ width: `${currentTelemetry.soap_level}%` }}
              />
            </div>
          </div>
        </div>

        {/* Bin Fill */}
        <div className={`rounded-xl border p-3.5 ${getGaugeColor(currentTelemetry.bin_fill, true)}`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider">🗑️ Bin Fill</span>
            <span className="text-[10px] font-extrabold">{currentTelemetry.bin_fill >= 90 ? 'FULL' : 'OK'}</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black">{currentTelemetry.bin_fill}%</span>
            <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-current rounded-full transition-all duration-300"
                style={{ width: `${currentTelemetry.bin_fill}%` }}
              />
            </div>
          </div>
        </div>

        {/* Floor Wetness */}
        <div className={`rounded-xl border p-3.5 ${getGaugeColor(currentTelemetry.wetness, true)}`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider">💦 Wetness</span>
            <span className="text-[10px] font-extrabold">{currentTelemetry.wetness >= 70 ? 'WET HAZARD' : 'DRY'}</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black">{currentTelemetry.wetness}%</span>
            <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-current rounded-full transition-all duration-300"
                style={{ width: `${currentTelemetry.wetness}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
        <span>🕒 Last Sensor Packet: <b>{currentTelemetry.recorded_at}</b></span>
        <span>👥 Hourly Footfall: <b>{currentTelemetry.occupancy} visitors</b></span>
        <span>📡 Ingestion Source: <b>{currentTelemetry.data_source}</b></span>
      </div>

      {/* Scenario Feedback Alert */}
      {simulationResult && (
        <div className="rounded-xl bg-indigo-50/80 p-4 text-xs text-indigo-950 border border-indigo-200 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-sm text-indigo-900">
              ⚡ Simulated Scenario Executed: {simulationResult.scenario}
            </span>
            <button
              onClick={() => setSimulationResult(null)}
              className="text-indigo-400 hover:text-indigo-700 font-bold"
            >
              ✕
            </button>
          </div>
          <p className="font-semibold text-indigo-900">{simulationResult.actionTaken}</p>
          {simulationResult.taskId && (
            <p className="text-[11px] text-indigo-700">
              {simulationResult.isNewTask
                ? `✨ Auto-generated maintenance task: #${simulationResult.taskId}`
                : `🔗 Linked to active task: #${simulationResult.taskId} (duplicate task prevented)`}
            </p>
          )}
        </div>
      )}

      {/* Simulation Scenario Buttons */}
      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
          Trigger Sensor Scenario for {selectedToiletId}:
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <button
            onClick={() => handleTriggerScenario('NORMAL')}
            disabled={isTriggering !== null}
            className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition-colors disabled:opacity-50 text-left shadow-2xs"
          >
            <span className="block text-sm">🌱 NORMAL</span>
            <span className="text-[10px] text-emerald-700 font-normal">Water 80%, Soap 80%, Bin 30%</span>
          </button>

          <button
            onClick={() => handleTriggerScenario('NO_WATER')}
            disabled={isTriggering !== null}
            className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-900 hover:bg-rose-100 transition-colors disabled:opacity-50 text-left shadow-2xs"
          >
            <span className="block text-sm">💧 NO WATER</span>
            <span className="text-[10px] text-rose-700 font-normal">Water 5% (Critical Breach)</span>
          </button>

          <button
            onClick={() => handleTriggerScenario('SOAP_LOW')}
            disabled={isTriggering !== null}
            className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors disabled:opacity-50 text-left shadow-2xs"
          >
            <span className="block text-sm">🧴 SOAP LOW</span>
            <span className="text-[10px] text-amber-700 font-normal">Soap 10% (Medium Breach)</span>
          </button>

          <button
            onClick={() => handleTriggerScenario('BIN_FULL')}
            disabled={isTriggering !== null}
            className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-900 hover:bg-rose-100 transition-colors disabled:opacity-50 text-left shadow-2xs"
          >
            <span className="block text-sm">🗑️ BIN FULL</span>
            <span className="text-[10px] text-rose-700 font-normal">Bin 95% (High Breach)</span>
          </button>

          <button
            onClick={() => handleTriggerScenario('WET_FLOOR')}
            disabled={isTriggering !== null}
            className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors disabled:opacity-50 text-left shadow-2xs"
          >
            <span className="block text-sm">💦 WET FLOOR</span>
            <span className="text-[10px] text-amber-700 font-normal">Wetness 90% (Slip Hazard)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
