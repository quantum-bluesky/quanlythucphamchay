import sqlite3
from pathlib import Path
import os
import sys

# Add parent directory to path to import store if needed, but we can just use raw sqlite
current_dir = Path(__file__).resolve().parent
project_root = current_dir.parent
db_path = project_root / "data" / "inventory.db"

if not db_path.exists():
    print(f"Database not found at {db_path}")
    sys.exit(1)

def migrate():
    conn = sqlite3.connect(db_path)
    try:
        # Check if recipe column exists
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(products)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if "recipe" not in columns:
            print("Column 'recipe' does not exist yet. Please run the app once to trigger automatic schema migration.")
            sys.exit(1)
            
        # Perform migration
        print("Starting migration: copying details to recipe...")
        
        cursor.execute("SELECT id, details FROM products WHERE details IS NOT NULL AND details != ''")
        products = cursor.fetchall()
        
        update_count = 0
        for prod_id, details in products:
            # We copy details -> recipe
            cursor.execute("UPDATE products SET recipe = ? WHERE id = ?", (details, prod_id))
            update_count += 1
            
        conn.commit()
        print(f"Successfully migrated {update_count} products.")
        print("Note: The 'details' column is kept intact. You will need to manually remove the recipe content from the 'details' column in the Admin UI.")
        
    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
