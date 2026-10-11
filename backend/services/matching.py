from typing import List, Dict, Any

try:
    from backend.models import Worker, WorkerMatchCandidate
except ImportError:
    from models import Worker, WorkerMatchCandidate

ISSUE_SKILL_REQUIREMENTS: Dict[str, List[str]] = {
    "No Water": ["plumbing", "water_supply", "pipe_repair"],
    "No Soap": ["soap_refill", "sanitation", "cleaning"],
    "Bin Full": ["bin_clearing", "waste_management", "cleaning"],
    "Wet Floor": ["cleaning", "sanitation", "plumbing"],
    "Dirty Toilet": ["cleaning", "sanitation"],
    "Broken Fixture": ["fixture_repair", "general_maintenance", "plumbing"],
    "Electrical": ["electrical", "lighting", "wiring"],
}

DEFAULT_SKILLS = ["general_maintenance", "cleaning"]


def match_workers_for_task(
    workers: List[Dict[str, Any]],
    issue_type: str,
    toilet_zone: str = "Zone-1 (Central)",
    priority: str = "Medium",
) -> List[WorkerMatchCandidate]:
    """
    Deterministic, explainable worker matching algorithm.
    Ranks workers based on:
    1. Skill relevance (50 pts)
    2. Service zone proximity (30 pts)
    3. Workload balancing & availability (20 pts)
    """
    required_skills = ISSUE_SKILL_REQUIREMENTS.get(issue_type, DEFAULT_SKILLS)
    candidates: List[WorkerMatchCandidate] = []

    for w_data in workers:
        worker_skills = (
            w_data["skills"] if isinstance(w_data["skills"], list)
            else [s.strip().lower() for s in w_data["skills"].split(",") if s.strip()]
        )
        worker_obj = Worker(
            id=w_data["id"],
            name=w_data["name"],
            role=w_data["role"],
            skills=worker_skills,
            service_zone=w_data["service_zone"],
            is_available=bool(w_data["is_available"]),
            active_tasks=int(w_data["active_tasks"]),
            is_demo=bool(w_data["is_demo"]),
            data_source=w_data.get("data_source", "synthetic_demo"),
        )

        if not worker_obj.is_available:
            candidates.append(
                WorkerMatchCandidate(
                    worker=worker_obj,
                    match_score=0.0,
                    skill_matched=False,
                    zone_matched=(worker_obj.service_zone == toilet_zone or worker_obj.service_zone == "All"),
                    workload_penalty=0,
                    recommendation_reason="Worker is currently off-duty / unavailable.",
                )
            )
            continue

        # 1. Skill evaluation (Max 50 pts)
        primary_req = required_skills[0].lower()
        has_primary = primary_req in worker_skills
        has_any = any(req.lower() in worker_skills for req in required_skills)
        has_general = "general_maintenance" in worker_skills

        if has_primary:
            skill_score = 50.0
            skill_matched = True
            skill_desc = f"Primary skill match ({primary_req})"
        elif has_any:
            skill_score = 35.0
            skill_matched = True
            matched_skill = next(s for s in required_skills if s.lower() in worker_skills)
            skill_desc = f"Secondary skill match ({matched_skill})"
        elif has_general:
            skill_score = 20.0
            skill_matched = True
            skill_desc = "General maintenance fallback"
        else:
            skill_score = 0.0
            skill_matched = False
            skill_desc = "No matching skill"

        # 2. Zone evaluation (Max 30 pts)
        zone_matched = (worker_obj.service_zone == toilet_zone or worker_obj.service_zone == "All")
        if worker_obj.service_zone == toilet_zone:
            zone_score = 30.0
            zone_desc = f"Direct zone match ({toilet_zone})"
        elif worker_obj.service_zone == "All":
            zone_score = 20.0
            zone_desc = "City-wide service coverage"
        else:
            zone_score = 5.0
            zone_desc = f"Different zone ({worker_obj.service_zone})"

        # 3. Workload evaluation (Max 20 pts)
        active = worker_obj.active_tasks
        if active == 0:
            workload_score = 20.0
            workload_penalty = 0
            workload_desc = "0 active tasks (Optimal capacity)"
        elif active == 1:
            workload_score = 10.0
            workload_penalty = 10
            workload_desc = "1 active task"
        elif active == 2:
            workload_score = 0.0
            workload_penalty = 20
            workload_desc = "2 active tasks"
        else:
            penalty = 20 + ((active - 2) * 10)
            workload_score = max(-20.0, -10.0 * (active - 2))
            workload_penalty = penalty
            workload_desc = f"{active} active tasks (High workload)"

        # Composite score
        total_score = max(0.0, min(100.0, skill_score + zone_score + workload_score))

        reason_parts = [skill_desc, zone_desc, workload_desc]
        reason_str = " | ".join(reason_parts)

        candidates.append(
            WorkerMatchCandidate(
                worker=worker_obj,
                match_score=round(total_score, 1),
                skill_matched=skill_matched,
                zone_matched=zone_matched,
                workload_penalty=workload_penalty,
                recommendation_reason=reason_str,
            )
        )

    # Sort candidates by match_score DESC, active_tasks ASC, id ASC
    candidates.sort(
        key=lambda c: (-c.match_score, c.worker.active_tasks, c.worker.id)
    )
    return candidates
