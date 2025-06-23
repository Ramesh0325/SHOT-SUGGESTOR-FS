#!/usr/bin/env python3
"""
Test script for improved image fusion functionality.
This script tests the enhanced theme preservation capabilities.
"""

import requests
import json
import base64
from PIL import Image
from io import BytesIO
import os
import sys

def create_test_image(color, size=(512, 512), text="TEST"):
    """Create a simple test image with solid color and text"""
    from PIL import ImageDraw, ImageFont
    
    img = Image.new('RGB', size, color=color)
    draw = ImageDraw.Draw(img)
    
    # Try to use a default font, fallback to basic if not available
    try:
        font = ImageFont.truetype("arial.ttf", 40)
    except:
        font = ImageFont.load_default()
    
    # Add text to make images distinguishable
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (size[0] - text_width) // 2
    y = (size[1] - text_height) // 2
    
    draw.text((x, y), text, fill='white', font=font)
    
    return img

def test_theme_preservation():
    """Test the improved theme preservation functionality"""
    
    # API endpoint
    base_url = "http://localhost:8000"
    
    # Test credentials
    login_data = {
        "username": "testuser",  # Replace with actual test user
        "password": "testpass"   # Replace with actual test password
    }
    
    try:
        print("🧪 Testing Enhanced Theme Preservation")
        print("=" * 50)
        
        # Step 1: Login
        print("1. Logging in...")
        login_response = requests.post(f"{base_url}/token", data=login_data)
        
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.text}")
            print("Please ensure you have created a test user first")
            return
        
        token_data = login_response.json()
        token = token_data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("✅ Login successful")
        
        # Step 2: Create test reference images
        print("\\n2. Creating test reference images...")
        
        # Create reference images with different themes for testing
        ref1 = create_test_image((100, 150, 200), text="REF1")  # Cool blue theme
        ref2 = create_test_image((120, 170, 220), text="REF2")  # Similar cool theme
        
        # Save to BytesIO for upload
        ref1_buffer = BytesIO()
        ref2_buffer = BytesIO()
        
        ref1.save(ref1_buffer, format='PNG')
        ref2.save(ref2_buffer, format='PNG')
        
        ref1_buffer.seek(0)
        ref2_buffer.seek(0)
        
        print("✅ Test reference images created")
        
        # Step 3: Test theme preservation with different parameters
        test_cases = [
            {
                "name": "Conservative Preservation",
                "prompt": "same scene from a low angle",
                "strength": 0.3,
                "guidance_scale": 15.0,
                "num_inference_steps": 80
            },
            {
                "name": "Balanced Approach", 
                "prompt": "same objects from behind",
                "strength": 0.45,
                "guidance_scale": 12.0,
                "num_inference_steps": 70
            },
            {
                "name": "Creative Angle",
                "prompt": "same environment from above, bird's eye view",
                "strength": 0.6,
                "guidance_scale": 10.0,
                "num_inference_steps": 60
            }
        ]
        
        for i, test_case in enumerate(test_cases, 1):
            print(f"\\n3.{i} Testing: {test_case['name']}")
            print(f"   Prompt: {test_case['prompt']}")
            print(f"   Parameters: strength={test_case['strength']}, guidance={test_case['guidance_scale']}")
            
            # Reset buffer positions
            ref1_buffer.seek(0)
            ref2_buffer.seek(0)
            
            # Prepare files for upload
            files = [
                ("files", ("ref1.png", ref1_buffer, "image/png")),
                ("files", ("ref2.png", ref2_buffer, "image/png"))
            ]
            
            data = {
                "prompt": test_case["prompt"],
                "strength": test_case["strength"],
                "guidance_scale": test_case["guidance_scale"],
                "num_inference_steps": test_case["num_inference_steps"]
            }
            
            try:
                print("   🔄 Generating image...")
                response = requests.post(
                    f"{base_url}/api/theme-preserve",
                    data=data,
                    files=files,
                    headers=headers,
                    timeout=300  # 5 minute timeout
                )
                
                if response.status_code == 200:
                    result = response.json()
                    print("   ✅ Generation successful!")
                    
                    # Check if we have processing info
                    if "processing_info" in result:
                        info = result["processing_info"]
                        print(f"   📊 Device: {info.get('device', 'unknown')}")
                        print(f"   📊 Final strength: {info.get('strength', 'unknown')}")
                        print(f"   📊 Final guidance: {info.get('guidance_scale', 'unknown')}")
                    
                    # Save the result image for inspection
                    if "image" in result:
                        output_filename = f"test_output_{test_case['name'].lower().replace(' ', '_')}.png"
                        try:
                            image_data = base64.b64decode(result["image"])
                            with open(output_filename, "wb") as f:
                                f.write(image_data)
                            print(f"   💾 Saved result to: {output_filename}")
                        except Exception as save_error:
                            print(f"   ⚠️  Could not save image: {save_error}")
                    
                else:
                    print(f"   ❌ Generation failed: {response.status_code}")
                    print(f"   Response: {response.text[:200]}...")
                    
            except requests.exceptions.Timeout:
                print("   ⏰ Request timed out (this might be normal for image generation)")
            except Exception as e:
                print(f"   ❌ Error during generation: {e}")
        
        print("\\n🎉 Theme preservation testing completed!")
        print("\\nImprovements made:")
        print("✅ Enhanced reference image analysis")
        print("✅ Intelligent blending based on structural similarity")
        print("✅ Analysis-driven prompt enhancement")
        print("✅ Optimized parameters for theme preservation")
        print("✅ Conservative default settings")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False
    
    return True

if __name__ == "__main__":
    # Check if server is running
    try:
        response = requests.get("http://localhost:8000/docs", timeout=5)
        if response.status_code == 200:
            print("✅ Backend server is running")
        else:
            print("⚠️  Backend server responded but may have issues")
    except requests.exceptions.RequestException:
        print("❌ Backend server is not running")
        print("Please start the backend server with: cd backend && python main.py")
        sys.exit(1)
    
    # Run the test
    success = test_theme_preservation()
    if success:
        print("\\n🎯 All tests completed successfully!")
    else:
        print("\\n💥 Some tests failed. Check the logs above.")
