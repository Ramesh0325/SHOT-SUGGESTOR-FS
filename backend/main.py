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
from db import (
    init_db, create_user, authenticate_user, get_user_by_username,
    create_project, get_user_projects, get_project, delete_project,
    save_shot, get_project_shots, get_shot, delete_shot,
    save_session, list_user_sessions, get_session_data, rename_session, delete_session,
    get_db_connection
)
from model import gemini, generate_shot_image
import json
from dotenv import load_dotenv
import sqlite3

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
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,  # Important for cookies/auth
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
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
        # Decode the JWT token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError as e:
        if isinstance(e, jwt.ExpiredSignatureError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        raise credentials_exception
        
    # Get user from database
    user = get_user_by_username(username=token_data.username)
    if user is None:
        raise credentials_exception
        
    return user

# Root endpoint
@app.get("/")
async def root():
    return {"message": "AI Cinematic Shot Suggestor Backend Running"}

# Authentication endpoints
@app.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )
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

@app.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    user = get_user_by_username(username=current_user["username"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return JSONResponse(
        content={
            "id": user["id"],
            "username": user["username"],
            "email": user.get("email"),
            "full_name": user.get("full_name"),
            "disabled": user.get("disabled", False)
        },
        headers={
            "Access-Control-Allow-Origin": FRONTEND_URL,
            "Access-Control-Allow-Credentials": "true"
        }
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
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    project = get_project(project_id)
    if not project or project["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    if delete_project(project_id):
        return {"message": "Project deleted successfully"}
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Failed to delete project"
    )

# Shot suggestion and image generation endpoints
@app.post("/shots/suggest")
async def suggest_shots(
    shot_data: ShotCreate,
    current_user: dict = Depends(get_current_user)
):
    try:
        # Generate shot suggestions using the Gemini model
        suggestions = await gemini(
            scene_description=shot_data.scene_description,
            num_shots=shot_data.num_shots
        )
        return suggestions  # Return suggestions directly since they're already in the correct format
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

@app.post("/shots/generate-image")
async def generate_image(
    shot_description: str = Form(...),
    model_name: str = Form(...),
    reference_image: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user)
):
    try:
        # Generate image using the model
        image_url = generate_shot_image(
            prompt=shot_description,
            model_name=model_name,
            reference_image=reference_image.file if reference_image else None
        )
        return {"image_url": image_url}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

# Shot management endpoints
@app.post("/projects/{project_id}/shots", response_model=ShotResponse)
async def create_shot(
    project_id: str,
    shot_number: int = Form(...),
    scene_description: str = Form(...),
    shot_description: str = Form(...),
    model_name: str = Form(...),
    image_url: Optional[str] = Form(None),
    metadata: UploadFile = File(None),
    current_user: dict = Depends(get_current_user)
):
    """Create a new shot in a project"""
    try:
        # Verify project ownership
        project = get_project(project_id)
        if not project or project["user_id"] != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        # Read and parse metadata blob if provided
        metadata_dict = None
        if metadata:
            try:
                content = await metadata.read()
                metadata_dict = json.loads(content.decode())
                # Validate metadata structure
                required_fields = ['camera_angle', 'camera_movement', 'framing']
                if not all(field in metadata_dict for field in required_fields):
                    raise ValueError("Missing required metadata fields")
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid metadata format"
                )
            except ValueError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(e)
                )
        
        # Save shot to database
        shot_id = save_shot(
            project_id=project_id,
            shot_number=shot_number,
            scene_description=scene_description,
            shot_description=shot_description,
            model_name=model_name,
            image_url=image_url,
            metadata=metadata_dict
        )
        
        if not shot_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to save shot"
            )
            
        # Get and return the created shot
        shot = get_shot(shot_id)
        if not shot:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve created shot"
            )
            
        return shot
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating shot: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating shot: {str(e)}"
        )

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
    shot_id: str,
    current_user: dict = Depends(get_current_user)
):
    shot = get_shot(shot_id)
    if not shot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shot not found"
        )
    
    # Verify project ownership
    project = get_project(shot["project_id"])
    if not project or project["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this shot"
        )
    
    if delete_shot(shot_id):
        return {"message": "Shot deleted successfully"}
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Failed to delete shot"
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

@app.get("/sessions", response_model=List[SessionResponse])
async def list_sessions(current_user: dict = Depends(get_current_user)):
    return list_user_sessions(current_user["id"])

@app.get("/sessions/{session_name}")
async def get_session(
    session_name: str,
    current_user: dict = Depends(get_current_user)
):
    session = get_session_data(current_user["id"], session_name)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
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

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    init_db()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
