#!/usr/bin/env python3

import os
import sys
sys.path.append('.')

from db import list_project_sessions, PROJECT_IMAGES_ROOT

def test_sessions():
    """Test if sessions are being found correctly"""
    print("Testing session listing...")
    print(f"PROJECT_IMAGES_ROOT: {PROJECT_IMAGES_ROOT}")
    
    # Test with the project ID from the URL
    project_id = "b157bc75-134d-4ff5-b4fe-8f9a8d8c30f6"
    user_id = 1  # Assuming user ID 1
    
    sessions = list_project_sessions(user_id, project_id)
    print(f"Found sessions: {len(sessions)}")
    
    for session in sessions:
        print(f"  - {session['name']} ({session['created_at']})")
        print(f"    Has input: {session['has_input']}")
        print(f"    Has shots: {session['has_shots']}")
        print(f"    Folder: {session['folder_path']}")
        print()

if __name__ == "__main__":
    test_sessions()
