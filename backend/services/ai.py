import os
import json
import re
import urllib.request
from typing import Dict, Any, List, Optional, Tuple

try:
    from backend.models import (
        IssueClassificationResponse,
        CopilotQueryResponse,
        TaskExplanationResponse,
        TelemetryInput,
    )
    from backend.services.health import calculate_health_score, determine_priority_and_action
    from backend.services.matching import match_workers_for_task
    from backend.repository import (
        get_all_toilets,
        get_toilet_by_id,
        get_all_maintenance_tasks,
        get_maintenance_task_by_id,
        get_all_reports,
        get_all_workers,
        get_latest_telemetry_for_toilet,
        get_latest_telemetry_for_all_toilets,
    )
except ImportError:
    from models import (
        IssueClassificationResponse,
        CopilotQueryResponse,
        TaskExplanationResponse,
        TelemetryInput,
    )
    from services.health import calculate_health_score, determine_priority_and_action
    from services.matching import match_workers_for_task
    from repository import (
        get_all_toilets,
        get_toilet_by_id,
        get_all_maintenance_tasks,
        get_maintenance_task_by_id,
        get_all_reports,
        get_all_workers,
        get_latest_telemetry_for_toilet,
        get_latest_telemetry_for_all_toilets,
    )

VALID_ISSUE_CATEGORIES = [
    "No Water",
    "No Soap",
    "Bin Full",
    "Wet Floor",
    "Dirty Toilet",
    "Broken Fixture",
    "Electrical",
    "Other",
]


# =========================================================
# Read-Only Grounded Tools
# =========================================================

def tool_get_facilities_summary() -> Dict[str, Any]:
    """Retrieves real-time status, health scores, and operational issues for all toilets."""
    raw = get_all_toilets()
    summary = []
    healthy, attention, critical = 0, 0, 0

    for t in raw:
        score, status = calculate_health_score(t["water"], t["soap"], t["bin"])
        priority, action = determine_priority_and_action(t["water"], t["soap"], t["bin"])

        if status == "Healthy":
            healthy += 1
        elif status == "Attention":
            attention += 1
        else:
            critical += 1

        summary.append({
            "id": t["id"],
            "location": t["location"],
            "zone": t["service_zone"],
            "health_score": score,
            "status": status,
            "water_available": t["water"],
            "soap_available": t["soap"],
            "bin_fill_percent": t["bin"],
            "priority": priority,
            "recommended_action": action,
        })

    return {
        "total_facilities": len(summary),
        "counts": {"healthy": healthy, "attention": attention, "critical": critical},
        "facilities": summary,
    }


