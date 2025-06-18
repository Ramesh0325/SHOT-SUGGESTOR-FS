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

def generate_fusion_image(
    prompt: str,
    reference_images: List[Image.Image],
    model_name: str = "runwayml/stable-diffusion-v1-5",
    negative_prompt: str = "blurry, low quality, distorted, deformed, inconsistent style, multiple images merged poorly",
    num_inference_steps: int = 50,
    guidance_scale: float = 8.5,
    strength: float = 0.8
) -> str:
    """
    Generate a single image that fuses multiple reference images with a user prompt.
    
    Args:
        prompt: User's creative requirements/description
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
        logger.info(f"Starting fusion image generation with {len(reference_images)} reference images")
        
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
        
        # Create a composite reference image by blending all images
        if len(processed_images) > 1:
            # Blend images using weighted average
            composite = Image.new('RGB', (512, 512), (0, 0, 0))
            total_weight = len(processed_images)
            
            for i, img in enumerate(processed_images):
                # Convert to numpy for blending
                img_array = np.array(img).astype(np.float32)
                weight = 1.0 / total_weight
                composite_array = np.array(composite).astype(np.float32)
                composite_array = composite_array * (1 - weight) + img_array * weight
                composite = Image.fromarray(composite_array.astype(np.uint8))
        else:
            composite = processed_images[0]
        
        # Enhance the prompt with fusion-specific instructions
        enhanced_prompt = f"{prompt}, cohesive composition, unified style, seamless integration of reference elements, professional photography"
        
        # Generate the fused image
        logger.info("Generating fused image...")
        result = pipe(
            prompt=enhanced_prompt,
            negative_prompt=negative_prompt,
            image=composite,
            strength=strength,
            guidance_scale=guidance_scale,
            num_inference_steps=num_inference_steps,
            num_images_per_prompt=1
        )
        
        # Get the generated image
        generated_image = result.images[0]
        
        # Convert to base64
        buffered = BytesIO()
        generated_image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        logger.info("Fusion image generation completed successfully")
        return img_str
        
    except Exception as e:
        logger.error(f"Error in fusion image generation: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate fusion image: {str(e)}"
        )

def analyze_reference_images(images: List[Image.Image]) -> Dict[str, Any]:
    """
    Analyze reference images to extract key visual elements and characteristics.
    
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
            "overall_mood": []
        }
        
        for img in images:
            if img.mode != "RGB":
                img = img.convert("RGB")
            
            # Analyze colors
            img_array = np.array(img)
            colors = img_array.reshape(-1, 3)
            
            # Get dominant colors
            from sklearn.cluster import KMeans
            kmeans = KMeans(n_clusters=5, random_state=42)
            kmeans.fit(colors)
            dominant_colors = kmeans.cluster_centers_.astype(int)
            
            # Determine color palette type
            avg_brightness = np.mean(colors)
            if avg_brightness > 180:
                palette_type = "bright"
            elif avg_brightness < 80:
                palette_type = "dark"
            else:
                palette_type = "balanced"
            
            analysis["color_palettes"].append(palette_type)
            
            # Analyze composition (simple edge detection)
            gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
            edges = cv2.Canny(gray, 50, 150)
            edge_density = np.sum(edges > 0) / edges.size
            
            if edge_density > 0.1:
                composition = "detailed"
            elif edge_density > 0.05:
                composition = "moderate"
            else:
                composition = "minimal"
            
            analysis["composition_styles"].append(composition)
            
            # Analyze lighting
            brightness_std = np.std(gray)
            if brightness_std > 50:
                lighting = "high_contrast"
            elif brightness_std > 25:
                lighting = "moderate_contrast"
            else:
                lighting = "low_contrast"
            
            analysis["lighting_conditions"].append(lighting)
        
        # Determine overall characteristics
        analysis["overall_mood"] = "balanced"  # Default
        if len(set(analysis["color_palettes"])) == 1:
            analysis["overall_mood"] = analysis["color_palettes"][0]
        
        return analysis
        
    except Exception as e:
        logger.error(f"Error analyzing reference images: {str(e)}")
        return {
            "color_palettes": ["balanced"] * len(images),
            "composition_styles": ["moderate"] * len(images),
            "lighting_conditions": ["moderate_contrast"] * len(images),
            "dominant_elements": [],
            "overall_mood": "balanced"
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
    Generate an image using a reference image for style/theme and a prompt for content/angle.
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

        # Use the first reference image for style
        reference_image = reference_images[0]
        if not isinstance(reference_image, Image.Image):
            reference_image = Image.open(reference_image)

        result = pipe(
            prompt=prompt,
            reference_image=reference_image,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
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
