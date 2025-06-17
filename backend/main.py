from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr
import uvicorn
import os
from pathlib import Path
import logging
import re
from db import (    init_db, create_user, authenticate_user, get_user_by_username,
    create_project, get_user_projects, get_project, delete_project,
    save_shot, get_project_shots, get_shot, delete_shot,
    save_session, list_user_sessions, get_session_data, rename_session, delete_session,
    list_file_system_sessions, get_filesystem_session_data, save_shots_to_filesystem,
    get_db_connection, save_shot_version, get_shot_versions, close_db_connection, 
    list_project_sessions, SESSIONS_ROOT
)
from model import gemini, generate_shot_image
import json
from dotenv import load_dotenv
import sqlite3
import atexit
import contextlib

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

# Hardcoded configuration (for testing only)
SECRET_KEY = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"  # This is a test key, replace in production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
FRONTEND_URL = "http://localhost:3000"

# Validate required environment variables
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable is not set")

# Constants
SECRET_KEY = SECRET_KEY
ALGORITHM = ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = ACCESS_TOKEN_EXPIRE_MINUTES

# Initialize FastAPI app
app = FastAPI(
    title="AI Cinematic Shot Suggestor API",
    description="Backend API for AI-powered cinematic shot suggestions",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # (or ["*"] for development)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add OPTIONS endpoint for CORS preflight
@app.options("/{full_path:path}")
async def options_handler(request: Request, full_path: str):
    return JSONResponse(
        content={},
        headers={
            "Access-Control-Allow-Origin": "http://localhost:3000",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "3600"
        }
    )

# Pydantic models for request/response validation
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class User(BaseModel):
    id: str
    username: str

class UserInDB(User):
    hashed_password: str

class UserCreate(BaseModel):
    username: str
    password: str
    confirm_password: str

class UserResponse(BaseModel):
    id: str
    username: str

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    shot_count: int
    last_shot_date: Optional[datetime]

class ShotCreate(BaseModel):
    scene_description: str
    num_shots: int
    model_name: str = "runwayml/stable-diffusion-v1-5"

class ShotResponse(BaseModel):
    id: str
    shot_number: int
    scene_description: str
    shot_description: str
    model_name: str
    image_url: Optional[str]
    metadata: Optional[Dict[str, Any]]
    created_at: datetime

class SessionCreate(BaseModel):
    name: str
    data: Dict[str, Any]

class SessionResponse(BaseModel):
    id: str
    name: str
    created_at: datetime
    updated_at: datetime

# Helper functions
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Configure OAuth2
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Get the current authenticated user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        logger.debug(f"Validating token: {token[:10]}...")
        # Decode the JWT token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            logger.error("Token missing username")
            raise credentials_exception
        token_data = TokenData(username=username)
    except jwt.ExpiredSignatureError:
        logger.error("Token has expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError as e:
        logger.error(f"JWT validation error: {str(e)}")
        raise credentials_exception
        
    # Get user from database
    user = get_user_by_username(username=token_data.username)
    if user is None:
        logger.error(f"User {token_data.username} not found in database")
        raise credentials_exception
        
    logger.info(f"Successfully authenticated user {user['username']}")
    return user

# Root endpoint
@app.get("/")
async def root():
    return {"message": "AI Cinematic Shot Suggestor Backend Running"}

# Authentication endpoints
@app.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """Login endpoint to get access token"""
    try:
        logger.info(f"Login attempt for user {form_data.username}")
        user = authenticate_user(form_data.username, form_data.password)
        if not user:
            logger.warning(f"Failed login attempt for user {form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user["username"]}, expires_delta=access_token_expires
        )
        
        logger.info(f"Successful login for user {user['username']}")
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user["id"],
                "username": user["username"],
                "email": user.get("email"),
                "full_name": user.get("full_name"),
                "disabled": user.get("disabled", False)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during login: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during login"
        )

@app.post("/register", response_model=UserResponse)
async def register(user: UserCreate):
    try:
        # Validate input
        if not user.username or not user.password:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": "Username and password are required"},
                headers={
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                    "Access-Control-Allow-Credentials": "true"
                }
            )
        
        # Validate password confirmation
        if user.password != user.confirm_password:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": "Passwords do not match"},
                headers={
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                    "Access-Control-Allow-Credentials": "true"
                }
            )

        # Create user
        user_id = create_user(
            username=user.username,
            password=user.password
        )
        
        if not user_id:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": "Username already taken"},
                headers={
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                    "Access-Control-Allow-Credentials": "true"
                }
            )
        
        # Get created user
        created_user = get_user_by_username(username=user.username)
        if not created_user:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"detail": "Failed to retrieve created user"},
                headers={
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                    "Access-Control-Allow-Credentials": "true"
                }
            )
        
        # Return user data
        return JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content={
                "id": created_user["id"],
                "username": created_user["username"]
            },
            headers={
                "Access-Control-Allow-Origin": "http://localhost:3000",
                "Access-Control-Allow-Credentials": "true"
            }
        )
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": f"Registration failed: {str(e)}"},
            headers={
                "Access-Control-Allow-Origin": "http://localhost:3000",
                "Access-Control-Allow-Credentials": "true"
            }
        )

