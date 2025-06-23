import re
import torch
from langdetect import detect
from PIL import Image
import google.generativeai as genai
from diffusers import StableDiffusionPipeline, StableDiffusionImg2ImgPipeline
from diffusers import ControlNetModel, StableDiffusionControlNetPipeline
from diffusers.utils import load_image
import numpy as np
import sqlite3
import os
import json
import base64
from io import BytesIO
from typing import List, Dict, Any, Optional
import requests
from fastapi import HTTPException
from dotenv import load_dotenv
import logging
import time
import backoff
from collections import deque
from threading import Lock
import hashlib
import functools
from datetime import datetime, timedelta
import aiosqlite
import colorsys
try:
    import cv2
except ImportError:
    raise ImportError("OpenCV (cv2) is required for ControlNet reference image preprocessing. Please install it with 'pip install opencv-python-headless' and restart your app.")

# Try to import ControlNet Reference Pipeline, but don't fail if not available
try:
    from diffusers import StableDiffusionControlNetReferencePipeline
    CONTROLNET_REFERENCE_AVAILABLE = True
except ImportError:
    CONTROLNET_REFERENCE_AVAILABLE = False
    print("Warning: StableDiffusionControlNetReferencePipeline not available. Advanced fusion will use fallback method.")

# Try to import IP-Adapter for identity preservation
try:
    from diffusers import StableDiffusionPipeline
    from ip_adapter import IPAdapter
    IP_ADAPTER_AVAILABLE = True
except ImportError:
    IP_ADAPTER_AVAILABLE = False
    print("Warning: IP-Adapter not available. Identity preservation will use fallback method.")

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class RateLimiter:
    def __init__(self, requests_per_minute=15, requests_per_day=200):  # More conservative limits
        self.requests_per_minute = requests_per_minute
        self.requests_per_day = requests_per_day
        self.minute_requests = deque(maxlen=requests_per_minute)
        self.daily_requests = deque(maxlen=requests_per_day)
        self.lock = Lock()
        self.cache_ttl = timedelta(hours=24)
        self.db_path = "cache.db"
        self._init_db()

    def _init_db(self):
        """Initialize the SQLite database for persistent caching"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS cache (
                        key TEXT PRIMARY KEY,
                        result TEXT,
                        timestamp DATETIME
                    )
                """)
                # Create index on timestamp for faster cleanup
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_timestamp 
                    ON cache(timestamp)
                """)
                # Clean up old cache entries
                conn.execute("""
                    DELETE FROM cache 
                    WHERE timestamp < datetime('now', '-24 hours')
                """)
                conn.commit()
        except Exception as e:
            logger.error(f"Error initializing cache database: {e}")

    async def _get_cache_key(self, scene_description: str, num_shots: int) -> str:
        """Generate a cache key for the request"""
        key = f"{scene_description}:{num_shots}"
        return hashlib.md5(key.encode()).hexdigest()

    async def _check_cache(self, cache_key: str) -> Optional[List[Dict[str, Any]]]:
        """Check if we have a cached result"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(
                    "SELECT result FROM cache WHERE key = ? AND timestamp > datetime('now', '-24 hours')",
                    (cache_key,)
                ) as cursor:
                    row = await cursor.fetchone()
                    if row:
                        logger.debug("Cache hit")
                        return json.loads(row[0])
        except Exception as e:
            logger.error(f"Error checking cache: {e}")
        return None

    async def _update_cache(self, cache_key: str, result: List[Dict[str, Any]]):
        """Update the cache with a new result"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute(
                    "INSERT OR REPLACE INTO cache (key, result, timestamp) VALUES (?, ?, datetime('now'))",
                    (cache_key, json.dumps(result))
                )
                await db.commit()
        except Exception as e:
            logger.error(f"Error updating cache: {e}")

    def _wait_if_needed(self):
        """Check rate limits and wait if necessary"""
        with self.lock:
            now = time.time()
            
            # Clean up old requests
            while self.minute_requests and now - self.minute_requests[0] > 60:
                self.minute_requests.popleft()
            while self.daily_requests and now - self.daily_requests[0] > 86400:
                self.daily_requests.popleft()

            # Check minute limit with buffer
            if len(self.minute_requests) >= self.requests_per_minute * 0.8:  # 80% threshold
                wait_time = 60 - (now - self.minute_requests[0])
                if wait_time > 0:
                    logger.warning(f"Approaching minute rate limit. Waiting {wait_time:.2f} seconds")
                    time.sleep(wait_time)

            # Check daily limit with buffer
            if len(self.daily_requests) >= self.requests_per_day * 0.8:  # 80% threshold
                wait_time = 86400 - (now - self.daily_requests[0])
                if wait_time > 0:
                    logger.warning(f"Approaching daily rate limit. Waiting {wait_time:.2f} seconds")
                    time.sleep(wait_time)

            # Add current request
            self.minute_requests.append(now)
            self.daily_requests.append(now)

    def __call__(self, func):
        """Decorator to apply rate limiting to a function"""
        @functools.wraps(func)
        async def wrapper(scene_description: str, num_shots: int, *args, **kwargs):
            cache_key = await self._get_cache_key(scene_description, num_shots)
            
            # Check cache first
            cached_result = await self._check_cache(cache_key)
            if cached_result is not None:
                return cached_result

            # Apply rate limiting with exponential backoff
            max_retries = 3
            retry_delay = 1
            
            for attempt in range(max_retries):
                try:
                    self._wait_if_needed()
                    result = await func(scene_description, num_shots, *args, **kwargs)
                    await self._update_cache(cache_key, result)
                    return result
                except Exception as e:
                    if "quota" in str(e).lower():
                        retry_match = re.search(r'retry_delay\s*{\s*seconds:\s*(\d+)\s*}', str(e))
                        retry_seconds = int(retry_match.group(1)) if retry_match else retry_delay
                        logger.warning(f"Rate limit hit (attempt {attempt + 1}/{max_retries}). Waiting {retry_seconds} seconds")
                        time.sleep(retry_seconds)
                        retry_delay *= 2  # Exponential backoff
                        if attempt == max_retries - 1: 
                            raise HTTPException(
                                status_code=429,
                                detail=f"Rate limit exceeded after {max_retries} attempts. Please try again later."
                            )
                    else:
                        raise
        return wrapper

# Initialize rate limiter with more conservative limits
rate_limiter = RateLimiter(requests_per_minute=15, requests_per_day=200)  # Even more conservative limits

# Configure Gemini API
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "AIzaSyAO7OYzRski9LnFLbkToOyFerwLIJsB154")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY environment variable is not set")

genai.configure(api_key=GOOGLE_API_KEY)

# Initialize Gemini model with specific configuration
generation_config = {
    "temperature": 0.7,
    "top_p": 0.8,
    "top_k": 1,
    "max_output_tokens": 1024
}

safety_settings = [
    {
        "category": "HARM_CATEGORY_HARASSMENT",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
    },
    {
        "category": "HARM_CATEGORY_HATE_SPEECH",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
    },
    {
        "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
    },
    {
        "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
    },
]

# Initialize the model directly with the specific model that worked previously
try:
    model = genai.GenerativeModel('gemini-2.0-flash')
    print("Successfully initialized model: gemini-2.0-flash")
except Exception as e:
    print(f"Error initializing Gemini model: {e}")
    raise

# Update rate limiter with appropriate limits
rate_limiter = RateLimiter(
    requests_per_minute=15,  # Conservative limit
    requests_per_day=200     # Conservative limit
)

# Configure Stable Diffusion
SD_MODEL_ID = "runwayml/stable-diffusion-v1-5"
CONTROLNET_MODEL_ID = "lllyasviel/sd-controlnet-canny"

# Initialize models
pipe = None
controlnet = None
controlnet_pipe = None

def initialize_models():
    """Initialize the Stable Diffusion models"""
    global pipe, controlnet, controlnet_pipe
    
    try:
        if torch.cuda.is_available():
            device = "cuda"
            logger.info("CUDA is available. Using GPU for image generation.")
        else:
            device = "cpu"
            logger.info("CUDA is not available. Using CPU for image generation (will be slow).")
        
        logger.info("Initializing base Stable Diffusion model...")
        # Initialize base model
        pipe = StableDiffusionPipeline.from_pretrained(
            SD_MODEL_ID,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32
        ).to(device)
        
        logger.info("Initializing ControlNet model...")
        # Initialize ControlNet model
        controlnet = ControlNetModel.from_pretrained(
            CONTROLNET_MODEL_ID,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32
        )
        
        logger.info("Initializing ControlNet pipeline...")
        # Initialize ControlNet pipeline
        controlnet_pipe = StableDiffusionControlNetPipeline.from_pretrained(
            SD_MODEL_ID,
            controlnet=controlnet,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32
        ).to(device)
        
        logger.info("All models initialized successfully.")
        return True
    except Exception as e:
        logger.error(f"Error initializing models: {str(e)}", exc_info=True)
        return False

def detect_language(text: str) -> str:
    """Detect the language of the input text"""
    try:
        response = model.generate_content(
            f"Detect the language of this text and respond with only the ISO 639-1 language code: {text}"
        )
        return response.text.strip().lower()
    except Exception as e:
        print(f"Error detecting language: {e}")
        return "en"  # Default to English

def translate_to_english(text: str, source_lang: str) -> str:
    """Translate text to English if it's not already in English"""
    if source_lang == "en":
        return text
    
    try:
        response = model.generate_content(
            f"Translate this text from {source_lang} to English. Respond with only the translation: {text}"
        )
        return response.text.strip()
    except Exception as e:
        print(f"Error translating text: {e}")
    return text

