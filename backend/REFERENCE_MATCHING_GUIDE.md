# Reference Image Matching Guide

## Overview
This guide explains the improvements made to achieve more accurate reference image matching in the AI Cinematic Shot Suggestor.

## Key Improvements Made

### 1. Multi-Image Blending
- **Before**: Only used the first reference image
- **After**: Blends all reference images using weighted averaging
- **Benefit**: Captures elements from all reference images, not just the first one

### 2. Optimized Parameters
- **Strength**: Reduced from 0.8 to 0.65 (better reference preservation)
- **Guidance Scale**: Increased from 8.5 to 10.0+ (better prompt following)
- **Inference Steps**: Increased from 50 to 60+ (better quality)

### 3. Enhanced Prompt Engineering
- Added theme preservation keywords
- Better negative prompts to avoid losing reference elements
- Intelligent analysis of reference images

### 4. Multiple Matching Techniques
- **Style Matching**: Uses ControlNet Reference Adapter
- **Identity Preservation**: Uses IP-Adapter
- **Pose Transfer**: Specialized pose transfer technique
- **Theme Preservation**: Enhanced fusion with theme analysis

## Available Endpoints

### 1. Basic Fusion (`/fusion/generate`)
```bash
POST /fusion/generate
```
- **Best for**: General reference image matching
- **Default parameters**: 
  - strength: 0.65
  - guidance_scale: 10.0
  - num_inference_steps: 60

### 2. Advanced Matching (`/fusion/advanced-match`)
```bash
POST /fusion/advanced-match
```
- **Best for**: Specific types of matching
- **Matching types**:
  - `style`: Style and visual elements
  - `identity`: Person identity preservation
  - `pose`: Pose and body position
  - `theme`: Complete theme and environment

### 3. Theme Preservation (`/api/theme-preserve`)
```bash
POST /api/theme-preserve
```
- **Best for**: Preserving complete themes and environments
- **Default parameters**:
  - strength: 0.6
  - guidance_scale: 12.0
  - num_inference_steps: 80

## Parameter Guidelines

### Strength (0.0 - 1.0)
- **0.3 - 0.5**: High reference preservation, minimal changes
- **0.5 - 0.7**: Balanced preservation and creativity (recommended)
- **0.7 - 0.9**: More creative changes, less reference preservation

### Guidance Scale (1.0 - 20.0)
- **7.0 - 9.0**: Balanced prompt following
- **9.0 - 12.0**: Strong prompt following (recommended for reference matching)
- **12.0+**: Very strong prompt following

### Inference Steps (20 - 100)
- **30 - 50**: Fast generation, lower quality
- **50 - 80**: Good balance (recommended)
- **80+**: High quality, slower generation

## Best Practices

### 1. Reference Image Quality
- Use high-quality, clear reference images
- Ensure reference images are well-lit
- Use images with similar styles/themes for better blending

### 2. Prompt Writing
- Be specific about what you want to change
- Use descriptive language for the new angle/view
- Include style preservation keywords when needed

### 3. Parameter Tuning
- Start with recommended parameters
- Adjust strength based on how much you want to preserve
- Increase guidance scale if the prompt isn't being followed well
- Increase inference steps for better quality

### 4. Multiple Reference Images
- Use 2-3 reference images for best results
- Ensure reference images are related/similar
- The first image gets highest weight in blending

## Example Usage

### Basic Fusion Example
```python
import requests

# Login to get token
login_response = requests.post("http://localhost:8000/token", data={
    "username": "your_username",
    "password": "your_password"
})
token = login_response.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Upload reference images and generate
with open("reference1.jpg", "rb") as f1, open("reference2.jpg", "rb") as f2:
    files = {
        "reference_images": [
            ("ref1.jpg", f1, "image/jpeg"),
            ("ref2.jpg", f2, "image/jpeg")
        ]
    }
    
    data = {
        "prompt": "same scene from a low angle",
        "strength": 0.65,
        "guidance_scale": 10.0,
        "num_inference_steps": 60
    }
    
    response = requests.post(
        "http://localhost:8000/fusion/generate",
        data=data,
        files=files,
        headers=headers
    )
    
    result = response.json()
    print(f"Generated image: {result['image_url'][:100]}...")
```

### Advanced Matching Example
```python
# For identity preservation
data = {
    "prompt": "same person in a different pose",
    "matching_type": "identity",
    "strength": 0.6,
    "guidance_scale": 12.0,
    "num_inference_steps": 80
}

response = requests.post(
    "http://localhost:8000/fusion/advanced-match",
    data=data,
    files=files,
    headers=headers
)
```

## Troubleshooting

### Issue: Generated image doesn't match reference
**Solutions**:
1. Reduce strength parameter (try 0.5-0.6)
2. Increase guidance scale (try 10.0-12.0)
3. Use more inference steps (try 60-80)
4. Check reference image quality

### Issue: Prompt not being followed
**Solutions**:
1. Increase guidance scale (try 12.0-15.0)
2. Make prompt more specific
3. Use advanced matching with appropriate type

### Issue: Poor image quality
**Solutions**:
1. Increase inference steps (try 80-100)
2. Use higher quality reference images
3. Ensure reference images are properly sized

### Issue: Slow generation
**Solutions**:
1. Reduce inference steps (try 40-60)
2. Use fewer reference images
3. Use GPU if available

## Testing

Run the test script to verify improvements:
```bash
cd backend
python test_reference_matching.py
```

This will test all the improved endpoints and verify they're working correctly.

## Technical Details

### Image Blending Algorithm
The system now uses weighted averaging to blend multiple reference images:
- First image gets weight 1.0
- Second image gets weight 0.5
- Third image gets weight 0.33
- And so on...

This ensures the first image has the most influence while still incorporating elements from all reference images.

### Theme Analysis
The system analyzes reference images to extract:
- Color palettes
- Composition styles
- Lighting conditions
- Dominant elements
- Theme elements
- Prop elements
- Setting elements

This analysis is used to enhance prompts and preserve visual consistency.

### Fallback Mechanisms
If advanced techniques (ControlNet, IP-Adapter) are not available, the system falls back to enhanced fusion methods to ensure compatibility 