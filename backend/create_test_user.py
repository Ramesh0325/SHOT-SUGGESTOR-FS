#!/usr/bin/env python3
import hashlib
import sqlite3
import uuid
import os

# Database setup
DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'shots_app.db')

def create_test_user():
    """Create a test user with known credentials"""
    username = "test"
    password = "test123"
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    user_id = str(uuid.uuid4())
    
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # Check if user already exists
        existing = cursor.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()
        
        if existing:
            print(f"User '{username}' already exists!")
            return
        
        # Create new user
        cursor.execute(
            "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, datetime('now'))",
            (user_id, username, password_hash)
        )
        conn.commit()
        print(f"Test user created successfully!")
        print(f"Username: {username}")
        print(f"Password: {password}")
        print(f"User ID: {user_id}")
        
    except sqlite3.Error as e:
        print(f"Error creating test user: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    create_test_user()