@rate_limiter
@backoff.on_exception(
    backoff.expo,
    (genai.types.BlockedPromptException, Exception),
    max_tries=3,
    max_time=30,
    giveup=lambda e: "quota" not in str(e).lower()
)
async def gemini(scene_description: str, num_shots: int = 5) -> List[Dict[str, Any]]:
    """
    Generate shot suggestions using Gemini with improved error handling and retry logic.
    """
    try:
        # Prepare the prompt with very specific instructions
        prompt = f"""You are a professional cinematographer. For the following scene, suggest {num_shots} distinct camera shots.
        Scene: {scene_description}

        IMPORTANT: Format your response EXACTLY like this example, with each shot on a new line:
        1. Establishing Wide Shot: A sweeping view of the landscape, camera slowly panning left to right. This shot establishes the vast scale of the location and sets the mood for the scene.
        2. Character Close-up: Character's intense expression, camera slightly low angle. This intimate shot captures the emotional intensity and determination of the character.
        3. Two-shot Medium: Two characters in conversation, camera tracking their movement. This shot maintains visual connection between characters while showing their environment.
        4. Over-the-shoulder Shot: Character's perspective looking at the scene, camera at eye level. This shot puts the audience in the character's shoes, creating an immersive experience.
        5. Aerial Establishing: Birds-eye view of the entire location, camera slowly descending. This dramatic shot reveals the full scope of the setting and creates a sense of grandeur.

        Each shot must include:
        - Shot number (1-{num_shots})
        - Shot name (e.g., "Establishing Wide Shot", "Character Close-up")
        - Description of the shot and camera movement
        - A brief explanation of why this shot is effective for the scene
        """

        # Generate content
        response = model.generate_content(prompt)
        
        if not response or not response.text:
            raise ValueError("Empty response from Gemini model")

        # Parse the response
        shots = []
        lines = response.text.strip().split('\n')
        count = 0
        
        for line in lines:
            line = line.strip()
            # Skip empty lines or lines that don't look like shot descriptions
            if not line or line.lower().startswith(('here', 'sure', 'okay', 'ok', 'i', 'the', 'this')):
                continue
                
            # Match numbered shot descriptions with shot name and explanation
            match = re.match(r'^\d+\.\s*([^:]+):\s*([^.]+)\.\s*(.+)$', line)
            if match:
                shot_name = match.group(1).strip()
                description = match.group(2).strip()
                explanation = match.group(3).strip()
                count += 1
                
                # Create shot with metadata matching frontend expectations
                shot = {
                    "shot_number": count,
                    "shot_description": description,
                    "explanation": explanation,  # Add explanation field
                    "metadata": {
                        "camera_angle": shot_name,
                        "camera_movement": extract_camera_movement(description),
                        "framing": shot_name,
                        "lighting": determine_lighting(description),
                        "visual_elements": determine_visual_elements(description),
                        "emotional_impact": determine_emotional_impact(description)
                    }
                }
                shots.append(shot)
                if count >= num_shots:
                    break

        if not shots:
            raise ValueError("No valid shots generated")

        return shots

    except Exception as e:
        logger.error(f"Error in gemini shot generation: {str(e)}")
        if "quota" in str(e).lower():
            raise HTTPException(
                status_code=429,
                detail="API quota exceeded. Please try again in a few minutes."
            )
        elif "blocked" in str(e).lower():
            raise HTTPException(
                status_code=400,
                detail="Content blocked by safety filters. Please rephrase your scene description."
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Error generating shots: {str(e)}"
            )

def determine_lens_type(shot_type: str, description: str) -> str:
    """Determine appropriate lens type based on shot type and description"""
    shot_type_lower = shot_type.lower()
    description_lower = description.lower()
    
    if any(word in shot_type_lower for word in ['wide', 'establishing', 'aerial']):
        return "Wide-angle lens (16-35mm)"
    elif any(word in shot_type_lower for word in ['close', 'extreme close']):
        return "Telephoto lens (70-200mm)"
    elif any(word in shot_type_lower for word in ['medium', 'two shot']):
        return "Standard lens (35-50mm)"
    else:
        return "Standard lens (35-50mm)"

def determine_lighting(description: str) -> str:
    """Determine lighting setup based on description"""
    description_lower = description.lower()
    
    if any(word in description_lower for word in ['dark', 'night', 'shadow']):
        return "Low-key lighting"
    elif any(word in description_lower for word in ['bright', 'sunny', 'day']):
        return "High-key lighting"
    else:
        return "Natural lighting"

def determine_composition(shot_type: str) -> str:
    """Determine composition based on shot type"""
    shot_type_lower = shot_type.lower()
    
    if any(word in shot_type_lower for word in ['wide', 'establishing']):
        return "Rule of thirds with emphasis on environment"
    elif any(word in shot_type_lower for word in ['close', 'extreme close']):
        return "Centered composition with tight framing"
    elif any(word in shot_type_lower for word in ['medium', 'two shot']):
        return "Balanced composition with subject placement"
    else:
        return "Dynamic composition"

def determine_depth_of_field(shot_type: str) -> str:
    """Determine depth of field based on shot type"""
    shot_type_lower = shot_type.lower()
    
    if any(word in shot_type_lower for word in ['wide', 'establishing']):
        return "Deep focus"
    elif any(word in shot_type_lower for word in ['close', 'extreme close']):
        return "Shallow focus"
    else:
        return "Medium focus"

def determine_color_palette(description: str) -> str:
    """Determine color palette based on description"""
    description_lower = description.lower()
    
    if any(word in description_lower for word in ['dark', 'night', 'shadow']):
        return "Cool tones with high contrast"
    elif any(word in description_lower for word in ['bright', 'sunny', 'day']):
        return "Warm tones with natural lighting"
    else:
        return "Natural color palette"

def extract_camera_movement(description: str) -> str:
    """Extract camera movement from shot description"""
    movement_keywords = {
        'panning': 'Pan',
        'tracking': 'Track',
        'dolly': 'Dolly',
        'crane': 'Crane',
        'steadicam': 'Steadicam',
        'handheld': 'Handheld',
        'static': 'Static',
        'zooming': 'Zoom',
        'tilting': 'Tilt',
        'pushing': 'Push',
        'pulling': 'Pull'
    }
    
    description_lower = description.lower()
    for keyword, movement in movement_keywords.items():
        if keyword in description_lower:
            return movement
    
    return "Static"  # Default to static if no movement detected

