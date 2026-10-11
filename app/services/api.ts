import {
  Toilet,
  Report,
  MaintenanceTask,
  Worker,
  WorkerMatchCandidate,
  TaskStatus,
  TelemetryRecord,
  TelemetryResponse,
  SimulationScenario,
  IssueClassificationResult,
  CopilotResponse,
  TaskExplanationResult,
} from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || errorData.message || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Toilets
  async getToilets(): Promise<Toilet[]> {
    const res = await fetch(`${API_BASE}/api/toilets`, { cache: 'no-store' });
    return handleResponse<Toilet[]>(res);
  },

  async getToilet(id: string): Promise<Toilet> {
    const res = await fetch(`${API_BASE}/api/toilets/${id}`, { cache: 'no-store' });
    return handleResponse<Toilet>(res);
  },

  // Reports
  async getReports(): Promise<Report[]> {
    const res = await fetch(`${API_BASE}/api/reports`, { cache: 'no-store' });
    return handleResponse<Report[]>(res);
  },

  async submitReport(data: { toilet_id: string; issue_type: string; description: string }): Promise<{
    message: string;
    report: Report;
    task: MaintenanceTask;
    is_new_task: boolean;
  }> {
    const res = await fetch(`${API_BASE}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  // Tasks
  async getTasks(status?: string, toiletId?: string): Promise<MaintenanceTask[]> {
    const params = new URLSearchParams();
    if (status && status !== 'All') params.append('status', status);
    if (toiletId) params.append('toilet_id', toiletId);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/api/tasks${query}`, { cache: 'no-store' });
    return handleResponse<MaintenanceTask[]>(res);
  },

  async getTask(taskId: string): Promise<MaintenanceTask> {
    const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, { cache: 'no-store' });
    return handleResponse<MaintenanceTask>(res);
  },

  async assignTask(taskId: string, workerId: string): Promise<{ message: string; task: MaintenanceTask }> {
    const res = await fetch(`${API_BASE}/api/tasks/${taskId}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worker_id: workerId }),
    });
    return handleResponse(res);
  },

  async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    notes?: string,
    officerId?: string
  ): Promise<{ message: string; task: MaintenanceTask; toilet_health?: any }> {
    const res = await fetch(`${API_BASE}/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes, officer_id: officerId }),
    });
    return handleResponse(res);
  },

  // Workers
  async getWorkers(): Promise<Worker[]> {
    const res = await fetch(`${API_BASE}/api/workers`, { cache: 'no-store' });
    return handleResponse<Worker[]>(res);
  },

  async matchWorkers(taskId?: string, toiletId?: string, issueType?: string): Promise<WorkerMatchCandidate[]> {
    const params = new URLSearchParams();
    if (taskId) params.append('task_id', taskId);
    if (toiletId) params.append('toilet_id', toiletId);
    if (issueType) params.append('issue_type', issueType);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/api/workers/match${query}`, { cache: 'no-store' });
    return handleResponse<WorkerMatchCandidate[]>(res);
  },

  // IoT Sensor Telemetry & Simulation
  async getLatestTelemetry(): Promise<TelemetryRecord[]> {
    const res = await fetch(`${API_BASE}/api/telemetry`, { cache: 'no-store' });
    return handleResponse<TelemetryRecord[]>(res);
  },

  async getToiletTelemetry(toiletId: string): Promise<TelemetryRecord> {
    const res = await fetch(`${API_BASE}/api/telemetry/${toiletId}`, { cache: 'no-store' });
    return handleResponse<TelemetryRecord>(res);
  },

  async sendTelemetry(data: {
    toilet_id: string;
    water_level: number;
    soap_level: number;
    bin_fill: number;
    wetness: number;
    occupancy?: number;
    data_source?: string;
  }): Promise<TelemetryResponse> {
    const res = await fetch(`${API_BASE}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<TelemetryResponse>(res);
  },

  async simulateScenario(
    toiletId: string,
    scenario: SimulationScenario
  ): Promise<{ message: string; scenario: string; result: TelemetryResponse }> {
    const res = await fetch(`${API_BASE}/api/telemetry/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toilet_id: toiletId, scenario }),
    });
    return handleResponse(res);
  },

  // Phase 5: AI Operations Layer
  async classifyIssue(
    description: string,
    toiletId?: string
  ): Promise<IssueClassificationResult> {
    const res = await fetch(`${API_BASE}/api/ai/classify-issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, toilet_id: toiletId }),
    });
    return handleResponse<IssueClassificationResult>(res);
  },

  async askCopilot(
    query: string,
    toiletId?: string,
    taskId?: string
  ): Promise<CopilotResponse> {
    const res = await fetch(`${API_BASE}/api/ai/copilot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, toilet_id: toiletId, task_id: taskId }),
    });
    return handleResponse<CopilotResponse>(res);
  },

  async explainTask(taskId: string): Promise<TaskExplanationResult> {
    const res = await fetch(`${API_BASE}/api/ai/explain-task/${taskId}`, { cache: 'no-store' });
    return handleResponse<TaskExplanationResult>(res);
  },
};
