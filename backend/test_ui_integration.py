#!/usr/bin/env python3
"""
Test script to verify UI integration with improved reference image matching.
This tests the /api/theme-preserve endpoint that the frontend uses.
"""

import requests
import json
from PIL import Image
from io import BytesIO
import base64

def test_ui_integration():
    """Test the theme preservation endpoint used by the UI"""
    
    # API endpoint
    base_url = "http://localhost:8000"
    
    # Test credentials
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
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        print("✓ Login successful")
        
        # Create a test image (you can replace this with actual image files)
        test_image = Image.new('RGB', (512, 512), color='blue')
        img_buffer = BytesIO()
        test_image.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        
        # Test the theme preservation endpoint (used by the UI)
        print("\nTesting theme preservation endpoint (UI integration)...")
        
        files = {"files": ("test.png", img_buffer, "image/png")}
        
        data = {
            "prompt": "same scene from a low angle",
            # These parameters are now optimized in the backend
            # strength: 0.55, guidance_scale: 13.0, num_inference_steps: 90
        }
        
        response = requests.post(
            f"{base_url}/api/theme-preserve",
            data=data,
            files=files,
            headers=headers
        )
        
        if response.status_code == 200:
            print("✓ Theme preservation test successful")
            result = response.json()
            print(f"  - Generated image size: {len(result['image'])} characters")
            print(f"  - Processing info: {result['processing_info']}")
            print(f"  - Enhanced prompt: {result['processing_info']['enhanced_prompt']}")
            
            # Verify the optimized parameters are being used
            processing_info = result['processing_info']
            if (processing_info['strength'] == 0.55 and 
                processing_info['guidance_scale'] == 13.0 and 
                processing_info['num_inference_steps'] == 90):
                print("✓ Optimized parameters confirmed")
            else:
                print("⚠ Parameters not as expected")
                
        else:
            print(f"✗ Theme preservation test failed: {response.text}")
        
        print("\n✓ UI integration test completed!")
        
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
    print("UI Integration Test Suite")
    print("=" * 40)
    
    # First create a test user
    create_test_user()
    
    # Run the tests
    test_ui_integration() 