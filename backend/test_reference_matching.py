#!/usr/bin/env python3
"""
Test script for reference image matching improvements.
This script helps verify that the enhanced fusion functions work correctly.
"""

import requests
import json
import base64
from PIL import Image
from io import BytesIO
import os

def test_reference_matching():
    """Test the improved reference matching functionality"""
    
    # API endpoint
    base_url = "http://localhost:8000"
    
    # Test credentials (you'll need to create a test user first)
    login_data = {
        "username": "testuser",
        "password": "testpass"
    }
    
    try:
        # Login to get token
        print("Logging in...")
        login_response = requests.post(f"{base_url}/token", data=login_data)
        if login_response.status_code != 200:
            print(f"Login failed: {login_response.text}")
            return
        
        token_data = login_response.json()
        token = token_data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        print("✓ Login successful")
        
        # Test 1: Basic fusion with improved parameters
        print("\n1. Testing basic fusion with improved parameters...")
        
        # Create a simple test image (you can replace this with actual image files)
        test_image = Image.new('RGB', (512, 512), color='red')
        img_buffer = BytesIO()
        test_image.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        
        fusion_data = {
            "prompt": "same scene from a different angle",
            "model_name": "runwayml/stable-diffusion-v1-5",
            "strength": 0.65,
            "guidance_scale": 10.0,
            "num_inference_steps": 60
        }
        
        files = {"reference_images": ("test.png", img_buffer, "image/png")}
        
        fusion_response = requests.post(
            f"{base_url}/fusion/generate",
            data=fusion_data,
            files=files,
            headers=headers
        )
        
        if fusion_response.status_code == 200:
            print("✓ Basic fusion test successful")
            result = fusion_response.json()
            print(f"  - Generated image size: {len(result['image_url'])} characters")
            print(f"  - Processing info: {result['processing_info']}")
        else:
            print(f"✗ Basic fusion test failed: {fusion_response.text}")
        
        # Test 2: Advanced matching
        print("\n2. Testing advanced reference matching...")
        
        advanced_data = {
            "prompt": "same person in a different pose",
            "matching_type": "identity",
            "strength": 0.6,
            "guidance_scale": 12.0,
            "num_inference_steps": 80
        }
        
        advanced_response = requests.post(
            f"{base_url}/fusion/advanced-match",
            data=advanced_data,
            files=files,
            headers=headers
        )
        
        if advanced_response.status_code == 200:
            print("✓ Advanced matching test successful")
            result = advanced_response.json()
            print(f"  - Matching type: {result['matching_type']}")
            print(f"  - Generated image size: {len(result['image_url'])} characters")
        else:
            print(f"✗ Advanced matching test failed: {advanced_response.text}")
        
        # Test 3: Theme preservation
        print("\n3. Testing theme preservation...")
        
        theme_data = {
            "prompt": "same environment from a new perspective",
            "strength": 0.6,
            "guidance_scale": 12.0,
            "num_inference_steps": 80
        }
        
        theme_response = requests.post(
            f"{base_url}/api/theme-preserve",
            data=theme_data,
            files=files,
            headers=headers
        )
        
        if theme_response.status_code == 200:
            print("✓ Theme preservation test successful")
            result = theme_response.json()
            print(f"  - Generated image size: {len(result['image'])} characters")
        else:
            print(f"✗ Theme preservation test failed: {theme_response.text}")
        
        print("\n✓ All tests completed!")
        
    except Exception as e:
        print(f"Error during testing: {str(e)}")

def create_test_user():
    """Create a test user if it doesn't exist"""
    base_url = "http://localhost:8000"
    
    user_data = {
        "username": "testuser",
        "password": "testpass",
        "confirm_password": "testpass"
    }
    
    try:
        response = requests.post(f"{base_url}/register", json=user_data)
        if response.status_code == 201:
            print("✓ Test user created successfully")
        elif response.status_code == 400 and "already taken" in response.text:
            print("✓ Test user already exists")
        else:
            print(f"✗ Failed to create test user: {response.text}")
    except Exception as e:
        print(f"Error creating test user: {str(e)}")

if __name__ == "__main__":
    print("Reference Image Matching Test Suite")
    print("=" * 40)
    
    # First create a test user
    create_test_user()
    
    # Run the tests
    test_reference_matching() 