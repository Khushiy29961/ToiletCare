from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    PENDING = "Pending"
    ASSIGNED = "Assigned"
    IN_PROGRESS = "In Progress"
    RESOLVED = "Resolved"
    VERIFIED = "Verified"


class SimulationScenarioType(str, Enum):
    NORMAL = "NORMAL"
    SOAP_LOW = "SOAP_LOW"
    BIN_FULL = "BIN_FULL"
    NO_WATER = "NO_WATER"
    WET_FLOOR = "WET_FLOOR"


class Toilet(BaseModel):
    id: str
    location: str
    score: int
    status: str
    water: bool
    soap: bool
    bin: int
    priority: str
    action: str
    service_zone: Optional[str] = "Zone-1 (Central)"
    is_demo: Optional[bool] = True
    data_source: Optional[str] = "demo_seed"
    source_url: Optional[str] = None
    verification_status: Optional[str] = "unverified"
    last_verified: Optional[str] = None


class Report(BaseModel):
    id: Optional[int] = None
    toilet_id: str
    issue_type: str
    description: str
    status: Optional[str] = "Pending"
    task_id: Optional[str] = None
    created_at: Optional[str] = None


class MaintenanceTask(BaseModel):
    task_id: str
    toilet_id: str
    issue_type: str
    priority: str
    action: str
    status: str = "Pending"
    assigned_worker_id: Optional[str] = None
    report_id: Optional[int] = None
    resolution_notes: Optional[str] = None
    verified_by: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    resolved_at: Optional[str] = None
    verified_at: Optional[str] = None


class Worker(BaseModel):
    id: str
    name: str
    role: str
    skills: List[str]
    service_zone: str
    is_available: bool = True
    active_tasks: int = 0
    is_demo: bool = True
    data_source: str = "synthetic_demo"


class WorkerMatchCandidate(BaseModel):
    worker: Worker
    match_score: float
    skill_matched: bool
    zone_matched: bool
    workload_penalty: int
    recommendation_reason: str


class TaskAssignRequest(BaseModel):
    worker_id: str


class TaskStatusUpdateRequest(BaseModel):
    status: TaskStatus
    notes: Optional[str] = None
    officer_id: Optional[str] = None


class TelemetryInput(BaseModel):
    toilet_id: str
    water_level: int = Field(ge=0, le=100, description="Water level percentage (0-100%)")
    soap_level: int = Field(ge=0, le=100, description="Soap level percentage (0-100%)")
    bin_fill: int = Field(ge=0, le=100, description="Bin fill percentage (0-100%)")
    wetness: float = Field(default=0.0, ge=0.0, le=100.0, description="Floor wetness percentage (0-100%)")
    occupancy: Optional[int] = Field(default=0, ge=0, description="Hourly occupancy count")
    data_source: Optional[str] = "simulator"


class TelemetryRecord(BaseModel):
    id: int
    toilet_id: str
    water_level: int
    soap_level: int
    bin_fill: int
    wetness: float
    occupancy: int
    data_source: str
    recorded_at: str


class SimulationScenarioRequest(BaseModel):
    toilet_id: str
    scenario: SimulationScenarioType


# ==========================================
# Phase 5: AI Operations Schemas
# ==========================================

class IssueClassificationRequest(BaseModel):
    description: str
    toilet_id: Optional[str] = None


class IssueClassificationResponse(BaseModel):
    issue_type: str
    severity: str
    reasoning: str
    suggested_action: str
    confidence: float
    engine_mode: str
    is_valid_category: bool


class CopilotQueryRequest(BaseModel):
    query: str
    toilet_id: Optional[str] = None
    task_id: Optional[str] = None


class CopilotQueryResponse(BaseModel):
    response: str
    tools_executed: List[str]
    data_sources: List[str]
    engine_mode: str
    suggested_actions: Optional[List[Dict[str, Any]]] = None


class TaskExplanationResponse(BaseModel):
    task_id: str
    explanation: str
    top_worker_id: Optional[str] = None
    match_score: Optional[float] = None
    decision_factors: List[str]
    engine_mode: str
