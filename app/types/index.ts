export type TaskStatus = 'Pending' | 'Assigned' | 'In Progress' | 'Resolved' | 'Verified';

export type SimulationScenario = 'NORMAL' | 'SOAP_LOW' | 'BIN_FULL' | 'NO_WATER' | 'WET_FLOOR';

export interface Toilet {
  id: string;
  location: string;
  score: number;
  status: 'Healthy' | 'Attention' | 'Critical' | string;
  water: boolean;
  soap: boolean;
  bin: number;
  priority: 'Critical' | 'High' | 'Medium' | 'Low' | string;
  action: string;
  service_zone?: string;
  is_demo?: boolean;
  data_source?: string;
  source_url?: string | null;
  verification_status?: string;
  last_verified?: string | null;
}

export interface Report {
  id: number;
  toilet_id: string;
  issue_type: string;
  description: string;
  status?: string;
  task_id?: string | null;
  created_at?: string;
}

export interface MaintenanceTask {
  task_id: string;
  toilet_id: string;
  report_id?: number | null;
  issue_type: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low' | string;
  action: string;
  status: TaskStatus;
  assigned_worker_id?: string | null;
  resolution_notes?: string | null;
  verified_by?: string | null;
  created_at?: string;
  updated_at?: string;
  resolved_at?: string | null;
  verified_at?: string | null;
}

export interface Worker {
  id: string;
  name: string;
  role: string;
  skills: string[];
  service_zone: string;
  is_available: boolean;
  active_tasks: number;
  is_demo: boolean;
  data_source: string;
}

export interface WorkerMatchCandidate {
  worker: Worker;
  match_score: number;
  skill_matched: boolean;
  zone_matched: boolean;
  workload_penalty: number;
  recommendation_reason: string;
}

export interface TelemetryRecord {
  id: number;
  toilet_id: string;
  water_level: number;
  soap_level: number;
  bin_fill: number;
  wetness: number;
  occupancy: number;
  data_source: string;
  recorded_at: string;
}

export interface TelemetryResponse {
  telemetry: TelemetryRecord;
  toilet_health: {
    toilet_id: string;
    score: number;
    status: string;
    priority: string;
    action: string;
    water: boolean;
    soap: boolean;
    bin: number;
  };
  issue_detected: string | null;
  task: MaintenanceTask | null;
  is_new_task: boolean;
  action_taken: string;
}

export interface IssueClassificationResult {
  issue_type: string;
  severity: string;
  reasoning: string;
  suggested_action: string;
  confidence: number;
  engine_mode: string;
  is_valid_category: boolean;
}

export interface CopilotResponse {
  response: string;
  tools_executed: string[];
  data_sources: string[];
  engine_mode: string;
  suggested_actions?: Array<{ label: string; toilet_id?: string; task_id?: string; worker_id?: string }>;
}

export interface TaskExplanationResult {
  task_id: string;
  explanation: string;
  top_worker_id?: string | null;
  match_score?: number | null;
  decision_factors: string[];
  engine_mode: string;
}

export type UserRole = 'citizen' | 'officer' | 'worker';
