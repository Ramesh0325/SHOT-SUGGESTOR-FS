import sqlite3
import os

# Get the absolute path to the database file
db_path = os.path.join(os.path.dirname(__file__), 'shots_app.db')

# Connect to the database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Fetch all users
cursor.execute("SELECT id, username FROM users")
users = cursor.fetchall()

print("Registered Users:")
if users:
    for user_id, username in users:
        print(f"ID: {user_id}, Username: {username}")
else:
    print("No users found in database!")

conn.close()