@app.get("/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    try:
        logger.info(f"User {current_user['username']} requesting their info")
        return current_user
    except Exception as e:
        logger.error(f"Error getting user info: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user information"
        )

# Project endpoints
@app.post("/projects", response_model=ProjectResponse)
async def create_new_project(
    project: ProjectCreate,
    current_user: dict = Depends(get_current_user)
):
    project_id = create_project(
        user_id=current_user["id"],
        name=project.name,
        description=project.description
    )
    if not project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create project"
        )
    return get_project(project_id)

@app.get("/projects", response_model=List[ProjectResponse])
async def list_projects(current_user: dict = Depends(get_current_user)):
    return get_user_projects(current_user["id"])

@app.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project_details(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    try:
        print(f"Fetching project {project_id} for user {current_user['id']}")  # Debug log
        project = get_project(project_id)
        print(f"Project data: {project}")  # Debug log
        
        if not project:
            print(f"Project {project_id} not found")  # Debug log
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"detail": "Project not found"},
                headers={
                    "Access-Control-Allow-Origin": request.headers.get("origin", "http://localhost:3000"),
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "*"
                }
            )
            
        if project["user_id"] != current_user["id"]:
            print(f"User {current_user['id']} not authorized for project {project_id}")  # Debug log
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Not authorized to access this project"},
                headers={
                    "Access-Control-Allow-Origin": request.headers.get("origin", "http://localhost:3000"),
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "*"
                }
            )
            
        return project
    except Exception as e:
        print(f"Error fetching project {project_id}: {str(e)}")  # Debug log
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": f"Internal server error: {str(e)}"},
            headers={
                "Access-Control-Allow-Origin": request.headers.get("origin", "http://localhost:3000"),
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*"
            }
        )

@app.delete("/projects/{project_id}")
async def remove_project(
    request: Request,
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    try:
        logger.info(f"Attempting to delete project {project_id} for user {current_user['id']}")
        
        # Add CORS headers for preflight
        if request.method == "OPTIONS":
            return JSONResponse(
                content={},
                headers={
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                    "Access-Control-Allow-Credentials": "true"
                }
            )

        # Get project details
        project = get_project(project_id)
        logger.debug(f"Retrieved project: {project}")
        
        if not project:
            logger.warning(f"Project {project_id} not found")
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"detail": "Project not found"},
                headers={
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                    "Access-Control-Allow-Credentials": "true"
                }
            )
            
        if project["user_id"] != current_user["id"]:
            logger.warning(f"User {current_user['id']} not authorized to delete project {project_id}")
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Not authorized to delete this project"},
                headers={
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                    "Access-Control-Allow-Credentials": "true"
                }
            )
        
        # Delete the project
        logger.info(f"Deleting project {project_id}")
        try:
            # First verify the project still exists
            project_exists = get_project(project_id)
            if not project_exists:
                logger.warning(f"Project {project_id} was deleted between verification and deletion")
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content={"detail": "Project was already deleted"},
                    headers={
                        "Access-Control-Allow-Origin": "http://localhost:3000",
                        "Access-Control-Allow-Credentials": "true"
                    }
                )

            # Delete project and all its shots
            delete_project(project_id)
            logger.info(f"Successfully deleted project {project_id}")
            
            return JSONResponse(
                content={"message": "Project deleted successfully"},
                headers={
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                    "Access-Control-Allow-Credentials": "true"
                }
            )
            
        except sqlite3.Error as e:
            logger.error(f"Database error while deleting project {project_id}: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"detail": f"Database error: {str(e)}"},
                headers={
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                    "Access-Control-Allow-Credentials": "true"
                }
            )
            
    except Exception as e:
        logger.error(f"Unexpected error deleting project {project_id}: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": f"Error deleting project: {str(e)}"},
            headers={
                "Access-Control-Allow-Origin": "http://localhost:3000",
                "Access-Control-Allow-Credentials": "true"
            }
        )

