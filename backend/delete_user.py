import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'shots_app.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Ask for usernames to delete (comma separated)
user_input = input("Enter usernames to delete (comma separated): ")
usernames_to_delete = [u.strip() for u in user_input.split(",") if u.strip()]

for username in usernames_to_delete:
    cursor.execute("DELETE FROM users WHERE username = ?", (username,))
    print(f"User '{username}' deleted (if existed).")

conn.commit()
conn.close()