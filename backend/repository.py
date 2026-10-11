import uuid
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime

try:
    from backend.database import get_db_connection
    from backend.models import Report, MaintenanceTask, TaskStatus
    from backend.services.health import calculate_health_score, determine_priority_and_action
except ImportError:
    from database import get_db_connection
    from models import Report, MaintenanceTask, TaskStatus
    from services.health import calculate_health_score, determine_priority_and_action

ISSUE_ACTION_MAPPING: Dict[str, Tuple[str, str]] = {
    "No Water": ("Critical", "Restore water supply"),
    "No Soap": ("Medium", "Refill soap"),
    "Bin Full": ("High", "Empty waste bin"),
    "Wet Floor": ("Medium", "Mop and sanitize wet floor"),
    "Dirty Toilet": ("Medium", "Deep clean sanitation"),
    "Broken Fixture": ("High", "Repair broken fixture"),
    "Electrical": ("Medium", "Fix lighting and electrical"),
}


def get_all_toilets() -> List[Dict[str, Any]]:
    """Retrieve all toilets from the SQLite database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, location, water, soap, bin, service_zone, is_demo, data_source, source_url, verification_status, last_verified
        FROM toilets
        ORDER BY id ASC
        """
    )
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": row["id"],
            "location": row["location"],
            "water": bool(row["water"]),
            "soap": bool(row["soap"]),
            "bin": int(row["bin"]),
            "service_zone": row["service_zone"] or "Zone-1 (Central)",
            "is_demo": bool(row["is_demo"]),
            "data_source": row["data_source"],
            "source_url": row["source_url"],
            "verification_status": row["verification_status"],
            "last_verified": row["last_verified"],
        }
        for row in rows
    ]


def get_toilet_by_id(toilet_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve a single toilet by ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM toilets WHERE id = ?", (toilet_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "id": row["id"],
        "location": row["location"],
        "water": bool(row["water"]),
        "soap": bool(row["soap"]),
        "bin": int(row["bin"]),
        "service_zone": row["service_zone"] or "Zone-1 (Central)",
        "is_demo": bool(row["is_demo"]),
        "data_source": row["data_source"],
        "source_url": row["source_url"],
        "verification_status": row["verification_status"],
        "last_verified": row["last_verified"],
    }


def update_toilet_condition(
    toilet_id: str,
    water: Optional[bool] = None,
    soap: Optional[bool] = None,
    bin_level: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    """Updates physical conditions of a toilet and timestamp."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM toilets WHERE id = ?", (toilet_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None

    new_water = int(water) if water is not None else row["water"]
    new_soap = int(soap) if soap is not None else row["soap"]
    new_bin = bin_level if bin_level is not None else row["bin"]

    cursor.execute(
        """
        UPDATE toilets
        SET water = ?, soap = ?, bin = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (new_water, new_soap, new_bin, toilet_id),
    )
    conn.commit()
    conn.close()
    return get_toilet_by_id(toilet_id)


