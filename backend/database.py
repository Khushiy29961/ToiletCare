import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "toiletcare.db"


def get_db_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def _ensure_column(cursor, table_name: str, column_name: str, column_def: str):
    """Safely adds a column to an existing SQLite table if it does not already exist."""
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [row[1] for row in cursor.fetchall()]
    if column_name not in columns:
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_def}")


def init_db():
    """
    Initializes SQLite tables and safe backward-compatible migrations.
    Preserves existing data across server restarts without duplicating records.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Toilets table
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS toilets (
            id TEXT PRIMARY KEY,
            location TEXT NOT NULL,
            water INTEGER NOT NULL,
            soap INTEGER NOT NULL,
            bin INTEGER NOT NULL,
            service_zone TEXT DEFAULT 'Zone-1 (Central)',
            is_demo INTEGER DEFAULT 1,
            data_source TEXT DEFAULT 'demo_seed',
            source_url TEXT,
            verification_status TEXT DEFAULT 'unverified',
            last_verified TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    _ensure_column(cursor, "toilets", "service_zone", "TEXT DEFAULT 'Zone-1 (Central)'")

    # 2. Citizen Reports table
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            toilet_id TEXT NOT NULL,
            issue_type TEXT NOT NULL,
            description TEXT NOT NULL,
            status TEXT DEFAULT 'Pending',
            task_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (toilet_id) REFERENCES toilets (id) ON DELETE CASCADE
        )
        """
    )
    _ensure_column(cursor, "reports", "status", "TEXT DEFAULT 'Pending'")
    _ensure_column(cursor, "reports", "task_id", "TEXT")

    # 3. Workers table (Synthetic demo workers only)
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS workers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            skills TEXT NOT NULL,
            service_zone TEXT NOT NULL,
            is_available INTEGER DEFAULT 1,
            active_tasks INTEGER DEFAULT 0,
            is_demo INTEGER DEFAULT 1,
            data_source TEXT DEFAULT 'synthetic_demo',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    _ensure_column(cursor, "workers", "data_source", "TEXT DEFAULT 'synthetic_demo'")

    # 4. Maintenance Tasks table
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS maintenance_tasks (
            task_id TEXT PRIMARY KEY,
            toilet_id TEXT NOT NULL,
            report_id INTEGER,
            issue_type TEXT NOT NULL,
            priority TEXT NOT NULL,
            action TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Pending',
            assigned_worker_id TEXT,
            resolution_notes TEXT,
            verified_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP,
            verified_at TIMESTAMP,
            FOREIGN KEY (toilet_id) REFERENCES toilets (id) ON DELETE CASCADE,
            FOREIGN KEY (report_id) REFERENCES reports (id) ON DELETE SET NULL,
            FOREIGN KEY (assigned_worker_id) REFERENCES workers (id) ON DELETE SET NULL
        )
        """
    )
    _ensure_column(cursor, "maintenance_tasks", "report_id", "INTEGER")
    _ensure_column(cursor, "maintenance_tasks", "resolution_notes", "TEXT")
    _ensure_column(cursor, "maintenance_tasks", "verified_by", "TEXT")
    _ensure_column(cursor, "maintenance_tasks", "resolved_at", "TIMESTAMP")
    _ensure_column(cursor, "maintenance_tasks", "verified_at", "TIMESTAMP")

    # 5. Sensor Telemetry table (Supporting both granular percentage and legacy boolean columns)
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS sensor_telemetry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            toilet_id TEXT NOT NULL,
            water_level INTEGER NOT NULL DEFAULT 100,
            soap_level INTEGER NOT NULL DEFAULT 100,
            bin_fill INTEGER NOT NULL DEFAULT 0,
            wetness REAL DEFAULT 0.0,
            occupancy INTEGER DEFAULT 0,
            water_available INTEGER DEFAULT 1,
            soap_available INTEGER DEFAULT 1,
            bin_fill_percent INTEGER DEFAULT 0,
            floor_wetness REAL DEFAULT 0.0,
            occupancy_count INTEGER DEFAULT 0,
            data_source TEXT DEFAULT 'simulator',
            recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (toilet_id) REFERENCES toilets (id) ON DELETE CASCADE
        )
        """
    )
    # Ensure all columns exist for full backward-compatibility
    _ensure_column(cursor, "sensor_telemetry", "water_level", "INTEGER DEFAULT 100")
    _ensure_column(cursor, "sensor_telemetry", "soap_level", "INTEGER DEFAULT 100")
    _ensure_column(cursor, "sensor_telemetry", "bin_fill", "INTEGER DEFAULT 0")
    _ensure_column(cursor, "sensor_telemetry", "wetness", "REAL DEFAULT 0.0")
    _ensure_column(cursor, "sensor_telemetry", "occupancy", "INTEGER DEFAULT 0")
    _ensure_column(cursor, "sensor_telemetry", "water_available", "INTEGER DEFAULT 1")
    _ensure_column(cursor, "sensor_telemetry", "soap_available", "INTEGER DEFAULT 1")
    _ensure_column(cursor, "sensor_telemetry", "bin_fill_percent", "INTEGER DEFAULT 0")
    _ensure_column(cursor, "sensor_telemetry", "floor_wetness", "REAL DEFAULT 0.0")
    _ensure_column(cursor, "sensor_telemetry", "occupancy_count", "INTEGER DEFAULT 0")
    _ensure_column(cursor, "sensor_telemetry", "data_source", "TEXT DEFAULT 'simulator'")

    conn.commit()

    # Seed demo toilets only if table is completely empty
    cursor.execute("SELECT COUNT(*) FROM toilets")
    toilet_count = cursor.fetchone()[0]

    if toilet_count == 0:
        demo_toilets = [
            ("TC-001", "Main Bus Station", 1, 1, 32, "Zone-1 (Central)", 1, "demo_seed", None, "unverified", None),
            ("TC-002", "City Park", 1, 0, 87, "Zone-1 (Central)", 1, "demo_seed", None, "unverified", None),
            ("TC-003", "Railway Station", 0, 0, 94, "Zone-2 (North)", 1, "demo_seed", None, "unverified", None),
        ]
        cursor.executemany(
            """
            INSERT INTO toilets (
                id, location, water, soap, bin, service_zone, is_demo, data_source, source_url, verification_status, last_verified
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            demo_toilets,
        )
        conn.commit()

    # Seed demo workers only if workers table is completely empty
    cursor.execute("SELECT COUNT(*) FROM workers")
    worker_count = cursor.fetchone()[0]

    if worker_count == 0:
        demo_workers = [
            (
                "WRK-001",
                "Demo Worker 1 (Plumber)",
                "Plumber",
                "plumbing,water_supply,pipe_repair,fixture_repair",
                "Zone-1 (Central)",
                1,
                0,
                1,
                "synthetic_demo",
            ),
            (
                "WRK-002",
                "Demo Worker 2 (Sanitation)",
                "Sanitation Specialist",
                "cleaning,waste_management,sanitation,soap_refill,bin_clearing",
                "Zone-1 (Central)",
                1,
                0,
                1,
                "synthetic_demo",
            ),
            (
                "WRK-003",
                "Demo Worker 3 (General Maintenance)",
                "General Maintenance",
                "cleaning,waste_management,fixture_repair,general_maintenance",
                "Zone-2 (North)",
                1,
                0,
                1,
                "synthetic_demo",
            ),
            (
                "WRK-004",
                "Demo Worker 4 (Electrician)",
                "Electrician",
                "electrical,lighting,exhaust_fan,wiring",
                "Zone-1 (Central)",
                1,
                0,
                1,
                "synthetic_demo",
            ),
            (
                "WRK-005",
                "Demo Worker 5 (Sanitation)",
                "Sanitation Specialist",
                "cleaning,waste_management,sanitation,soap_refill,bin_clearing",
                "Zone-2 (North)",
                0,
                0,
                1,
                "synthetic_demo",
            ),
        ]
        cursor.executemany(
            """
            INSERT INTO workers (
                id, name, role, skills, service_zone, is_available, active_tasks, is_demo, data_source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            demo_workers,
        )
        conn.commit()

    # Seed initial telemetry snapshot for demo toilets if telemetry table is empty
    cursor.execute("SELECT COUNT(*) FROM sensor_telemetry")
    telemetry_count = cursor.fetchone()[0]
    if telemetry_count == 0:
        # Tuple format: toilet_id, water_level, soap_level, bin_fill, wetness, occupancy, water_available, soap_available, bin_fill_percent, floor_wetness, occupancy_count, data_source
        initial_telemetry = [
            ("TC-001", 100, 100, 32, 10.0, 3, 1, 1, 32, 10.0, 3, "simulator"),
            ("TC-002", 100, 10, 87, 15.0, 8, 1, 0, 87, 15.0, 8, "simulator"),
            ("TC-003", 10, 10, 94, 25.0, 14, 0, 0, 94, 25.0, 14, "simulator"),
        ]
        cursor.executemany(
            """
            INSERT INTO sensor_telemetry (
                toilet_id,
                water_level, soap_level, bin_fill, wetness, occupancy,
                water_available, soap_available, bin_fill_percent, floor_wetness, occupancy_count,
                data_source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            initial_telemetry,
        )
        conn.commit()

    conn.close()
