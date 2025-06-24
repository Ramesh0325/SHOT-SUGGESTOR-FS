#!/usr/bin/env python3

import os
import sys
sys.path.append('.')

from db import PROJECT_IMAGES_ROOT

def test_session_structure():
    """Check current session structure"""
    project_id = "b157bc75-134d-4ff5-b4fe-8f9a8d8c30f6"
    project_dir = os.path.join(PROJECT_IMAGES_ROOT, project_id)
    
    if not os.path.exists(project_dir):
        print(f"Project directory not found: {project_dir}")
        return
    
    print(f"Project directory: {project_dir}")
    sessions = [f for f in os.listdir(project_dir) if f.startswith('session_')]
    print(f"Current sessions: {len(sessions)}")
    
    for session in sessions:
        session_path = os.path.join(project_dir, session)
        files = os.listdir(session_path)
        print(f"  - {session}")
        print(f"    Files: {files}")
        print(f"    Size: {sum(os.path.getsize(os.path.join(session_path, f)) for f in files if os.path.isfile(os.path.join(session_path, f)))} bytes")

if __name__ == "__main__":
    test_session_structure()
