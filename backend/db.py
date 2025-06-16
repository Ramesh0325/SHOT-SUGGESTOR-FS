import sqlite3
import os
import hashlib
import uuid
from datetime import datetime
import base64
from PIL import Image
import io
import json
import shutil
import time
import threading
import contextlib

# Get the absolute path to the database file
DB_FILE = os.path.join(os.path.dirname(__file__), "shots_app.db")
SESSIONS_ROOT = os.path.join(os.path.dirname(__file__), 'user_sessions')

# Global connection pool
_connection_pool = None
_connection_lock = threading.Lock()
_connection_count = 0

@contextlib.contextmanager
def get_db_connection():
    """Get a database connection from the pool with proper cleanup"""
    global _connection_pool, _connection_count
    
    with _connection_lock:
        if _connection_pool is None:
            # Initialize the connection pool
            _connection_pool = sqlite3.connect(DB_FILE, timeout=60.0)
            _connection_pool.row_factory = sqlite3.Row
            
            # Set pragmas for better concurrency
            _connection_pool.execute("PRAGMA busy_timeout = 60000")  # 60 second timeout
            _connection_pool.execute("PRAGMA journal_mode = DELETE")  # Use DELETE journal mode
            _connection_pool.execute("PRAGMA synchronous = NORMAL")
            _connection_pool.execute("PRAGMA foreign_keys = ON")
            _connection_pool.execute("PRAGMA temp_store = MEMORY")
            _connection_pool.execute("PRAGMA mmap_size = 30000000000")
            
            print("Database: Initialized connection pool")
        
        _connection_count += 1
        print(f"Database: Active connections: {_connection_count}")
    
    try:
        yield _connection_pool
    finally:
        with _connection_lock:
            _connection_count -= 1
            print(f"Database: Active connections: {_connection_count}")

def close_db_connection():
    """Close the database connection pool"""
    global _connection_pool, _connection_count
    
    with _connection_lock:
        if _connection_pool is not None:
            _connection_pool.close()
            _connection_pool = None
            _connection_count = 0
            print("Database: Closed connection pool")

# Add this function to convert PIL Image to base64 string for storage
def image_to_base64(image):
    """Convert a PIL Image to a base64 encoded string"""
    buffered = io.BytesIO()
    image.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode("utf-8")

# Add this function to convert base64 string back to PIL Image
def base64_to_image(base64_str):
    """Convert a base64 encoded string to a PIL Image"""
    if not base64_str:
        return None
    image_data = base64.b64decode(base64_str)
    return Image.open(io.BytesIO(image_data))

