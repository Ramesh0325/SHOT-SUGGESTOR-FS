#!/usr/bin/env python3

import requests
import json
import os

def test_sessions_endpoint():
    """Test the sessions endpoint directly"""
    base_url = "http://localhost:8000"
    project_id = "b157bc75-134d-4ff5-b4fe-8f9a8d8c30f6"
    
    print("Testing sessions endpoint...")
    print(f"URL: {base_url}/projects/{project_id}/sessions")
    
    # Test without authentication first
    print("\n1. Testing without authentication:")
    try:
        response = requests.get(f"{base_url}/projects/{project_id}/sessions")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}...")
    except Exception as e:
        print(f"Error: {e}")
    
    # Test with dummy token
    print("\n2. Testing with dummy token:")
    try:
        headers = {"Authorization": "Bearer dummy_token"}
        response = requests.get(f"{base_url}/projects/{project_id}/sessions", headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}...")
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n3. To test with real token:")
    print("   - Login to your app in the browser")
    print("   - Check localStorage for 'token'")
    print("   - Use that token to test the endpoint")

if __name__ == "__main__":
    test_sessions_endpoint()