def find_active_task_for_issue(toilet_id: str, issue_type: str) -> Optional[Dict[str, Any]]:
    """Finds any active task (Pending, Assigned, In Progress) for the same toilet and issue."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT * FROM maintenance_tasks
        WHERE toilet_id = ? AND issue_type = ? AND status IN ('Pending', 'Assigned', 'In Progress')
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (toilet_id, issue_type),
    )
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    return dict(row)


def create_report_with_auto_task(report: Report) -> Dict[str, Any]:
    """
    Creates a citizen report and automatically links or creates a maintenance task.
    Prevents duplicate active tasks for the same issue on the same toilet.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Check for existing active task for the same toilet & issue
    cursor.execute(
        """
        SELECT * FROM maintenance_tasks
        WHERE toilet_id = ? AND issue_type = ? AND status IN ('Pending', 'Assigned', 'In Progress')
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (report.toilet_id, report.issue_type),
    )
    existing_task_row = cursor.fetchone()

    if existing_task_row:
        existing_task = dict(existing_task_row)
        task_id = existing_task["task_id"]
        is_new_task = False

        # Insert report linked to existing active task
        cursor.execute(
            """
            INSERT INTO reports (toilet_id, issue_type, description, status, task_id)
            VALUES (?, ?, ?, 'Converted', ?)
            """,
            (report.toilet_id, report.issue_type, report.description, task_id),
        )
        conn.commit()
        report_id = cursor.lastrowid
        conn.close()

        saved_task = existing_task
    else:
        # Generate new Task ID
        cursor.execute("SELECT COUNT(*) FROM maintenance_tasks")
        count = cursor.fetchone()[0]
        task_id = f"TASK-{count + 1:03d}"
        is_new_task = True

        # Insert report first
        cursor.execute(
            """
            INSERT INTO reports (toilet_id, issue_type, description, status, task_id)
            VALUES (?, ?, ?, 'Converted', ?)
            """,
            (report.toilet_id, report.issue_type, report.description, task_id),
        )
        conn.commit()
        report_id = cursor.lastrowid

        # Determine priority and action
        default_priority, default_action = ISSUE_ACTION_MAPPING.get(
            report.issue_type, ("Medium", f"Inspect and resolve {report.issue_type}")
        )

        # Insert new maintenance task
        cursor.execute(
            """
            INSERT INTO maintenance_tasks (
                task_id, toilet_id, report_id, issue_type, priority, action, status
            ) VALUES (?, ?, ?, ?, ?, ?, 'Pending')
            """,
            (task_id, report.toilet_id, report_id, report.issue_type, default_priority, default_action),
        )
        conn.commit()
        conn.close()

        saved_task = {
            "task_id": task_id,
            "toilet_id": report.toilet_id,
            "report_id": report_id,
            "issue_type": report.issue_type,
            "priority": default_priority,
            "action": default_action,
            "status": "Pending",
            "assigned_worker_id": None,
            "resolution_notes": None,
            "verified_by": None,
        }

    saved_report = {
        "id": report_id,
        "toilet_id": report.toilet_id,
        "issue_type": report.issue_type,
        "description": report.description,
        "status": "Converted",
        "task_id": task_id,
    }

    return {
        "report": saved_report,
        "task": saved_task,
        "is_new_task": is_new_task,
    }


def insert_report(report: Report) -> Dict[str, Any]:
    """Compatibility insert for Report."""
    res = create_report_with_auto_task(report)
    return res["report"]


def get_all_reports() -> List[Dict[str, Any]]:
    """Retrieve all citizen reports with linked tasks."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, toilet_id, issue_type, description, status, task_id, created_at
        FROM reports
        ORDER BY id DESC
        """
    )
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": row["id"],
            "toilet_id": row["toilet_id"],
            "issue_type": row["issue_type"],
            "description": row["description"],
            "status": row["status"],
            "task_id": row["task_id"],
            "created_at": str(row["created_at"]),
        }
        for row in rows
    ]


def insert_maintenance_task(task: MaintenanceTask) -> Dict[str, Any]:
    """Insert or replace a maintenance task with duplicate protection."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT OR REPLACE INTO maintenance_tasks (
            task_id, toilet_id, report_id, issue_type, priority, action, status, assigned_worker_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            task.task_id,
            task.toilet_id,
            task.report_id,
            task.issue_type,
            task.priority,
            task.action,
            task.status,
            task.assigned_worker_id,
        ),
    )
    conn.commit()
    conn.close()
    return task.model_dump()


