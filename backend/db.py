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

# Get the absolute path to the database file
DB_FILE = os.path.join(os.path.dirname(__file__), "shots_app.db")
SESSIONS_ROOT = os.path.join(os.path.dirname(__file__), 'user_sessions')

def get_db_connection():
    """Create a connection to the SQLite database"""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

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
    conn = get_db_connection()
    
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
    
    # Create shots table
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
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
    
    # Add triggers for updated_at timestamps
    conn.execute('''
    CREATE TRIGGER IF NOT EXISTS update_project_timestamp 
    AFTER UPDATE ON projects
    BEGIN
        UPDATE projects SET updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.id;
    END
    ''')
    
    conn.execute('''
    CREATE TRIGGER IF NOT EXISTS update_session_timestamp 
    AFTER UPDATE ON sessions
    BEGIN
        UPDATE sessions SET updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.id;
    END
    ''')
    
    conn.commit()
    conn.close()

# User management functions
def create_user(username, password):
    """Create a new user account with just username and password"""
    conn = get_db_connection()
    user_id = str(uuid.uuid4())
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    try:
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
    finally:
        conn.close()

def authenticate_user(username, password):
    """Authenticate a user by username and password"""
    conn = get_db_connection()
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    user = conn.execute(
        "SELECT * FROM users WHERE username = ? AND password_hash = ?",
        (username, password_hash)
    ).fetchone()
    
    conn.close()
    return dict(user) if user else None

def get_user_by_id(user_id):
    """Get user by ID"""
    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(user) if user else None

def get_user_by_username(username):
    """Get user by username"""
    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    return dict(user) if user else None

# Project management functions
def create_project(user_id, name, description=""):
    """Create a new project"""
    conn = get_db_connection()
    project_id = str(uuid.uuid4())
    
    try:
        conn.execute(
            "INSERT INTO projects (id, user_id, name, description) VALUES (?, ?, ?, ?)",
            (project_id, user_id, name, description)
        )
        conn.commit()
        return project_id
    except sqlite3.Error as e:
        print(f"Error creating project: {e}")
        return None
    finally:
        conn.close()

def get_user_projects(user_id):
    """Get all projects for a user"""
    conn = get_db_connection()
    try:
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
    finally:
        conn.close()

def get_project(project_id):
    """Get project by ID"""
    try:
        print(f"Database: Fetching project {project_id}")  # Debug log
        conn = get_db_connection()
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
        conn.close()
        
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
    conn = get_db_connection()
    # First delete related shots
    conn.execute("DELETE FROM shots WHERE project_id = ?", (project_id,))
    # Then delete the project
    conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    conn.commit()
    conn.close()

# Shot management functions
def save_shot(project_id, shot_number, scene_description, shot_description, model_name, image_url=None, metadata=None):
    """Save a shot to the database"""
    conn = get_db_connection()
    shot_id = str(uuid.uuid4())
    
    try:
        # Ensure metadata is a dictionary and convert to JSON string
        metadata_json = json.dumps(metadata) if isinstance(metadata, dict) else None
        
        conn.execute(
            """
            INSERT INTO shots (
                id, project_id, shot_number, scene_description,
                shot_description, model_name, image_url, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (shot_id, project_id, shot_number, scene_description,
             shot_description, model_name, image_url, metadata_json)
        )
        conn.commit()
        return shot_id
    except sqlite3.Error as e:
        print(f"Error saving shot: {e}")
        return None
    finally:
        conn.close()

def get_project_shots(project_id):
    """Get all shots for a project"""
    conn = get_db_connection()
    try:
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
    finally:
        conn.close()

def get_shot(shot_id):
    """Get shot by ID"""
    conn = get_db_connection()
    try:
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
    finally:
        conn.close()

# Add function to save an image for a specific shot
def save_shot_image(shot_id, shot_number, image):
    """Save a generated image for a shot and also save to a project folder on disk"""
    conn = get_db_connection()
    image_id = str(uuid.uuid4())
    # Convert PIL Image to base64 string
    image_data = image_to_base64(image)
    conn.execute(
        "INSERT INTO shot_images (id, shot_id, shot_number, image_data) VALUES (?, ?, ?, ?)",
        (image_id, shot_id, shot_number, image_data)
    )
    conn.commit()
    conn.close()
    # Save image to disk in project folder
    project_folder = os.path.join("project_images", shot_id)
    os.makedirs(project_folder, exist_ok=True)
    image_path = os.path.join(project_folder, f"shot_{shot_number}.png")
    image.save(image_path)
    return image_id

# Add function to get images for a shot
def get_shot_images(shot_id):
    """Get all images for a specific shot"""
    conn = get_db_connection()
    images = conn.execute(
        "SELECT * FROM shot_images WHERE shot_id = ? ORDER BY shot_number, created_at",
        (shot_id,)
    ).fetchall()
    conn.close()
    
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
    """Delete a shot and its images by shot ID"""
    conn = get_db_connection()
    # Delete related images
    conn.execute("DELETE FROM shot_images WHERE shot_id = ?", (shot_id,))
    # Delete the shot
    conn.execute("DELETE FROM shots WHERE id = ?", (shot_id,))
    conn.commit()
    conn.close()

# Session management functions
os.makedirs(SESSIONS_ROOT, exist_ok=True)

def save_session(user_id, name, data):
    """Save or update a user session"""
    conn = get_db_connection()
    session_id = str(uuid.uuid4())
    
    try:
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
    finally:
        conn.close()

def list_user_sessions(user_id):
    """Get all sessions for a user"""
    conn = get_db_connection()
    try:
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
    finally:
        conn.close()

def get_session_data(user_id, session_name):
    """Get session data by name"""
    conn = get_db_connection()
    try:
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
    finally:
        conn.close()

def rename_session(user_id, old_name, new_name):
    """Rename a user session"""
    conn = get_db_connection()
    try:
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
    finally:
        conn.close()

def delete_session(user_id, session_name):
    """Delete a user session"""
    conn = get_db_connection()
    try:
        conn.execute(
            "DELETE FROM sessions WHERE user_id = ? AND name = ?",
            (user_id, session_name)
        )
        conn.commit()
        return True
    except sqlite3.Error as e:
        print(f"Error deleting session: {e}")
        return False
    finally:
        conn.close()

# Initialize the database on import
init_db()
