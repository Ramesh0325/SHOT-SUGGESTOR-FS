import sqlite3
import os

# Get the absolute path to the database file
db_path = os.path.join(os.path.dirname(__file__), 'shots_app.db')

# Connect to the database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Fetch all users
cursor.execute("SELECT id, username, created_at FROM users")
users = cursor.fetchall()

print("\nRegistered Users:")
if users:
    for user in users:
        print(f"ID: {user[0]}, Username: {user[1]}, Created: {user[2]}")
else:
    print("No users found in the database.")

conn.close() 