def generate_shot_image(
    prompt: str,
    model_name: str = "runwayml/stable-diffusion-v1-5",
    reference_image: Optional[Any] = None,
    negative_prompt: str = "blurry, low quality, distorted, deformed",
    num_inference_steps: int = 30,
    guidance_scale: float = 7.5
) -> str:
    """Generate an image based on the shot description"""
    try:
        logger.info(f"Starting image generation for prompt: '{prompt}' with model: {model_name}")
        
        # Check if model is initialized
        if pipe is None:
            logger.info("Models not initialized. Initializing now...")
            initialize_models()
            if pipe is None:
                logger.error("Failed to initialize models")
                raise RuntimeError("Failed to initialize image generation models")
            logger.info("Models initialized successfully")
        
        # Prepare the prompt
        full_prompt = f"cinematic shot, professional photography, {prompt}"
        logger.info(f"Using full prompt: '{full_prompt}'")
        
        if reference_image:
            logger.info("Using reference image with ControlNet")
            # Use ControlNet for reference image
            if controlnet_pipe is None:
                logger.error("ControlNet model not initialized")
                raise HTTPException(
                    status_code=500,
                    detail="ControlNet model not initialized"
                )
            
            # Process reference image
            try:
                if isinstance(reference_image, str):
                    if reference_image.startswith(('http://', 'https://')):
                        logger.info("Loading image from URL")
                        image = load_image(reference_image)
                    else:
                        logger.info("Loading image from base64 string")
                        image = Image.open(BytesIO(base64.b64decode(reference_image)))
                else:
                    logger.info("Loading image from file-like object")
                    image = Image.open(reference_image)
                
                # Generate image with ControlNet
                logger.info("Generating image with ControlNet")
                image = controlnet_pipe(
                    prompt=full_prompt,
                    negative_prompt=negative_prompt,
                    image=image,
                    num_inference_steps=num_inference_steps,
                    guidance_scale=guidance_scale
                ).images[0]
            except Exception as img_error:
                logger.error(f"Error processing reference image: {str(img_error)}")
                raise
        else:
            # Generate image without reference
            logger.info("Generating image with standard diffusion pipeline")
            try:
                image = pipe(
                    prompt=full_prompt,
                    negative_prompt=negative_prompt,
                    num_inference_steps=num_inference_steps,
                    guidance_scale=guidance_scale
                ).images[0]
                logger.info("Image generation successful")
            except Exception as pipe_error:
                logger.error(f"Error in diffusion pipeline: {str(pipe_error)}")
                raise
        
        # Convert image to base64
        try:
            logger.info("Converting image to base64")
            buffered = BytesIO()
            image.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode()
            logger.info("Image conversion successful")
            
            # Return the base64 string
            return f"data:image/png;base64,{img_str}"
        except Exception as conv_error:
            logger.error(f"Error converting image to base64: {str(conv_error)}")
            raise
    
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"Error generating image: {str(e)}\nTraceback: {error_trace}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate image: {str(e)}"
        )

def determine_visual_elements(description: str) -> str:
    """Determine visual elements from shot description"""
    description_lower = description.lower()
    
    elements = []
    if any(word in description_lower for word in ['landscape', 'view', 'wide']):
        elements.append("Environmental composition")
    if any(word in description_lower for word in ['character', 'face', 'expression']):
        elements.append("Character focus")
    if any(word in description_lower for word in ['movement', 'tracking', 'panning']):
        elements.append("Dynamic movement")
    if any(word in description_lower for word in ['light', 'shadow', 'contrast']):
        elements.append("Lighting effects")
    
    return ", ".join(elements) if elements else "Standard composition"

def determine_emotional_impact(description: str) -> str:
    """Determine the emotional impact based on the description"""
    emotional_keywords = {
        "dramatic": ["dramatic", "intense", "powerful", "emotional", "passionate"],
        "peaceful": ["peaceful", "calm", "serene", "tranquil", "gentle"],
        "mysterious": ["mysterious", "enigmatic", "mystical", "ethereal", "otherworldly"],
        "energetic": ["energetic", "dynamic", "vibrant", "lively", "exciting"],
        "melancholic": ["melancholic", "sad", "nostalgic", "contemplative", "reflective"]
    }
    
    description_lower = description.lower()
    for emotion, keywords in emotional_keywords.items():
        if any(keyword in description_lower for keyword in keywords):
            return emotion
    return "neutral"

def smart_parameter_tuning(
    reference_images: List[Image.Image], 
    prompt: str,
    base_strength: float = 0.7,
    base_guidance: float = 10.0
) -> Dict[str, float]:
    """
    Intelligently tune parameters based on reference images and prompt analysis.
    
    Args:
        reference_images: List of reference images
        prompt: User's prompt
        base_strength: Base strength value
        base_guidance: Base guidance scale value
    
    Returns:
        Dictionary with tuned parameters
    """
    try:
        # Analyze reference images
        analysis = analyze_reference_images(reference_images)
        
        # Start with base parameters
        strength = base_strength
        guidance_scale = base_guidance
        num_inference_steps = 60
        
        # Adjust based on number of reference images
        if len(reference_images) == 1:
            # Single reference - can use higher strength for better preservation
            strength = min(strength + 0.1, 0.8)
        elif len(reference_images) > 3:
            # Multiple references - use lower strength to avoid conflicts
            strength = max(strength - 0.1, 0.5)
        
        # Adjust based on prompt complexity
        prompt_lower = prompt.lower()
        
        # If prompt requests major changes (new angles, hidden elements)
        if any(keyword in prompt_lower for keyword in ["from above", "from below", "behind", "side", "close-up", "feet", "hands", "back"]):
            # Lower strength to allow more creative freedom
            strength = max(strength - 0.1, 0.5)
            # Higher guidance to follow the prompt better
            guidance_scale = min(guidance_scale + 1.0, 12.0)
        
        # If prompt is about subtle changes
        if any(keyword in prompt_lower for keyword in ["same", "similar", "preserve", "keep", "maintain"]):
            # Higher strength for better preservation
            strength = min(strength + 0.1, 0.8)
            # Lower guidance to avoid over-processing
            guidance_scale = max(guidance_scale - 1.0, 8.0)
        
        # Adjust based on image analysis
        if analysis.get("overall_mood") == "dramatic":
            # Dramatic images need higher guidance for mood preservation
            guidance_scale = min(guidance_scale + 0.5, 12.0)
        
        if analysis.get("visual_style") == "detailed":
            # Detailed images need more inference steps
            num_inference_steps = 80
        
        # Adjust based on color palette
        if analysis.get("color_palettes"):
            if "dark" in analysis["color_palettes"]:
                # Dark images often need higher guidance
                guidance_scale = min(guidance_scale + 0.5, 12.0)
            elif "bright" in analysis["color_palettes"]:
                # Bright images can use lower guidance
                guidance_scale = max(guidance_scale - 0.5, 8.0)
        
        logger.info(f"Smart parameter tuning: strength={strength:.2f}, guidance={guidance_scale:.2f}, steps={num_inference_steps}")
        
        return {
            "strength": strength,
            "guidance_scale": guidance_scale,
            "num_inference_steps": num_inference_steps
        }
        
    except Exception as e:
        logger.warning(f"Smart parameter tuning failed, using defaults: {str(e)}")
        return {
            "strength": base_strength,
            "guidance_scale": base_guidance,
            "num_inference_steps": 60
        }

