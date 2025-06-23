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
PROJECT_IMAGES_ROOT = os.path.join(os.path.dirname(__file__), 'project_images')

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
            _connection_pool.row_factory = sqlite3.Row            # Set pragmas for better concurrency
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

def migrate_add_project_type():
    """Add project_type column to projects table if it doesn't exist"""
    try:
        with get_db_connection() as conn:
            # Check if project_type column exists
            cursor = conn.execute("PRAGMA table_info(projects)")
            columns = [column[1] for column in cursor.fetchall()]
            
            if 'project_type' not in columns:
                print("Adding project_type column to projects table...")
                conn.execute('''
                    ALTER TABLE projects 
                    ADD COLUMN project_type TEXT DEFAULT 'shot-suggestion'
                ''')
                conn.commit()
                print("Successfully added project_type column")
            else:
                print("project_type column already exists")
    except sqlite3.Error as e:
        print(f"Error adding project_type column: {e}")

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
        END        ''')
        
        # Run migration to add project_type column
        migrate_add_project_type()
        
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
def create_project(user_id, name, description="", project_type="shot-suggestion"):
    """Create a new project with support for different project types"""
    project_id = str(uuid.uuid4())
    try:
        with get_db_connection() as conn:
            conn.execute(
                "INSERT INTO projects (id, user_id, name, description, project_type) VALUES (?, ?, ?, ?, ?)",
                (project_id, user_id, name, description, project_type)
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

def list_file_system_sessions(user_id):
    """Get all sessions for a user from the filesystem"""
    try:
        user_folder = os.path.join(SESSIONS_ROOT, str(user_id))
        if not os.path.exists(user_folder):
            return []
        
        sessions = []
        # Get all session directories
        for session_dir in os.listdir(user_folder):
            session_path = os.path.join(user_folder, session_dir)
            if os.path.isdir(session_path):
                for folder in os.listdir(session_path):
                    if folder.startswith('session_'):
                        session_full_path = os.path.join(session_path, folder)
                        # Get input.json and shots.json if they exist
                        input_path = os.path.join(session_full_path, 'input.json')
                        shots_path = os.path.join(session_full_path, 'shots.json')
                        
                        # Parse date from session folder name (e.g., session_20250612_165228_b967451b)
                        try:
                            date_part = folder.split('_')[1:3]  # Get date and time parts
                            date_str = f"{date_part[0][:4]}-{date_part[0][4:6]}-{date_part[0][6:]} {date_part[1][:2]}:{date_part[1][2:4]}:{date_part[1][4:]}"
                            created_at = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S").isoformat()
                        except (IndexError, ValueError):
                            created_at = datetime.now().isoformat()
                            
                        session = {
                            "id": folder,
                            "name": folder,
                            "folder_path": session_full_path,
                            "created_at": created_at,
                            "updated_at": created_at,
                            "type": "filesystem",
                            "has_input": os.path.exists(input_path),
                            "has_shots": os.path.exists(shots_path)
                        }
                        sessions.append(session)
        
        # Sort by date (newest first)
        sessions.sort(key=lambda x: x['created_at'], reverse=True)
        return sessions
    except Exception as e:
        print(f"Error listing filesystem sessions: {e}")
        return []

def get_filesystem_session_data(user_id, session_id):
    """Get session data from filesystem by id"""
    try:
        # Find the session folder
        user_folder = os.path.join(SESSIONS_ROOT, str(user_id))
        if not os.path.exists(user_folder):
            return None
            
        # Search in all project folders
        for project_dir in os.listdir(user_folder):
            project_path = os.path.join(user_folder, project_dir)
            if os.path.isdir(project_path):
                session_path = None
                
                # Check if this session exists in this project folder
                for folder in os.listdir(project_path):
                    if folder == session_id:
                        session_path = os.path.join(project_path, folder)
                        break
                
                if session_path:
                    # Get input.json and shots.json if they exist
                    input_path = os.path.join(session_path, 'input.json')
                    shots_path = os.path.join(session_path, 'shots.json')
                    
                    data = {}
                    if os.path.exists(input_path):
                        with open(input_path, 'r') as f:
                            data['input'] = json.load(f)
                    
                    if os.path.exists(shots_path):
                        with open(shots_path, 'r') as f:
                            data['shots'] = json.load(f)
                      # Parse date from session folder name
                    try:
                        date_part = session_id.split('_')[1:3]
                        date_str = f"{date_part[0][:4]}-{date_part[0][4:6]}-{date_part[0][6:]} {date_part[1][:2]}:{date_part[1][2:4]}:{date_part[1][4:]}"
                        created_at = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S").isoformat()
                    except (IndexError, ValueError):
                        created_at = datetime.now().isoformat()
                    
                    return {
                        "id": session_id,
                        "name": session_id,
                        "folder_path": session_path,
                        "created_at": created_at,
                        "updated_at": created_at,
                        "type": "filesystem",
                        "data": data
                    }
        
        return None
    except Exception as e:
        print(f"Error getting filesystem session data: {e}")
        return None

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

def save_shots_to_filesystem(user_id, session_data, shots_data, project_id=None):
    """
    Save shots data to the filesystem in the user's session directory
    
    Args:
        user_id: The ID of the user
        session_data: Dictionary with scene_description, num_shots, model_name
        shots_data: List of shot suggestions
        project_id: Optional project ID to associate this session with 
    
    Returns:
        Dictionary with session_id and folder_path if successful, None if failed
    """
    try:
        # Create a unique session ID with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        session_id = f"session_{timestamp}_{uuid.uuid4().hex[:8]}"
        
        # Create user directory if it doesn't exist
        user_dir = os.path.join(SESSIONS_ROOT, str(user_id))
        os.makedirs(user_dir, exist_ok=True)
        
        # If no specific project is provided, try to use the active project from session_data
        if not project_id and isinstance(session_data, dict) and "project_id" in session_data:
            project_id = session_data["project_id"]
            
        # If still no project_id, create a default one based on timestamp
        if not project_id:
            # Find or create a project folder (using a timestamp to make it unique)
            project_id = f"project_{timestamp[:8]}"  # Use date part only
            
        # Create the project directory
        project_dir = os.path.join(user_dir, project_id)
        os.makedirs(project_dir, exist_ok=True)
        
        # Create session directory
        session_dir = os.path.join(project_dir, session_id)
        os.makedirs(session_dir, exist_ok=True)
        
        # Make sure session_data is a valid dictionary
        if not isinstance(session_data, dict):
            session_data = {"scene_description": str(session_data)}
        
        # Make sure shots_data is a valid list
        if not isinstance(shots_data, list):
            # If suggestions is an object with a suggestions property, extract that
            if isinstance(shots_data, dict) and "suggestions" in shots_data:
                shots_data = shots_data["suggestions"]
            else:
                shots_data = []
          # Save input data
        with open(os.path.join(session_dir, 'input.json'), 'w') as f:
            json.dump(session_data, f, indent=2)
        
        # Save shots data
        with open(os.path.join(session_dir, 'shots.json'), 'w') as f:
            json.dump(shots_data, f, indent=2)
            
        print(f"Successfully saved session to {session_dir}")
        
        # Return success with path info
        return {
            "session_id": session_id,
            "folder_path": session_dir
        }
        return {
            "session_id": session_id,
            "folder_path": session_dir
        }
    except Exception as e:
        print(f"Error saving shots to filesystem: {e}")
        import traceback
        traceback.print_exc()
        return None

def list_project_sessions(user_id, project_id):
    """Get all sessions for a specific project from the filesystem"""
    try:
        project_folder = os.path.join(SESSIONS_ROOT, str(user_id), project_id)
        if not os.path.exists(project_folder):
            return []
        
        sessions = []
        # Get all session directories in this project folder
        for folder in os.listdir(project_folder):
            if folder.startswith('session_'):
                session_full_path = os.path.join(project_folder, folder)
                if os.path.isdir(session_full_path):
                    # Get input.json and shots.json if they exist
                    input_path = os.path.join(session_full_path, 'input.json')
                    shots_path = os.path.join(session_full_path, 'shots.json')
                    
                    # Parse date from session folder name (e.g., session_20250612_165228_b967451b)
                    created_at = datetime.now().isoformat()
                    
                    # Try to extract date from session folder name
                    try:
                        date_part = folder.split('_')[1:3]  # Get date and time parts
                        date_str = f"{date_part[0][:4]}-{date_part[0][4:6]}-{date_part[0][6:]} {date_part[1][:2]}:{date_part[1][2:4]}:{date_part[1][4:]}"
                        created_at = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S").isoformat()
                    except (IndexError, ValueError) as e:
                        print(f"Could not parse date from session name {folder}: {e}")
                        # Keep using the default created_at
                    
                    session = {
                        "id": folder,
                        "name": folder,
                        "folder_path": session_full_path,
                        "created_at": created_at,
                        "updated_at": created_at,
                        "project_id": project_id,
                        "type": "filesystem",
                        "has_input": os.path.exists(input_path),
                        "has_shots": os.path.exists(shots_path)
                    }
                    sessions.append(session)
        
        # Sort by date (newest first)
        sessions.sort(key=lambda x: x['created_at'], reverse=True)
        return sessions
    except Exception as e:
        print(f"Error listing project sessions: {e}")
        return []

def save_enhanced_shots_to_project(user_id, project_id, session_data, shots_data):
    """
    Save enhanced shots to a project with session data
    """
    try:
        import uuid
        import json
        from datetime import datetime
        
        # Generate a unique session ID
        session_id = str(uuid.uuid4())
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
          # Create session name with timestamp
        session_name = f"session_{timestamp}_{session_id[:8]}"
        
        # Create file system folders for the project session
        project_dir = os.path.join(PROJECT_IMAGES_ROOT, project_id)
        session_dir = os.path.join(project_dir, session_name)
        images_dir = os.path.join(session_dir, "images")
        
        # Create directories
        os.makedirs(images_dir, exist_ok=True)
        
        # Save session input data to file
        input_file_path = os.path.join(session_dir, "input.json")
        with open(input_file_path, 'w') as f:
            json.dump(session_data, f, indent=2)
        
        # Save shots data to file
        shots_file_path = os.path.join(session_dir, "shots.json")
        shots_for_file = {
            "shots": shots_data if isinstance(shots_data, list) else shots_data.get('shots', []),
            "session_id": session_id,
            "created_at": datetime.now().isoformat(),
            "num_shots": len(shots_data if isinstance(shots_data, list) else shots_data.get('shots', [])),
            "scene_description": session_data.get('scene_description', ''),
            "model_name": session_data.get('model_name', 'unknown')
        }
        with open(shots_file_path, 'w') as f:
            json.dump(shots_for_file, f, indent=2)
        
        # Prepare session data
        session_record = {
            "id": session_id,
            "name": session_name,
            "user_id": user_id,
            "project_id": project_id,
            "input_data": session_data,
            "shots_data": shots_data,
            "created_at": datetime.now().isoformat(),
            "type": "enhanced"
        }
          # Save to database sessions table
        with get_db_connection() as conn:
            try:
                # Insert session record
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO sessions (id, user_id, name, data, created_at, project_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (session_id, user_id, session_name, json.dumps(session_record), 
                     datetime.now().isoformat(), project_id)
                )
                
                # Also save individual shots to the shots table if they don't exist
                # shots_data can be either a list of shots or a dict with 'shots' key
                shots_list = shots_data if isinstance(shots_data, list) else shots_data.get('shots', [])
                for i, shot in enumerate(shots_list, 1):
                    shot_id = save_shot(
                        project_id=project_id,
                        shot_number=i,
                        scene_description=session_data.get('scene_description', ''),
                        shot_description=shot.get('shot_description', ''),
                        model_name=session_data.get('model_name', 'unknown'),
                        metadata={
                            "session_id": session_id,
                            "enhanced": True,
                            "original_input": session_data,
                            "shot_metadata": shot.get('metadata', {})
                        },
                        user_input=session_data.get('scene_description', '')
                    )
                
                conn.commit()
                print(f"Database: Enhanced session saved successfully: {session_id}")
                
            except sqlite3.Error as e:
                print(f"Database: Error saving enhanced session: {str(e)}")
                conn.rollback()
                return None
        
        # Create proper return structure with all required fields
        return {
            "session_id": session_id,
            "session_dir": session_dir,
            "images_dir": images_dir,
            "type": "enhanced_project_session",
            "id": session_id,
            "name": session_name,
            "user_id": user_id,
            "project_id": project_id,
            "input_data": session_data,
            "shots_data": shots_data,
            "created_at": datetime.now().isoformat(),
            "input_file": input_file_path,
            "shots_file": shots_file_path
        }
        
        return None
        
    except Exception as e:
        print(f"Error in save_enhanced_shots_to_project: {str(e)}")
        return None

def save_fusion_session_to_project(user_id, project_id, final_prompt, generated_image):
    """
    Save Image Fusion session data to project structure
    """
    try:
        import uuid
        import json
        import base64
        from datetime import datetime
        
        # Generate a unique session ID
        session_id = str(uuid.uuid4())
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Create session name with timestamp
        session_name = f"fusion_session_{timestamp}_{session_id[:8]}"
        
        # Create file system folders for the project session
        project_dir = os.path.join(PROJECT_IMAGES_ROOT, project_id)
        session_dir = os.path.join(project_dir, session_name)
        images_dir = os.path.join(session_dir, "images")
        
        # Create directories
        os.makedirs(images_dir, exist_ok=True)
        
        # Save session input data to file
        input_data = {
            "type": "image_fusion",
            "final_prompt": final_prompt,
            "created_at": datetime.now().isoformat(),
            "session_id": session_id,
            "user_id": user_id,
            "project_id": project_id
        }
        
        input_file_path = os.path.join(session_dir, "input.json")
        with open(input_file_path, 'w') as f:
            json.dump(input_data, f, indent=2)
        
        # Save generated image to file
        image_filename = f"fusion_image_{timestamp}.png"
        image_file_path = os.path.join(images_dir, image_filename)
        
        # Decode base64 image and save to file
        try:
            image_bytes = base64.b64decode(generated_image)
            with open(image_file_path, 'wb') as f:
                f.write(image_bytes)
            print(f"Fusion image saved to: {image_file_path}")
        except Exception as img_error:
            print(f"Error saving fusion image: {img_error}")
            image_file_path = None
        
        # Save output data to file
        output_data = {
            "type": "image_fusion",
            "generated_image_path": image_file_path,
            "generated_image_filename": image_filename,
            "final_prompt": final_prompt,
            "generation_completed_at": datetime.now().isoformat(),
            "session_id": session_id
        }
        
        output_file_path = os.path.join(session_dir, "output.json")
        with open(output_file_path, 'w') as f:
            json.dump(output_data, f, indent=2)        # Save to database sessions table
        session_record = {
            "id": session_id,
            "name": session_name,
            "user_id": user_id,
            "project_id": project_id,
            "type": "image_fusion",
            "input_data": input_data,
            "output_data": output_data,
            "created_at": datetime.now().isoformat()
        }
        
        with get_db_connection() as conn:
            try:
                # Insert session record
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO sessions (id, user_id, name, data, created_at, project_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (session_id, user_id, session_name, json.dumps(session_record), 
                     datetime.now().isoformat(), project_id)
                )
                
                conn.commit()
                print(f"Database: Fusion session saved successfully: {session_id}")
                
            except sqlite3.Error as e:
                print(f"Database: Error saving fusion session: {str(e)}")
                conn.rollback()
                return None
        
        # Return success data
        return {
            "session_id": session_id,
            "session_dir": session_dir,
            "images_dir": images_dir,
            "type": "image_fusion_session",
            "input_file": input_file_path,
            "output_file": output_file_path,
            "image_file": image_file_path
        }
        
    except Exception as e:
        print(f"Error in save_fusion_session_to_project: {str(e)}")
        return None

def get_session_by_id(session_id):
    """Get session data by session ID"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            session = cursor.execute(
                "SELECT * FROM sessions WHERE id = ?",
                (session_id,)
            ).fetchone()
            
            if session:
                # Convert to dict
                session_dict = dict(session)
                # Parse JSON data if it exists
                if session_dict.get('data'):
                    try:
                        session_dict['data'] = json.loads(session_dict['data'])
                    except:
                        pass
                return session_dict
            return None
    except Exception as e:
        print(f"Error getting session by ID: {e}")
        return None
