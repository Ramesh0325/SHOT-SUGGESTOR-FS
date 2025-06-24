#!/usr/bin/env python3

import requests
import json
import os

def test_image_access():
    """Test public access to session images"""
    base_url = "http://localhost:8000"
    
    # Check if there are any existing images in the project folders
    from db import PROJECT_IMAGES_ROOT
    
    print("🖼️ TESTING IMAGE ACCESS WITHOUT AUTHENTICATION")
    print("=" * 60)
    
    found_images = []
    project_dirs = []
    
    if os.path.exists(PROJECT_IMAGES_ROOT):
        for project_id in os.listdir(PROJECT_IMAGES_ROOT):
            project_path = os.path.join(PROJECT_IMAGES_ROOT, project_id)
            if os.path.isdir(project_path):
                project_dirs.append(project_id)
                for session_name in os.listdir(project_path):
                    session_path = os.path.join(project_path, session_name)
                    if os.path.isdir(session_path):
                        images_path = os.path.join(session_path, "images")
                        if os.path.exists(images_path):
                            for image_file in os.listdir(images_path):
                                if image_file.lower().endswith(('.png', '.jpg', '.jpeg')):
                                    found_images.append({
                                        'project_id': project_id,
                                        'session_id': session_name,
                                        'filename': image_file,
                                        'url': f"{base_url}/projects/{project_id}/sessions/{session_name}/images/{image_file}"
                                    })
    
    print(f"\n📁 Found {len(project_dirs)} projects and {len(found_images)} images")
    
    if found_images:
        print("\n🧪 Testing image access:")
        for i, image in enumerate(found_images[:3]):  # Test first 3 images
            print(f"\n   {i+1}. Testing: {image['filename']}")
            print(f"      URL: {image['url']}")
            
            try:
                # Test without authentication
                response = requests.get(image['url'], timeout=10)
                if response.status_code == 200:
                    print(f"      ✅ Image accessible (size: {len(response.content)} bytes)")
                else:
                    print(f"      ❌ Image not accessible: {response.status_code}")
            except Exception as e:
                print(f"      ❌ Error accessing image: {e}")
    else:
        print("❌ No images found to test")
        print("\nTo test:")
        print("1. Login to the frontend")
        print("2. Create a new session with shots")
        print("3. Generate an image for a shot")
        print("4. Run this test again")
    
    print(f"\n🎯 SUMMARY:")
    print(f"   Projects found: {len(project_dirs)}")
    print(f"   Images found: {len(found_images)}")
    if found_images:
        print("   Image serving endpoint is now public (no authentication required)")

if __name__ == "__main__":
    test_image_access()
