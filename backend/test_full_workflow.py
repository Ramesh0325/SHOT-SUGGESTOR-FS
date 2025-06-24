#!/usr/bin/env python3

import requests
import json
import os

def test_full_workflow():
    """Test the complete authentication and session workflow"""
    base_url = "http://localhost:8000"
    project_id = "b157bc75-134d-4ff5-b4fe-8f9a8d8c30f6"
    
    print("🧪 TESTING COMPLETE WORKFLOW")
    print("=" * 50)
    
    # Step 1: Test if backend is responsive
    print("\n1️⃣ Testing backend connectivity:")
    try:
        response = requests.get(f"{base_url}/")
        print(f"✅ Backend is responding: {response.status_code}")
    except Exception as e:
        print(f"❌ Backend connection failed: {e}")
        return
    
    # Step 2: Test login with a test user
    print("\n2️⃣ Testing authentication:")
    print("Note: You need to replace these with actual credentials")
      # Try with actual users from the database
    test_users = [
        {"username": "ramesh", "password": "ramesh"},
        {"username": "ram", "password": "ram"},
        {"username": "testuser", "password": "testuser"},
        {"username": "test", "password": "test"},
        {"username": "hello", "password": "hello"}
    ]
    
    token = None
    for creds in test_users:
        try:
            login_data = {
                "username": creds["username"],
                "password": creds["password"]
            }
            response = requests.post(f"{base_url}/token", data=login_data)
            if response.status_code == 200:
                token = response.json()["access_token"]
                print(f"✅ Login successful with {creds['username']}")
                print(f"   Token: {token[:20]}...")
                break
            else:
                print(f"❌ Login failed for {creds['username']}: {response.status_code}")
        except Exception as e:
            print(f"❌ Login error for {creds['username']}: {e}")
    
    if not token:
        print("\n⚠️  No valid credentials found. Please:")
        print("   1. Check if you have users in the database")
        print("   2. Create a test user if needed")
        print("   3. Update the test credentials above")
        return
    
    # Step 3: Test sessions endpoint
    print(f"\n3️⃣ Testing sessions endpoint:")
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{base_url}/projects/{project_id}/sessions", headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            sessions = response.json()
            print(f"✅ Found {len(sessions)} sessions")
            for i, session in enumerate(sessions):
                print(f"   {i+1}. {session.get('id', 'Unknown')} ({session.get('created_at', 'No date')})")
        else:
            print(f"❌ Sessions request failed: {response.text}")
    except Exception as e:
        print(f"❌ Sessions error: {e}")
    
    # Step 4: Test session details
    if token and 'sessions' in locals() and sessions:
        print(f"\n4️⃣ Testing session details:")
        session_id = sessions[0]['id']
        try:
            response = requests.get(
                f"{base_url}/projects/{project_id}/sessions/{session_id}/details",
                headers=headers
            )
            print(f"Session details status: {response.status_code}")
            if response.status_code == 200:
                print("✅ Session details loaded successfully")
            else:
                print(f"❌ Session details failed: {response.text}")
        except Exception as e:
            print(f"❌ Session details error: {e}")
    
    print("\n🎯 SUMMARY:")
    print("If you see errors above, that's likely why the frontend isn't working.")
    print("Common fixes:")
    print("- Ensure you're logged in with valid credentials")
    print("- Check if the project ID exists and you have access")
    print("- Verify the backend server is running properly")

if __name__ == "__main__":
    test_full_workflow()
