import sqlite3
from pathlib import Path
import sys

current_dir = Path(__file__).resolve().parent
project_root = current_dir.parent
db_path = project_root / "data" / "inventory.db"

if not db_path.exists():
    print(f"Database not found at {db_path}")
    sys.exit(1)

def run():
    print("WARNING: This script will clear the 'details' column for ALL products.")
    print("This should ONLY be run after you have successfully migrated to the 'recipe' column.")
    confirm = input("Are you sure you want to continue? (yes/no): ")
    if confirm.lower() != 'yes':
        print("Aborted.")
        sys.exit(0)

    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.cursor()
        # Count how many have details
        cursor.execute("SELECT COUNT(*) FROM products WHERE details IS NOT NULL AND details != ''")
        count = cursor.fetchone()[0]
        
        if count == 0:
            print("No details found to clear. Already empty.")
            return

        cursor.execute("UPDATE products SET details = '' WHERE details IS NOT NULL AND details != ''")
        conn.commit()
        
        print(f"Successfully cleared 'details' for {count} products.")
        
    except Exception as e:
        conn.rollback()
        print(f"Failed to clear details: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    run()
