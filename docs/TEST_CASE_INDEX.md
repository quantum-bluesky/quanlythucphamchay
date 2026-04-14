# Test Case Index

Tài liệu này là bảng mapping nhanh giữa:

- `case code`
- file spec
- lệnh chạy nhanh

Mục tiêu:

- tìm test đúng file trong vài giây
- chạy theo mã case bằng `--grep` hoặc script lọc theo mã
- loại trừ các nhóm case cố định như `UT-DB` khi cần

## 1. Cách đọc mã

- `ACC-*`: acceptance case bám checklist bàn giao
- `IT-*`: integration regression bổ sung
- `UT-*`: unit test backend

## 2. Bảng mapping

| Case code | File spec / test | Lệnh chạy nhanh |
| --- | --- | --- |
| `ACC-ABOUT-01` | `tests/integration/acceptance-checklist.spec.js` | `npx playwright test tests/integration/acceptance-checklist.spec.js --grep "ACC-ABOUT-01"` |
| `ACC-INV-01` | `tests/integration/acceptance-checklist.spec.js` | `npx playwright test tests/integration/acceptance-checklist.spec.js --grep "ACC-INV-01"` |
| `ACC-INV-02` | `tests/integration/core-workflows.spec.js` | `npx playwright test tests/integration/core-workflows.spec.js --grep "ACC-INV-02"` |
| `ACC-SALE-01` | `tests/integration/acceptance-sales-phase-b.spec.js` | `npx playwright test tests/integration/acceptance-sales-phase-b.spec.js --grep "ACC-SALE-01"` |
| `ACC-SALE-02` | `tests/integration/acceptance-sales-phase-b.spec.js` | `npx playwright test tests/integration/acceptance-sales-phase-b.spec.js --grep "ACC-SALE-02"` |
| `ACC-ORD-01` | `tests/integration/management-screens.spec.js` | `npx playwright test tests/integration/management-screens.spec.js --grep "ACC-ORD-01"` |
| `ACC-CUS-01` | `tests/integration/management-screens.spec.js` | `npx playwright test tests/integration/management-screens.spec.js --grep "ACC-CUS-01"` |
| `ACC-PROD-01` | `tests/integration/core-workflows.spec.js` | `npx playwright test tests/integration/core-workflows.spec.js --grep "ACC-PROD-01"` |
| `ACC-PUR-01` | `tests/integration/workflow-phase-a.spec.js` | `npx playwright test tests/integration/workflow-phase-a.spec.js --grep "ACC-PUR-01"` |
| `ACC-PUR-02` | `tests/integration/workflow-phase-a.spec.js` | `npx playwright test tests/integration/workflow-phase-a.spec.js --grep "ACC-PUR-02"` |
| `ACC-PHB-01` | `tests/integration/acceptance-sales-phase-b.spec.js` | `npx playwright test tests/integration/acceptance-sales-phase-b.spec.js --grep "ACC-PHB-01"` |
| `ACC-PHB-02` | `tests/integration/acceptance-sales-phase-b.spec.js` | `npx playwright test tests/integration/acceptance-sales-phase-b.spec.js --grep "ACC-PHB-02"` |
| `ACC-PHB-03` | `tests/integration/acceptance-sales-phase-b.spec.js` | `npx playwright test tests/integration/acceptance-sales-phase-b.spec.js --grep "ACC-PHB-03"` |
| `IT-PHB-01` | `tests/integration/workflow-phase-b.spec.js` | `npx playwright test tests/integration/workflow-phase-b.spec.js --grep "IT-PHB-01"` |
| `IT-PHB-02` | `tests/integration/workflow-phase-b.spec.js` | `npx playwright test tests/integration/workflow-phase-b.spec.js --grep "IT-PHB-02"` |
| `IT-PHB-03` | `tests/integration/workflow-phase-b.spec.js` | `npx playwright test tests/integration/workflow-phase-b.spec.js --grep "IT-PHB-03"` |
| `IT-PHB-04` | `tests/integration/workflow-phase-b.spec.js` | `npx playwright test tests/integration/workflow-phase-b.spec.js --grep "IT-PHB-04"` |
| `IT-PHB-05` | `tests/integration/workflow-phase-b.spec.js` | `npx playwright test tests/integration/workflow-phase-b.spec.js --grep "IT-PHB-05"` |
| `ACC-SUP-01` | `tests/integration/management-screens.spec.js` | `npx playwright test tests/integration/management-screens.spec.js --grep "ACC-SUP-01"` |
| `ACC-SUP-02` | `tests/integration/acceptance-checklist.spec.js` | `npx playwright test tests/integration/acceptance-checklist.spec.js --grep "ACC-SUP-02"` |
| `ACC-REP-01` | `tests/integration/acceptance-checklist.spec.js` / `tests/integration/management-screens.spec.js` | `npx playwright test tests/integration/acceptance-checklist.spec.js tests/integration/management-screens.spec.js --grep "ACC-REP-01"` |
| `ACC-HIS-01` | `tests/integration/acceptance-checklist.spec.js` / `tests/integration/management-screens.spec.js` | `npx playwright test tests/integration/acceptance-checklist.spec.js tests/integration/management-screens.spec.js --grep "ACC-HIS-01"` |
| `ACC-ADM-01` | `tests/integration/admin.spec.js` | `npx playwright test tests/integration/admin.spec.js --grep "ACC-ADM-01"` |
| `ACC-ADM-02` | `tests/integration/admin.spec.js` | `npx playwright test tests/integration/admin.spec.js --grep "ACC-ADM-02"` |
| `ACC-ADM-03` | `tests/integration/workflow-phase-a.spec.js` | `npx playwright test tests/integration/workflow-phase-a.spec.js --grep "ACC-ADM-03"` |
| `ACC-SYNC-01` | `tests/integration/cross-client-sync.spec.js` | `npx playwright test tests/integration/cross-client-sync.spec.js --grep "ACC-SYNC-01"` |
| `ACC-SYNC-02` | `tests/integration/workflow-phase-c.spec.js` | `npx playwright test tests/integration/workflow-phase-c.spec.js --grep "ACC-SYNC-02"` |
| `ACC-SYNC-03` | `tests/integration/workflow-phase-c.spec.js` | `npx playwright test tests/integration/workflow-phase-c.spec.js --grep "ACC-SYNC-03"` |
| `IT-PHD-01` | `tests/integration/workflow-phase-d.spec.js` | `npx playwright test tests/integration/workflow-phase-d.spec.js --grep "IT-PHD-01"` |
| `IT-PHD-02` | `tests/integration/workflow-phase-d.spec.js` | `npx playwright test tests/integration/workflow-phase-d.spec.js --grep "IT-PHD-02"` |
| `IT-PHD-03` | `tests/integration/workflow-phase-d.spec.js` | `npx playwright test tests/integration/workflow-phase-d.spec.js --grep "IT-PHD-03"` |
| `IT-PURSUP-01` | `tests/integration/purchase-supplier-flow.spec.js` | `npx playwright test tests/integration/purchase-supplier-flow.spec.js --grep "IT-PURSUP-01"` |
| `IT-PURSUP-02` | `tests/integration/purchase-supplier-flow.spec.js` | `npx playwright test tests/integration/purchase-supplier-flow.spec.js --grep "IT-PURSUP-02"` |
| `IT-MOB-01` | `tests/integration/mobile-floating-ui.spec.js` | `npx playwright test tests/integration/mobile-floating-ui.spec.js --grep "IT-MOB-01"` |
| `IT-MOB-02` | `tests/integration/mobile-floating-ui.spec.js` | `npx playwright test tests/integration/mobile-floating-ui.spec.js --grep "IT-MOB-02"` |
| `IT-ORD-01` | `tests/integration/orders-actions.spec.js` | `npx playwright test tests/integration/orders-actions.spec.js --grep "IT-ORD-01"` |
| `UT-DB-01` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_01_create_product_and_stock_summary` |
| `UT-DB-02` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_02_stock_out_cannot_exceed_inventory` |
| `UT-DB-03` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_03_inventory_adjustment_receipt_updates_stock_with_reason` |
| `UT-DB-04` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_04_customer_return_receipt_increases_stock` |
| `UT-DB-05` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_05_supplier_return_receipt_reduces_stock` |
| `UT-DB-06` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_06_inventory_adjustment_requires_reason` |
| `UT-NORM-01` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_norm_01_save_sync_state_persists_relational_tables` |
| `UT-NORM-02` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_norm_02_receipt_creation_persists_normalized_receipt_tables` |
| `UT-NORM-03` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_norm_03_legacy_app_state_is_migrated_to_normalized_tables_on_bootstrap` |
| `UT-SYNC-01` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_sync_01_save_sync_state_accepts_matching_expected_updated_at` |
| `UT-SYNC-02` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_sync_02_save_sync_state_rejects_stale_expected_updated_at` |
| `UT-AUD-01` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_aud_01_save_sync_state_logs_cart_status_changes_with_actor` |
| `UT-AUD-02` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_aud_02_save_sync_state_logs_purchase_status_changes_with_actor` |
| `UT-HIS-01` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_his_01_product_history_supports_actor_filter` |
| `UT-HIS-02` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_his_02_product_history_supports_date_range_filter` |

## 3. Lệnh chạy nhanh theo nhóm

### Chạy một case integration

```powershell
npx playwright test tests/integration/workflow-phase-a.spec.js --grep "ACC-PUR-01"
```

### Chạy một nhóm acceptance

```powershell
npx playwright test tests/integration/acceptance-sales-phase-b.spec.js tests/integration/workflow-phase-a.spec.js --grep "ACC-PUR-01|ACC-SALE-01"
```

### Chạy một nhóm unit

```powershell
python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_01_create_product_and_stock_summary
```

### Chạy bằng script chuẩn theo mã

```powershell
npm run test:cases -- -Target integration -IncludeCode ACC-SYNC
```

### Loại trừ nhóm DB

```powershell
npm run test:cases -- -Target unit -ExcludeCode UT-DB
```

### Loại trừ Phase D

```powershell
npm run test:cases -- -Target integration -ExcludeCode IT-PHD
```

### Chạy toàn bộ trừ một nhóm

```powershell
npm run test:cases -- -Target all -ExcludeCode UT-DB
```

## 4. Ghi chú

- Một số test Playwright cover nhiều case checklist; khi đó title test có thể chứa nhiều mã ở đầu.
- Nếu thêm test mới, hãy gắn mã ở đầu tên test để bảng này và lệnh `--grep` dùng được ngay.
- Nếu tách thêm group mới, ưu tiên giữ cùng tiền tố chuẩn như `ACC-`, `IT-`, `UT-`.