def generate_fusion_image(
    prompt: str,
    reference_images: List[Image.Image],
    model_name: str = "runwayml/stable-diffusion-v1-5",
    negative_prompt: str = "blurry, low quality, distorted, deformed, inconsistent style, multiple images merged poorly, different props, different theme, different setting, different objects",
    num_inference_steps: int = 50,
    guidance_scale: float = 8.5,
    strength: float = 0.8
) -> str:
    """
    Generate a single image that fuses multiple reference images with a user prompt,
    preserving the complete theme, props, and visual elements while generating new angles.
    
    Args:
        prompt: User's creative requirements/description (new angle/view)
        reference_images: List of PIL Image objects to use as references
        model_name: The diffusion model to use
        negative_prompt: What to avoid in the generation
        num_inference_steps: Number of denoising steps
        guidance_scale: How closely to follow the prompt
        strength: How much to blend the reference images (0.0-1.0)
    
    Returns:
        Base64 encoded image string
    """
    try:
        logger.info(f"Starting enhanced fusion image generation with {len(reference_images)} reference images")
        
        # Check for GPU availability
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {device}")
        
        # Initialize the pipeline
        if device == "cuda":
            pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
                model_name,
                torch_dtype=torch.float16,
                use_safetensors=True
            ).to(device)
        else:
            pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
                model_name,
                torch_dtype=torch.float32
            ).to(device)
        
        # Process reference images
        processed_images = []
        for i, img in enumerate(reference_images):
            # Convert to RGB if necessary
            if img.mode != "RGB":
                img = img.convert("RGB")
            
            # Resize to a consistent size (512x512 for processing)
            img = img.resize((512, 512), Image.Resampling.LANCZOS)
            processed_images.append(img)
        
        # Create a better blended reference image that preserves more detail
        if len(processed_images) > 1:
            # Use the first image as the primary base and selectively blend others
            primary_reference = processed_images[0]
            
            # For multiple images, create a composite that preserves the primary theme
            # but incorporates elements from other images
            for i, img in enumerate(processed_images[1:], 1):
                try:
                    # Use a lower weight for additional images to avoid theme dilution
                    weight = 0.3 / i  # Decreasing weight for each additional image
                    
                    # Convert to arrays for blending
                    primary_array = np.array(primary_reference, dtype=np.float32)
                    blend_array = np.array(img, dtype=np.float32)
                    
                    # Blend only if the images are similar in structure (edge-based similarity)
                    primary_gray = np.array(primary_reference.convert('L'), dtype=np.uint8)
                    blend_gray = np.array(img.convert('L'), dtype=np.uint8)
                    
                    primary_edges = cv2.Canny(primary_gray, 50, 150)
                    blend_edges = cv2.Canny(blend_gray, 50, 150)
                    
                    # Calculate edge similarity - ensure both arrays are boolean or uint8
                    primary_edges_bool = primary_edges > 0
                    blend_edges_bool = blend_edges > 0
                    
                    # Calculate edge similarity using proper boolean operations
                    intersection = np.sum(primary_edges_bool & blend_edges_bool)
                    union = np.sum(primary_edges_bool | blend_edges_bool)
                    edge_similarity = intersection / (union + 1e-6)
                    
                    # Only blend if images are structurally similar
                    if edge_similarity > 0.1:
                        blended_array = primary_array * (1 - weight) + blend_array * weight
                        primary_reference = Image.fromarray(np.clip(blended_array, 0, 255).astype(np.uint8))
                    
                except Exception as blend_error:
                    logger.warning(f"Failed to blend image {i+1}: {str(blend_error)}, skipping blend")
                    continue
        else:
            primary_reference = processed_images[0]
        
        # NEW APPROACH: Extract detailed text descriptions from all reference images
        logger.info("Extracting detailed descriptions from reference images...")
        image_descriptions = []
        for i, img in enumerate(processed_images):
            try:
                description = extract_detailed_image_description(img)
                image_descriptions.append(description)
                logger.info(f"Extracted description for image {i+1}: {description[:100]}...")
            except Exception as e:
                logger.warning(f"Failed to extract description for image {i+1}: {str(e)}")
                # Fallback to traditional analysis for this image
                fallback_desc = _fallback_image_analysis(img)
                image_descriptions.append(fallback_desc)
        
        # Merge extracted descriptions with user prompt
        logger.info("Merging image descriptions with user prompt...")
        enhanced_prompt = merge_image_descriptions_with_prompt(image_descriptions, prompt)
        
        # Generate enhanced negative prompt based on descriptions
        enhanced_negative_prompt = generate_enhanced_negative_prompt(image_descriptions, negative_prompt)
        
        logger.info(f"Enhanced prompt: {enhanced_prompt[:200]}...")
        logger.info(f"Enhanced negative: {enhanced_negative_prompt[:200]}...")
        
        # Also run traditional analysis as backup for parameter optimization
        analysis = analyze_reference_images(processed_images)
        
        # The enhanced_prompt was already created by merge_image_descriptions_with_prompt above
        # No need for additional prompt enhancement since the detailed descriptions already contain
        # all the theme preservation information we need
        
        # Validate and optimize parameters based on prompt requirements
        validation = validate_prompt_following(prompt, strength, guidance_scale)
        
        # Use validated parameters
        optimal_strength = validation["adjusted_strength"]
        optimal_guidance = validation["adjusted_guidance"]
        optimal_steps = max(num_inference_steps, 60)  # Good quality steps
        
        # Log any warnings or adjustments
        for warning in validation["warnings"]:
            logger.warning(f"Parameter adjustment: {warning}")
        
        # Ensure strength is within reasonable bounds
        optimal_strength = max(min(optimal_strength, 0.8), 0.45)  # Allow sufficient variation for prompt following
        
        # Generate the fused image with optimized parameters
        logger.info(f"Generating fused image with enhanced theme preservation... (strength: {optimal_strength}, guidance: {optimal_guidance}, steps: {optimal_steps})")
        result = pipe(
            prompt=enhanced_prompt,
            negative_prompt=enhanced_negative_prompt,
            image=primary_reference,
            strength=optimal_strength,
            guidance_scale=optimal_guidance,
            num_inference_steps=optimal_steps,
            num_images_per_prompt=1
        )
        
        # Get the generated image
        generated_image = result.images[0]
        
        # Convert to base64
        buffered = BytesIO()
        generated_image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        logger.info("Enhanced fusion image generation completed successfully")
        return img_str
        
    except Exception as e:
        logger.error(f"Error in enhanced fusion image generation: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate fusion image: {str(e)}"
        )

def analyze_reference_images(images: List[Image.Image]) -> Dict[str, Any]:
    """
    Analyze reference images to extract key visual elements, themes, props, and characteristics
    that should be preserved when generating new angles.
    
    Args:
        images: List of PIL Image objects
    
    Returns:
        Dictionary containing analysis results
    """
    try:
        analysis = {
            "color_palettes": [],
            "composition_styles": [],
            "lighting_conditions": [],
            "dominant_elements": [],
            "theme_elements": [],
            "prop_elements": [],
            "setting_elements": [],
            "overall_mood": "balanced",
            "visual_style": "balanced"
        }
        
        all_elements = []
        dominant_colors = []
        brightness_levels = []
        
        for img in images:
            if img.mode != "RGB":
                img = img.convert("RGB")
            
            # Analyze colors more thoroughly
            img_array = np.array(img)
            
            # Extract dominant colors
            img_small = img.resize((50, 50))
            colors = img_small.getcolors(maxcolors=2500)
            if colors:
                # Sort by frequency and get top colors
                colors.sort(key=lambda x: x[0], reverse=True)
                top_colors = colors[:5]
                for count, color in top_colors:
                    dominant_colors.append(color)
            
            # Analyze brightness and contrast
            gray = img.convert('L')
            brightness = np.mean(np.array(gray))
            brightness_levels.append(brightness)
            
            # Analyze composition (simple edge detection for complexity)
            edges = cv2.Canny(np.array(gray), 50, 150)
            edge_density = np.sum(edges > 0) / edges.size
            
            if edge_density > 0.1:
                analysis["composition_styles"].append("detailed")
            else:
                analysis["composition_styles"].append("simple")
        
        # Determine overall lighting
        avg_brightness = np.mean(brightness_levels)
        if avg_brightness > 150:
            analysis["lighting_conditions"].append("bright")
        elif avg_brightness < 80:
            analysis["lighting_conditions"].append("dark")
        else:
            analysis["lighting_conditions"].append("balanced")
        
        # Analyze color harmony
        if dominant_colors:
            # Convert RGB to HSV for better color analysis
            hsv_colors = []
            for r, g, b in dominant_colors[:10]:  # Top 10 colors
                h, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255)
                hsv_colors.append((h*360, s*100, v*100))
            
            # Determine color scheme
            hues = [h for h, s, v in hsv_colors if s > 20]  # Only saturated colors
            if hues:
                hue_range = max(hues) - min(hues)
                if hue_range < 30:
                    analysis["theme_elements"].append("monochromatic")
                elif hue_range < 60:
                    analysis["theme_elements"].append("analogous colors")
                else:
                    analysis["theme_elements"].append("diverse colors")
        
        # Set overall mood based on brightness and colors
        if avg_brightness > 150:
            analysis["overall_mood"] = "bright and airy"
        elif avg_brightness < 80:
            analysis["overall_mood"] = "moody and dramatic"
        else:
            analysis["overall_mood"] = "balanced and natural"
        
        # Determine visual style
        complexity = np.mean([1 if style == "detailed" else 0 for style in analysis["composition_styles"]])
        if complexity > 0.7:
            analysis["visual_style"] = "detailed and complex"
        elif complexity < 0.3:
            analysis["visual_style"] = "clean and minimal"
        else:
            analysis["visual_style"] = "balanced composition"
        
        return analysis
    
    except Exception as e:
        logger.error(f"Error analyzing reference images: {str(e)}")
        # Return default analysis on error
        return {
            "color_palettes": ["balanced"],
            "composition_styles": ["balanced"],
            "lighting_conditions": ["balanced"],
            "dominant_elements": ["general"],
            "theme_elements": ["neutral"],
            "prop_elements": ["standard"],
            "setting_elements": ["general"],
            "overall_mood": "balanced",
            "visual_style": "balanced"
        }

