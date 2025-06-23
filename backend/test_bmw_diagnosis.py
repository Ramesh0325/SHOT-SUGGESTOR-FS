#!/usr/bin/env python3
"""
BMW E30 M3 Fusion Test Script
Test different approaches to diagnose the black output issue
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from model import generate_fusion_image, generate_multi_view_fusion
from PIL import Image
import base64
from io import BytesIO
import torch

def test_bmw_fusion():
    """Test BMW E30 M3 fusion with different approaches"""
    
    print("🚗 BMW E30 M3 Fusion Diagnostic Test")
    print("=" * 50)
    
    # Check GPU status
    if torch.cuda.is_available():
        print(f"✅ GPU Available: {torch.cuda.get_device_name()}")
        print(f"✅ GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
    else:
        print("⚠️  Using CPU (slower but should work)")
    
    # You'll need to provide the reference image path
    reference_image_path = input("Enter path to your yellow BMW E30 reference image: ").strip()
    
    if not os.path.exists(reference_image_path):
        print(f"❌ Image not found: {reference_image_path}")
        return
    
    try:
        # Load reference image
        reference_image = Image.open(reference_image_path)
        print(f"✅ Loaded reference image: {reference_image.size}")
        
        # Test 1: Simple prompt with conservative parameters
        print("\n🧪 Test 1: Simple prompt, conservative parameters")
        print("Prompt: 'Side view of the same yellow BMW'")
        
        try:
            result1 = generate_fusion_image(
                prompt="Side view of the same yellow BMW",
                reference_images=[reference_image],
                strength=0.6,
                guidance_scale=8.0,
                num_inference_steps=30
            )
            
            if result1 and len(result1) > 100:  # Check if we got actual image data
                print("✅ Test 1 SUCCESS - Generated image data")
                save_test_image(result1, "test1_simple.png")
            else:
                print("❌ Test 1 FAILED - No/invalid image data")
                
        except Exception as e:
            print(f"❌ Test 1 ERROR: {str(e)}")
        
        # Test 2: Multi-view fusion mode
        print("\n🧪 Test 2: Multi-view fusion mode")
        print("Prompt: 'Side profile view of the same yellow BMW E30'")
        
        try:
            result2 = generate_multi_view_fusion(
                prompt="Side profile view of the same yellow BMW E30",
                reference_images=[reference_image],
                strength=0.5,
                guidance_scale=7.5,
                num_inference_steps=25
            )
            
            if result2 and len(result2) > 100:
                print("✅ Test 2 SUCCESS - Generated image data")
                save_test_image(result2, "test2_multiview.png")
            else:
                print("❌ Test 2 FAILED - No/invalid image data")
                
        except Exception as e:
            print(f"❌ Test 2 ERROR: {str(e)}")
        
        # Test 3: Very minimal prompt
        print("\n🧪 Test 3: Minimal prompt")
        print("Prompt: 'side view'")
        
        try:
            result3 = generate_fusion_image(
                prompt="side view",
                reference_images=[reference_image],
                strength=0.4,
                guidance_scale=6.0,
                num_inference_steps=20
            )
            
            if result3 and len(result3) > 100:
                print("✅ Test 3 SUCCESS - Generated image data")
                save_test_image(result3, "test3_minimal.png")
            else:
                print("❌ Test 3 FAILED - No/invalid image data")
                
        except Exception as e:
            print(f"❌ Test 3 ERROR: {str(e)}")
            
        print("\n📊 Test Results Summary:")
        print("Check the generated test images to see which approach works best.")
        print("If all tests fail, there may be a system-level issue.")
        
    except Exception as e:
        print(f"❌ Failed to load reference image: {str(e)}")

def save_test_image(base64_data: str, filename: str):
    """Save base64 image data to file"""
    try:
        image_data = base64.b64decode(base64_data)
        with open(filename, 'wb') as f:
            f.write(image_data)
        print(f"💾 Saved: {filename}")
    except Exception as e:
        print(f"❌ Failed to save {filename}: {str(e)}")

if __name__ == "__main__":
    test_bmw_fusion()
