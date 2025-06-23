#!/usr/bin/env python3
"""
Test script for the enhanced image-to-text-to-image fusion approach.
This demonstrates the new approach where we extract detailed text descriptions
from reference images and merge them with user prompts.
"""

import requests
import json
import base64
from PIL import Image
from io import BytesIO
import os

def test_enhanced_fusion():
    """Test the new enhanced fusion approach"""
    
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
        
        # Test scenarios for enhanced fusion
        test_scenarios = [
            {
                "name": "Enhanced Car Viewpoint",
                "prompt": "side view of the same car",
                "description": "Test enhanced fusion with car image using detailed description extraction"
            },
            {
                "name": "Enhanced Portrait Angle",
                "prompt": "profile view of the same person",
                "description": "Test enhanced fusion with portrait using AI vision analysis"
            },
            {
                "name": "Enhanced Scene Background",
                "prompt": "same scene from a lower angle",
                "description": "Test background and environment preservation with enhanced approach"
            },
            {
                "name": "Enhanced Object Detail",
                "prompt": "close-up view of the same objects",
                "description": "Test detailed object preservation with enhanced text extraction"
            }
        ]
        
        for scenario in test_scenarios:
            print(f"\n✨ Testing: {scenario['name']}")
            print(f"📝 Prompt: {scenario['prompt']}")
            print(f"📋 Description: {scenario['description']}")
            
            # Create test images (you should replace these with actual reference images)
            test_images = create_test_images()
            
            # Prepare files for upload
            files = []
            for i, img in enumerate(test_images):
                img_buffer = BytesIO()
                img.save(img_buffer, format='PNG')
                img_buffer.seek(0)
                files.append(('files', (f'ref_{i+1}.png', img_buffer, 'image/png')))
            
            # Test parameters for enhanced fusion
            test_data = {
                "prompt": scenario["prompt"],
                "strength": 0.45,           # Balanced for theme preservation
                "guidance_scale": 12.0,     # Good guidance for AI vision approach
                "num_inference_steps": 70   # Good quality
            }
            
            print("🚀 Testing enhanced fusion (image-to-text-to-image)...")
            
            try:
                response = requests.post(
                    f"{base_url}/api/enhanced-fusion",
                    data=test_data,
                    files=files,
                    headers=headers,
                    timeout=180  # 3 minutes timeout for AI vision analysis
                )
                
                if response.status_code == 200:
                    result = response.json()
                    print("✅ Enhanced fusion successful!")
                    print(f"🖼️ Generated image length: {len(result['image'])} characters")
                    print(f"📊 Processing info: {result.get('processing_info', {})}")
                    print(f"🎯 Approach: {result['processing_info'].get('approach', 'unknown')}")
                    print(f"🔬 Enhancement: {result['processing_info'].get('enhancement', 'unknown')}")
                    
                    # Save the result (optional)
                    save_result_image(result['image'], f"enhanced_test_{scenario['name'].lower().replace(' ', '_')}.png")
                    
                else:
                    print(f"❌ Enhanced fusion failed: {response.status_code}")
                    print(f"Error: {response.text}")
                
            except requests.exceptions.Timeout:
                print("⏰ Request timed out (enhanced fusion with AI vision may take longer)")
            except Exception as e:
                print(f"❌ Error during enhanced fusion: {str(e)}")
            
            # Reset files for next iteration
            for _, file_tuple in files:
                if len(file_tuple) > 1 and hasattr(file_tuple[1], 'close'):
                    file_tuple[1].close()
        
        print("\n🎯 Enhanced Fusion Test Summary:")
        print("=" * 60)
        print("✨ NEW APPROACH: Image-to-Text-to-Image Fusion")
        print("🔍 What it does:")
        print("   1. Extracts detailed text descriptions from your reference images")
        print("   2. Analyzes every background element, character, and theme detail")
        print("   3. Merges these descriptions with your prompt")
        print("   4. Generates images with maximum theme preservation")
        print()
        print("🚀 Benefits over traditional methods:")
        print("   • Preserves ALL background details")
        print("   • Maintains character consistency")
        print("   • Captures subtle theme elements")
        print("   • Better understanding of complete visual context")
        print("   • Reduces theme drift and inconsistencies")
        print()
        print("💡 This mimics how human vision works - seeing and describing")
        print("   every detail before generating the new viewpoint!")
        
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")

def create_test_images():
    """Create simple test images (replace with actual photos for real testing)"""
    images = []
    colors = [(255, 0, 0), (0, 255, 0), (0, 0, 255)]  # Red, Green, Blue
    
    for i, color in enumerate(colors):
        img = Image.new('RGB', (512, 512), color)
        # Add some simple patterns to make it more interesting
        from PIL import ImageDraw
        draw = ImageDraw.Draw(img)
        draw.rectangle([100, 100, 400, 400], fill=(255, 255, 255))
        draw.text((200, 250), f"Test {i+1}", fill=(0, 0, 0))
        images.append(img)
    
    return images

def save_result_image(base64_image: str, filename: str):
    """Save the generated image to file"""
    try:
        image_data = base64.b64decode(base64_image)
        image = Image.open(BytesIO(image_data))
        image.save(filename)
        print(f"💾 Saved result to: {filename}")
    except Exception as e:
        print(f"❌ Failed to save image: {str(e)}")

if __name__ == "__main__":
    print("✨ Enhanced Image-to-Text-to-Image Fusion Test")
    print("=" * 50)
    print("🚀 Testing the NEW approach that:")
    print("   • Extracts detailed descriptions from reference images")
    print("   • Merges descriptions with your prompt")
    print("   • Preserves ALL theme and background details")
    print("   • Maintains character consistency")
    print()
    
    test_enhanced_fusion()
