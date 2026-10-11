from typing import Dict, Any, Optional, Tuple

try:
    from backend.models import TelemetryInput, SimulationScenarioType
    from backend.services.health import calculate_health_score, determine_priority_and_action
    from backend.repository import (
        get_toilet_by_id,
        update_toilet_condition,
        find_active_task_for_issue,
        get_db_connection,
    )
except ImportError:
    from models import TelemetryInput, SimulationScenarioType
    from services.health import calculate_health_score, determine_priority_and_action
    from repository import (
        get_toilet_by_id,
        update_toilet_condition,
        find_active_task_for_issue,
        get_db_connection,
    )

SCENARIOS: Dict[str, Dict[str, Any]] = {
    "NORMAL": {
        "water_level": 80,
        "soap_level": 80,
        "bin_fill": 30,
        "wetness": 10.0,
        "occupancy": 5,
    },
    "SOAP_LOW": {
        "water_level": 80,
        "soap_level": 10,
        "bin_fill": 40,
        "wetness": 10.0,
        "occupancy": 8,
    },
    "BIN_FULL": {
        "water_level": 80,
        "soap_level": 80,
        "bin_fill": 95,
        "wetness": 10.0,
        "occupancy": 12,
    },
    "NO_WATER": {
        "water_level": 5,
        "soap_level": 80,
        "bin_fill": 40,
        "wetness": 10.0,
        "occupancy": 3,
    },
    "WET_FLOOR": {
        "water_level": 80,
        "soap_level": 80,
        "bin_fill": 30,
        "wetness": 90.0,
        "occupancy": 6,
    },
}


def evaluate_telemetry_thresholds(telemetry: TelemetryInput) -> Optional[Tuple[str, str, str]]:
    """
    Evaluates sensor telemetry against threshold rules:
    Returns (issue_type, priority, action) if an operational threshold is breached, or None.
    """
    if telemetry.water_level < 20:
        return ("No Water", "Critical", "Restore water supply")

    if telemetry.bin_fill >= 90:
        return ("Bin Full", "High", "Empty waste bin")

    if telemetry.soap_level < 20:
        return ("No Soap", "Medium", "Refill soap")

    if telemetry.wetness >= 70.0:
        return ("Wet Floor", "Medium", "Mop and sanitize wet floor")

    return None


def process_telemetry_packet(telemetry: TelemetryInput) -> Dict[str, Any]:
    """
    Core IoT / Simulator Telemetry Processor:
    1. Records telemetry event into SQLite sensor_telemetry table.
    2. Updates physical condition state in toilets table (water, soap, bin).
    3. Evaluates thresholds for critical/high/medium operational breaches.
    4. Automatically creates a maintenance task if an issue is detected and no active task exists.
    5. Applies active-task duplicate protection.
    6. Recalculates facility health score.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    water_bool = telemetry.water_level >= 20
    soap_bool = telemetry.soap_level >= 20
    bin_int = int(telemetry.bin_fill)
    wetness_val = float(telemetry.wetness)
    occupancy_val = int(telemetry.occupancy or 0)

    # 1. Insert telemetry record supporting both new and legacy column names
    cursor.execute(
        """
        INSERT INTO sensor_telemetry (
            toilet_id,
            water_level, soap_level, bin_fill, wetness, occupancy,
            water_available, soap_available, bin_fill_percent, floor_wetness, occupancy_count,
            data_source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            telemetry.toilet_id,
            telemetry.water_level,
            telemetry.soap_level,
            bin_int,
            wetness_val,
            occupancy_val,
            int(water_bool),
            int(soap_bool),
            bin_int,
            wetness_val,
            occupancy_val,
            telemetry.data_source or "simulator",
        ),
    )
    conn.commit()
    telemetry_id = cursor.lastrowid

    # Fetch recorded timestamp
    cursor.execute("SELECT recorded_at FROM sensor_telemetry WHERE id = ?", (telemetry_id,))
    row = cursor.fetchone()
    recorded_at = str(row["recorded_at"]) if row else "Just now"

    # 2. Update physical conditions on toilet record
    cursor.execute(
        """
        UPDATE toilets
        SET water = ?, soap = ?, bin = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (int(water_bool), int(soap_bool), bin_int, telemetry.toilet_id),
    )
    conn.commit()

    # 3. Evaluate sensor thresholds
    breach = evaluate_telemetry_thresholds(telemetry)
    saved_task = None
    is_new_task = False
    action_taken = "Telemetry recorded. Conditions normal."

    if breach:
        issue_type, priority, action = breach

        # 4. Check duplicate active task protection
        cursor.execute(
            """
            SELECT * FROM maintenance_tasks
            WHERE toilet_id = ? AND issue_type = ? AND status IN ('Pending', 'Assigned', 'In Progress')
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (telemetry.toilet_id, issue_type),
        )
        existing_task_row = cursor.fetchone()

        if existing_task_row:
            saved_task = dict(existing_task_row)
            is_new_task = False
            action_taken = f"Breach detected ({issue_type}). Linked to existing active task {saved_task['task_id']}."
        else:
            # Generate new sequential task
            cursor.execute("SELECT COUNT(*) FROM maintenance_tasks")
            count = cursor.fetchone()[0]
            task_id = f"TASK-{count + 1:03d}"

            cursor.execute(
                """
                INSERT INTO maintenance_tasks (
                    task_id, toilet_id, issue_type, priority, action, status
                ) VALUES (?, ?, ?, ?, ?, 'Pending')
                """,
                (task_id, telemetry.toilet_id, issue_type, priority, action),
            )
            conn.commit()

            saved_task = {
                "task_id": task_id,
                "toilet_id": telemetry.toilet_id,
                "issue_type": issue_type,
                "priority": priority,
                "action": action,
                "status": "Pending",
                "assigned_worker_id": None,
                "created_at": recorded_at,
            }
            is_new_task = True
            action_taken = f"Critical sensor breach detected ({issue_type}). Automatically created new task {task_id}."

    conn.close()

    # 5. Recalculate health score and priority
    score, status = calculate_health_score(water_bool, soap_bool, bin_int)
    priority, recommended_action = determine_priority_and_action(water_bool, soap_bool, bin_int)

    return {
        "telemetry": {
            "id": telemetry_id,
            "toilet_id": telemetry.toilet_id,
            "water_level": telemetry.water_level,
            "soap_level": telemetry.soap_level,
            "bin_fill": bin_int,
            "wetness": wetness_val,
            "occupancy": occupancy_val,
            "data_source": telemetry.data_source or "simulator",
            "recorded_at": recorded_at,
        },
        "toilet_health": {
            "toilet_id": telemetry.toilet_id,
            "score": score,
            "status": status,
            "priority": priority,
            "action": recommended_action,
            "water": water_bool,
            "soap": soap_bool,
            "bin": bin_int,
        },
        "issue_detected": breach[0] if breach else None,
        "task": saved_task,
        "is_new_task": is_new_task,
        "action_taken": action_taken,
    }
