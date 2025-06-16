import sqlite3
import os

# Get the absolute path to the database file
db_path = os.path.join(os.path.dirname(__file__), 'shots_app.db')

# Connect to the database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Fetch all users' name and email
cursor.execute("SELECT username, email FROM users")
users = cursor.fetchall()

print("Registered Users:")
for username, email in users:
    print(f"Name: {username}, Email: {email}")

conn.close()