# Initialize models on import
try:
    initialize_models()
except Exception as e:
    print(f"Warning: Failed to initialize models: {e}")
    print("Models will be initialized on first use")

conn = sqlite3.connect('shots_app.db')
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
print(cursor.fetchall())
conn.close()

def generate_reference_style_image(
    prompt: str,
    reference_images: list,
    model_name: str = "lllyasviel/sd-controlnet-reference",
    num_inference_steps: int = 30,
    guidance_scale: float = 7.5
) -> str:
    """
    Generate an image using reference images for style/theme and a prompt for content/angle.
    Uses ControlNet Reference Adapter if available, otherwise falls back to regular fusion.
    """
    import torch
    from PIL import Image
    from io import BytesIO
    import base64

    # Check if ControlNet Reference is available
    if not CONTROLNET_REFERENCE_AVAILABLE:
        logger.warning("ControlNet Reference not available, using fallback fusion method")
        # Convert reference_images to PIL Images if they're file paths
        pil_images = []
        for img in reference_images:
            if not isinstance(img, Image.Image):
                pil_images.append(Image.open(img))
            else:
                pil_images.append(img)
        return generate_fusion_image(prompt, pil_images)

    try:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        pipe = StableDiffusionControlNetReferencePipeline.from_pretrained(
            model_name,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32
        ).to(device)

        # Process multiple reference images
        processed_references = []
        for img in reference_images:
            if not isinstance(img, Image.Image):
                img = Image.open(img)
            
            # Convert to RGB and resize
            if img.mode != "RGB":
                img = img.convert("RGB")
            img = img.resize((512, 512), Image.Resampling.LANCZOS)
            processed_references.append(img)

        # If multiple reference images, blend them for better style preservation
        if len(processed_references) > 1:
            # Create a blended reference image
            blended_image = Image.new('RGB', (512, 512), (0, 0, 0))
            total_weight = 0
            
            for i, img in enumerate(processed_references):
                img_array = np.array(img, dtype=np.float32)
                weight = 1.0 / (i + 1)  # Weight decreases for subsequent images
                blended_image = np.array(blended_image, dtype=np.float32)
                blended_image += img_array * weight
                total_weight += weight
            
            # Normalize the blended image
            blended_image = blended_image / total_weight
            blended_image = np.clip(blended_image, 0, 255).astype(np.uint8)
            reference_image = Image.fromarray(blended_image)
        else:
            reference_image = processed_references[0]

        # Enhance prompt for better style preservation
        enhanced_prompt = f"{prompt}, same style, same theme, same visual elements, cohesive composition, professional photography"
        negative_prompt = "different style, different theme, inconsistent, blurry, low quality, distorted"

        # Use optimized parameters for better reference matching
        result = pipe(
            prompt=enhanced_prompt,
            negative_prompt=negative_prompt,
            reference_image=reference_image,
            num_inference_steps=max(num_inference_steps, 40),  # More steps for better quality
            guidance_scale=max(guidance_scale, 9.0),  # Higher guidance for better prompt following
        )
        generated_image = result.images[0]
        buffered = BytesIO()
        generated_image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        return img_str
    except Exception as e:
        logger.error(f"Error with ControlNet Reference: {e}")
        logger.info("Falling back to regular fusion method")
        # Fall back to regular fusion
        pil_images = []
        for img in reference_images:
            if not isinstance(img, Image.Image):
                pil_images.append(Image.open(img))
            else:
                pil_images.append(img)
        return generate_fusion_image(prompt, pil_images)

def generate_identity_preserving_image(
    prompt: str,
    reference_images: list,
    model_name: str = "runwayml/stable-diffusion-v1-5",
    num_inference_steps: int = 30,
    guidance_scale: float = 7.5,
    ip_adapter_scale: float = 0.8
) -> str:
    """
    Generate an image that preserves the identity of a person from reference images
    while allowing pose/scenario changes as specified in the prompt.
    
    Uses IP-Adapter for identity preservation.
    """
    import torch
    from PIL import Image
    from io import BytesIO
    import base64

    # Check if IP-Adapter is available
    if not IP_ADAPTER_AVAILABLE:
        logger.warning("IP-Adapter not available, using fallback method")
        return generate_reference_style_image(prompt, reference_images)

    try:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # Load the base model
        pipe = StableDiffusionPipeline.from_pretrained(
            model_name,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32
        ).to(device)
        
        # Load IP-Adapter
        ip_adapter = IPAdapter(pipe, "h94/IP-Adapter", device=device)
        
        # Process reference images
        reference_image = reference_images[0]  # Use first image for identity
        if not isinstance(reference_image, Image.Image):
            reference_image = Image.open(reference_image)
        
        # Convert to RGB if necessary
        if reference_image.mode != "RGB":
            reference_image = reference_image.convert("RGB")
        
        # Resize to standard size
        reference_image = reference_image.resize((512, 512), Image.Resampling.LANCZOS)
        
        # Generate image with identity preservation
        result = pipe(
            prompt=prompt,
            ip_adapter_image=reference_image,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            ip_adapter_scale=ip_adapter_scale
        )
        
        generated_image = result.images[0]
        buffered = BytesIO()
        generated_image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        return img_str
        
    except Exception as e:
        logger.error(f"Error with IP-Adapter: {e}")
        logger.info("Falling back to reference style method")
        return generate_reference_style_image(prompt, reference_images)

def generate_pose_transfer_image(
    prompt: str,
    reference_images: list,
    model_name: str = "runwayml/stable-diffusion-v1-5",
    num_inference_steps: int = 30,
    guidance_scale: float = 7.5,
    strength: float = 0.8
) -> str:
    """
    Generate an image that transfers the pose/style from reference images
    while maintaining identity and applying the new scenario from prompt.
    
    Uses a combination of img2img and prompt engineering for better results.
    """
    import torch
    from PIL import Image
    from io import BytesIO
    import base64

    try:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # Load img2img pipeline
        pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
            model_name,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32
        ).to(device)
        
        # Process reference image
        reference_image = reference_images[0]
        if not isinstance(reference_image, Image.Image):
            reference_image = Image.open(reference_image)
        
        # Convert to RGB and resize
        if reference_image.mode != "RGB":
            reference_image = reference_image.convert("RGB")
        reference_image = reference_image.resize((512, 512), Image.Resampling.LANCZOS)
        
        # Enhance prompt for better identity preservation
        enhanced_prompt = f"{prompt}, same person, same face, same identity, high detail, professional photography"
        negative_prompt = "different person, different face, blurry, low quality, distorted, deformed, multiple people"
        
        # Generate with lower strength to preserve identity
        result = pipe(
            prompt=enhanced_prompt,
            negative_prompt=negative_prompt,
            image=reference_image,
            strength=strength,
            guidance_scale=guidance_scale,
            num_inference_steps=num_inference_steps
        )
        
        generated_image = result.images[0]
        buffered = BytesIO()
        generated_image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        return img_str
        
    except Exception as e:
        logger.error(f"Error in pose transfer: {e}")
        return generate_fusion_image(prompt, reference_images)