# Shot suggestion and image generation endpoints
@app.post("/shots/suggest")
async def suggest_shots(
    shot_data: ShotCreate,
    project_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    try:
        logger.info(f"Generating shot suggestions for user {current_user['username']}, project_id: {project_id}")
        
        # Generate shot suggestions using the Gemini model
        shot_suggestions = await gemini(
            scene_description=shot_data.scene_description,
            num_shots=shot_data.num_shots
        )
        
        # Save the suggestions to filesystem session
        input_data = {
            "scene_description": shot_data.scene_description,
            "num_shots": shot_data.num_shots,
            "model_name": shot_data.model_name
        }
        
        # Add project_id if provided
        if project_id:
            input_data["project_id"] = project_id
            logger.info(f"Using project_id: {project_id} for session")
        
        # Create a response object with the right format
        response_data = {
            "suggestions": shot_suggestions
        }
        
        try:
            # Save shots to filesystem
            fs_session = save_shots_to_filesystem(
                user_id=current_user["id"],
                session_data=input_data,
                shots_data=shot_suggestions,  # Use the list directly here
                project_id=project_id
            )
            
            # Also save to database with a generated name
            session_name = f"Session {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
            session_data = {
                "input": input_data,
                "shots": shot_suggestions
            }
            
            # Only save to DB if explicitly enabled
            if os.environ.get("SAVE_SESSIONS_TO_DB", "false").lower() == "true":
                save_session(
                    user_id=current_user["id"],
                    name=session_name,
                    data=session_data
                )
            
            # Include session info in the response
            if fs_session:
                response_data["session_info"] = {
                    "id": fs_session["session_id"],
                    "folder_path": fs_session["folder_path"]
                }
                
            logger.info(f"Successfully saved shots to filesystem: {fs_session}")
        except Exception as e:
            # Log the error but continue - we still want to return the suggestions
            logger.error(f"Error saving shots to filesystem: {str(e)}")
            
        return response_data  # Return structured response with suggestions
    except Exception as e:
        logger.error(f"Error in suggest_shots: {str(e)}")
        if "quota" in str(e).lower():
            # Extract retry delay if available
            retry_match = re.search(r'retry_delay\s*{\s*seconds:\s*(\d+)\s*}', str(e))
            retry_seconds = int(retry_match.group(1)) if retry_match else 60
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Please wait {retry_seconds} seconds before trying again. {str(e)}"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/projects/{project_id}/shots")
async def create_shot(
    project_id: str,
    shot_number: int = Form(...),
    scene_description: str = Form(...),
    shot_description: str = Form(...),
    model_name: str = Form(...),
    metadata: UploadFile = File(None),
    current_user: dict = Depends(get_current_user)
):
    """Create a new shot in a project"""
    try:
        # Verify project ownership and existence
        with get_db_connection() as conn:
            project = conn.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
            if not project:
                raise HTTPException(status_code=404, detail="Project not found (or deleted).")
        project = get_project(project_id)
        if not project or project["user_id"] != current_user["id"]:
            raise HTTPException(status_code=404, detail="Project not found (or deleted).")

        # Parse metadata if provided
        metadata_dict = None
        user_input = None
        if metadata:
            try:
                metadata_content = await metadata.read()
                metadata_dict = json.loads(metadata_content)
                user_input = {
                    "shot_description": shot_description,
                    "model_name": model_name,
                    "timestamp": datetime.now().isoformat()
                }
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid metadata JSON"
                )

        try:
            # Save the shot and create initial version
            logger.info("Attempting to save shot to database")
            with get_db_connection() as conn:
                shot_id = save_shot(
                    project_id=project_id,
                    shot_number=shot_number,
                    scene_description=scene_description,
                    shot_description=shot_description,
                    model_name=model_name,
                    metadata=metadata_dict,
                    user_input=user_input
                )

                if not shot_id:
                    logger.error("Failed to save shot - save_shot returned None")
                    raise HTTPException(status_code=500, detail="Failed to save shot to database")

                logger.info(f"Successfully created shot {shot_id}")
                return {"id": shot_id, "message": "Shot created successfully"}

        except sqlite3.Error as db_error:
            logger.error(f"Database error while saving shot: {str(db_error)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Database error: {str(db_error)}"
            )
        except Exception as db_error:
            logger.error(f"Unexpected error while saving shot: {str(db_error)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Error saving shot: {str(db_error)}"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error creating shot: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error creating shot: {str(e)}"
        )

