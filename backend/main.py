from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Request, status, Body
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
    list_project_sessions, SESSIONS_ROOT, save_enhanced_shots_to_project, 
    PROJECT_IMAGES_ROOT, save_fusion_session_to_project, get_session_by_id
)
from model import gemini, generate_shot_image, generate_fusion_image, analyze_reference_images, generate_reference_style_image, generate_identity_preserving_image, generate_pose_transfer_image, generate_multi_view_fusion, extract_detailed_image_description, merge_image_descriptions_with_prompt, generate_enhanced_negative_prompt, generate_image_from_text_prompt
import json
from dotenv import load_dotenv
import sqlite3
import atexit
import contextlib
from PIL import Image
from io import BytesIO
import torch
import uuid
from shutil import rmtree

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
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Allow both ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add OPTIONS endpoint for CORS preflight
@app.options("/{full_path:path}")
async def options_handler(request: Request, full_path: str):
    origin = request.headers.get("origin", "http://localhost:3000")
    return JSONResponse(
        content={},
        headers={
            "Access-Control-Allow-Origin": origin,
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
    project_type: Optional[str] = "shot-suggestion"  # "shot-suggestion" or "image-fusion"

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    project_type: Optional[str]
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

class FusionImageRequest(BaseModel):
    prompt: str
    model_name: str = "runwayml/stable-diffusion-v1-5"
    strength: float = 0.8
    guidance_scale: float = 8.5
    num_inference_steps: int = 50

# Helper functions
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=24)  # 24 hours for development
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_project_storage_path(project_id: str, project_type: str = "shot-suggestion") -> str:
    """Get the storage path for a project based on its type"""
    if project_type == "image-fusion":
        base_path = os.path.join(PROJECT_IMAGES_ROOT, "fusion_projects", project_id)
    else:  # shot-suggestion
        base_path = os.path.join(PROJECT_IMAGES_ROOT, "shot_projects", project_id)
    
    # Create directory if it doesn't exist
    os.makedirs(base_path, exist_ok=True)
    return base_path

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
        description=project.description,
        project_type=project.project_type
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
    request: Request,
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
            # Use enhanced project structure if project_id is provided
            if project_id:
                # Save to enhanced project structure
                enhanced_session = save_enhanced_shots_to_project(
                    user_id=current_user["id"],
                    project_id=project_id,
                    session_data=input_data,
                    shots_data=shot_suggestions
                )
                
                if enhanced_session:
                    response_data["session_info"] = {
                        "id": enhanced_session["session_id"],
                        "folder_path": enhanced_session["session_dir"],
                        "images_dir": enhanced_session["images_dir"],
                        "type": "enhanced_project_session"
                    }
                    logger.info(f"Successfully saved shots to enhanced project structure: {enhanced_session}")
                else:
                    logger.error("Failed to save to enhanced project structure")
            else:
                # Fallback to filesystem session for non-project shots
                fs_session = save_shots_to_filesystem(
                    user_id=current_user["id"],
                    session_data=input_data,
                    shots_data=shot_suggestions,
                    project_id=None
                )
                
                if fs_session:
                    response_data["session_info"] = {
                        "id": fs_session["session_id"],
                        "folder_path": fs_session["folder_path"],
                        "type": "filesystem_session"
                    }
                    logger.info(f"Successfully saved shots to filesystem: {fs_session}")
        except Exception as e:
            # Log the error but continue - we still want to return the suggestions
            logger.error(f"Error saving shots: {str(e)}")
            
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
    project_id: str = Form(None),
    shot_index: str = Form(None),  # Changed from int to str to handle form data properly
    current_user: dict = Depends(get_current_user)
):
    try:
        logger.info(f"Generating image for shot description: '{shot_description}' with model: {model_name}")
        logger.info(f"Session ID: {session_id}, Project ID: {project_id}, Shot Index: {shot_index}")
        
        # Generate the image
        image_data = generate_shot_image(
            prompt=shot_description,
            model_name=model_name
        )
        
        logger.info("Image generation successful")
        
        # Prepare response
        response = {"image_url": image_data}        # Save image to enhanced project structure if we have the necessary info
        if project_id and session_id and shot_index is not None:
            try:
                shot_idx = int(shot_index) if shot_index else None
                
                if shot_idx is not None:
                    # Create session-specific image save path
                    try:
                        import base64
                        import os
                        from datetime import datetime
                        
                        # Create session images directory
                        session_images_dir = os.path.join(PROJECT_IMAGES_ROOT, project_id, session_id, "images")
                        os.makedirs(session_images_dir, exist_ok=True)
                        
                        # Save image file with shot index
                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                        image_filename = f"shot_{shot_idx}_{timestamp}.png"
                        image_path = os.path.join(session_images_dir, image_filename)
                        
                        # Decode and save image
                        if image_data.startswith('data:image'):
                            # Remove data URL prefix if present
                            image_data_clean = image_data.split(',')[1]
                        else:
                            image_data_clean = image_data
                            
                        image_bytes = base64.b64decode(image_data_clean)
                        with open(image_path, 'wb') as f:
                            f.write(image_bytes)
                          # Create relative path for frontend URL
                        relative_image_path = f"/projects/{project_id}/sessions/{session_id}/images/{image_filename}"
                        
                        response["saved_to_project"] = True
                        response["image_file_path"] = image_path
                        response["image_filename"] = image_filename
                        response["image_url"] = f"http://localhost:8000{relative_image_path}"  # Update URL to point to saved image
                        logger.info(f"Shot image saved to session: {image_path}")
                        
                        # Update shots.json file with the image information
                        try:
                            shots_file = os.path.join(PROJECT_IMAGES_ROOT, project_id, session_id, "shots.json")
                            if os.path.exists(shots_file):
                                with open(shots_file, 'r') as f:
                                    shots_data = json.load(f)
                                
                                # Update the specific shot with image URL
                                if 'shots' in shots_data and shot_idx < len(shots_data['shots']):
                                    shots_data['shots'][shot_idx]['image_url'] = relative_image_path
                                    shots_data['shots'][shot_idx]['image_filename'] = image_filename
                                    shots_data['shots'][shot_idx]['image_generated_at'] = datetime.now().isoformat()
                                    
                                    # Save updated shots.json
                                    with open(shots_file, 'w') as f:
                                        json.dump(shots_data, f, indent=2)
                                    
                                    logger.info(f"Updated shots.json with image for shot {shot_idx}")
                                    response["shots_json_updated"] = True
                        except Exception as shots_update_error:
                            logger.error(f"Error updating shots.json: {shots_update_error}")
                            response["shots_json_updated"] = False
                        
                    except Exception as save_error:
                        logger.error(f"Error saving shot image to session: {save_error}")
                        response["saved_to_project"] = False
                else:
                    logger.error("Failed to save image to project structure - invalid shot index")
                    response["saved_to_project"] = False
                        
            except Exception as project_save_error:
                logger.error(f"Error saving image to project: {str(project_save_error)}")
                response["saved_to_project"] = False

        # Handle legacy shot_id updates if provided
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
                (version_number, image_data, shot_id)
            )
            conn.commit()
            conn.close()
            logger.info(f"Shot {shot_id} updated successfully with new image")
        
        # Update legacy filesystem session if session_id is provided (fallback)
        if session_id and shot_index is not None and not project_id:
            try:
                # Convert shot_index to integer if it's a string
                shot_idx = int(shot_index) if shot_index else None
                
                logger.info(f"Updating legacy filesystem session {session_id} with image for shot index {shot_idx}")
                
                # Get the session data
                session_data = get_filesystem_session_data(current_user["id"], session_id)
                
                if session_data and "data" in session_data and "shots" in session_data["data"]:
                    shots = session_data["data"]["shots"]
                    
                    # Make sure the shot index is valid
                    if shot_idx is not None and 0 <= shot_idx < len(shots):
                        # Update the shot with the image URL
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
                                    
                                    logger.info(f"Updated legacy session file at {shots_path}")
                                    break
            except Exception as sess_error:
                logger.error(f"Error updating legacy session file: {str(sess_error)}")
                # Non-critical error, don't raise HTTP exception
        
        return response
        
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
    """List all sessions for a specific project"""    # Get sessions for this project from filesystem
    sessions = list_project_sessions(current_user["id"], project_id)
    if not sessions:
        return []
    
    return sorted(sessions, key=lambda x: x.get('created_at', ''), reverse=True)