def generate_multi_view_fusion(
    prompt: str,
    reference_images: List[Image.Image],
    model_name: str = "runwayml/stable-diffusion-v1-5",
    negative_prompt: str = "blurry, low quality, distorted, deformed, inconsistent style, different car model, different color, different location, floating objects",
    num_inference_steps: int = 80,
    guidance_scale: float = 16.0,
    strength: float = 0.35
) -> str:
    """
    Generate new viewpoints from multiple reference images with enhanced consistency.
    Optimized for scenarios like: front view car → side view car
    
    Args:
        prompt: Requested viewpoint (e.g., "side view", "rear view", "from above")
        reference_images: Multiple angles/views of the same subject
        model_name: The diffusion model to use
        negative_prompt: What to avoid in generation
        num_inference_steps: Number of denoising steps
        guidance_scale: How closely to follow the prompt
        strength: How much to modify from reference (lower = more faithful)
    
    Returns:
        Base64 encoded image string
    """
    try:
        logger.info(f"Starting multi-view fusion with {len(reference_images)} reference images")
        
        # Check for GPU availability
        device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # Initialize pipeline
        if device == "cuda":
            pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
                model_name,
                torch_dtype=torch.float16,
                use_safetensors=True
            ).to(device)
        else:
            pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
                model_name,
                torch_dtype=torch.float32
            ).to(device)
        
        # Process and analyze all reference images
        processed_images = []
        for img in reference_images:
            if img.mode != "RGB":
                img = img.convert("RGB")
            img = img.resize((512, 512), Image.Resampling.LANCZOS)
            processed_images.append(img)
        
        # NEW APPROACH: Extract detailed text descriptions from all reference images
        logger.info("Extracting detailed descriptions from reference images for multi-view fusion...")
        image_descriptions = []
        for i, img in enumerate(processed_images):
            try:
                description = extract_detailed_image_description(img)
                image_descriptions.append(description)
                logger.info(f"Multi-view: Extracted description for image {i+1}: {description[:100]}...")
            except Exception as e:
                logger.warning(f"Failed to extract description for image {i+1}: {str(e)}")
                # Fallback to traditional analysis for this image
                fallback_desc = _fallback_image_analysis(img)
                image_descriptions.append(fallback_desc)
        
        # Merge extracted descriptions with user prompt for multi-view
        logger.info("Merging image descriptions with viewpoint prompt for multi-view fusion...")
        enhanced_prompt = merge_image_descriptions_with_prompt(image_descriptions, prompt)
        
        # Generate enhanced negative prompt based on descriptions
        enhanced_negative_prompt = generate_enhanced_negative_prompt(image_descriptions, negative_prompt)
        
        logger.info(f"Multi-view enhanced prompt: {enhanced_prompt[:200]}...")
        logger.info(f"Multi-view enhanced negative: {enhanced_negative_prompt[:200]}...")
        
        # Also run traditional analysis as backup for composite creation
        analysis = analyze_reference_images(processed_images)
        
        # Create a composite reference that captures the most consistent elements
        primary_reference = create_optimal_composite(processed_images, analysis)
        
        # Validate and optimize parameters based on prompt requirements
        validation = validate_prompt_following(prompt, strength, guidance_scale)
        
        # Use validated parameters
        optimal_strength = validation["adjusted_strength"]
        optimal_guidance = validation["adjusted_guidance"] 
        optimal_steps = max(num_inference_steps, 60)  # Sufficient quality steps
        
        # Log any warnings or adjustments
        for warning in validation["warnings"]:
            logger.warning(f"Parameter adjustment: {warning}")
        
        # Ensure strength is within reasonable bounds for prompt following
        optimal_strength = max(min(optimal_strength, 0.8), 0.45)  # Allow good variation for prompt following
        
        logger.info(f"Generating multi-view fusion (strength: {optimal_strength}, guidance: {optimal_guidance})")
        
        # Generate with enhanced parameters
        result = pipe(
            prompt=enhanced_prompt,
            negative_prompt=enhanced_negative_prompt,
            image=primary_reference,
            strength=optimal_strength,
            guidance_scale=optimal_guidance,
            num_inference_steps=optimal_steps,
            num_images_per_prompt=1
        )
        
        # Convert to base64
        generated_image = result.images[0]
        buffered = BytesIO()
        generated_image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        logger.info("Multi-view fusion completed successfully")
        return img_str
        
    except Exception as e:
        logger.error(f"Error in multi-view fusion: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate multi-view fusion: {str(e)}"
        )

def create_optimal_composite(images: List[Image.Image], analysis: Dict[str, Any]) -> Image.Image:
    """
    Create an optimal composite image that preserves the most consistent elements
    across multiple reference views.
    """
    if len(images) == 1:
        return images[0]
    
    # Use the first image as base
    primary = images[0]
    primary_array = np.array(primary, dtype=np.float32)
    
    # For each additional image, blend only consistent regions
    for i, img in enumerate(images[1:], 1):
        img_array = np.array(img, dtype=np.float32)
        
        # Calculate similarity map using edge comparison
        primary_gray = cv2.cvtColor(primary_array.astype(np.uint8), cv2.COLOR_RGB2GRAY)
        img_gray = cv2.cvtColor(img_array.astype(np.uint8), cv2.COLOR_RGB2GRAY)
        
        # Find similar regions
        diff = cv2.absdiff(primary_gray, img_gray)
        similarity_mask = (diff < 50).astype(np.float32)  # Threshold for similarity
        
        # Expand mask to 3 channels
        similarity_mask_3ch = np.stack([similarity_mask] * 3, axis=-1)
        
        # Blend only similar regions with decreasing weight
        weight = 0.3 / (i + 1)  # Decreasing weight for later images
        blend_mask = similarity_mask_3ch * weight
        
        primary_array = primary_array * (1 - blend_mask) + img_array * blend_mask
    
    # Convert back to PIL Image
    composite = Image.fromarray(np.clip(primary_array, 0, 255).astype(np.uint8))
    return composite

def build_viewpoint_prompt(prompt: str, analysis: Dict[str, Any], num_references: int) -> str:
    """
    Build an enhanced prompt specifically for viewpoint generation
    """
    prompt_lower = prompt.lower()
    
    # Extract viewpoint request
    viewpoint_terms = []
    if "side" in prompt_lower:
        viewpoint_terms.append("side profile view, lateral perspective")
    if "rear" in prompt_lower or "back" in prompt_lower:
        viewpoint_terms.append("rear view, back perspective")
    if "front" in prompt_lower:
        viewpoint_terms.append("front view, frontal perspective")
    if "above" in prompt_lower or "top" in prompt_lower:
        viewpoint_terms.append("top view, bird's eye perspective, overhead angle")
    if "below" in prompt_lower or "underneath" in prompt_lower:
        viewpoint_terms.append("bottom view, underneath perspective, low angle")
    
    # Build consistency terms based on analysis
    consistency_terms = [
        "exact same object",
        "identical properties",
        "same material",
        "same color scheme",
        "same lighting conditions",
        "same environment",
        "same background",
        "maintain all original details"
    ]
    
    # Add analysis-specific terms
    if analysis.get("overall_mood"):
        consistency_terms.append(f"same {analysis['overall_mood']} mood")
    
    if num_references > 1:
        consistency_terms.append("consistent with all reference views")
        consistency_terms.append("maintain cross-view consistency")
    
    # Combine everything
    viewpoint_str = ", ".join(viewpoint_terms) if viewpoint_terms else "new perspective"
    consistency_str = ", ".join(consistency_terms)
    
    enhanced_prompt = f"{prompt}, {viewpoint_str}, {consistency_str}, photorealistic, high quality, professional photography, sharp details"
    
    return enhanced_prompt