@app.post("/shots/generate-image")
async def generate_shot_image_endpoint(
    shot_description: str = Form(...),
    model_name: str = Form(...),
    shot_id: str = Form(None),
    session_id: str = Form(None),
    shot_index: str = Form(None),  # Changed from int to str to handle form data properly
    current_user: dict = Depends(get_current_user)
):
    try:
        logger.info(f"Generating image for shot description: '{shot_description}' with model: {model_name}")
        
        # Generate the image
        image_data = generate_shot_image(
            prompt=shot_description,
            model_name=model_name
        )
        
        logger.info("Image generation successful")

        if shot_id:
            logger.info(f"Updating existing shot {shot_id} with new image")
            # Get current shot
            shot = get_shot(shot_id)
            if not shot:
                raise HTTPException(status_code=404, detail="Shot not found")
            if get_project(shot["project_id"])["user_id"] != current_user["id"]:
                raise HTTPException(status_code=403, detail="Not authorized to modify this shot")

            # Create new version
            version_number = shot.get("version_number", 0) + 1
            version_id = save_shot_version(
                shot_id=shot_id,
                version_number=version_number,
                scene_description=shot["scene_description"],
                shot_description=shot_description,
                model_name=model_name,
                image_url=image_data,
                metadata=shot.get("metadata"),
                user_input={
                    "shot_description": shot_description,
                    "model_name": model_name,
                    "timestamp": datetime.now().isoformat()
                }
            )

            if not version_id:
                raise HTTPException(status_code=500, detail="Failed to save shot version")

            # Update shot with new version
            conn = get_db_connection()
            conn.execute(
                """
                UPDATE shots 
                SET version_number = ?, image_url = ?
                WHERE id = ?
                """,
                (version_number, image_data, shot_id)            )
            conn.commit()
            conn.close()
            logger.info(f"Shot {shot_id} updated successfully with new image")
        
        # Update filesystem session if session_id is provided
        if session_id and shot_index is not None:
            try:
                # Convert shot_index to integer if it's a string
                shot_idx = int(shot_index) if shot_index else None
                
                logger.info(f"Updating filesystem session {session_id} with image for shot index {shot_idx}")
                
                # Get the session data
                session_data = get_filesystem_session_data(current_user["id"], session_id)
                
                if session_data and "data" in session_data and "shots" in session_data["data"]:
                    shots = session_data["data"]["shots"]
                    
                    # Make sure the shot index is valid
                    if shot_idx is not None and 0 <= shot_idx < len(shots):                        # Update the shot with the image URL
                        shots[shot_idx]["image_url"] = image_data
                        logger.info(f"Successfully added image_url to shot at index {shot_idx}")
                        
                        # Find the session folder
                        user_folder = os.path.join(SESSIONS_ROOT, str(current_user["id"]))
                        
                        # Search in all project folders for this session
                        for project_dir in os.listdir(user_folder):
                            project_path = os.path.join(user_folder, project_dir)
                            if os.path.isdir(project_path):
                                session_path = os.path.join(project_path, session_id)
                                
                                if os.path.exists(session_path):
                                    # Update shots.json file
                                    shots_path = os.path.join(session_path, 'shots.json')
                                    with open(shots_path, 'w') as f:
                                        json.dump(shots, f, indent=2)
                                    
                                    logger.info(f"Updated session file at {shots_path}")
                                    break
            except Exception as sess_error:
                logger.error(f"Error updating session file: {str(sess_error)}")
                # Non-critical error, don't raise HTTP exception
        
        return {"image_url": image_data}
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"Error generating image: {str(e)}\nTraceback: {error_trace}")
        raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")

