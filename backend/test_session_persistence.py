#!/usr/bin/env python3

import requests
import json

def test_session_persistence():
    """Test if sessions are being saved and can be retrieved"""
    base_url = "http://localhost:8000"
    
    # Test credentials
    login_data = {
        "username": "ramesh",
        "password": "password"
    }
    
    try:
        print("=== Testing Session Persistence ===")
        
        # 1. Login
        print("1. Logging in...")
        login_response = requests.post(f"{base_url}/token", data=login_data)
        if login_response.status_code != 200:
            print(f"✗ Login failed: {login_response.text}")
            return
            
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("✓ Login successful")
        
        # 2. List projects to find an existing one
        print("2. Listing projects...")
        projects_response = requests.get(f"{base_url}/projects", headers=headers)
        if projects_response.status_code != 200:
            print(f"✗ Failed to list projects: {projects_response.text}")
            return
            
        projects = projects_response.json()
        shot_projects = [p for p in projects if p.get('project_type') == 'shot-suggestion']
        
        if not shot_projects:
            print("✗ No shot suggestion projects found")
            return
            
        test_project = shot_projects[0]
        print(f"✓ Found project: {test_project['name']} (ID: {test_project['id']})")
        
        # 3. List sessions for this project
        print("3. Listing sessions for project...")
        sessions_response = requests.get(
            f"{base_url}/projects/{test_project['id']}/sessions", 
            headers=headers
        )
        
        if sessions_response.status_code == 200:
            sessions = sessions_response.json()
            shot_sessions = [s for s in sessions if not (s.get('type', '').find('fusion') >= 0 or s.get('name', '').find('fusion') >= 0)]
            
            print(f"✓ Found {len(sessions)} total sessions, {len(shot_sessions)} shot sessions")
            
            if shot_sessions:
                # Test loading the most recent session
                latest_session = sorted(shot_sessions, key=lambda x: x.get('created_at', ''), reverse=True)[0]
                print(f"✓ Latest session: {latest_session.get('id', 'Unknown')} created at {latest_session.get('created_at', 'Unknown')}")
                
                # 4. Get session details
                print("4. Getting session details...")
                details_response = requests.get(
                    f"{base_url}/projects/{test_project['id']}/sessions/{latest_session['id']}/details",
                    headers=headers
                )
                
                if details_response.status_code == 200:
                    details = details_response.json()
                    print("✓ Session details loaded successfully")
                    
                    # Check what data is available
                    if details.get('shots_data', {}).get('shots'):
                        shots_count = len(details['shots_data']['shots'])
                        print(f"✓ Found {shots_count} shots in session")
                    else:
                        print("⚠ No shots data found in session")
                        
                    if details.get('input_data', {}).get('scene_description'):
                        scene = details['input_data']['scene_description']
                        print(f"✓ Scene description: {scene[:50]}...")
                    else:
                        print("⚠ No input data found in session")
                        
                else:
                    print(f"✗ Failed to get session details: {details_response.text}")
            else:
                print("⚠ No shot suggestion sessions found for this project")
        else:
            print(f"✗ Failed to list sessions: {sessions_response.text}")
            
    except Exception as e:
        print(f"✗ Error: {e}")

if __name__ == "__main__":
    test_session_persistence()
