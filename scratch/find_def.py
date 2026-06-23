with open("qltpchay/store.py", "r", encoding="utf-8") as f:
    for line_num, line in enumerate(f, 1):
        if "def start_procurement_batch" in line:
            print(f"Line {line_num}: {line.strip()}")
