#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db import get_project, get_user_by_username

def check_project_and_user():
    """Check if project and user exist"""
    project_id = "b157bc75-134d-4ff5-b4fe-8f9a8d8c30f6"
    username = "ramesh"
    
    print("🔍 CHECKING PROJECT AND USER")
    print("=" * 50)
    
    # Check user
    print(f"\n1️⃣ Checking user '{username}':")
    user = get_user_by_username(username)
    if user:
        print(f"✅ User found: ID={user['id']}")
        user_id = user['id']
    else:
        print("❌ User not found")
        return
    
    # Check project
    print(f"\n2️⃣ Checking project '{project_id}':")
    project = get_project(project_id)
    if project:
        print(f"✅ Project found: Name={project.get('name', 'Unknown')}")
        print(f"   Owner ID: {project.get('user_id', 'Unknown')}")
        print(f"   Current User ID: {user_id}")
        print(f"   Match: {'✅' if project.get('user_id') == user_id else '❌'}")
    else:
        print("❌ Project not found in database")
    
    # Check project directory
    from db import PROJECT_IMAGES_ROOT
    project_dir = os.path.join(PROJECT_IMAGES_ROOT, project_id)
    print(f"\n3️⃣ Checking project directory:")
    print(f"   Path: {project_dir}")
    if os.path.exists(project_dir):
        print("✅ Directory exists")
        sessions = [f for f in os.listdir(project_dir) if f.startswith('session_')]
        print(f"   Sessions found: {len(sessions)}")
        for session in sessions:
            print(f"     - {session}")
    else:
        print("❌ Directory does not exist")

if __name__ == "__main__":
    check_project_and_user()