@app.get("/shots/{shot_id}/versions")
async def get_shot_versions(
    shot_id: str,
    current_user: dict = Depends(get_current_user)
):
    try:
        # Verify shot exists and user has access
        shot = get_shot(shot_id)
        if not shot:
            raise HTTPException(status_code=404, detail="Shot not found")
        if get_project(shot["project_id"])["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized to view this shot")

        # Get all versions
        versions = get_shot_versions(shot_id)
        return versions

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting shot versions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Shot management endpoints
@app.get("/projects/{project_id}/shots", response_model=List[ShotResponse])
async def list_project_shots(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    # Verify project ownership
    project = get_project(project_id)
    if not project or project["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    return get_project_shots(project_id)

@app.delete("/shots/{shot_id}")
async def remove_shot(
    request: Request,
    shot_id: str,
    current_user: dict = Depends(get_current_user)
):
    try:
        logger.info(f"Attempting to delete shot {shot_id} for user {current_user['id']}")
        
        # Add CORS headers for preflight
        if request.method == "OPTIONS":
            return JSONResponse(
                content={},
                headers={
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                    "Access-Control-Allow-Credentials": "true"
                }
            )

        # Get shot details
        shot = get_shot(shot_id)
        logger.debug(f"Retrieved shot: {shot}")
        
        if not shot:
            logger.warning(f"Shot {shot_id} not found")
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"detail": "Shot not found"},
                headers={
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                    "Access-Control-Allow-Credentials": "true"
                }
            )
        
        # Verify project ownership
        project = get_project(shot["project_id"])
        logger.debug(f"Retrieved project: {project}")
        
        if not project:
            logger.warning(f"Project {shot['project_id']} not found for shot {shot_id}")
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"detail": "Project not found"},
                headers={
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                    "Access-Control-Allow-Credentials": "true"
                }
            )
            
        if project["user_id"] != current_user["id"]:
            logger.warning(f"User {current_user['id']} not authorized to delete shot {shot_id} from project {project['id']}")
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Not authorized to delete this shot"},
                headers={
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                    "Access-Control-Allow-Credentials": "true"
                }
            )
        
        # Delete the shot
        logger.info(f"Deleting shot {shot_id} from project {project['id']}")
        try:
            # First verify the shot still exists
            shot_exists = get_shot(shot_id)
            if not shot_exists:
                logger.warning(f"Shot {shot_id} was deleted between verification and deletion")
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content={"detail": "Shot was already deleted"},
                    headers={
                        "Access-Control-Allow-Origin": "http://localhost:3000",
                        "Access-Control-Allow-Credentials": "true"
                    }
                )

            # Attempt deletion
            success = delete_shot(shot_id)
            if success:
                logger.info(f"Successfully deleted shot {shot_id}")
                return JSONResponse(
                    content={"message": "Shot deleted successfully"},
                    headers={
                        "Access-Control-Allow-Origin": "http://localhost:3000",
                        "Access-Control-Allow-Credentials": "true"
                    }
                )
            else:
                logger.error(f"Failed to delete shot {shot_id} - delete_shot returned False")
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content={"detail": "Failed to delete shot from database"},
                    headers={
                        "Access-Control-Allow-Origin": "http://localhost:3000",
                        "Access-Control-Allow-Credentials": "true"
                    }
                )
        except sqlite3.Error as e:
            logger.error(f"Database error while deleting shot {shot_id}: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"detail": f"Database error: {str(e)}"},
                headers={
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                    "Access-Control-Allow-Credentials": "true"
                }
            )
            
    except Exception as e:
        logger.error(f"Unexpected error deleting shot {shot_id}: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": f"Error deleting shot: {str(e)}"},
            headers={
                "Access-Control-Allow-Origin": "http://localhost:3000",
                "Access-Control-Allow-Credentials": "true"
            }
        )

