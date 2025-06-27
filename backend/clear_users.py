import sqlite3
import os

# Database setup
DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'shots_app.db')

def clear_all_users():
    """Deletes all users from the database without confirmation."""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # Delete all records from the users table
        cursor.execute("DELETE FROM users")
        conn.commit()
        
        deleted_count = cursor.rowcount
        print(f"Successfully deleted {deleted_count} user(s) from the database.")
        
    except sqlite3.Error as e:
        print(f"Error clearing users: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    clear_all_users() 