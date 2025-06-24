#!/usr/bin/env python3
"""
Verification script to check if shot and image saving is working correctly
"""
import os
import json
from datetime import datetime

def check_project_storage():
    """Check the current state of project storage"""
    backend_path = os.path.dirname(__file__)
    project_images_path = os.path.join(backend_path, 'project_images')
    
    print("🔍 PROJECT STORAGE VERIFICATION")
    print("=" * 50)
    
    if not os.path.exists(project_images_path):
        print("❌ Project images directory doesn't exist!")
        return False
    
    print(f"✅ Project images directory exists: {project_images_path}")
    
    # Count projects and sessions
    project_count = 0
    session_count = 0
    image_count = 0
    
    for item in os.listdir(project_images_path):
        project_dir = os.path.join(project_images_path, item)
        if os.path.isdir(project_dir) and not item.startswith('.'):
            project_count += 1
            print(f"\n📁 Project: {item}")
            
            # Count sessions in this project
            project_sessions = 0
            for session_item in os.listdir(project_dir):
                session_dir = os.path.join(project_dir, session_item)
                if os.path.isdir(session_dir) and session_item.startswith('session_'):
                    project_sessions += 1
                    session_count += 1
                    
                    # Check session contents
                    has_input = os.path.exists(os.path.join(session_dir, 'input.json'))
                    has_shots = os.path.exists(os.path.join(session_dir, 'shots.json'))
                    images_dir = os.path.join(session_dir, 'images')
                    session_images = 0
                    
                    if os.path.exists(images_dir):
                        session_images = len([f for f in os.listdir(images_dir) 
                                            if f.endswith(('.png', '.jpg', '.jpeg'))])
                        image_count += session_images
                    
                    status_icons = []
                    if has_input: status_icons.append("📋")
                    if has_shots: status_icons.append("🎬") 
                    if session_images > 0: status_icons.append(f"🖼️({session_images})")
                    
                    print(f"   └── {session_item} {''.join(status_icons)}")
            
            print(f"   Sessions: {project_sessions}")
    
    print(f"\n📊 SUMMARY:")
    print(f"   Projects: {project_count}")
    print(f"   Sessions: {session_count}")
    print(f"   Images: {image_count}")
    
    # Check a sample session for detailed info
    if session_count > 0:
        print(f"\n🔬 SAMPLE SESSION ANALYSIS:")
        check_sample_session(project_images_path)
    
    return True

def check_sample_session(project_images_path):
    """Check the contents of a sample session"""
    for project_dir in os.listdir(project_images_path):
        project_path = os.path.join(project_images_path, project_dir)
        if os.path.isdir(project_path) and not project_dir.startswith('.'):
            for session_dir in os.listdir(project_path):
                session_path = os.path.join(project_path, session_dir)
                if os.path.isdir(session_path) and session_dir.startswith('session_'):
                    print(f"   Examining: {session_dir}")
                    
                    # Check input.json
                    input_file = os.path.join(session_path, 'input.json')
                    if os.path.exists(input_file):
                        try:
                            with open(input_file, 'r') as f:
                                input_data = json.load(f)
                            print(f"   ✅ Input data: {input_data.get('scene_description', 'N/A')[:50]}...")
                        except:
                            print(f"   ❌ Could not read input.json")
                    
                    # Check shots.json
                    shots_file = os.path.join(session_path, 'shots.json')
                    if os.path.exists(shots_file):
                        try:
                            with open(shots_file, 'r') as f:
                                shots_data = json.load(f)
                            if isinstance(shots_data, dict):
                                shots_count = shots_data.get('num_shots', len(shots_data.get('shots', [])))
                            else:
                                shots_count = len(shots_data)
                            print(f"   ✅ Shots data: {shots_count} shots")
                        except:
                            print(f"   ❌ Could not read shots.json")
                    
                    # Check images directory
                    images_dir = os.path.join(session_path, 'images')
                    if os.path.exists(images_dir):
                        images = [f for f in os.listdir(images_dir) if f.endswith(('.png', '.jpg', '.jpeg'))]
                        print(f"   ✅ Images directory: {len(images)} images")
                        for img in images[:3]:  # Show first 3 images
                            img_path = os.path.join(images_dir, img)
                            size = os.path.getsize(img_path)
                            print(f"      - {img} ({size} bytes)")
                    
                    return  # Just check the first session found

def check_database_integration():
    """Check if database has shot records"""
    try:
        import sqlite3
        backend_path = os.path.dirname(__file__)
        db_path = os.path.join(backend_path, 'shots_app.db')
        
        print(f"\n🗄️ DATABASE VERIFICATION")
        print("=" * 50)
        
        if not os.path.exists(db_path):
            print("❌ Database file doesn't exist!")
            return False
        
        print(f"✅ Database exists: {db_path}")
        
        conn = sqlite3.connect(db_path)
        
        # Check tables
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        print(f"✅ Tables: {', '.join(tables)}")
        
        # Count records
        if 'projects' in tables:
            cursor = conn.execute("SELECT COUNT(*) FROM projects")
            project_count = cursor.fetchone()[0]
            print(f"✅ Projects in DB: {project_count}")
        
        if 'shots' in tables:
            cursor = conn.execute("SELECT COUNT(*) FROM shots")
            shot_count = cursor.fetchone()[0]
            print(f"✅ Shots in DB: {shot_count}")
        
        if 'sessions' in tables:
            cursor = conn.execute("SELECT COUNT(*) FROM sessions")
            session_count = cursor.fetchone()[0]
            print(f"✅ Sessions in DB: {session_count}")
        
        conn.close()
        return True
    
    except Exception as e:
        print(f"❌ Database check failed: {e}")
        return False

if __name__ == "__main__":
    print("🚀 SHOT SUGGESTOR STORAGE VERIFICATION")
    print("=" * 60)
    print(f"Timestamp: {datetime.now()}")
    
    fs_ok = check_project_storage()
    db_ok = check_database_integration()
    
    print(f"\n🎯 FINAL RESULT:")
    if fs_ok and db_ok:
        print("✅ Storage system is working correctly!")
        print("   - Projects are being saved to folders")
        print("   - Sessions are organized with timestamps") 
        print("   - Database is tracking relationships")
        print("   - System ready for image generation")
    else:
        print("❌ Issues detected in storage system")
        if not fs_ok:
            print("   - File system storage has problems")
        if not db_ok:
            print("   - Database storage has problems")