def build_comprehensive_negatives(base_negative: str, analysis: Dict[str, Any]) -> str:
    """
    Build comprehensive negative prompts to avoid inconsistencies
    """
    general_negatives = [
        "different object",
        "different model",
        "different color",
        "different material",
        "different lighting",
        "different environment",
        "floating objects",
        "multiple objects",
        "merged objects",
        "deformed",
        "distorted",
        "blurry",
        "low quality",
        "artifacts",
        "inconsistent perspective",
        "impossible angles"
    ]
    
    # Add analysis-specific negatives
    analysis_negatives = []
    if analysis.get("overall_mood") == "bright and airy":
        analysis_negatives.extend(["dark", "gloomy", "dim"])
    elif analysis.get("overall_mood") == "moody and dramatic":
        analysis_negatives.extend(["bright", "overexposed", "washed out"])
    
    all_negatives = general_negatives + analysis_negatives
    
    return f"{base_negative}, {', '.join(all_negatives)}"

def validate_prompt_following(prompt: str, strength: float, guidance_scale: float) -> Dict[str, Any]:
    """
    Validate and suggest optimal parameters for prompt following
    """
    suggestions = {
        "adjusted_strength": strength,
        "adjusted_guidance": guidance_scale,
        "warnings": [],
        "recommendations": []
    }
    
    # Check if prompt suggests significant changes
    change_indicators = [
        "side view", "rear view", "front view", "top view", "bottom view",
        "from above", "from below", "behind", "in front", 
        "close-up", "wide shot", "different angle", "new perspective"
    ]
    
    prompt_lower = prompt.lower()
    significant_change = any(indicator in prompt_lower for indicator in change_indicators)
    
    if significant_change:
        # For significant viewpoint changes, we need higher strength
        if strength < 0.5:
            suggestions["adjusted_strength"] = max(strength, 0.55)
            suggestions["warnings"].append(f"Low strength ({strength}) may not follow prompt. Increased to {suggestions['adjusted_strength']}")
        
        # Ensure guidance is strong enough
        if guidance_scale < 10.0:
            suggestions["adjusted_guidance"] = max(guidance_scale, 12.0)
            suggestions["warnings"].append(f"Low guidance ({guidance_scale}) may not follow prompt. Increased to {suggestions['adjusted_guidance']}")
    
    # Add recommendations based on prompt type
    if any(word in prompt_lower for word in ["side", "rear", "back", "behind"]):
        suggestions["recommendations"].append("For viewpoint changes, consider using Multi-View Fusion with multiple reference angles")
    
    if any(word in prompt_lower for word in ["close-up", "detail", "zoom"]):
        suggestions["recommendations"].append("For detail shots, strength 0.6-0.7 works well")
    
    return suggestions

# Enhanced Image Analysis Functions
def extract_detailed_image_description(image: Image.Image) -> str:
    """
    Extract comprehensive text description from an image, similar to how a human would describe it.
    This mimics detailed visual analysis to capture every background element, character, and theme.
    
    Args:
        image: PIL Image object
    
    Returns:
        Detailed text description of the image
    """
    try:
        if image.mode != "RGB":
            image = image.convert("RGB")
        
        img_array = np.array(image)
        h, w = img_array.shape[:2]
        
        # Encode image as base64 for Gemini analysis
        buffer = BytesIO()
        image.save(buffer, format='PNG')
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        # Optimized prompt for concise but comprehensive analysis
        analysis_prompt = """Analyze this image and provide a concise but comprehensive description (aim for 800-1200 characters total). Focus on the most important visual elements:

1. MAIN SUBJECTS: Key people, objects, or focal points
2. SETTING: Environment type and key background elements
3. LIGHTING & MOOD: Overall lighting quality and atmosphere
4. COLOR SCHEME: Dominant colors and visual style
5. COMPOSITION: Camera angle and visual arrangement

Be specific and detailed but concise. Focus on elements that are most important for recreating this scene from a different angle. Avoid repetition and overly descriptive language."""

        # Use Gemini to analyze the image
        try:
            # Create a proper image part for Gemini
            image_part = {
                "mime_type": "image/png",
                "data": img_base64
            }
            
            response = model.generate_content([analysis_prompt, image_part])
            detailed_description = response.text
            
            # Limit description length to avoid overwhelming the generation AI
            if len(detailed_description) > 1500:
                # Truncate at the last complete sentence before 1500 chars
                truncated = detailed_description[:1500]
                last_period = truncated.rfind('.')
                if last_period > 800:  # Ensure we don't truncate too much
                    detailed_description = truncated[:last_period + 1]
                else:
                    detailed_description = truncated + "..."
            
            logger.info(f"Successfully extracted image description ({len(detailed_description)} characters)")
            return detailed_description
            
        except Exception as gemini_error:
            logger.warning(f"Gemini vision analysis failed: {gemini_error}, falling back to traditional analysis")
            
            # Fallback to traditional analysis if Gemini fails
            return _fallback_image_analysis(image)
            
    except Exception as e:
        logger.error(f"Error in detailed image description extraction: {str(e)}")
        return _fallback_image_analysis(image)

def _fallback_image_analysis(image: Image.Image) -> str:
    """
    Fallback image analysis using traditional computer vision techniques
    """
    try:
        img_array = np.array(image)
        h, w = img_array.shape[:2]
        
        # Color analysis
        colors = image.getcolors(maxcolors=256*256*256)
        if colors:
            colors.sort(key=lambda x: x[0], reverse=True)
            dominant_color = colors[0][1]
            r, g, b = dominant_color
            
        # Brightness analysis
        gray = image.convert('L')
        brightness = np.mean(np.array(gray))
        
        # Edge analysis for complexity
        edges = cv2.Canny(np.array(gray), 50, 150)
        edge_density = np.sum(edges > 0) / edges.size
        
        # Generate basic description
        lighting = "bright" if brightness > 150 else "dark" if brightness < 80 else "balanced"
        complexity = "detailed and complex" if edge_density > 0.1 else "simple and clean"
        color_desc = f"dominated by RGB({r}, {g}, {b})" if colors else "with varied colors"
        
        description = f"An image with {lighting} lighting, {complexity} composition, {color_desc}. The scene appears to have moderate visual complexity with various elements distributed throughout the frame."
        
        return description
        
    except Exception as e:
        logger.error(f"Error in fallback image analysis: {str(e)}")
        return "A photographic image with balanced lighting and standard composition."