def get_all_maintenance_tasks(
    status: Optional[str] = None, toilet_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Retrieve maintenance tasks with optional status and toilet filtering."""
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM maintenance_tasks WHERE 1=1"
    params = []

    if status:
        query += " AND status = ?"
        params.append(status)
    if toilet_id:
        query += " AND toilet_id = ?"
        params.append(toilet_id)

    query += " ORDER BY created_at DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "task_id": row["task_id"],
            "toilet_id": row["toilet_id"],
            "report_id": row["report_id"],
            "issue_type": row["issue_type"],
            "priority": row["priority"],
            "action": row["action"],
            "status": row["status"],
            "assigned_worker_id": row["assigned_worker_id"],
            "resolution_notes": row["resolution_notes"],
            "verified_by": row["verified_by"],
            "created_at": str(row["created_at"]) if row["created_at"] else None,
            "updated_at": str(row["updated_at"]) if row["updated_at"] else None,
            "resolved_at": str(row["resolved_at"]) if row["resolved_at"] else None,
            "verified_at": str(row["verified_at"]) if row["verified_at"] else None,
        }
        for row in rows
    ]


def get_maintenance_task_by_id(task_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve a single maintenance task by ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM maintenance_tasks WHERE task_id = ?", (task_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "task_id": row["task_id"],
        "toilet_id": row["toilet_id"],
        "report_id": row["report_id"],
        "issue_type": row["issue_type"],
        "priority": row["priority"],
        "action": row["action"],
        "status": row["status"],
        "assigned_worker_id": row["assigned_worker_id"],
        "resolution_notes": row["resolution_notes"],
        "verified_by": row["verified_by"],
        "created_at": str(row["created_at"]) if row["created_at"] else None,
        "updated_at": str(row["updated_at"]) if row["updated_at"] else None,
        "resolved_at": str(row["resolved_at"]) if row["resolved_at"] else None,
        "verified_at": str(row["verified_at"]) if row["verified_at"] else None,
    }


def get_all_workers() -> List[Dict[str, Any]]:
    """Retrieve all synthetic demo workers."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM workers ORDER BY id ASC")
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": row["id"],
            "name": row["name"],
            "role": row["role"],
            "skills": [s.strip() for s in row["skills"].split(",") if s.strip()],
            "service_zone": row["service_zone"],
            "is_available": bool(row["is_available"]),
            "active_tasks": int(row["active_tasks"]),
            "is_demo": bool(row["is_demo"]),
            "data_source": row["data_source"],
        }
        for row in rows
    ]


def get_worker_by_id(worker_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve a single worker by ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM workers WHERE id = ?", (worker_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "id": row["id"],
        "name": row["name"],
        "role": row["role"],
        "skills": [s.strip() for s in row["skills"].split(",") if s.strip()],
        "service_zone": row["service_zone"],
        "is_available": bool(row["is_available"]),
        "active_tasks": int(row["active_tasks"]),
        "is_demo": bool(row["is_demo"]),
        "data_source": row["data_source"],
    }