def init_db():
    """Initialize the database with required tables if they don't exist"""
    with get_db_connection() as conn:
        # Create users table with simplified schema
        conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        # Create projects table
        conn.execute('''
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
        ''')
        
        # Create shots table with all required columns
        conn.execute('''
        CREATE TABLE IF NOT EXISTS shots (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            shot_number INTEGER NOT NULL,
            scene_description TEXT NOT NULL,
            shot_description TEXT NOT NULL,
            model_name TEXT NOT NULL,
            image_url TEXT,
            metadata TEXT,
            version_number INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )
        ''')
        
        # Verify all required columns exist
        try:
            # Check if version_number column exists
            conn.execute("SELECT version_number FROM shots LIMIT 1")
        except sqlite3.OperationalError:
            print("Database: Adding version_number column to shots table")
            conn.execute('ALTER TABLE shots ADD COLUMN version_number INTEGER DEFAULT 1')
        
        try:
            # Check if metadata column exists
            conn.execute("SELECT metadata FROM shots LIMIT 1")
        except sqlite3.OperationalError:
            print("Database: Adding metadata column to shots table")
            conn.execute('ALTER TABLE shots ADD COLUMN metadata TEXT')
        
        # Create shot_images table
        conn.execute('''
        CREATE TABLE IF NOT EXISTS shot_images (
            id TEXT PRIMARY KEY,
            shot_id TEXT NOT NULL,
            shot_number INTEGER NOT NULL,
            image_data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (shot_id) REFERENCES shots (id) ON DELETE CASCADE
        )
        ''')
        
        # Create sessions table
        conn.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            UNIQUE(user_id, name)
        )
        ''')
        
        # Create shot_versions table to track different versions of shots
        conn.execute('''
        CREATE TABLE IF NOT EXISTS shot_versions (
            id TEXT PRIMARY KEY,
            shot_id TEXT NOT NULL,
            version_number INTEGER NOT NULL,
            scene_description TEXT NOT NULL,
            shot_description TEXT NOT NULL,
            model_name TEXT NOT NULL,
            image_url TEXT,
            metadata TEXT,
            user_input TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (shot_id) REFERENCES shots (id) ON DELETE CASCADE
        )
        ''')
        
        # Add triggers for updated_at timestamps
        conn.execute('''
        CREATE TRIGGER IF NOT EXISTS update_project_timestamp 
        AFTER UPDATE ON projects
        BEGIN
            UPDATE projects SET updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.id;
        END
        ''')
        
        # Commit all changes
        conn.commit()
        print("Database: Initialized successfully")

# User management functions
def create_user(username, password):
    """Create a new user account with just username and password"""
    user_id = str(uuid.uuid4())
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    try:
        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO users (id, username, password_hash)
                VALUES (?, ?, ?)
                """,
                (user_id, username, password_hash)
            )
            conn.commit()
            return user_id
    except sqlite3.IntegrityError as e:
        print(f"Error creating user: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error creating user: {e}")
        return None

def authenticate_user(username, password):
    """Authenticate a user by username and password"""
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    with get_db_connection() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE username = ? AND password_hash = ?",
            (username, password_hash)
        ).fetchone()
        return dict(user) if user else None

def get_user_by_id(user_id):
    """Get user by ID"""
    with get_db_connection() as conn:
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(user) if user else None

def get_user_by_username(username):
    """Get user by username"""
    with get_db_connection() as conn:
        user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        return dict(user) if user else None

# Project management functions
def create_project(user_id, name, description=""):
    """Create a new project"""
    project_id = str(uuid.uuid4())
    try:
        with get_db_connection() as conn:
            conn.execute(
                "INSERT INTO projects (id, user_id, name, description) VALUES (?, ?, ?, ?)",
                (project_id, user_id, name, description)
            )
            conn.commit()
            return project_id
    except sqlite3.Error as e:
        print(f"Error creating project: {e}")
        return None

def get_user_projects(user_id):
    """Get all projects for a user"""
    try:
        with get_db_connection() as conn:
            projects = conn.execute(
                """
                SELECT p.*, 
                       COUNT(s.id) as shot_count,
                       MAX(s.created_at) as last_shot_date
                FROM projects p
                LEFT JOIN shots s ON p.id = s.project_id
                WHERE p.user_id = ?
                GROUP BY p.id
                ORDER BY p.updated_at DESC
                """,
                (user_id,)
            ).fetchall()
            return [dict(project) for project in projects]
    except sqlite3.Error as e:
        print(f"Error getting user projects: {e}")
        return []

def get_project(project_id):
    """Get project by ID"""
    try:
        print(f"Database: Fetching project {project_id}")  # Debug log
        with get_db_connection() as conn:
            project = conn.execute(
                """
                SELECT p.*, 
                       COUNT(s.id) as shot_count,
                       MAX(s.created_at) as last_shot_date
                FROM projects p
                LEFT JOIN shots s ON p.id = s.project_id
                WHERE p.id = ?
                GROUP BY p.id
                """,
                (project_id,)
            ).fetchone()
            if project:
                print(f"Database: Found project {project_id}")  # Debug log
                return dict(project)
            else:
                print(f"Database: Project {project_id} not found")  # Debug log
                return None
    except Exception as e:
        print(f"Database error fetching project {project_id}: {str(e)}")  # Debug log
        raise

def delete_project(project_id):
    """Delete a project and its shots"""
    with get_db_connection() as conn:
        # First delete related shots
        conn.execute("DELETE FROM shots WHERE project_id = ?", (project_id,))
        # Then delete the project
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()

# Shot management functions
def save_shot(project_id, shot_number, scene_description, shot_description, model_name, image_url=None, metadata=None, user_input=None):
    """Save a shot to the database and create initial version"""
    shot_id = str(uuid.uuid4())
    
    try:
        print(f"Database: Starting to save shot {shot_id} for project {project_id}")
        print(f"Database: Shot details - number={shot_number}, model={model_name}")
        
        # Ensure metadata is a dictionary and convert to JSON string
        try:
            metadata_json = json.dumps(metadata) if isinstance(metadata, dict) else None
            print(f"Database: Prepared metadata JSON: {metadata_json}")
        except Exception as e:
            print(f"Database: Error preparing metadata JSON: {str(e)}")
            raise
        
        # Use context manager for connection
        with get_db_connection() as conn:
            # Start transaction with retry logic
            max_retries = 5
            retry_delay = 0.5
            
            for attempt in range(max_retries):
                try:
                    print(f"Database: Starting transaction (attempt {attempt + 1}/{max_retries})")
                    conn.execute("BEGIN IMMEDIATE TRANSACTION")
                    
                    try:
                        # Insert the shot
                        print("Database: Inserting shot record")
                        conn.execute(
                            """
                            INSERT INTO shots (
                                id, project_id, shot_number, scene_description,
                                shot_description, model_name, image_url, metadata, version_number
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            (shot_id, project_id, shot_number, scene_description,
                             shot_description, model_name, image_url, metadata_json, 1)
                        )
                        print("Database: Shot record inserted successfully")
                        
                        # Save initial version
                        print("Database: Saving initial shot version")
                        version_id = save_shot_version(
                            shot_id, 1, scene_description, shot_description,
                            model_name, image_url, metadata, user_input
                        )
                        
                        if not version_id:
                            print("Database: Failed to save shot version")
                            raise sqlite3.Error("Failed to save shot version")
                        
                        print(f"Database: Successfully saved shot version {version_id}")
                        
                        # Commit transaction
                        print("Database: Committing transaction")
                        conn.commit()
                        print(f"Database: Successfully saved shot {shot_id}")
                        return shot_id
                        
                    except sqlite3.Error as e:
                        print(f"Database: SQLite error during shot save: {str(e)}")
                        conn.rollback()
                        if "database is locked" in str(e) and attempt < max_retries - 1:
                            print(f"Database: Locked, retrying in {retry_delay} seconds...")
                            time.sleep(retry_delay)
                            retry_delay *= 1.5  # Slower backoff
                            continue
                        raise
                        
                except Exception as e:
                    print(f"Database: Unexpected error (attempt {attempt + 1}): {str(e)}")
                    conn.rollback()
                    if attempt == max_retries - 1:
                        raise
                    time.sleep(retry_delay)
                    retry_delay *= 1.5
                    
    except Exception as e:
        print(f"Database: Fatal error saving shot: {str(e)}")
        raise

def get_project_shots(project_id):
    """Get all shots for a project"""
    try:
        with get_db_connection() as conn:
            shots = conn.execute(
                """
                SELECT * FROM shots 
                WHERE project_id = ? 
                ORDER BY shot_number ASC, created_at DESC
                """,
                (project_id,)
            ).fetchall()
            
            # Convert shots to dictionaries and parse metadata
            shot_list = []
            for shot in shots:
                shot_dict = dict(shot)
                # Parse metadata JSON string back to dictionary
                if shot_dict.get('metadata'):
                    try:
                        shot_dict['metadata'] = json.loads(shot_dict['metadata'])
                    except json.JSONDecodeError:
                        shot_dict['metadata'] = None
                shot_list.append(shot_dict)
            
            return shot_list
    except sqlite3.Error as e:
        print(f"Error getting project shots: {e}")
        return []

def get_shot(shot_id):
    """Get shot by ID"""
    try:
        with get_db_connection() as conn:
            shot = conn.execute("SELECT * FROM shots WHERE id = ?", (shot_id,)).fetchone()
            if shot:
                shot_dict = dict(shot)
                # Parse metadata JSON string back to dictionary
                if shot_dict.get('metadata'):
                    try:
                        shot_dict['metadata'] = json.loads(shot_dict['metadata'])
                    except json.JSONDecodeError:
                        shot_dict['metadata'] = None
                return shot_dict
            return None
    except Exception as e:
        print(f"Error getting shot: {e}")
        return None

# Add function to save an image for a specific shot
def save_shot_image(shot_id, shot_number, image):
    """Save a generated image for a shot and also save to a project folder on disk"""
    image_id = str(uuid.uuid4())
    # Convert PIL Image to base64 string
    image_data = image_to_base64(image)
    with get_db_connection() as conn:
        conn.execute(
            "INSERT INTO shot_images (id, shot_id, shot_number, image_data) VALUES (?, ?, ?, ?)",
            (image_id, shot_id, shot_number, image_data)
        )
        conn.commit()
    # Save image to disk in project folder
    project_folder = os.path.join("project_images", shot_id)
    os.makedirs(project_folder, exist_ok=True)
    image_path = os.path.join(project_folder, f"shot_{shot_number}.png")
    image.save(image_path)
    return image_id

# Add function to get images for a shot
def get_shot_images(shot_id):
    """Get all images for a specific shot"""
    with get_db_connection() as conn:
        images = conn.execute(
            "SELECT * FROM shot_images WHERE shot_id = ? ORDER BY shot_number, created_at",
            (shot_id,)
        ).fetchall()
        result = {}
        for img in images:
            shot_num = img['shot_number']
            if shot_num not in result:
                result[shot_num] = []
            # Convert base64 string back to PIL Image
            pil_img = base64_to_image(img['image_data'])
            if pil_img:
                result[shot_num].append(pil_img)
        return result

# Add function to delete a shot and all its images from the database, given the shot ID
def delete_shot(shot_id):
    """Delete a shot and its images (and shot_versions) by shot ID"""
    try:
        with get_db_connection() as conn:
            print(f"Database: Starting deletion of shot {shot_id}")  # Debug log
            conn.execute("BEGIN TRANSACTION")
            shot = conn.execute("SELECT id FROM shots WHERE id = ?", (shot_id,)).fetchone()
            if not shot:
                print(f"Database: Shot {shot_id} not found")  # Debug log
                conn.rollback()
                return False
            print(f"Database: Found shot {shot_id}, proceeding with deletion")  # Debug log
            # Delete related images (if table exists)
            try:
                table_exists = conn.execute("""
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name='shot_images'
                """).fetchone()
                if table_exists:
                    conn.execute("DELETE FROM shot_images WHERE shot_id = ?", (shot_id,))
                    print(f"Database: Deleted images for shot {shot_id}")  # Debug log
                else:
                    print(f"Database: shot_images table does not exist, skipping image deletion")  # Debug log
            except sqlite3.Error as e:
                print(f"Database: Error deleting images for shot {shot_id}: {e}")  # Debug log
                # Continue with shot deletion even if image deletion fails
            # Delete shot_versions (cascade shot_versions deletion)
            try:
                conn.execute("DELETE FROM shot_versions WHERE shot_id = ?", (shot_id,))
                print(f"Database: Deleted shot_versions for shot {shot_id}")  # Debug log
            except sqlite3.Error as e:
                print(f"Database: Error deleting shot_versions for shot {shot_id}: {e}")  # Debug log
                conn.rollback()
                return False
            # Delete the shot
            try:
                conn.execute("DELETE FROM shots WHERE id = ?", (shot_id,))
                print(f"Database: Deleted shot {shot_id}")  # Debug log
            except sqlite3.Error as e:
                print(f"Database: Error deleting shot {shot_id}: {e}")  # Debug log
                conn.rollback()
                return False
            conn.commit()
            print(f"Database: Successfully committed deletion of shot {shot_id}")  # Debug log
            return True
    except sqlite3.Error as e:
        print(f"Database: Unexpected error deleting shot {shot_id}: {e}")  # Debug log
        return False
    except Exception as e:
        print(f"Database: Unexpected non-SQLite error deleting shot {shot_id}: {e}")  # Debug log
        return False

# Session management functions
os.makedirs(SESSIONS_ROOT, exist_ok=True)

def save_session(user_id, name, data):
    """Save or update a user session"""
    session_id = str(uuid.uuid4())
    try:
        with get_db_connection() as conn:
            # Check if session with this name exists
            existing = conn.execute(
                "SELECT id FROM sessions WHERE user_id = ? AND name = ?",
                (user_id, name)
            ).fetchone()
            if existing:
                # Update existing session
                conn.execute(
                    """
                    UPDATE sessions 
                    SET data = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (json.dumps(data), existing['id'])
                )
                session_id = existing['id']
            else:
                # Create new session
                conn.execute(
                    """
                    INSERT INTO sessions (id, user_id, name, data)
                    VALUES (?, ?, ?, ?)
                    """,
                    (session_id, user_id, name, json.dumps(data))
                )
            conn.commit()
            return session_id
    except sqlite3.Error as e:
        print(f"Error saving session: {e}")
        return None

def list_user_sessions(user_id):
    """Get all sessions for a user"""
    try:
        with get_db_connection() as conn:
            sessions = conn.execute(
                """
                SELECT id, name, created_at, updated_at
                FROM sessions
                WHERE user_id = ?
                ORDER BY updated_at DESC
                """,
                (user_id,)
            ).fetchall()
            return [dict(session) for session in sessions]
    except sqlite3.Error as e:
        print(f"Error listing sessions: {e}")
        return []

def get_session_data(user_id, session_name):
    """Get session data by name"""
    try:
        with get_db_connection() as conn:
            session = conn.execute(
                "SELECT * FROM sessions WHERE user_id = ? AND name = ?",
                (user_id, session_name)
            ).fetchone()
            if session:
                session_dict = dict(session)
                session_dict['data'] = json.loads(session_dict['data'])
                return session_dict
            return None
    except sqlite3.Error as e:
        print(f"Error getting session data: {e}")
        return None

def rename_session(user_id, old_name, new_name):
    """Rename a user session"""
    try:
        with get_db_connection() as conn:
            conn.execute(
                """
                UPDATE sessions 
                SET name = ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND name = ?
                """,
                (new_name, user_id, old_name)
            )
            conn.commit()
            return True
    except sqlite3.Error as e:
        print(f"Error renaming session: {e}")
        return False

def delete_session(user_id, session_name):
    """Delete a user session"""
    try:
        with get_db_connection() as conn:
            conn.execute(
                "DELETE FROM sessions WHERE user_id = ? AND name = ?",
                (user_id, session_name)
            )
            conn.commit()
            return True
    except sqlite3.Error as e:
        print(f"Error deleting session: {e}")
        return False

# Initialize the database on import
init_db()

def save_shot_version(shot_id, version_number, scene_description, shot_description, model_name, image_url=None, metadata=None, user_input=None):
    """Save a new version of a shot"""
    version_id = str(uuid.uuid4())
    
    try:
        print(f"Database: Saving version {version_number} for shot {shot_id}")
        
        # Ensure metadata and user_input are dictionaries and convert to JSON strings
        try:
            metadata_json = json.dumps(metadata) if isinstance(metadata, dict) else None
            user_input_json = json.dumps(user_input) if isinstance(user_input, dict) else None
            print(f"Database: Prepared metadata JSON: {metadata_json}")
            print(f"Database: Prepared user input JSON: {user_input_json}")
        except Exception as e:
            print(f"Database: Error preparing JSON data: {str(e)}")
            raise
        
        # Use context manager for connection
        with get_db_connection() as conn:
            # Start transaction with retry logic
            max_retries = 5
            retry_delay = 0.5
            
            for attempt in range(max_retries):
                try:
                    print(f"Database: Starting version transaction (attempt {attempt + 1}/{max_retries})")
                    conn.execute("BEGIN IMMEDIATE TRANSACTION")
                    
                    try:
                        print("Database: Inserting version record")
                        conn.execute(
                            """
                            INSERT INTO shot_versions (
                                id, shot_id, version_number, scene_description,
                                shot_description, model_name, image_url, metadata, user_input
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            (version_id, shot_id, version_number, scene_description,
                             shot_description, model_name, image_url, metadata_json, user_input_json)
                        )
                        print("Database: Version record inserted successfully")
                        conn.commit()
                        return version_id
                        
                    except sqlite3.Error as e:
                        print(f"Database: SQLite error saving version: {str(e)}")
                        conn.rollback()
                        if "database is locked" in str(e) and attempt < max_retries - 1:
                            print(f"Database: Locked, retrying in {retry_delay} seconds...")
                            time.sleep(retry_delay)
                            retry_delay *= 1.5
                            continue
                        raise
                        
                except Exception as e:
                    print(f"Database: Unexpected error saving version (attempt {attempt + 1}): {str(e)}")
                    conn.rollback()
                    if attempt == max_retries - 1:
                        raise
                    time.sleep(retry_delay)
                    retry_delay *= 1.5
                    
    except Exception as e:
        print(f"Database: Fatal error saving version: {str(e)}")
        raise

def get_shot_versions(shot_id):
    """Get all versions of a shot"""
    try:
        with get_db_connection() as conn:
            versions = conn.execute(
                """
                SELECT * FROM shot_versions 
                WHERE shot_id = ? 
                ORDER BY version_number DESC, created_at DESC
                """,
                (shot_id,)
            ).fetchall()
            # Convert versions to dictionaries and parse metadata
            version_list = []
            for version in versions:
                version_dict = dict(version)
                # Parse metadata and user_input JSON strings back to dictionaries
                if version_dict.get('metadata'):
                    try:
                        version_dict['metadata'] = json.loads(version_dict['metadata'])
                    except json.JSONDecodeError:
                        version_dict['metadata'] = None
                if version_dict.get('user_input'):
                    try:
                        version_dict['user_input'] = json.loads(version_dict['user_input'])
                    except json.JSONDecodeError:
                        version_dict['user_input'] = None
                version_list.append(version_dict)
            return version_list
    except sqlite3.Error as e:
        print(f"Error getting shot versions: {e}")
        return []