def merge_image_descriptions_with_prompt(image_descriptions: List[str], user_prompt: str) -> str:
    """
    Intelligently merge extracted image descriptions with user prompt to create
    a cohesive generation prompt that preserves visual elements while incorporating the new angle.
    
    Args:
        image_descriptions: List of detailed descriptions from reference images
        user_prompt: User's desired viewpoint/angle prompt
    
    Returns:
        Enhanced prompt optimized for accurate image generation
    """
    try:
        logger.info("Creating intelligent combined prompt...")
        
        # Combine all descriptions
        full_descriptions = " ".join(image_descriptions)
        
        # Use Gemini to intelligently extract and synthesize key visual elements
        synthesis_prompt = f"""
Analyze these image descriptions and create an optimized prompt for AI image generation that preserves key visual identity:

IMAGE DESCRIPTIONS:
{full_descriptions}

USER'S NEW REQUIREMENT:
{user_prompt}

Create a focused prompt for image generation (75-100 words maximum) that:
1. Starts with the user's angle requirement
2. PRIORITIZES MOST IMPORTANT ELEMENTS: Focus on the 3-4 most distinctive visual features
3. PRESERVES CORE IDENTITY: Include only the most essential clothing/armor details, key props, distinctive features
4. PRESERVES KEY ATMOSPHERE: Include only the most impactful environmental elements (weather, lighting mood, setting type)
5. MAINTAINS VISUAL CONSISTENCY: Use specific but concise descriptors for colors, materials, style

CRITICAL OPTIMIZATION RULES:
- Keep under 75-100 words total for optimal model focus
- Prioritize quality over quantity - choose only the MOST distinctive elements
- Use precise, impactful adjectives rather than long descriptions
- Environmental details should be concise but atmospheric (e.g., "stormy battlefield" not "stormy dramatic sky with heavy clouds over rocky mountainous battlefield terrain")

Format: Single focused paragraph, 75-100 words maximum, optimized for image generation model performance.
"""

        try:
            # Use Gemini to create intelligent synthesis
            response = model.generate_content(synthesis_prompt)
            synthesized_prompt = response.text.strip()
            
            # Clean up the response (remove any formatting or extra text)
            synthesized_prompt = re.sub(r'^.*?:', '', synthesized_prompt)  # Remove any leading labels
            synthesized_prompt = synthesized_prompt.replace('\n', ' ').strip()
            
            # Ensure optimal length for image generation (max 400 characters for focused model performance)
            if len(synthesized_prompt) > 400:
                # Truncate at last complete phrase before 400 chars
                truncated = synthesized_prompt[:400]
                last_comma = truncated.rfind(', ')
                last_period = truncated.rfind('. ')
                last_punct = max(last_comma, last_period)
                if last_punct > 200:  # Ensure we don't truncate too much
                    synthesized_prompt = truncated[:last_punct]
                else:
                    synthesized_prompt = truncated.rstrip(', .')
            
            logger.info(f"AI-synthesized optimized prompt ({len(synthesized_prompt)} chars): {synthesized_prompt}")
            return synthesized_prompt
            
        except Exception as gemini_error:
            logger.warning(f"Gemini synthesis failed: {gemini_error}, using fallback method")
            
            # Fallback: Extract key elements manually with focused optimization
            combined_text = full_descriptions.lower()
            
            # Extract key visual elements with priority focus
            key_elements = []
            
            # Environmental atmosphere (TOP PRIORITY - but concise)
            if any(word in combined_text for word in ['storm', 'cloud', 'overcast', 'dramatic sky']):
                key_elements.append('stormy sky')
            if any(word in combined_text for word in ['rocky', 'mountain', 'terrain', 'battlefield']):
                key_elements.append('rocky terrain')
            if any(word in combined_text for word in ['dark', 'moody', 'dramatic', 'harsh']):
                key_elements.append('dramatic lighting')
            
            # Core character elements (ESSENTIAL ONLY)
            armor_found = False
            for keyword in ["armor", "helmet", "shield", "breastplate"]:
                if keyword in combined_text and not armor_found:
                    key_elements.append('detailed armor')
                    armor_found = True
                    break
            
            # Weapons (SINGLE MOST PROMINENT)
            weapon_found = False
            for keyword in ["sword", "spear", "bow", "weapon"]:
                if keyword in combined_text and not weapon_found:
                    key_elements.append(f'{keyword}')
                    weapon_found = True
                    break
            
            # Key colors (MOST DISTINCTIVE ONLY)
            color_keywords = ['bronze', 'silver', 'gold', 'copper', 'metallic', 'brown', 'gray']
            for color in color_keywords:
                if color in combined_text:
                    key_elements.append(f'{color} tones')
                    break  # Only include one primary color scheme
            
            # Character types (MAIN SUBJECT ONLY)
            subject = "warrior"
            for keyword in ["knight", "soldier", "fighter", "hero"]:
                if keyword in combined_text:
                    subject = keyword
                    break
            
            # Build focused, optimized prompt
            preserved_elements = ", ".join(key_elements[:5])  # Limit to 5 most important elements
            
            fallback_prompt = f"{user_prompt}. {subject} with {preserved_elements}. Cinematic composition, epic scale, gritty realism."
            
            # Ensure fallback is also within optimal length
            if len(fallback_prompt) > 400:
                # Simplify further
                essential_elements = ", ".join(key_elements[:3])
                fallback_prompt = f"{user_prompt}. {subject} with {essential_elements}. Cinematic, epic scale."
            
            logger.info(f"Fallback optimized prompt ({len(fallback_prompt)} chars): {fallback_prompt}")
            return fallback_prompt
        
    except Exception as e:
        logger.error(f"Error in intelligent prompt merging: {str(e)}")
        return f"{user_prompt}, maintaining the same visual theme and style from the reference images"
        
    except Exception as e:
        logger.error(f"Error merging descriptions with prompt: {str(e)}")
        return f"{user_prompt}, maintaining the same visual theme and style from the reference images"

def generate_enhanced_negative_prompt(image_descriptions: List[str], base_negative: str) -> str:
    """
    Generate an optimized negative prompt that's focused and effective
    """
    try:
        # Analyze descriptions to understand what elements must be preserved
        combined = " ".join(image_descriptions).lower()
        
        # Start with essential negatives
        enhanced_negatives = [
            "blurry, low quality, distorted, deformed",
            "multiple images, inconsistent style",
            "completely different scene, different setting"
        ]
        
        # Add specific negatives based on image content (focused)
        if "outdoor" in combined:
            enhanced_negatives.append("indoor setting")
        elif "indoor" in combined:
            enhanced_negatives.append("outdoor setting")
        
        if "armor" in combined or "warrior" in combined:
            enhanced_negatives.append("modern clothing, casual wear")
        
        if "stormy" in combined or "dramatic" in combined:
            enhanced_negatives.append("bright sunny day, cheerful lighting")
        
        # Keep negative prompt concise but effective
        result = ", ".join(enhanced_negatives)
        
        # Limit length to avoid overwhelming the model
        if len(result) > 200:
            result = ", ".join(enhanced_negatives[:4])
        
        return result
        
    except Exception as e:
        logger.error(f"Error generating enhanced negative prompt: {str(e)}")
        return "blurry, low quality, distorted, deformed, inconsistent style"

def generate_image_from_text_prompt(
    prompt: str,
    model_name: str = "runwayml/stable-diffusion-v1-5",
    negative_prompt: str = "blurry, low quality, distorted, deformed, inconsistent style",
    num_inference_steps: int = 30,  # Reduced for better speed/quality balance
    guidance_scale: float = 8.0,    # Slightly higher for better prompt following
    width: int = 512,
    height: int = 512
) -> str:
    """
    Generate image from text prompt only (text-to-image).
    This is used when we already have a comprehensive final prompt.
    
    Args:
        prompt: Complete text prompt for image generation
        model_name: The diffusion model to use
        negative_prompt: What to avoid in the generation
        num_inference_steps: Number of denoising steps
        guidance_scale: How closely to follow the prompt
        width: Output image width
        height: Output image height
    
    Returns:
        Base64 encoded image string
    """
    try:
        logger.info(f"Starting text-to-image generation with prompt: {prompt[:100]}...")
        
        # Check for GPU availability
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {device}")
        
        # Import required modules
        from diffusers import StableDiffusionPipeline
        
        # Initialize the text-to-image pipeline
        if device == "cuda":
            pipe = StableDiffusionPipeline.from_pretrained(
                model_name,
                torch_dtype=torch.float16,
                use_safetensors=True
            ).to(device)
        else:
            pipe = StableDiffusionPipeline.from_pretrained(
                model_name,
                torch_dtype=torch.float32
            ).to(device)
        
        # Enable memory efficient attention
        if hasattr(pipe, 'enable_attention_slicing'):
            pipe.enable_attention_slicing()
        
        logger.info("Pipeline loaded successfully")
        
        # Generate the image
        logger.info("Generating image...")
        with torch.no_grad():
            result = pipe(
                prompt=prompt,
                negative_prompt=negative_prompt,
                num_inference_steps=num_inference_steps,
                guidance_scale=guidance_scale,
                width=width,
                height=height,
                generator=torch.Generator(device=device).manual_seed(42)  # For reproducibility
            )
        
        generated_image = result.images[0]
        logger.info("Image generation completed")
        
        # Convert to base64
        buffered = BytesIO()
        generated_image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        logger.info("Image conversion to base64 completed")
        return img_str  # Return just the base64 string, not the full data URL
        
    except Exception as e:
        logger.error(f"Error in text-to-image generation: {str(e)}")
        raise e
    finally:
        # Clean up GPU memory
        if 'pipe' in locals():
            del pipe
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