@app.put("/projects/{project_id}/shots/{shot_id}", response_model=ShotResponse)
async def update_shot(
    project_id: str,
    shot_id: str,
    shot_update: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update a shot in a project"""
    try:
        # Verify project ownership
        project = get_project(project_id)
        if not project or project["user_id"] != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        # Get the shot to verify it exists
        shot = get_shot(shot_id)
        if not shot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Shot not found"
            )
            
        # Update shot in database
        conn = get_db_connection()
        try:
            # Only update image_url if provided
            if "image_url" in shot_update:
                conn.execute(
                    """
                    UPDATE shots 
                    SET image_url = ? 
                    WHERE id = ? AND project_id = ?
                    """,
                    (shot_update["image_url"], shot_id, project_id)
                )
                conn.commit()
            
            # Get and return the updated shot
            updated_shot = get_shot(shot_id)
            if not updated_shot:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to retrieve updated shot"
                )
            return updated_shot
            
        except sqlite3.Error as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {str(e)}"
            )
        finally:
            conn.close()
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating shot: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating shot: {str(e)}"
        )

# Session management endpoints
@app.post("/sessions", response_model=SessionResponse)
async def create_new_session(
    session: SessionCreate,
    current_user: dict = Depends(get_current_user)
):
    session_id = save_session(
        user_id=current_user["id"],
        name=session.name,
        data=session.data
    )
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to save session"
        )
    return get_session_data(current_user["id"], session.name)

@app.get("/sessions", response_model=List[dict])
async def list_sessions(current_user: dict = Depends(get_current_user)):
    # Only get sessions from database (filesystem sessions are now in projects)
    db_sessions = list_user_sessions(current_user["id"])
    
    # Add source type to database sessions
    for session in db_sessions:
        session["type"] = "database"
    
    return sorted(db_sessions, key=lambda x: x.get('updated_at', ''), reverse=True)

@app.get("/sessions/{session_identifier}")
async def get_session(
    session_identifier: str,
    session_type: str = "database",  # can be "database" or "filesystem"
    current_user: dict = Depends(get_current_user)
):
    if session_type == "filesystem":
        # Get from filesystem
        session = get_filesystem_session_data(current_user["id"], session_identifier)
    else:
        # Get from database
        session = get_session_data(current_user["id"], session_identifier)
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session not found: {session_identifier}"
        )
    return session

@app.put("/sessions/{session_name}")
async def update_session(
    session_name: str,
    new_name: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    if rename_session(current_user["id"], session_name, new_name):
        return {"message": "Session renamed successfully"}
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Failed to rename session"
    )

@app.delete("/sessions/{session_name}")
async def remove_session(
    session_name: str,
    current_user: dict = Depends(get_current_user)
):
    if delete_session(current_user["id"], session_name):
        return {"message": "Session deleted successfully"}
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Failed to delete session"
    )

@app.get("/projects/{project_id}/sessions", response_model=List[dict])
async def list_project_sessions_api(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """List all sessions for a specific project"""
    # Get sessions for this project from filesystem
    sessions = list_project_sessions(current_user["id"], project_id)
    if not sessions:
        return []
    
    return sorted(sessions, key=lambda x: x.get('created_at', ''), reverse=True)

# Register cleanup handler
@atexit.register
def cleanup():
    """Cleanup database connection on shutdown"""
    close_db_connection()

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on FastAPI shutdown"""
    close_db_connection()

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    init_db()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