@app.get("/projects/{project_id}/sessions/{session_id}/details")
async def get_project_session_details(
    project_id: str,
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get detailed session data from project folder including input/output files
    """
    import os
    try:
        from db import PROJECT_IMAGES_ROOT, get_session_by_id
        logger.info(f"Getting session details for project {project_id}, session {session_id}")
        # Try to find session folder
        project_dir = os.path.join(PROJECT_IMAGES_ROOT, project_id)
        session_folder = os.path.join(project_dir, session_id)
        if not os.path.exists(session_folder):
            return JSONResponse(status_code=404, content={"detail": "Session folder not found"})
        # Load input.json
        input_data = None
        input_file = os.path.join(session_folder, "input.json")
        if os.path.exists(input_file):
            with open(input_file, "r", encoding="utf-8") as f:
                input_data = json.load(f)
        # Load shots.json (for shot suggestion sessions)
        shots_data = None
        shots_file = os.path.join(session_folder, "shots.json")
        if os.path.exists(shots_file):
            with open(shots_file, "r", encoding="utf-8") as f:
                shots_data = json.load(f)
        # Load output.json
        output_data = None
        output_file = os.path.join(session_folder, "output.json")
        if os.path.exists(output_file):
            with open(output_file, "r", encoding="utf-8") as f:
                output_data = json.load(f)
        # List generated images
        images_dir = os.path.join(session_folder, "images")
        image_files = []
        if os.path.exists(images_dir):
            for fname in os.listdir(images_dir):
                if fname.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                    image_files.append({
                        "filename": fname,
                        "url": f"/projects/{project_id}/sessions/{session_id}/images/{fname}"
                    })
        return {
            "session": {"id": session_id, "project_id": project_id},
            "session_folder": session_folder,
            "input_data": input_data,
            "shots_data": shots_data,
            "output_data": output_data,
            "image_files": image_files,
            "file_summary": {
                "has_input": input_data is not None,
                "has_shots": shots_data is not None,
                "has_output": output_data is not None,
                "image_count": len(image_files)
            }
        }
    except Exception as e:
        logger.error(f"Error loading session details: {str(e)}")
        return JSONResponse(status_code=500, content={"detail": f"Failed to load session details: {str(e)}"})

@app.post("/fusion/generate-image")
async def fusion_generate_image_with_final_prompt(
    final_prompt: str = Form(...),
    project_id: str = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Generate fusion image using the final prompt that already contains
    the analysis of reference images + user's desired angle.
    """
    try:
        logger.info(f"Fusion generate-image from user {current_user['username']}")
        logger.info(f"Final prompt: {final_prompt[:200]}...")
        
        if not final_prompt.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Final prompt cannot be empty"
            )
        
        # Import the function        # Generate image using text-to-image with the final prompt and optimized parameters
        generated_image = generate_image_from_text_prompt(
            prompt=final_prompt,
            num_inference_steps=30,  # Optimized for better speed/quality balance
            guidance_scale=8.0       # Better prompt following
        )
        
        logger.info("Image generation completed successfully")
        
        # Save the fusion session data to project if project_id is provided
        saved_data = None
        if project_id:
            try:
                # Save fusion data to project structure
                saved_data = save_fusion_session_to_project(
                    user_id=current_user["id"],
                    project_id=project_id,
                    final_prompt=final_prompt,
                    generated_image=generated_image
                )
                
                if saved_data:
                    logger.info(f"Fusion session saved to project {project_id}")
                else:
                    logger.warning("Failed to save fusion session to project")                    
            except Exception as save_error:
                logger.error(f"Error saving fusion session: {str(save_error)}")
        
        response_data = {
            "success": True,
            "image_data": generated_image,
            "prompt_used": final_prompt,
            "message": "Image generated successfully using final prompt"
        }
        # Add save information if data was saved
        if saved_data:
            response_data["saved_to_project"] = True
            response_data["session_info"] = {
                "session_id": saved_data["session_id"],
                "session_dir": saved_data["session_dir"],
                "images_dir": saved_data["images_dir"]
            }
            if saved_data.get("image_filename"):
                response_data["image_url"] = f"http://localhost:8000/projects/{project_id}/sessions/{saved_data['session_name']}/images/{saved_data['image_filename']}"
        return response_data
        
    except Exception as e:
        logger.error(f"Error in fusion generate-image: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate image: {str(e)}"
        )

