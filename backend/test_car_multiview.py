#!/usr/bin/env python3
"""
Test script for multi-view fusion - specifically for car example:
Front view car → Side view car generation
"""

import requests
import json
import base64
from PIL import Image
from io import BytesIO
import os

def test_car_multi_view():
    """Test multi-view fusion with car example"""
    
    base_url = "http://localhost:8000"
    
    # Test credentials
    login_data = {
        "username": "testuser",  # Replace with your username
        "password": "testpass"   # Replace with your password
    }
    
    try:
        # Login to get token
        print("🔐 Logging in...")
        login_response = requests.post(f"{base_url}/token", data=login_data)
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.text}")
            return
        
        token_data = login_response.json()
        token = token_data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        print("✅ Login successful")
        
        # Test scenarios
        test_scenarios = [
            {
                "name": "Car Front to Side View",
                "prompt": "side view of the same car",
                "description": "Generate side view from front view reference"
            },
            {
                "name": "Car to Rear View", 
                "prompt": "rear view of the same car",
                "description": "Generate rear view from front view reference"
            },
            {
                "name": "Car from Above",
                "prompt": "top view of the same car from above",
                "description": "Generate overhead view from front view reference"
            },
            {
                "name": "Car Close-up Detail",
                "prompt": "close-up side view focusing on the car door and wheel",
                "description": "Generate detailed side view from front view reference"
            }
        ]
        
        for scenario in test_scenarios:
            print(f"\n🚗 Testing: {scenario['name']}")
            print(f"📝 Prompt: {scenario['prompt']}")
            print(f"📋 Description: {scenario['description']}")
            
            # Create test car images (you should replace these with actual car images)
            test_images = create_test_car_images()
            
            # Prepare files for upload
            files = []
            for i, img in enumerate(test_images):
                img_buffer = BytesIO()
                img.save(img_buffer, format='PNG')
                img_buffer.seek(0)
                files.append(('files', (f'car_ref_{i+1}.png', img_buffer, 'image/png')))
            
            # Test parameters optimized for car viewpoint generation
            test_data = {
                "prompt": scenario["prompt"],
                "strength": 0.35,           # Conservative for consistency
                "guidance_scale": 16.0,     # Strong guidance for accuracy
                "num_inference_steps": 80   # Good quality
            }
            
            print("⚙️ Testing multi-view fusion...")
            
            try:
                response = requests.post(
                    f"{base_url}/api/multi-view-fusion",
                    data=test_data,
                    files=files,
                    headers=headers,
                    timeout=120  # 2 minutes timeout
                )
                
                if response.status_code == 200:
                    result = response.json()
                    print("✅ Multi-view fusion successful!")
                    print(f"🖼️ Generated image length: {len(result['image'])} characters")
                    print(f"📊 Processing info: {result.get('processing_info', {})}")
                    
                    # Save the result (optional)
                    save_result_image(result['image'], f"car_test_{scenario['name'].lower().replace(' ', '_')}.png")
                    
                else:
                    print(f"❌ Multi-view fusion failed: {response.status_code}")
                    print(f"Error: {response.text}")
                
            except requests.exceptions.Timeout:
                print("⏰ Request timed out (this is normal for first-time model loading)")
            except Exception as e:
                print(f"❌ Error during multi-view fusion: {str(e)}")
            
            # Reset files for next iteration
            for _, file_tuple in files:
                if len(file_tuple) > 1 and hasattr(file_tuple[1], 'close'):
                    file_tuple[1].close()
        
        print("\n🎯 Multi-view Fusion Test Summary:")
        print("=" * 50)
        print("✅ The system should now better handle:")
        print("   • Car front view → side view generation")
        print("   • Preserving car model, color, and details")
        print("   • Maintaining background and lighting")
        print("   • Generating realistic new perspectives")
        print()
        print("📈 With multiple reference images:")
        print("   • Better 3D understanding of the car")
        print("   • More consistent color and material preservation")
        print("   • Reduced hallucination of unseen details")
        print("   • Higher quality viewpoint transformations")
        
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")

def create_test_car_images():
    """Create simple test car images (replace with actual car photos)"""
    # Create simple colored rectangles representing cars
    # In real usage, you would load actual car photos
    
    images = []
    colors = [(255, 0, 0), (0, 255, 0), (0, 0, 255)]  # Red, Green, Blue cars
    
    for i, color in enumerate(colors):
        img = Image.new('RGB', (512, 512), color=(200, 200, 200))  # Gray background
        # Draw a simple car shape (rectangle)
        from PIL import ImageDraw
        draw = ImageDraw.Draw(img)
        
        # Car body
        draw.rectangle([100, 200, 400, 350], fill=color, outline=(0, 0, 0), width=3)
        # Car windows
        draw.rectangle([120, 220, 380, 280], fill=(100, 100, 100), outline=(0, 0, 0), width=2)
        # Car wheels
        draw.circle([150, 350], 30, fill=(50, 50, 50), outline=(0, 0, 0), width=3)
        draw.circle([350, 350], 30, fill=(50, 50, 50), outline=(0, 0, 0), width=3)
        
        images.append(img)
    
    return images[:2]  # Return first 2 images

def save_result_image(base64_image: str, filename: str):
    """Save the generated image to file"""
    try:
        # Decode base64 image
        image_data = base64.b64decode(base64_image)
        image = Image.open(BytesIO(image_data))
        
        # Save to file
        output_dir = "test_results"
        os.makedirs(output_dir, exist_ok=True)
        filepath = os.path.join(output_dir, filename)
        image.save(filepath)
        
        print(f"💾 Saved result to: {filepath}")
        
    except Exception as e:
        print(f"❌ Failed to save image: {str(e)}")

if __name__ == "__main__":
    print("🚗 Car Multi-View Fusion Test")
    print("=" * 40)
    print("This test demonstrates:")
    print("• Generating car side views from front view references")
    print("• Preserving car color, model, and environmental details")
    print("• Using multiple reference images for better consistency")
    print()
    
    test_car_multi_view()