def assign_task_to_worker(task_id: str, worker_id: str) -> Optional[Dict[str, Any]]:
    """
    Transactionally assigns a task to a worker.
    Updates worker active_tasks workload (+1 for new worker, -1 for previous worker if reassigning).
    Transitions task status to 'Assigned'.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Fetch task
    cursor.execute("SELECT * FROM maintenance_tasks WHERE task_id = ?", (task_id,))
    task_row = cursor.fetchone()
    if not task_row:
        conn.close()
        return None

    task = dict(task_row)
    prev_worker_id = task["assigned_worker_id"]
    prev_status = task["status"]

    # 2. Fetch new worker
    cursor.execute("SELECT * FROM workers WHERE id = ?", (worker_id,))
    worker_row = cursor.fetchone()
    if not worker_row:
        conn.close()
        return None

    # 3. Transactional updates
    if prev_worker_id and prev_worker_id != worker_id and prev_status in ("Assigned", "In Progress"):
        cursor.execute(
            "UPDATE workers SET active_tasks = MAX(0, active_tasks - 1) WHERE id = ?",
            (prev_worker_id,),
        )

    if prev_worker_id != worker_id or prev_status == "Pending":
        cursor.execute(
            "UPDATE workers SET active_tasks = active_tasks + 1 WHERE id = ?",
            (worker_id,),
        )

    # Update task
    cursor.execute(
        """
        UPDATE maintenance_tasks
        SET assigned_worker_id = ?, status = 'Assigned', updated_at = CURRENT_TIMESTAMP
        WHERE task_id = ?
        """,
        (worker_id, task_id),
    )

    conn.commit()
    conn.close()

    return get_maintenance_task_by_id(task_id)


def update_task_status(
    task_id: str,
    new_status: str,
    notes: Optional[str] = None,
    officer_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Transactionally updates task status across lifecycle:
    Pending -> Assigned -> In Progress -> Resolved -> Verified.
    Decrements worker active_tasks when task becomes Resolved or Verified.
    Recalculates toilet health upon verification.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM maintenance_tasks WHERE task_id = ?", (task_id,))
    task_row = cursor.fetchone()
    if not task_row:
        conn.close()
        return None

    task = dict(task_row)
    old_status = task["status"]
    worker_id = task["assigned_worker_id"]
    toilet_id = task["toilet_id"]
    issue_type = task["issue_type"]

    # Decrement worker workload when resolving an active task
    if old_status in ("Assigned", "In Progress") and new_status in ("Resolved", "Verified"):
        if worker_id:
            cursor.execute(
                "UPDATE workers SET active_tasks = MAX(0, active_tasks - 1) WHERE id = ?",
                (worker_id,),
            )

    # Prepare status update columns
    if new_status == "Resolved":
        cursor.execute(
            """
            UPDATE maintenance_tasks
            SET status = ?, resolution_notes = COALESCE(?, resolution_notes),
                resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE task_id = ?
            """,
            (new_status, notes, task_id),
        )
    elif new_status == "Verified":
        cursor.execute(
            """
            UPDATE maintenance_tasks
            SET status = ?, resolution_notes = COALESCE(?, resolution_notes),
                verified_by = COALESCE(?, verified_by, 'Officer'),
                verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE task_id = ?
            """,
            (new_status, notes, officer_id, task_id),
        )

        # Upon verification, update physical condition flags if applicable
        if issue_type == "No Water":
            cursor.execute("UPDATE toilets SET water = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (toilet_id,))
        elif issue_type == "No Soap":
            cursor.execute("UPDATE toilets SET soap = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (toilet_id,))
        elif issue_type == "Bin Full":
            cursor.execute("UPDATE toilets SET bin = 15, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (toilet_id,))
    else:
        cursor.execute(
            """
            UPDATE maintenance_tasks
            SET status = ?, resolution_notes = COALESCE(?, resolution_notes), updated_at = CURRENT_TIMESTAMP
            WHERE task_id = ?
            """,
            (new_status, notes, task_id),
        )

    conn.commit()
    conn.close()

    return get_maintenance_task_by_id(task_id)


def get_latest_telemetry_for_all_toilets() -> List[Dict[str, Any]]:
    """Retrieve the most recent telemetry packet for each toilet."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT st.*
        FROM sensor_telemetry st
        INNER JOIN (
            SELECT toilet_id, MAX(id) as max_id
            FROM sensor_telemetry
            GROUP BY toilet_id
        ) latest ON st.id = latest.max_id
        ORDER BY st.toilet_id ASC
        """
    )
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": row["id"],
            "toilet_id": row["toilet_id"],
            "water_level": int(row["water_level"]),
            "soap_level": int(row["soap_level"]),
            "bin_fill": int(row["bin_fill"]),
            "wetness": float(row["wetness"]),
            "occupancy": int(row["occupancy"]),
            "data_source": row["data_source"],
            "recorded_at": str(row["recorded_at"]),
        }
        for row in rows
    ]


def get_latest_telemetry_for_toilet(toilet_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve the most recent telemetry packet for a single toilet."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT * FROM sensor_telemetry
        WHERE toilet_id = ?
        ORDER BY id DESC
        LIMIT 1
        """,
        (toilet_id,),
    )
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "id": row["id"],
        "toilet_id": row["toilet_id"],
        "water_level": int(row["water_level"]),
        "soap_level": int(row["soap_level"]),
        "bin_fill": int(row["bin_fill"]),
        "wetness": float(row["wetness"]),
        "occupancy": int(row["occupancy"]),
        "data_source": row["data_source"],
        "recorded_at": str(row["recorded_at"]),
    }
