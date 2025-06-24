#!/usr/bin/env python3

import requests
import json

def test_user_projects():
    """Test listing projects for different users"""
    base_url = "http://localhost:8000"
    
    print("🧪 TESTING USER PROJECTS ACCESS")
    print("=" * 50)
    
    # Test users we know exist
    test_users = [
        {"username": "ram", "password": "ram"},
        {"username": "ramesh", "password": "ramesh"},
        {"username": "vineesha", "password": "vineesha"},
    ]
    
    for user_creds in test_users:
        username = user_creds["username"]
        print(f"\n🔑 Testing user: {username}")
        
        # Step 1: Login
        try:
            formData = {"username": username, "password": user_creds["password"]}
            response = requests.post(f"{base_url}/token", data=formData)
            if response.status_code == 200:
                token = response.json()["access_token"]
                headers = {"Authorization": f"Bearer {token}"}
                print(f"✅ Login successful for {username}")
            else:
                print(f"❌ Login failed for {username}: {response.text}")
                continue
        except Exception as e:
            print(f"❌ Login error for {username}: {e}")
            continue
        
        # Step 2: List projects
        try:
            response = requests.get(f"{base_url}/projects", headers=headers)
            if response.status_code == 200:
                projects = response.json()
                print(f"   📁 Found {len(projects)} projects:")
                for i, project in enumerate(projects):
                    print(f"      {i+1}. {project.get('name', 'Unnamed')} (ID: {project.get('id', 'Unknown')[:8]}...)")
                    
                    # Check project directory
                    project_id = project.get('id')
                    if project_id:
                        # Check if project has sessions
                        try:
                            sessions_response = requests.get(f"{base_url}/projects/{project_id}/sessions", headers=headers)
                            if sessions_response.status_code == 200:
                                sessions = sessions_response.json()
                                print(f"         Sessions: {len(sessions)}")
                            else:
                                print(f"         Sessions: Error ({sessions_response.status_code})")
                        except:
                            print(f"         Sessions: Error checking")
                            
            else:
                print(f"❌ Projects listing failed for {username}: {response.text}")
        except Exception as e:
            print(f"❌ Projects listing error for {username}: {e}")

if __name__ == "__main__":
    test_user_projects()
