from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

try:
    from backend.database import init_db
    from backend.models import (
        Toilet,
        Report,
        MaintenanceTask,
        Worker,
        WorkerMatchCandidate,
        TaskAssignRequest,
        TaskStatusUpdateRequest,
        TelemetryInput,
        TelemetryRecord,
        SimulationScenarioRequest,
        IssueClassificationRequest,
        IssueClassificationResponse,
        CopilotQueryRequest,
        CopilotQueryResponse,
        TaskExplanationResponse,
    )
    from backend.services.health import calculate_health_score, determine_priority_and_action
    from backend.services.matching import match_workers_for_task
    from backend.services.telemetry import process_telemetry_packet, SCENARIOS
    from backend.services.ai import (
        classify_citizen_issue,
        ask_copilot,
        explain_task_recommendation,
    )
    from backend.repository import (
        get_all_toilets,
        get_toilet_by_id,
        create_report_with_auto_task,
        get_all_reports,
        insert_maintenance_task,
        get_all_maintenance_tasks,
        get_maintenance_task_by_id,
        get_all_workers,
        get_worker_by_id,
        assign_task_to_worker,
        update_task_status,
        get_latest_telemetry_for_all_toilets,
        get_latest_telemetry_for_toilet,
    )
except ImportError:
    from database import init_db
    from models import (
        Toilet,
        Report,
        MaintenanceTask,
        Worker,
        WorkerMatchCandidate,
        TaskAssignRequest,
        TaskStatusUpdateRequest,
        TelemetryInput,
        TelemetryRecord,
        SimulationScenarioRequest,
        IssueClassificationRequest,
        IssueClassificationResponse,
        CopilotQueryRequest,
        CopilotQueryResponse,
        TaskExplanationResponse,
    )
    from services.health import calculate_health_score, determine_priority_and_action
    from services.matching import match_workers_for_task
    from services.telemetry import process_telemetry_packet, SCENARIOS
    from services.ai import (
        classify_citizen_issue,
        ask_copilot,
        explain_task_recommendation,
    )
    from repository import (
        get_all_toilets,
        get_toilet_by_id,
        create_report_with_auto_task,
        get_all_reports,
        insert_maintenance_task,
        get_all_maintenance_tasks,
        get_maintenance_task_by_id,
        get_all_workers,
        get_worker_by_id,
        assign_task_to_worker,
        update_task_status,
        get_latest_telemetry_for_all_toilets,
        get_latest_telemetry_for_toilet,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and ensure tables/columns/demo data
    init_db()
    yield


app = FastAPI(title="ToiletCare API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "ToiletCare API is running",
        "status": "healthy",
    }


# ==========================================
# 1. Toilet Network Endpoints
# ==========================================

@app.get("/api/toilets", response_model=List[Toilet])
def get_toilets():
    raw_toilets = get_all_toilets()
    updated_toilets = []

    for toilet in raw_toilets:
        score, status = calculate_health_score(
            toilet["water"],
            toilet["soap"],
            toilet["bin"],
        )

        priority, action = determine_priority_and_action(
            toilet["water"],
            toilet["soap"],
            toilet["bin"],
        )

        updated_toilets.append({
            **toilet,
            "score": score,
            "status": status,
            "priority": priority,
            "action": action,
        })

    return updated_toilets


@app.get("/api/toilets/{toilet_id}")
def get_toilet(toilet_id: str):
    toilet = get_toilet_by_id(toilet_id)
    if not toilet:
        raise HTTPException(status_code=404, detail=f"Toilet with ID '{toilet_id}' not found.")

    score, status = calculate_health_score(toilet["water"], toilet["soap"], toilet["bin"])
    priority, action = determine_priority_and_action(toilet["water"], toilet["soap"], toilet["bin"])

    return {
        **toilet,
        "score": score,
        "status": status,
        "priority": priority,
        "action": action,
    }


# ==========================================
# 2. Citizen Reports Endpoints
# ==========================================

@app.post("/api/reports")
def create_report(report: Report):
    # Validate toilet exists
    toilet = get_toilet_by_id(report.toilet_id)
    if not toilet:
        raise HTTPException(status_code=404, detail=f"Toilet '{report.toilet_id}' does not exist.")

    result = create_report_with_auto_task(report)

    return {
        "message": "Report received successfully",
        "report": result["report"],
        "task": result["task"],
        "is_new_task": result["is_new_task"],
    }


@app.get("/api/reports")
def get_reports():
    return get_all_reports()


# ==========================================
# 3. Maintenance Tasks Endpoints
# ==========================================

@app.get("/api/tasks")
def get_tasks(
    status: Optional[str] = Query(None, description="Filter by task status (Pending, Assigned, In Progress, Resolved, Verified)"),
    toilet_id: Optional[str] = Query(None, description="Filter by toilet ID"),
):
    return get_all_maintenance_tasks(status=status, toilet_id=toilet_id)


@app.get("/api/tasks/{task_id}")
def get_task(task_id: str):
    task = get_maintenance_task_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")
    return task


@app.post("/api/tasks")
def create_task(task: MaintenanceTask):
    saved_task = insert_maintenance_task(task)
    return {
        "message": "Maintenance task created successfully",
        "task": saved_task,
    }


@app.patch("/api/tasks/{task_id}/assign")
def assign_task(task_id: str, request: TaskAssignRequest):
    worker = get_worker_by_id(request.worker_id)
    if not worker:
        raise HTTPException(status_code=404, detail=f"Worker '{request.worker_id}' not found.")
    if not worker["is_available"]:
        raise HTTPException(status_code=400, detail=f"Worker '{worker['name']}' is currently marked unavailable.")

    updated_task = assign_task_to_worker(task_id, request.worker_id)
    if not updated_task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")

    return {
        "message": f"Task '{task_id}' assigned to {worker['name']}",
        "task": updated_task,
    }


@app.patch("/api/tasks/{task_id}/status")
def update_task_lifecycle(task_id: str, request: TaskStatusUpdateRequest):
    task = get_maintenance_task_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")

    updated_task = update_task_status(
        task_id=task_id,
        new_status=request.status.value,
        notes=request.notes,
        officer_id=request.officer_id,
    )

    toilet = get_toilet_by_id(updated_task["toilet_id"])
    score, status = calculate_health_score(toilet["water"], toilet["soap"], toilet["bin"])
    priority, action = determine_priority_and_action(toilet["water"], toilet["soap"], toilet["bin"])

    return {
        "message": f"Task status updated to '{request.status.value}'",
        "task": updated_task,
        "toilet_health": {
            "toilet_id": toilet["id"],
            "score": score,
            "status": status,
            "priority": priority,
            "action": action,
        },
    }


# ==========================================
# 4. Worker Management & Matching Endpoints
# ==========================================

@app.get("/api/workers", response_model=List[Worker])
def get_workers():
    return get_all_workers()


@app.get("/api/workers/match", response_model=List[WorkerMatchCandidate])
def match_workers(
    task_id: Optional[str] = Query(None, description="Task ID to find candidate workers for"),
    toilet_id: Optional[str] = Query(None, description="Toilet ID for zone context"),
    issue_type: Optional[str] = Query(None, description="Issue type (e.g. No Water, No Soap, Bin Full)"),
):
    workers = get_all_workers()
    target_issue = issue_type or "General"
    target_zone = "Zone-1 (Central)"
    target_priority = "Medium"

    if task_id:
        task = get_maintenance_task_by_id(task_id)
        if not task:
            raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")
        target_issue = task["issue_type"]
        target_priority = task["priority"]
        toilet = get_toilet_by_id(task["toilet_id"])
        if toilet:
            target_zone = toilet.get("service_zone", "Zone-1 (Central)")
    elif toilet_id:
        toilet = get_toilet_by_id(toilet_id)
        if toilet:
            target_zone = toilet.get("service_zone", "Zone-1 (Central)")

    return match_workers_for_task(
        workers=workers,
        issue_type=target_issue,
        toilet_zone=target_zone,
        priority=target_priority,
    )


# ==========================================
# 5. IoT Sensor Telemetry & Simulation Endpoints
# ==========================================

@app.post("/api/telemetry")
def ingest_telemetry(telemetry: TelemetryInput):
    toilet = get_toilet_by_id(telemetry.toilet_id)
    if not toilet:
        raise HTTPException(status_code=404, detail=f"Toilet '{telemetry.toilet_id}' not found.")

    result = process_telemetry_packet(telemetry)
    return result


@app.get("/api/telemetry", response_model=List[TelemetryRecord])
def get_all_latest_telemetry():
    return get_latest_telemetry_for_all_toilets()


@app.get("/api/telemetry/{toilet_id}", response_model=TelemetryRecord)
def get_toilet_latest_telemetry(toilet_id: str):
    record = get_latest_telemetry_for_toilet(toilet_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"No telemetry found for toilet '{toilet_id}'.")
    return record


@app.post("/api/telemetry/simulate")
def simulate_sensor_scenario(request: SimulationScenarioRequest):
    toilet = get_toilet_by_id(request.toilet_id)
    if not toilet:
        raise HTTPException(status_code=404, detail=f"Toilet '{request.toilet_id}' not found.")

    scenario_name = request.scenario.value
    scenario_data = SCENARIOS.get(scenario_name)
    if not scenario_data:
        raise HTTPException(status_code=400, detail=f"Unknown scenario '{scenario_name}'.")

    telemetry_input = TelemetryInput(
        toilet_id=request.toilet_id,
        water_level=scenario_data["water_level"],
        soap_level=scenario_data["soap_level"],
        bin_fill=scenario_data["bin_fill"],
        wetness=scenario_data["wetness"],
        occupancy=scenario_data["occupancy"],
        data_source="simulator",
    )

    result = process_telemetry_packet(telemetry_input)
    return {
        "message": f"Simulated '{scenario_name}' condition for {request.toilet_id}",
        "scenario": scenario_name,
        "result": result,
    }


# ==========================================
# 6. AI Operations Layer Endpoints
# ==========================================

@app.post("/api/ai/classify-issue", response_model=IssueClassificationResponse)
def classify_issue_endpoint(request: IssueClassificationRequest):
    if not request.description.strip():
        raise HTTPException(status_code=400, detail="Grievance description cannot be empty.")
    return classify_citizen_issue(request.description, request.toilet_id)


@app.post("/api/ai/copilot", response_model=CopilotQueryResponse)
def copilot_endpoint(request: CopilotQueryRequest):
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Copilot query cannot be empty.")
    return ask_copilot(request.query, request.toilet_id, request.task_id)


@app.get("/api/ai/explain-task/{task_id}", response_model=TaskExplanationResponse)
def explain_task_endpoint(task_id: str):
    return explain_task_recommendation(task_id)