#!/usr/bin/env python3

import requests
import json

def test_sessions_endpoint():
    """Test the sessions endpoint with an existing project"""
    base_url = "http://localhost:8000"
    
    # First, try to login to get a token
    print("1. Testing login...")
    login_response = requests.post(f"{base_url}/token", {
        "username": "testuser",  # Replace with actual username
        "password": "testpass"   # Replace with actual password
    })
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.text}")
        return
    
    token = login_response.json()["access_token"]
    print("✅ Login successful")
    
    # Test project sessions endpoint
    project_id = "b157bc75-134d-4ff5-b4fe-8f9a8d8c30f6"  # Your project ID
    print(f"2. Testing sessions for project: {project_id}")
    
    headers = {"Authorization": f"Bearer {token}"}
    sessions_response = requests.get(f"{base_url}/projects/{project_id}/sessions", headers=headers)
    
    print(f"Status: {sessions_response.status_code}")
    print(f"Response: {json.dumps(sessions_response.json(), indent=2)}")
    
    if sessions_response.status_code == 200:
        sessions = sessions_response.json()
        print(f"✅ Found {len(sessions)} sessions")
        
        # Test session details for first session if exists
        if sessions:
            session_id = sessions[0]["id"]
            print(f"3. Testing session details for: {session_id}")
            
            details_response = requests.get(
                f"{base_url}/projects/{project_id}/sessions/{session_id}/details", 
                headers=headers
            )
            print(f"Details Status: {details_response.status_code}")
            print(f"Details Response: {json.dumps(details_response.json(), indent=2)}")
    else:
        print(f"❌ Sessions request failed: {sessions_response.text}")

if __name__ == "__main__":
    test_sessions_endpoint()
