#!/usr/bin/env python3

import requests
import json

def test_project_creation():
    """Test project creation functionality"""
    base_url = "http://localhost:8000"
    
    # Test data
    login_data = {
        "username": "ramesh",
        "password": "password"
    }
    
    try:
        print("Testing project creation...")
        
        # 1. Login first
        print("1. Logging in...")
        login_response = requests.post(f"{base_url}/token", data=login_data)
        print(f"Login status: {login_response.status_code}")
        
        if login_response.status_code != 200:
            print(f"Login failed: {login_response.text}")
            return
            
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("✓ Login successful")
        
        # 2. Test project creation
        print("2. Creating project...")
        project_data = {
            "name": "Test Shot Project",
            "description": "A test project for shot suggestions",
            "project_type": "shot-suggestion"
        }
        
        create_response = requests.post(
            f"{base_url}/projects", 
            json=project_data, 
            headers=headers
        )
        
        print(f"Create project status: {create_response.status_code}")
        
        if create_response.status_code == 200:
            project = create_response.json()
            print(f"✓ Project created successfully: {project['id']}")
            print(f"  Name: {project['name']}")
            print(f"  Type: {project['project_type']}")
            
            # 3. Test listing projects
            print("3. Listing projects...")
            list_response = requests.get(f"{base_url}/projects", headers=headers)
            print(f"List projects status: {list_response.status_code}")
            
            if list_response.status_code == 200:
                projects = list_response.json()
                print(f"✓ Found {len(projects)} projects")
                for p in projects[-3:]:  # Show last 3 projects
                    print(f"  - {p['name']} ({p['project_type']})")
            else:
                print(f"✗ Failed to list projects: {list_response.text}")
                
        else:
            print(f"✗ Failed to create project: {create_response.text}")
            
    except Exception as e:
        print(f"✗ Error: {e}")

if __name__ == "__main__":
    test_project_creation()