def tool_get_maintenance_tasks(status: Optional[str] = None, toilet_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieves maintenance tasks filtered by lifecycle status or facility."""
    return get_all_maintenance_tasks(status=status, toilet_id=toilet_id)


def tool_get_available_workers() -> List[Dict[str, Any]]:
    """Retrieves active synthetic workers who are currently available for dispatch."""
    all_workers = get_all_workers()
    return [w for w in all_workers if w["is_available"]]


def tool_get_facility_audit_trail(toilet_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves comprehensive operational trail: current telemetry, recent reports, and task history for a toilet."""
    toilet = get_toilet_by_id(toilet_id)
    if not toilet:
        return None

    score, status = calculate_health_score(toilet["water"], toilet["soap"], toilet["bin"])
    priority, action = determine_priority_and_action(toilet["water"], toilet["soap"], toilet["bin"])

    telemetry = get_latest_telemetry_for_toilet(toilet_id)
    tasks = get_all_maintenance_tasks(toilet_id=toilet_id)
    all_reports = get_all_reports()
    toilet_reports = [r for r in all_reports if r["toilet_id"] == toilet_id]

    return {
        "facility": {
            "id": toilet["id"],
            "location": toilet["location"],
            "zone": toilet["service_zone"],
            "health_score": score,
            "status": status,
            "priority": priority,
            "action": action,
            "water": toilet["water"],
            "soap": toilet["soap"],
            "bin": toilet["bin"],
        },
        "latest_telemetry": telemetry,
        "recent_reports": toilet_reports[:5],
        "tasks": tasks,
    }


def tool_explain_worker_dispatch(task_id: str) -> Optional[Dict[str, Any]]:
    """Evaluates candidates for a task and returns deterministic ranking with transparent explanations."""
    task = get_maintenance_task_by_id(task_id)
    if not task:
        return None

    toilet = get_toilet_by_id(task["toilet_id"])
    target_zone = toilet.get("service_zone", "Zone-1 (Central)") if toilet else "Zone-1 (Central)"
    workers = get_all_workers()

    candidates = match_workers_for_task(
        workers=workers,
        issue_type=task["issue_type"],
        toilet_zone=target_zone,
        priority=task["priority"],
    )

    return {
        "task": task,
        "target_facility": toilet,
        "ranked_candidates": [
            {
                "worker_id": c.worker.id,
                "name": c.worker.name,
                "role": c.worker.role,
                "match_score": c.match_score,
                "skill_matched": c.skill_matched,
                "zone_matched": c.zone_matched,
                "active_tasks": c.worker.active_tasks,
                "reason": c.recommendation_reason,
            }
            for c in candidates
        ],
    }


# =========================================================
# Natural Language Issue Classifier
# =========================================================

def _deterministic_issue_classifier(description: str) -> Tuple[str, str, str, str, float]:
    """
    Deterministic semantic intent parser for citizen grievances.
    Returns (issue_type, severity, reasoning, suggested_action, confidence).
    """
    desc = description.lower()

    # Pattern matching for 7 core categories
    if any(k in desc for k in ["no water", "tap dry", "taps dry", "water not coming", "water supply", "pipe leak", "pipe burst", "dripping tap", "tap broken", "low water"]):
        return (
            "No Water",
            "Critical",
            "Detected water supply disruption or broken plumbing fixture causing water unavailability.",
            "Restore water supply",
            0.95,
        )

    if any(k in desc for k in ["no soap", "soap empty", "dispenser empty", "no handwash", "refill soap", "soap dispenser broken", "soap dry"]):
        return (
            "No Soap",
            "Medium",
            "Detected lack of hand hygiene supplies or empty soap dispenser.",
            "Refill soap",
            0.92,
        )

    if any(k in desc for k in ["bin full", "dustbin", "trash", "garbage", "overflowing bin", "waste bin", "litter", "waste piled"]):
        return (
            "Bin Full",
            "High",
            "Detected overflowing waste receptacle or uncollected sanitary waste.",
            "Empty waste bin",
            0.94,
        )

    if any(k in desc for k in ["wet floor", "slippery", "water on floor", "puddle", "standing water", "flooded floor", "skid"]):
        return (
            "Wet Floor",
            "Medium",
            "Detected floor moisture hazard with potential slipping risk.",
            "Mop and sanitize wet floor",
            0.90,
        )

    if any(k in desc for k in ["dirty", "filthy", "smell", "foul odor", "stain", "unhygienic", "poop", "urine", "not cleaned"]):
        return (
            "Dirty Toilet",
            "Medium",
            "Detected hygiene, odor, or general cleanliness issues requiring deep sanitization.",
            "Deep clean sanitation",
            0.88,
        )

    if any(k in desc for k in ["broken fixture", "door broken", "lock broken", "latch broken", "flush broken", "toilet seat broken", "commode damaged", "hinge", "door jammed"]):
        return (
            "Broken Fixture",
            "High",
            "Detected structural or hardware damage to toilet cabin fixtures.",
            "Repair broken fixture",
            0.89,
        )

    if any(k in desc for k in ["light", "dark", "bulb", "fan", "electricity", "wiring", "switch", "exhaust"]):
        return (
            "Electrical",
            "Medium",
            "Detected lighting, electrical, or ventilation malfunction.",
            "Fix lighting and electrical",
            0.87,
        )

    # Ambiguous or out-of-domain
    return (
        "Other",
        "Low",
        "Description is ambiguous or lacks specific operational keywords. Needs manual review.",
        "Inspect facility and verify condition",
        0.35,
    )


def classify_citizen_issue(description: str, toilet_id: Optional[str] = None) -> IssueClassificationResponse:
    """
    Classifies citizen free-text grievances into structured issue parameters.
    Uses Gemini API if configured, with automatic fallback to deterministic semantic parsing.
    """
    api_key = os.environ.get("GEMINI_API_KEY")

    if api_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
            prompt = (
                f"You are the ToiletCare Grievance Classifier. Classify the following citizen report into EXACTLY one of these categories: "
                f"{', '.join(VALID_ISSUE_CATEGORIES)}.\n\n"
                f"User Description: \"{description}\"\n\n"
                f"Respond with JSON ONLY in this format:\n"
                f"{{\n"
                f"  \"issue_type\": \"<one of the categories>\",\n"
                f"  \"severity\": \"Critical\" | \"High\" | \"Medium\" | \"Low\",\n"
                f"  \"reasoning\": \"<short explanation>\",\n"
                f"  \"suggested_action\": \"<action>\",\n"
                f"  \"confidence\": <number between 0.0 and 1.0>\n"
                f"}}"
            )
            payload = {"contents": [{"parts": [{"text": prompt}]}]}
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                result = json.loads(response.read().decode("utf-8"))
                text = result["candidates"][0]["content"]["parts"][0]["text"]
                # Clean JSON block
                clean_json = re.search(r"\{.*\}", text, re.DOTALL)
                if clean_json:
                    parsed = json.loads(clean_json.group(0))
                    category = parsed.get("issue_type")
                    if category in VALID_ISSUE_CATEGORIES and category != "Other":
                        return IssueClassificationResponse(
                            issue_type=category,
                            severity=parsed.get("severity", "Medium"),
                            reasoning=parsed.get("reasoning", "AI classification from user grievance text."),
                            suggested_action=parsed.get("suggested_action", "Inspect and resolve issue"),
                            confidence=float(parsed.get("confidence", 0.9)),
                            engine_mode="Google Gemini AI",
                            is_valid_category=True,
                        )
        except Exception:
            pass  # Fall through to deterministic fallback

    # Deterministic fallback engine
    issue_type, severity, reasoning, action, conf = _deterministic_issue_classifier(description)
    return IssueClassificationResponse(
        issue_type=issue_type,
        severity=severity,
        reasoning=reasoning,
        suggested_action=action,
        confidence=conf,
        engine_mode="ToiletCare Operations Engine (Deterministic Fallback)",
        is_valid_category=issue_type in VALID_ISSUE_CATEGORIES,
    )


# =========================================================
# Officer AI Operations Copilot
# =========================================================

def ask_copilot(query: str, toilet_id: Optional[str] = None, task_id: Optional[str] = None) -> CopilotQueryResponse:
    """
    Grounded Officer AI Operations Copilot.
    Executes actual backend query tools and synthesizes fact-checked answers without hallucinating data.
    """
    q = query.lower()
    tools_called = []
    data_sources = []
    engine_mode = "ToiletCare Operations Engine"
    suggested_actions = []

    # 1. Check for Facility Status / Attention / Critical Queries
    if any(k in q for k in ["which toilets", "which facility", "need attention", "needs attention", "critical toilet", "unhealthy", "highest priority", "overview", "status of toilets"]):
        tools_called.append("tool_get_facilities_summary")
        data_sources.append("SQLite: toilets, health_score_engine")

        summary = tool_get_facilities_summary()
        critical_toilets = [f for f in summary["facilities"] if f["status"] == "Critical"]
        attention_toilets = [f for f in summary["facilities"] if f["status"] == "Attention"]
        healthy_toilets = [f for f in summary["facilities"] if f["status"] == "Healthy"]

        response_lines = [
            f"### 🚽 Facility Health Network Overview ({summary['total_facilities']} Toilets Monitored)",
            f"- **Healthy (Score ≥ 70)**: {len(healthy_toilets)} facilities",
            f"- **Attention (Score 40–69)**: {len(attention_toilets)} facilities",
            f"- **Critical (Score < 40)**: {len(critical_toilets)} facilities\n",
        ]

        if critical_toilets:
            response_lines.append("#### 🚨 Critical Facilities Requiring Immediate Action:")
            for t in critical_toilets:
                response_lines.append(
                    f"* **{t['id']} ({t['location']})**: Health Score **{t['health_score']}/100** | "
                    f"Water: {'Available' if t['water_available'] else '🚫 Low/Dry'} | "
                    f"Bin: {t['bin_fill_percent']}% | Action: **{t['recommended_action']}**"
                )
                suggested_actions.append({"label": f"Inspect {t['id']}", "toilet_id": t["id"]})

        if attention_toilets:
            response_lines.append("\n#### ⚠️ Facilities Needing Attention:")
            for t in attention_toilets:
                response_lines.append(
                    f"* **{t['id']} ({t['location']})**: Health Score **{t['health_score']}/100** | "
                    f"Soap: {'Available' if t['soap_available'] else '🚫 Empty'} | "
                    f"Bin: {t['bin_fill_percent']}% | Action: **{t['recommended_action']}**"
                )

        if not critical_toilets and not attention_toilets:
            response_lines.append("All monitored public toilets are currently in **Healthy** condition (100% operational).")

        return CopilotQueryResponse(
            response="\n".join(response_lines),
            tools_executed=tools_called,
            data_sources=data_sources,
            engine_mode=engine_mode,
            suggested_actions=suggested_actions,
        )

    # 2. Check for Unresolved / Maintenance Task Queries
    if any(k in q for k in ["unresolved", "pending task", "open task", "active task", "tasks", "work orders", "assigned tasks"]):
        tools_called.append("tool_get_maintenance_tasks")
        data_sources.append("SQLite: maintenance_tasks")

        all_tasks = tool_get_maintenance_tasks()
        unresolved = [t for t in all_tasks if t["status"] in ("Pending", "Assigned", "In Progress")]
        resolved_needing_verify = [t for t in all_tasks if t["status"] == "Resolved"]

        response_lines = [
            f"### 📋 Active Maintenance Operations Queue",
            f"Currently **{len(unresolved)}** unresolved tasks in progress and **{len(resolved_needing_verify)}** tasks awaiting officer verification.\n",
        ]

        if unresolved:
            response_lines.append("#### 🛠️ Unresolved Tasks:")
            for t in unresolved:
                response_lines.append(
                    f"* **{t['task_id']}** ({t['issue_type']} at {t['toilet_id']}): "
                    f"Status: `{t['status']}` | Priority: **{t['priority']}** | "
                    f"Worker: {t['assigned_worker_id'] or 'Unassigned'} | Action: {t['action']}"
                )
                if t["status"] == "Pending":
                    suggested_actions.append({"label": f"Match Worker for {t['task_id']}", "task_id": t["task_id"]})

        if resolved_needing_verify:
            response_lines.append("\n#### 🔍 Tasks Ready for Inspection & Verification:")
            for t in resolved_needing_verify:
                response_lines.append(
                    f"* **{t['task_id']}** at {t['toilet_id']}: Notes: *\"{t['resolution_notes'] or 'Work completed'}\"*"
                )

        if not unresolved and not resolved_needing_verify:
            response_lines.append("There are no active or unresolved maintenance tasks at this time.")

        return CopilotQueryResponse(
            response="\n".join(response_lines),
            tools_executed=tools_called,
            data_sources=data_sources,
            engine_mode=engine_mode,
            suggested_actions=suggested_actions,
        )

    # 3. Check for Worker Availability Queries
    if any(k in q for k in ["which workers", "available workers", "worker list", "workers", "plumber", "sanitation worker", "technician"]):
        tools_called.append("tool_get_available_workers")
        data_sources.append("SQLite: workers (synthetic demo roster)")

        workers = tool_get_available_workers()
        response_lines = [
            f"### 👷 Available Field Technicians ({len(workers)} On-Duty)",
            "Worker roster is actively synchronized with skill profiles, service zones, and live workload:\n",
        ]

        for w in workers:
            response_lines.append(
                f"* **{w['name']}** (`{w['id']}`): {w['role']} in **{w['service_zone']}** | "
                f"Active Workload: **{w['active_tasks']} tasks** | Skills: *{', '.join(w['skills'])}*"
            )

        return CopilotQueryResponse(
            response="\n".join(response_lines),
            tools_executed=tools_called,
            data_sources=data_sources,
            engine_mode=engine_mode,
            suggested_actions=[],
        )

    # 4. Check for Specific Facility History / Audit Trail (e.g. TC-001, TC-002, TC-003)
    toilet_match = re.search(r"tc-00[1-9]", q) or (toilet_id and re.search(r"tc-00[1-9]", toilet_id.lower()))
    if toilet_match or any(k in q for k in ["what happened at", "facility status", "toilet history", "tell me about"]):
        target_tid = toilet_match.group(0).upper() if toilet_match else (toilet_id or "TC-003")
        tools_called.append("tool_get_facility_audit_trail")
        data_sources.append(f"SQLite: toilets({target_tid}), sensor_telemetry, reports, maintenance_tasks")

        audit = tool_get_facility_audit_trail(target_tid)
        if not audit:
            return CopilotQueryResponse(
                response=f"Facility ID **{target_tid}** was not found in the ToiletCare database. Valid facilities in current pilot: TC-001, TC-002, TC-003.",
                tools_executed=tools_called,
                data_sources=data_sources,
                engine_mode=engine_mode,
            )

        f = audit["facility"]
        telem = audit["latest_telemetry"]
        reports = audit["recent_reports"]
        tasks = audit["tasks"]

        response_lines = [
            f"### 📍 Operational History & Status Report for {f['id']} ({f['location']})",
            f"* **Current Health Score**: **{f['health_score']}/100** (`{f['status']}`)",
            f"* **Service Zone**: {f['zone']}",
            f"* **Operating Conditions**: Water: {'💧 Available' if f['water'] else '🚫 Low/Dry'} | Soap: {'🧴 Available' if f['soap'] else '🚫 Empty'} | Bin: 🗑️ {f['bin']}%",
            f"* **Priority / Recommended Action**: {f['priority']} — *{f['action']}*\n",
        ]

        if telem:
            response_lines.append(f"**Latest Telemetry Packet**: Water: {telem['water_level']}%, Soap: {telem['soap_level']}%, Bin: {telem['bin_fill']}%, Wetness: {telem['wetness']}%, Source: {telem['data_source']}")

        if reports:
            response_lines.append(f"\n**Recent Citizen Grievances ({len(reports)})**:")
            for r in reports:
                response_lines.append(f"- *{r['issue_type']}* (Status: {r['status']}): \"{r['description']}\"")

        if tasks:
            response_lines.append(f"\n**Maintenance Tasks ({len(tasks)})**:")
            for t in tasks:
                response_lines.append(f"- **{t['task_id']}** ({t['issue_type']}): Status `{t['status']}` | Assigned: {t['assigned_worker_id'] or 'None'}")

        return CopilotQueryResponse(
            response="\n".join(response_lines),
            tools_executed=tools_called,
            data_sources=data_sources,
            engine_mode=engine_mode,
            suggested_actions=[{"label": f"View {f['id']} Telemetry", "toilet_id": f["id"]}],
        )

    # 5. Check for Worker Recommendation / Task Explanation Query (e.g. TASK-001, TASK-002)
    task_match = re.search(r"task-00[1-9]|task-[0-9]{3}", q) or (task_id and re.search(r"task-00[1-9]|task-[0-9]{3}", task_id.lower()))
    if task_match or any(k in q for k in ["who is recommended", "who is the best worker", "dispatch worker", "worker recommendation"]):
        target_task_id = task_match.group(0).upper() if task_match else (task_id or "TASK-001")
        tools_called.append("tool_explain_worker_dispatch")
        data_sources.append(f"SQLite: maintenance_tasks({target_task_id}), workers, matching_engine")

        dispatch = tool_explain_worker_dispatch(target_task_id)
        if not dispatch:
            return CopilotQueryResponse(
                response=f"Task **{target_task_id}** was not found in the operations database.",
                tools_executed=tools_called,
                data_sources=data_sources,
                engine_mode=engine_mode,
            )

        task = dispatch["task"]
        candidates = dispatch["ranked_candidates"]
        top = candidates[0] if candidates else None

        response_lines = [
            f"### 🎯 Worker Dispatch Recommendation for {task['task_id']}",
            f"* **Issue**: {task['issue_type']} at **{task['toilet_id']}**",
            f"* **Priority**: {task['priority']} | **Required Action**: {task['action']}\n",
        ]

        if top and top["match_score"] > 0:
            response_lines.append(
                f"#### ⭐ Top Recommended Worker: **{top['name']}** (`{top['worker_id']}`)\n"
                f"* **Match Score**: **{top['match_score']}%**\n"
                f"* **Role**: {top['role']}\n"
                f"* **Current Active Workload**: {top['active_tasks']} active tasks\n"
                f"* **Algorithmic Reason**: {top['reason']}\n"
            )

        response_lines.append("#### Ranked Alternative Candidates:")
        for c in candidates[1:4]:
            response_lines.append(f"- **{c['name']}** (`{c['worker_id']}`): {c['match_score']}% | {c['reason']}")

        return CopilotQueryResponse(
            response="\n".join(response_lines),
            tools_executed=tools_called,
            data_sources=data_sources,
            engine_mode=engine_mode,
            suggested_actions=[{"label": f"Assign {top['worker_id']}", "task_id": task['task_id'], "worker_id": top['worker_id']}] if top else [],
        )

    # 6. Fallback / Out of Domain Rejection
    return CopilotQueryResponse(
        response=(
            "I don't have enough data in the ToiletCare operations database to answer that.\n\n"
            "You can ask me about:\n"
            "* Facilities needing attention or critical status (e.g. *\"Which toilets need attention?\"*)\n"
            "* Active maintenance tasks (e.g. *\"Which tasks are unresolved?\"*)\n"
            "* Available workers and workload (e.g. *\"Which workers are available?\"*)\n"
            "* Specific facility operational history (e.g. *\"What happened at TC-003?\"*)\n"
            "* Algorithmic worker dispatch recommendations (e.g. *\"Who is recommended for TASK-001?\"*)"
        ),
        tools_executed=[],
        data_sources=[],
        engine_mode="ToiletCare Operations Engine (Grounded Guardrail)",
        suggested_actions=[],
    )


def explain_task_recommendation(task_id: str) -> TaskExplanationResponse:
    """Explains deterministic worker recommendation for a task."""
    dispatch = tool_explain_worker_dispatch(task_id)
    if not dispatch:
        return TaskExplanationResponse(
            task_id=task_id,
            explanation=f"Task {task_id} not found in database.",
            top_worker_id=None,
            match_score=None,
            decision_factors=["Task not found"],
            engine_mode="ToiletCare Operations Engine",
        )

    task = dispatch["task"]
    candidates = dispatch["ranked_candidates"]
    top = candidates[0] if candidates else None

    if not top:
        return TaskExplanationResponse(
            task_id=task_id,
            explanation="No available workers found for this task.",
            top_worker_id=None,
            match_score=None,
            decision_factors=["Worker roster empty or all workers off-duty"],
            engine_mode="ToiletCare Operations Engine",
        )

    factors = [
        f"Primary skill matching for {task['issue_type']}",
        f"Service zone alignment in {dispatch['target_facility'].get('service_zone', 'Zone-1') if dispatch['target_facility'] else 'Zone-1'}",
        f"Workload capacity balancing ({top['active_tasks']} active tasks)",
    ]

    explanation = (
        f"{top['name']} ({top['worker_id']}) is ranked #1 with a {top['match_score']}% match score. "
        f"{top['reason']}"
    )

    return TaskExplanationResponse(
        task_id=task_id,
        explanation=explanation,
        top_worker_id=top["worker_id"],
        match_score=top["match_score"],
        decision_factors=factors,
        engine_mode="ToiletCare Operations Engine",
    )