@app.post("/fusion/generate")
async def generate_fusion_image_endpoint(
    prompt: str = Form(...),
    model_name: str = Form("runwayml/stable-diffusion-v1-5"),
    strength: float = Form(0.65),  # Reduced from 0.8 for better reference preservation
    guidance_scale: float = Form(10.0),  # Increased from 8.5 for better prompt following
    num_inference_steps: int = Form(60),  # Increased from 50 for better quality
    reference_images: List[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a fused image from multiple reference images and a prompt.
    
    Args:
        prompt: User's creative requirements/description
        model_name: The diffusion model to use
        strength: How much to blend reference images (0.0-1.0) - lower values preserve more reference characteristics
        guidance_scale: How closely to follow the prompt - higher values follow prompt more closely
        num_inference_steps: Number of denoising steps - more steps for better quality
        reference_images: List of uploaded reference images
        current_user: Authenticated user
    
    Returns:
        Base64 encoded generated image
    """
    try:
        logger.info(f"Fusion image generation request from user {current_user['username']}")
        logger.info(f"Prompt: {prompt}")
        logger.info(f"Number of reference images: {len(reference_images)}")
        
        # Validate inputs
        if len(reference_images) < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one reference image is required"
            )
        
        if len(reference_images) > 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum 10 reference images allowed"
            )
        
        if not prompt.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Prompt cannot be empty"
            )
        
        # Process uploaded images
        processed_images = []
        for i, uploaded_file in enumerate(reference_images):
            try:
                # Validate file type
                if not uploaded_file.content_type.startswith('image/'):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"File {uploaded_file.filename} is not an image"
                    )
                
                # Read and process image
                image_data = await uploaded_file.read()
                image = Image.open(BytesIO(image_data))
                
                # Validate image size
                if len(image_data) > 10 * 1024 * 1024:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Image {uploaded_file.filename} is too large (max 10MB)"
                    )
                
                processed_images.append(image)
                logger.info(f"Processed reference image {i+1}: {uploaded_file.filename}")
                
            except Exception as e:
                logger.error(f"Error processing image {uploaded_file.filename}: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Error processing image {uploaded_file.filename}: {str(e)}"
                )
        
        # Analyze reference images for better prompt enhancement
        try:
            analysis = analyze_reference_images(processed_images)
            logger.info(f"Image analysis: {analysis}")
            
            # Enhance prompt based on analysis to preserve complete themes
            enhanced_prompt = prompt
            
            # Add theme preservation elements
            if analysis.get("theme_elements"):
                theme_elements = ", ".join(analysis["theme_elements"])
                enhanced_prompt += f", {theme_elements}"
            
            # Add prop preservation
            if analysis.get("prop_elements"):
                prop_elements = ", ".join(analysis["prop_elements"])
                enhanced_prompt += f", same props: {prop_elements}"
            
            # Add setting preservation
            if analysis.get("setting_elements"):
                setting_elements = ", ".join(analysis["setting_elements"])
                enhanced_prompt += f", same setting: {setting_elements}"
            
            # Add overall mood if consistent
            if analysis["overall_mood"] != "balanced":
                enhanced_prompt += f", {analysis['overall_mood']} mood"
            
            # Add visual style consistency
            if analysis["visual_style"] != "balanced":
                enhanced_prompt += f", {analysis['visual_style']} composition"
            
            # Add dominant elements preservation
            if analysis.get("dominant_elements"):
                dominant_elements = ", ".join(analysis["dominant_elements"])
                enhanced_prompt += f", preserve: {dominant_elements}"
            
        except Exception as e:
            logger.warning(f"Image analysis failed, using original prompt: {str(e)}")
            enhanced_prompt = prompt
        
        # Generate the fused image
        logger.info("Starting fusion image generation...")
        generated_image = generate_fusion_image(
            prompt=enhanced_prompt,
            reference_images=processed_images,
            model_name="runwayml/stable-diffusion-v1-5",
            strength=strength,
            guidance_scale=guidance_scale,
            num_inference_steps=num_inference_steps
        )
        
        logger.info("Fusion image generation completed successfully")
        
        return {
            "image_url": generated_image,
            "prompt_used": enhanced_prompt,
            "analysis": analysis if 'analysis' in locals() else None,
            "processing_info": {
                "device": "cuda" if torch.cuda.is_available() else "cpu",
                "model": model_name,
                "strength": strength,
                "guidance_scale": guidance_scale,
                "num_inference_steps": num_inference_steps
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in fusion image generation: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate fusion image: {str(e)}"
        )

@app.post("/api/fuse-reference")
async def fuse_reference(
    prompt: str = Form(...),
    files: list[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Generate an image using reference images for style/theme and a prompt for content/angle.
    Uses ControlNet Reference Adapter.
    """
    from PIL import Image
    import tempfile
    reference_images = []
    for file in files:
        contents = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
            tmp.write(contents)
            tmp.flush()
            reference_images.append(tmp.name)
    img_str = generate_reference_style_image(prompt, reference_images)
    return {"image": img_str}

@app.post("/api/identity-preserve")
async def identity_preserve(
    prompt: str = Form(...),
    files: list[UploadFile] = File(...),
    ip_adapter_scale: float = Form(0.8),
    guidance_scale: float = Form(7.5),
    num_inference_steps: int = Form(30),
    current_user: dict = Depends(get_current_user)
):
    """
    Generate an image that preserves the identity of a person from reference images
    while allowing pose/scenario changes as specified in the prompt.
    Uses IP-Adapter for identity preservation.
    """
    from PIL import Image
    import tempfile
    reference_images = []
    for file in files:
        contents = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
            tmp.write(contents)
            tmp.flush()
            reference_images.append(tmp.name)
    img_str = generate_identity_preserving_image(
        prompt, 
        reference_images, 
        ip_adapter_scale=ip_adapter_scale,
        guidance_scale=guidance_scale,
        num_inference_steps=num_inference_steps
    )
    return {"image": img_str}

@app.post("/api/pose-transfer")
async def pose_transfer(
    prompt: str = Form(...),
    files: list[UploadFile] = File(...),
    strength: float = Form(0.8),
    guidance_scale: float = Form(7.5),
    num_inference_steps: int = Form(30),
    current_user: dict = Depends(get_current_user)
):
    """
    Generate an image that transfers the pose/style from reference images
    while maintaining identity and applying the new scenario from prompt.
    """
    from PIL import Image
    import tempfile
    reference_images = []
    for file in files:
        contents = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
            tmp.write(contents)
            tmp.flush()
            reference_images.append(tmp.name)
    img_str = generate_pose_transfer_image(
        prompt, 
        reference_images, 
        strength=strength,
        guidance_scale=guidance_scale,
        num_inference_steps=num_inference_steps
    )
    return {"image": img_str}

@app.post("/api/theme-preserve")
async def theme_preserve(
    prompt: str = Form(...),
    files: List[UploadFile] = File(...),
    strength: float = Form(0.6),  # Balanced for theme preservation and prompt following
    guidance_scale: float = Form(15.0),  # Higher for stronger theme following
    num_inference_steps: int = Form(100),  # More steps for better quality
    current_user: dict = Depends(get_current_user)
):
    """
    Generate an image that preserves the complete theme, props, objects, and visual style
    from reference images while generating a new angle/view based on the prompt.
    Optimized for "same world, new angle" generation.
    """
    try:
        logger.info(f"Theme preservation request from user {current_user['username']}")
        logger.info(f"Prompt: {prompt}")
        logger.info(f"Number of reference images: {len(files)}")
        
        # Validate inputs
        if len(files) < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one reference image is required"
            )
        
        if len(files) > 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum 10 reference images allowed for theme preservation"
            )
        
        if not prompt.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Prompt cannot be empty"
            )
        
        # Process uploaded images
        processed_images = []
        for i, uploaded_file in enumerate(files):
            try:
                # Validate file size (max 10MB)
                if uploaded_file.size > 10 * 1024 * 1024:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Image {uploaded_file.filename} is too large (max 10MB)"
                    )
                
                # Read and validate image
                image_data = await uploaded_file.read()
                image = Image.open(BytesIO(image_data))
                
                # Convert to RGB if necessary
                if image.mode not in ("RGB", "RGBA"):
                    image = image.convert("RGB")
                elif image.mode == "RGBA":
                    # Convert RGBA to RGB with white background
                    background = Image.new("RGB", image.size, (255, 255, 255))
                    background.paste(image, mask=image.split()[-1])
                    image = background
                
                # Validate image dimensions
                if image.width < 64 or image.height < 64:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Image {uploaded_file.filename} is too small (minimum 64x64)"
                    )
                
                if image.width > 2048 or image.height > 2048:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Image {uploaded_file.filename} is too large (max 2048x2048)"
                    )
                
                processed_images.append(image)
                logger.info(f"Processed reference image {i+1}: {uploaded_file.filename}")
                
            except Exception as e:
                logger.error(f"Error processing image {uploaded_file.filename}: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Error processing image {uploaded_file.filename}: {str(e)}"
                )
        
        # Enhance prompt for better "same world, new angle" generation
        enhanced_prompt = f"{prompt}, exact same world, exact same scene, exact same objects, exact same props, exact same lighting conditions, exact same visual style, exact same color palette, exact same environment, exact same setting, preserve all visual elements completely, only change the camera angle or viewpoint, maintain all original details"
        
        # Generate the theme-preserving image with enhanced parameters
        logger.info("Starting theme-preserving image generation...")
        generated_image = generate_fusion_image(
            prompt=enhanced_prompt,
            reference_images=processed_images,
            model_name="runwayml/stable-diffusion-v1-5",
            strength=strength,
            guidance_scale=guidance_scale,
            num_inference_steps=num_inference_steps
        )
        
        logger.info("Theme-preserving image generation completed successfully")
        
        return {
            "image": generated_image,
            "message": "Theme-preserving image generated successfully",
            "processing_info": {
                "device": "cuda" if torch.cuda.is_available() else "cpu",
                "strength": strength,
                "guidance_scale": guidance_scale,
                "num_inference_steps": num_inference_steps,
                "enhanced_prompt": enhanced_prompt
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in theme preservation: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate theme-preserving image: {str(e)}"
        )

# Test endpoint for debugging image generation
@app.post("/test/image-generation")
async def test_image_generation(
    prompt: str = Form("a beautiful landscape"),
    current_user: dict = Depends(get_current_user)
):
    """Simple test endpoint to verify image generation is working"""
    try:
        logger.info(f"Test image generation for prompt: '{prompt}'")
        
        # Generate a simple image without reference
        image_data = generate_shot_image(
            prompt=prompt,
            model_name="runwayml/stable-diffusion-v1-5"
        )
        
        return {
            "success": True,
            "image_url": image_data,
            "prompt_used": prompt,
            "message": "Test image generation successful"
        }
        
    except Exception as e:
        logger.error(f"Test image generation failed: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "message": "Test image generation failed"
        }

@app.post("/fusion/advanced-match")
async def advanced_reference_matching(
    prompt: str = Form(...),
    reference_images: List[UploadFile] = File(...),
    matching_type: str = Form("style"),  # "style", "identity", "pose", "theme"
    strength: float = Form(0.6),  # Even lower for better preservation
    guidance_scale: float = Form(12.0),  # Higher for better prompt following
    num_inference_steps: int = Form(80),  # More steps for better quality
    current_user: dict = Depends(get_current_user)
):
    """
    Advanced reference image matching with specialized techniques for different types of matching.
    
    Args:
        prompt: User's creative requirements/description
        reference_images: List of uploaded reference images
        matching_type: Type of matching - "style", "identity", "pose", "theme"
        strength: How much to blend reference images (0.0-1.0)
        guidance_scale: How closely to follow the prompt
        num_inference_steps: Number of denoising steps
        current_user: Authenticated user
    
    Returns:
        Base64 encoded generated image
    """
    try:
        logger.info(f"Advanced reference matching request from user {current_user['username']}")
        logger.info(f"Matching type: {matching_type}")
        logger.info(f"Number of reference images: {len(reference_images)}")
        
        # Validate inputs
        if len(reference_images) < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one reference image is required"
            )
        
        if matching_type not in ["style", "identity", "pose", "theme"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Matching type must be one of: style, identity, pose, theme"
            )
        
        # Process uploaded images
        processed_images = []
        for i, uploaded_file in enumerate(reference_images):
            try:
                if not uploaded_file.content_type.startswith('image/'):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"File {uploaded_file.filename} is not an image"
                    )
                
                image_data = await uploaded_file.read()
                image = Image.open(BytesIO(image_data))
                
                if len(image_data) > 10 * 1024 * 1024:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Image {uploaded_file.filename} is too large (max 10MB)"
                    )
                
                processed_images.append(image)
                logger.info(f"Processed image {i+1}: {uploaded_file.filename}")
                
            except Exception as e:
                logger.error(f"Error processing image {uploaded_file.filename}: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Error processing image {uploaded_file.filename}: {str(e)}"
                )
        
        # Choose the appropriate generation method based on matching type
        if matching_type == "style":
            # Use ControlNet Reference for style matching
            generated_image = generate_reference_style_image(
                prompt=prompt,
                reference_images=processed_images,
                num_inference_steps=num_inference_steps,
                guidance_scale=guidance_scale
            )
        elif matching_type == "identity":
            # Use IP-Adapter for identity preservation
            generated_image = generate_identity_preserving_image(
                prompt=prompt,
                reference_images=processed_images,
                num_inference_steps=num_inference_steps,
                guidance_scale=guidance_scale,
                ip_adapter_scale=strength
            )
        elif matching_type == "pose":
            # Use pose transfer technique
            generated_image = generate_pose_transfer_image(
                prompt=prompt,
                reference_images=processed_images,
                num_inference_steps=num_inference_steps,
                guidance_scale=guidance_scale,
                strength=strength
            )
        else:  # theme
            # Use enhanced fusion for theme preservation
            generated_image = generate_fusion_image(
                prompt=prompt,
                reference_images=processed_images,
                strength=strength,
                guidance_scale=guidance_scale,
                num_inference_steps=num_inference_steps
            )
        
        logger.info(f"Advanced {matching_type} matching completed successfully")
        
        return {
            "image_url": generated_image,
            "matching_type": matching_type,
            "prompt_used": prompt,
            "processing_info": {
                "device": "cuda" if torch.cuda.is_available() else "cpu",
                "strength": strength,
                "guidance_scale": guidance_scale,
                "num_inference_steps": num_inference_steps
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in advanced reference matching: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate advanced reference matching: {str(e)}"
        )

@app.post("/api/multi-view-fusion")
async def multi_view_fusion(
    prompt: str = Form(...),
    files: List[UploadFile] = File(...),
    strength: float = Form(0.55),  # Balanced for consistency and prompt following
    guidance_scale: float = Form(16.0),  # Strong guidance
    num_inference_steps: int = Form(80),  # Good quality
    current_user: dict = Depends(get_current_user)
):
    """
    Generate new viewpoints from multiple reference images with enhanced consistency.
    
    Ideal for scenarios like:
    - Car front view → car side view
    - Building from street → building from above
    - Object from one angle → object from another angle
    
    Works best with 2-4 reference images showing different angles of the same subject.
    """
    try:
        logger.info(f"Multi-view fusion request from user {current_user['username']}")
        logger.info(f"Prompt: {prompt}")
        logger.info(f"Number of reference images: {len(files)}")
        
        # Validate inputs
        if len(files) < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one reference image is required"
            )
        
        if len(files) > 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum 6 reference images allowed for multi-view fusion"
            )
        
        if not prompt.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Viewpoint prompt cannot be empty"
            )
        
        # Process uploaded images
        processed_images = []
        for i, uploaded_file in enumerate(files):
            try:
                # Validate file type
                if not uploaded_file.content_type.startswith('image/'):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"File {uploaded_file.filename} is not an image"
                    )
                
                # Read and process image
                image_data = await uploaded_file.read()
                image = Image.open(BytesIO(image_data))
                
                # Validate image size
                if len(image_data) > 10 * 1024 * 1024:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Image {uploaded_file.filename} is too large (max 10MB)"
                    )
                
                processed_images.append(image)
                logger.info(f"Processed reference image {i+1}: {uploaded_file.filename}")
                
            except Exception as e:
                logger.error(f"Error processing image {uploaded_file.filename}: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Error processing image {uploaded_file.filename}: {str(e)}"
                )
        
        # Generate the multi-view fusion
        logger.info("Starting multi-view fusion generation...")
        generated_image = generate_multi_view_fusion(
            prompt=prompt,
            reference_images=processed_images,
            model_name="runwayml/stable-diffusion-v1-5",
            strength=strength,
            guidance_scale=guidance_scale,
            num_inference_steps=num_inference_steps
        )
        
        logger.info("Multi-view fusion generation completed successfully")
        
        return {
            "image": generated_image,
            "message": "Multi-view fusion generated successfully",
            "processing_info": {
                "device": "cuda" if torch.cuda.is_available() else "cpu",
                "num_reference_images": len(processed_images),
                "strength": strength,
                "guidance_scale": guidance_scale,
                "num_inference_steps": num_inference_steps,
                "optimization": "multi_view_consistency"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in multi-view fusion: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate multi-view fusion: {str(e)}"
        )

@app.post("/api/enhanced-fusion")
async def enhanced_fusion(
    prompt: str = Form(...),
    files: List[UploadFile] = File(...),
    strength: float = Form(0.55),
    guidance_scale: float = Form(12.0),
    num_inference_steps: int = Form(70),
    current_user: dict = Depends(get_current_user)
):
    """
    Enhanced image fusion using image-to-text-to-image approach.
    
    This endpoint:
    1. Extracts detailed text descriptions from reference images (like AI vision analysis)
    2. Merges these descriptions with the user's prompt
    3. Generates images that preserve all background, character, and theme details
    
    This approach significantly improves theme and character consistency compared to traditional methods.
    """
    try:
        logger.info(f"Enhanced fusion request from user {current_user['username']}")
        logger.info(f"Prompt: {prompt}")
        logger.info(f"Number of reference images: {len(files)}")
        
        # Validate inputs
        if len(files) < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one reference image is required"
            )
        
        if len(files) > 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum 8 reference images allowed for enhanced fusion"
            )
        
        if not prompt.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Prompt cannot be empty"
            )
        
        # Process uploaded images
        processed_images = []
        for i, uploaded_file in enumerate(files):
            try:
                # Validate file size (max 10MB)
                if uploaded_file.size > 10 * 1024 * 1024:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Image {uploaded_file.filename} is too large (max 10MB)"
                    )
                
                # Read and validate image
                image_data = await uploaded_file.read()
                image = Image.open(BytesIO(image_data))
                
                # Convert to RGB if necessary
                if image.mode not in ("RGB", "RGBA"):
                    image = image.convert("RGB")
                elif image.mode == "RGBA":
                    # Convert RGBA to RGB with white background
                    background = Image.new("RGB", image.size, (255, 255, 255))
                    background.paste(image, mask=image.split()[-1])
                    image = background
                
                # Validate image dimensions
                if image.width < 64 or image.height < 64:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Image {uploaded_file.filename} is too small (minimum 64x64)"
                    )
                
                if image.width > 2048 or image.height > 2048:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Image {uploaded_file.filename} is too large (max 2048x2048)"
                    )
                
                processed_images.append(image)
                logger.info(f"Processed reference image {i+1}: {uploaded_file.filename}")
                
            except Exception as e:
                logger.error(f"Error processing image {uploaded_file.filename}: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Error processing image {uploaded_file.filename}: {str(e)}"
                )
        
        # Generate the enhanced fusion using image-to-text-to-image approach
        logger.info("Starting enhanced fusion generation...")
        generated_image = generate_fusion_image(
            prompt=prompt,
            reference_images=processed_images,
            model_name="runwayml/stable-diffusion-v1-5",
            strength=strength,
            guidance_scale=guidance_scale,
            num_inference_steps=num_inference_steps
        )
        
        logger.info("Enhanced fusion generation completed successfully")
        
        return {
            "image": generated_image,
            "message": "Enhanced fusion generated successfully using image-to-text-to-image approach",
            "processing_info": {
                "device": "cuda" if torch.cuda.is_available() else "cpu",
                "num_reference_images": len(processed_images),
                "strength": strength,
                "guidance_scale": guidance_scale,
                "num_inference_steps": num_inference_steps,
                "approach": "image_to_text_to_image",
                "enhancement": "detailed_visual_analysis"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in enhanced fusion: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate enhanced fusion: {str(e)}"
        )

@app.post("/api/analyze-images")
async def analyze_images(
    files: List[UploadFile] = File(...),
    project_id: str = Form(None),
    session_id: str = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Analyze uploaded reference images and return detailed descriptions.
    Also stores reference image metadata and analysis in input.json if project_id and session_id are provided.
    """
    try:
        logger.info(f"Image analysis request from user {current_user['username']}")
        logger.info(f"Number of images to analyze: {len(files)}")
        # Validate inputs
        if len(files) < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one image is required for analysis"
            )
        if len(files) > 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum 10 images allowed for analysis"
            )
        # Process and analyze each image
        image_analyses = []
        reference_images_metadata = []
        for i, uploaded_file in enumerate(files):
            try:
                # Validate file size (max 10MB)
                if uploaded_file.size > 10 * 1024 * 1024:
                    image_analyses.append({
                        "filename": uploaded_file.filename,
                        "status": "error",
                        "error": f"Image too large (max 10MB)",
                        "description": None
                    })
                    continue
                # Read and validate image
                image_data = await uploaded_file.read()
                image = Image.open(BytesIO(image_data))
                # Convert to RGB if necessary
                if image.mode not in ("RGB", "RGBA"):
                    image = image.convert("RGB")
                elif image.mode == "RGBA":
                    background = Image.new("RGB", image.size, (255, 255, 255))
                    background.paste(image, mask=image.split()[-1])
                    image = background
                # Validate image dimensions
                if image.width < 64 or image.height < 64:
                    image_analyses.append({
                        "filename": uploaded_file.filename,
                        "status": "error",
                        "error": f"Image too small (minimum 64x64)",
                        "description": None
                    })
                    continue
                if image.width > 2048 or image.height > 2048:
                    image_analyses.append({
                        "filename": uploaded_file.filename,
                        "status": "error", 
                        "error": f"Image too large (max 2048x2048)",
                        "description": None
                    })
                    continue
                # Extract detailed description using AI vision
                logger.info(f"Analyzing image {i+1}: {uploaded_file.filename}")
                description = extract_detailed_image_description(image)
                # Also get basic technical analysis
                basic_analysis = analyze_reference_images([image])
                image_analyses.append({
                    "filename": uploaded_file.filename,
                    "status": "success",
                    "description": description,
                    "technical_info": {
                        "dimensions": f"{image.width}x{image.height}",
                        "mode": image.mode,
                        "overall_mood": basic_analysis.get("overall_mood", "balanced"),
                        "visual_style": basic_analysis.get("visual_style", "balanced"),
                        "lighting_conditions": basic_analysis.get("lighting_conditions", ["balanced"])
                    },
                    "error": None
                })
                # Save reference image metadata for session restoration
                reference_images_metadata.append({
                    "filename": uploaded_file.filename,
                    "content_type": uploaded_file.content_type,
                    # Optionally, save a base64 preview or a relative URL if saved to disk
                })
                logger.info(f"Successfully analyzed image {i+1}: {uploaded_file.filename}")
            except Exception as e:
                logger.error(f"Error analyzing image {uploaded_file.filename}: {str(e)}")
                image_analyses.append({
                    "filename": uploaded_file.filename,
                    "status": "error",
                    "error": f"Analysis failed: {str(e)}",
                    "description": None
                })
        # Save to input.json if project_id and session_id are provided
        if project_id and session_id:
            try:
                from db import PROJECT_IMAGES_ROOT
                session_folder = os.path.join(PROJECT_IMAGES_ROOT, project_id, session_id)
                input_file = os.path.join(session_folder, "input.json")
                # Load existing input.json if present
                input_data = {}
                if os.path.exists(input_file):
                    with open(input_file, "r", encoding="utf-8") as f:
                        input_data = json.load(f)
                # Store reference images and analyses
                input_data["reference_images"] = reference_images_metadata
                input_data["reference_image_analyses"] = image_analyses
                with open(input_file, "w", encoding="utf-8") as f:
                    json.dump(input_data, f, indent=2)
                logger.info(f"Saved reference image metadata and analyses to {input_file}")
            except Exception as e:
                logger.error(f"Failed to save reference image metadata/analyses to input.json: {e}")
                # Don't fail the whole endpoint, but log

        # Count successful analyses
        successful_analyses = len([a for a in image_analyses if a["status"] == "success"])
        logger.info(f"Image analysis completed: {successful_analyses}/{len(files)} successful")
        return {
            "analyses": image_analyses,
            "summary": {
                "total_images": len(files),
                "successful_analyses": successful_analyses,
                "failed_analyses": len(files) - successful_analyses
            },
            "message": f"Analyzed {successful_analyses} out of {len(files)} images successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in image analysis: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze images: {str(e)}"
        )

@app.post("/api/preview-combined-prompt")
async def preview_combined_prompt(
    user_prompt: str = Form(...),
    image_descriptions: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Combine user prompt and image descriptions for previewing the final prompt before generation.
    """
    import json
    try:
        # Parse image descriptions
        descriptions = json.loads(image_descriptions)
        if not isinstance(descriptions, list):
            raise ValueError("image_descriptions must be a list of strings")
        # Combine all descriptions into one string
        combined_descriptions = ". ".join([desc for desc in descriptions if isinstance(desc, str)])
        # Merge with user prompt
        combined_prompt = f"{combined_descriptions}. {user_prompt}" if combined_descriptions else user_prompt
        return {
            "combined_prompt": combined_prompt,
            "descriptions_used": descriptions,
            "user_prompt": user_prompt
        }
    except Exception as e:
        return {
            "detail": f"Failed to combine prompt: {str(e)}"
        }
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

@app.get("/projects/{project_id}/sessions/{session_id}/images/{filename}")
async def get_session_image(project_id: str, session_id: str, filename: str):
    """
    Serve an image file from the session's images directory with error logging.
    """
    import os
    from fastapi.responses import FileResponse
    from db import PROJECT_IMAGES_ROOT
    images_dir = os.path.join(PROJECT_IMAGES_ROOT, project_id, session_id, "images")
    file_path = os.path.join(images_dir, filename)
    logger.info(f"Image requested: {file_path}")
    if not os.path.exists(file_path):
        logger.warning(f"Image not found: {file_path}")
        return JSONResponse(status_code=404, content={"detail": f"Image not found: {filename}"})
    try:
        return FileResponse(file_path)
    except Exception as e:
        logger.error(f"Failed to serve image {file_path}: {str(e)}")
        return JSONResponse(status_code=500, content={"detail": f"Failed to serve image: {str(e)}"})
    
@app.post("/projects/{project_id}/fusion/start-session")
async def start_fusion_session(project_id: str, current_user: dict = Depends(get_current_user)):
    """
    Create a new fusion session: create session folder, images subfolder, and minimal input.json.
    """
    import uuid
    import os
    import json
    from db import PROJECT_IMAGES_ROOT
    from datetime import datetime
    try:
        # Create unique session id
        session_id = str(uuid.uuid4())
        project_dir = os.path.join(PROJECT_IMAGES_ROOT, project_id)
        session_folder = os.path.join(project_dir, session_id)
        images_dir = os.path.join(session_folder, "images")
        os.makedirs(images_dir, exist_ok=True)
        # Write minimal input.json
        input_file = os.path.join(session_folder, "input.json")
        input_data = {
            "created_at": datetime.now().isoformat(),
            "session_id": session_id,
            "project_id": project_id,
            "type": "fusion"
        }
        with open(input_file, "w", encoding="utf-8") as f:
            json.dump(input_data, f, indent=2)
        logger.info(f"Created new fusion session: {session_id} for project {project_id}")
        return {
            "session_id": session_id,
            "session_folder": session_folder,
            "images_dir": images_dir,
            "input_file": input_file,
            "input_data": input_data
        }
    except Exception as e:
        logger.error(f"Failed to create fusion session: {str(e)}")
        return JSONResponse(status_code=500, content={"detail": f"Failed to create fusion session: {str(e)}"})
