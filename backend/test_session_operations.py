#!/usr/bin/env python3

import requests
import json

def test_session_operations():
    """Test session listing, loading, and deletion"""
    base_url = "http://localhost:8000"
    project_id = "b157bc75-134d-4ff5-b4fe-8f9a8d8c30f6"
    
    print("🧪 TESTING SESSION OPERATIONS")
    print("=" * 50)
      # Step 1: Login
    print("\n1️⃣ Testing login:")
    try:
        formData = {"username": "ram", "password": "ram"}  # Use "ram" instead of "ramesh"
        response = requests.post(f"{base_url}/token", data=formData)
        if response.status_code == 200:
            token = response.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            print("✅ Login successful")
        else:
            print(f"❌ Login failed: {response.text}")
            return
    except Exception as e:
        print(f"❌ Login error: {e}")
        return
    
    # Step 2: List sessions
    print("\n2️⃣ Testing session listing:")
    try:
        response = requests.get(f"{base_url}/projects/{project_id}/sessions", headers=headers)
        if response.status_code == 200:
            sessions = response.json()
            print(f"✅ Found {len(sessions)} sessions")
            for i, session in enumerate(sessions):
                print(f"   {i+1}. {session['id']} ({session.get('created_at', 'No date')})")
            
            if not sessions:
                print("No sessions to test with")
                return
                
        else:
            print(f"❌ Session listing failed: {response.text}")
            return
    except Exception as e:
        print(f"❌ Session listing error: {e}")
        return
    
    # Step 3: Test session details
    print("\n3️⃣ Testing session details:")
    first_session = sessions[0]
    session_id = first_session['id']
    try:
        response = requests.get(
            f"{base_url}/projects/{project_id}/sessions/{session_id}/details",
            headers=headers
        )
        if response.status_code == 200:
            details = response.json()
            print("✅ Session details loaded successfully")
            print(f"   Has input: {details.get('input_data') is not None}")
            print(f"   Has shots: {details.get('shots_data') is not None}")
            if details.get('shots_data', {}).get('shots'):
                print(f"   Number of shots: {len(details['shots_data']['shots'])}")
        else:
            print(f"❌ Session details failed: {response.text}")
    except Exception as e:
        print(f"❌ Session details error: {e}")
    
    # Step 4: Test session deletion (skip if only one session)
    if len(sessions) > 1:
        print("\n4️⃣ Testing session deletion:")
        session_to_delete = sessions[-1]  # Delete the oldest session
        session_id = session_to_delete['id']
        try:
            response = requests.delete(
                f"{base_url}/projects/{project_id}/sessions/{session_id}",
                headers=headers
            )
            if response.status_code == 200:
                print("✅ Session deleted successfully")
                
                # Verify it's gone
                response = requests.get(f"{base_url}/projects/{project_id}/sessions", headers=headers)
                if response.status_code == 200:
                    remaining_sessions = response.json()
                    print(f"   Sessions remaining: {len(remaining_sessions)}")
                    if len(remaining_sessions) == len(sessions) - 1:
                        print("✅ Session count decreased as expected")
                    else:
                        print("❌ Session count unexpected")
                        
            else:
                print(f"❌ Session deletion failed: {response.text}")
        except Exception as e:
            print(f"❌ Session deletion error: {e}")
    else:
        print("\n4️⃣ Skipping deletion test (only one session)")
    
    print("\n🎯 SUMMARY:")
    print("All tests completed. Check results above.")

if __name__ == "__main__":
    test_session_operations()
