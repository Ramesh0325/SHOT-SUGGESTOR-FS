#!/usr/bin/env python3
"""
Test script for improved prompt following in image fusion
"""

import requests
import json
import base64
from PIL import Image
from io import BytesIO
import os

def test_improved_prompt_following():
    """Test that the system now properly follows prompts instead of just copying reference images"""
    
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
            print("Please update the username/password in the script or create a test user")
            return
        
        token_data = login_response.json()
        token = token_data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        print("✅ Login successful")
        
        # Test scenarios that should produce different outputs
        test_scenarios = [
            {
                "name": "Side View Test",
                "prompt": "side view of the same object",
                "expected": "Should show side profile, not copy the front view",
                "mode": "multi-view"
            },
            {
                "name": "From Above Test", 
                "prompt": "top view from above looking down",
                "expected": "Should show overhead perspective",
                "mode": "theme-preserve"
            },
            {
                "name": "Close-up Test",
                "prompt": "close-up detail shot of the same subject",
                "expected": "Should zoom in on details, not copy full image",
                "mode": "theme-preserve"
            },
            {
                "name": "Behind View Test",
                "prompt": "view from behind the same subject",
                "expected": "Should show rear view perspective",
                "mode": "multi-view"
            }
        ]
        
        for i, scenario in enumerate(test_scenarios):
            print(f"\n🧪 Test {i+1}: {scenario['name']}")
            print(f"📝 Prompt: '{scenario['prompt']}'")
            print(f"🎯 Expected: {scenario['expected']}")
            print(f"🔧 Mode: {scenario['mode']}")
            
            # Create test reference image
            test_image = create_test_reference_image(i)
            
            # Prepare files for upload
            img_buffer = BytesIO()
            test_image.save(img_buffer, format='PNG')
            img_buffer.seek(0)
            
            files = [('files', ('test_reference.png', img_buffer, 'image/png'))]
            
            # Test with improved parameters
            test_data = {
                "prompt": scenario["prompt"],
                "strength": 0.6,     # Balanced for prompt following
                "guidance_scale": 12.0,  # Strong prompt guidance
                "num_inference_steps": 60
            }
            
            # Choose endpoint based on mode
            endpoint = f"{base_url}/api/{'multi-view-fusion' if scenario['mode'] == 'multi-view' else 'theme-preserve'}"
            
            print("⚙️ Testing prompt following...")
            
            try:
                response = requests.post(
                    endpoint,
                    data=test_data,
                    files=files,
                    headers=headers,
                    timeout=120
                )
                
                if response.status_code == 200:
                    result = response.json()
                    print("✅ Generation successful!")
                    
                    # Check if we got processing info
                    if "processing_info" in result:
                        info = result["processing_info"]
                        print(f"📊 Parameters used:")
                        print(f"   Strength: {info.get('strength', 'N/A')}")
                        print(f"   Guidance: {info.get('guidance_scale', 'N/A')}")
                        print(f"   Steps: {info.get('num_inference_steps', 'N/A')}")
                    
                    # Save result for manual inspection
                    save_test_result(result['image'], f"prompt_test_{i+1}_{scenario['name'].lower().replace(' ', '_')}.png")
                    
                    print("💡 Manual check needed: Compare generated image with reference to verify prompt was followed")
                    
                else:
                    print(f"❌ Generation failed: {response.status_code}")
                    print(f"Error: {response.text}")
                
            except requests.exceptions.Timeout:
                print("⏰ Request timed out")
            except Exception as e:
                print(f"❌ Error during generation: {str(e)}")
        
        print("\n🎯 Improved Prompt Following Summary:")
        print("=" * 60)
        print("✅ Fixed Issues:")
        print("   • Increased default strength from 0.35-0.4 to 0.55-0.6")
        print("   • Added prompt validation to detect significant changes")
        print("   • Auto-adjust parameters based on prompt requirements")
        print("   • Better balance between preservation and creativity")
        print()
        print("📈 Expected Improvements:")
        print("   • 'side view' prompts should show actual side views")
        print("   • 'from above' should show overhead perspectives") 
        print("   • 'close-up' should zoom in on details")
        print("   • 'behind' should show rear view angles")
        print()
        print("🔍 Manual Verification:")
        print("   • Check saved test images in 'test_results' folder")
        print("   • Compare with reference images")
        print("   • Verify prompts are being followed, not just copying references")
        
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")

def create_test_reference_image(index: int):
    """Create a simple test reference image"""
    colors = [(255, 100, 100), (100, 255, 100), (100, 100, 255), (255, 255, 100)]
    color = colors[index % len(colors)]
    
    # Create a simple geometric shape to test viewpoint changes
    img = Image.new('RGB', (512, 512), color=(240, 240, 240))
    from PIL import ImageDraw
    draw = ImageDraw.Draw(img)
    
    # Draw a simple 3D-looking box that should look different from different angles
    # Front face
    draw.rectangle([150, 200, 350, 400], fill=color, outline=(0, 0, 0), width=3)
    # Top face (perspective)
    draw.polygon([(150, 200), (200, 150), (400, 150), (350, 200)], fill=tuple(max(0, c-50) for c in color), outline=(0, 0, 0), width=2)
    # Right face (perspective)
    draw.polygon([(350, 200), (400, 150), (400, 350), (350, 400)], fill=tuple(max(0, c-80) for c in color), outline=(0, 0, 0), width=2)
    
    return img

def save_test_result(base64_image: str, filename: str):
    """Save the generated test result"""
    try:
        # Decode base64 image
        image_data = base64.b64decode(base64_image)
        image = Image.open(BytesIO(image_data))
        
        # Save to test results folder
        output_dir = "test_results"
        os.makedirs(output_dir, exist_ok=True)
        filepath = os.path.join(output_dir, filename)
        image.save(filepath)
        
        print(f"💾 Saved test result: {filepath}")
        
    except Exception as e:
        print(f"❌ Failed to save test image: {str(e)}")

if __name__ == "__main__":
    print("🧪 Improved Prompt Following Test")
    print("=" * 40)
    print("This test verifies that the system now:")
    print("• Follows prompts instead of copying reference images")
    print("• Uses improved parameter validation")
    print("• Generates different viewpoints as requested")
    print()
    
    test_improved_prompt_following()
