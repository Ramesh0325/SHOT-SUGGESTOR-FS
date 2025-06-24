#!/usr/bin/env python3
"""
Test script to verify image generation and saving works
"""
import requests
import json
import os

def test_image_generation():
    """Test the complete flow: login -> create project -> generate shots -> generate image"""
    
    base_url = "http://localhost:8000"
    
    print("🧪 TESTING IMAGE GENERATION AND SAVING")
    print("=" * 50)
    
    # Test data
    test_user = {
        "username": "testuser",
        "password": "testpass123"
    }
    
    try:
        # 1. Login (or create user if doesn't exist)
        print("1️⃣ Authenticating...")
        
        # Try to login first
        login_response = requests.post(
            f"{base_url}/auth/login",
            data={"username": test_user["username"], "password": test_user["password"]}
        )
        
        if login_response.status_code == 401:
            # User doesn't exist, create it
            print("   Creating new test user...")
            register_response = requests.post(
                f"{base_url}/auth/register",
                json=test_user
            )
            if register_response.status_code == 200:
                print("   ✅ User created successfully")
                # Now login
                login_response = requests.post(
                    f"{base_url}/auth/login",
                    data={"username": test_user["username"], "password": test_user["password"]}
                )
            else:
                print(f"   ❌ Failed to create user: {register_response.text}")
                return False
        
        if login_response.status_code != 200:
            print(f"   ❌ Login failed: {login_response.text}")
            return False
        
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("   ✅ Authentication successful")
        
        # 2. Create a test project
        print("2️⃣ Creating test project...")
        project_data = {
            "name": "Image Generation Test",
            "description": "Testing image generation and saving",
            "project_type": "shot-suggestion"
        }
        
        project_response = requests.post(
            f"{base_url}/projects",
            json=project_data,
            headers=headers
        )
        
        if project_response.status_code != 200:
            print(f"   ❌ Failed to create project: {project_response.text}")
            return False
        
        project_id = project_response.json()["id"]
        print(f"   ✅ Project created: {project_id}")
        
        # 3. Generate shots
        print("3️⃣ Generating shots...")
        shots_data = {
            "scene_description": "A peaceful sunset over mountains with birds flying",
            "num_shots": 2,
            "model_name": "runwayml/stable-diffusion-v1-5"
        }
        
        shots_response = requests.post(
            f"{base_url}/shots/suggest?project_id={project_id}",
            json=shots_data,
            headers=headers
        )
        
        if shots_response.status_code != 200:
            print(f"   ❌ Failed to generate shots: {shots_response.text}")
            return False
        
        shots_result = shots_response.json()
        shots = shots_result.get("suggestions", [])
        session_info = shots_result.get("session_info", {})
        
        print(f"   ✅ Generated {len(shots)} shots")
        print(f"   📁 Session: {session_info.get('id', 'N/A')}")
        
        # 4. Generate image for first shot
        if shots:
            print("4️⃣ Generating image for first shot...")
            first_shot = shots[0]
            
            form_data = {
                "shot_description": first_shot.get("shot_description", ""),
                "model_name": "runwayml/stable-diffusion-v1-5",
                "project_id": project_id,
                "session_id": session_info.get("id", ""),
                "shot_index": "0"
            }
            
            image_response = requests.post(
                f"{base_url}/shots/generate-image",
                data=form_data,
                headers=headers
            )
            
            if image_response.status_code != 200:
                print(f"   ❌ Failed to generate image: {image_response.text}")
                return False
            
            image_result = image_response.json()
            image_url = image_result.get("image_url", "")
            saved_to_project = image_result.get("saved_to_project", False)
            
            print(f"   ✅ Image generated successfully")
            print(f"   🖼️ Image URL: {image_url[:50]}...")
            print(f"   💾 Saved to project: {saved_to_project}")
            
            # 5. Verify the file was saved
            print("5️⃣ Verifying file system...")
            backend_path = os.path.dirname(__file__)
            project_path = os.path.join(backend_path, "project_images", project_id)
            
            if os.path.exists(project_path):
                print(f"   ✅ Project folder exists: {project_path}")
                
                # Look for session folders
                sessions = [d for d in os.listdir(project_path) if d.startswith("session_")]
                if sessions:
                    latest_session = sorted(sessions)[-1]
                    session_path = os.path.join(project_path, latest_session)
                    images_path = os.path.join(session_path, "images")
                    
                    if os.path.exists(images_path):
                        images = [f for f in os.listdir(images_path) if f.endswith(('.png', '.jpg', '.jpeg'))]
                        print(f"   ✅ Found {len(images)} image(s) in session folder")
                        
                        if images:
                            for img in images:
                                img_path = os.path.join(images_path, img)
                                size = os.path.getsize(img_path)
                                print(f"      - {img} ({size} bytes)")
                            return True
                        else:
                            print("   ⚠️ No images found in images folder")
                    else:
                        print("   ❌ Images folder doesn't exist")
                else:
                    print("   ❌ No session folders found")
            else:
                print("   ❌ Project folder doesn't exist")
            
            return False
        else:
            print("   ❌ No shots were generated")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend server")
        print("   Make sure the backend is running on http://localhost:8000")
        return False
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        return False

if __name__ == "__main__":
    print("🧪 SHOT SUGGESTOR IMAGE GENERATION TEST")
    print("=" * 60)
    
    success = test_image_generation()
    
    print(f"\n🎯 TEST RESULT:")
    if success:
        print("✅ Image generation and saving is working perfectly!")
        print("   - Authentication works")
        print("   - Project creation works") 
        print("   - Shot generation works")
        print("   - Image generation works")
        print("   - File system saving works")
    else:
        print("❌ Test failed - check the error messages above")
        print("   Make sure the backend server is running")
