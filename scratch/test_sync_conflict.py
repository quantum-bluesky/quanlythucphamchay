import sys
from pathlib import Path
from qltpchay.store import InventoryStore, SyncConflictError

db_path = Path("data/inventory.db")
store = InventoryStore(db_path)
store.enable_multiuser_conflict_check = True

# Get current state
sync_state = store.get_sync_state()
initial_updated_at = sync_state["updated_at"]

print(f"Initial updated_at for carts: {initial_updated_at.get('carts')}")

# Try first save
existing_carts = list(sync_state["carts"])
try:
    store.save_sync_state({
        "carts": existing_carts + [{"id": "phase-c-cart-temp-1", "status": "draft", "items": []}],
        "expected_updated_at": {"carts": initial_updated_at.get("carts")}
    })
    print("First save succeeded")
except Exception as e:
    print(f"First save failed with: {type(e).__name__}: {e}")
    sys.exit(1)

# Try stale save
try:
    store.save_sync_state({
        "carts": [{"id": "phase-c-cart-temp-2", "status": "draft", "items": []}],
        "expected_updated_at": {"carts": initial_updated_at.get("carts")}
    })
    print("Stale save succeeded (Unexpected!)")
except Exception as e:
    print(f"Stale save failed with: {type(e).__name__}: {e}")
