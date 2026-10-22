with open('qltpchay/store.py', 'r', encoding='utf-8') as f: content = f.read()
schema_addition = '''            self._backfill_batches_from_transactions_if_needed(connection)

            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS zalo_groups (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    zalo_url TEXT,
                    is_active INTEGER DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                """
            )
            try:
                connection.execute("ALTER TABLE customers ADD COLUMN zalo_group_id TEXT")
            except Exception:
                pass'''

content = content.replace('            self._backfill_batches_from_transactions_if_needed(connection)', schema_addition)
with open('qltpchay/store.py', 'w', encoding='utf-8') as f: f.write(content)
print("schema appended")
