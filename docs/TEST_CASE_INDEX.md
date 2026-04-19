# Test Case Index

Tài liệu này là bảng mapping nhanh giữa:

- `case code`
- file spec
- lệnh chạy nhanh

Mục tiêu:

- tìm test đúng file trong vài giây
- chạy theo mã case bằng `--grep` hoặc script lọc theo mã
- loại trừ các nhóm case cố định như `UT-DB` khi cần
- giữ đồng bộ với tài liệu mô tả test case tại `docs/TEST_CASE_DESCRIPTIONS.md`

## 1. Cách đọc mã

- `ACC-*`: acceptance case bám checklist bàn giao
- `IT-*`: integration regression bổ sung
- `UT-*`: unit test backend

## 2. Bảng mapping

| STT | Case code | File spec / test | Lệnh chạy nhanh |
| --- | --- | --- | --- |
| 1 | `ACC-ABOUT-01` | `tests/integration/acceptance-checklist.spec.js` | `npx playwright test tests/integration/acceptance-checklist.spec.js --grep "ACC-ABOUT-01"` |
| 2 | `ACC-INV-01` | `tests/integration/acceptance-checklist.spec.js` | `npx playwright test tests/integration/acceptance-checklist.spec.js --grep "ACC-INV-01"` |
| 3 | `ACC-INV-02` | `tests/integration/core-workflows.spec.js` | `npx playwright test tests/integration/core-workflows.spec.js --grep "ACC-INV-02"` |
| 4 | `ACC-SALE-01` | `tests/integration/acceptance-sales-phase-b.spec.js` | `npx playwright test tests/integration/acceptance-sales-phase-b.spec.js --grep "ACC-SALE-01"` |
| 5 | `ACC-SALE-02` | `tests/integration/acceptance-sales-phase-b.spec.js` | `npx playwright test tests/integration/acceptance-sales-phase-b.spec.js --grep "ACC-SALE-02"` |
| 6 | `ACC-ORD-01` | `tests/integration/management-screens.spec.js` | `npx playwright test tests/integration/management-screens.spec.js --grep "ACC-ORD-01"` |
| 7 | `ACC-CUS-01` | `tests/integration/management-screens.spec.js` | `npx playwright test tests/integration/management-screens.spec.js --grep "ACC-CUS-01"` |
| 8 | `ACC-PROD-01` | `tests/integration/core-workflows.spec.js` | `npx playwright test tests/integration/core-workflows.spec.js --grep "ACC-PROD-01"` |
| 9 | `ACC-PUR-01` | `tests/integration/workflow-phase-a.spec.js` | `npx playwright test tests/integration/workflow-phase-a.spec.js --grep "ACC-PUR-01"` |
| 10 | `ACC-PUR-02` | `tests/integration/workflow-phase-a.spec.js` | `npx playwright test tests/integration/workflow-phase-a.spec.js --grep "ACC-PUR-02"` |
| 11 | `ACC-PHB-01` | `tests/integration/acceptance-sales-phase-b.spec.js` | `npx playwright test tests/integration/acceptance-sales-phase-b.spec.js --grep "ACC-PHB-01"` |
| 12 | `ACC-PHB-02` | `tests/integration/acceptance-sales-phase-b.spec.js` | `npx playwright test tests/integration/acceptance-sales-phase-b.spec.js --grep "ACC-PHB-02"` |
| 13 | `ACC-PHB-03` | `tests/integration/acceptance-sales-phase-b.spec.js` | `npx playwright test tests/integration/acceptance-sales-phase-b.spec.js --grep "ACC-PHB-03"` |
| 14 | `ACC-PHB-04` | `tests/integration/acceptance-sales-phase-b.spec.js` | `npx playwright test tests/integration/acceptance-sales-phase-b.spec.js --grep "ACC-PHB-04"` |
| 15 | `IT-PHB-01` | `tests/integration/workflow-phase-b.spec.js` | `npx playwright test tests/integration/workflow-phase-b.spec.js --grep "IT-PHB-01"` |
| 16 | `IT-PHB-02` | `tests/integration/workflow-phase-b.spec.js` | `npx playwright test tests/integration/workflow-phase-b.spec.js --grep "IT-PHB-02"` |
| 17 | `IT-PHB-03` | `tests/integration/workflow-phase-b.spec.js` | `npx playwright test tests/integration/workflow-phase-b.spec.js --grep "IT-PHB-03"` |
| 18 | `IT-PHB-04` | `tests/integration/workflow-phase-b.spec.js` | `npx playwright test tests/integration/workflow-phase-b.spec.js --grep "IT-PHB-04"` |
| 19 | `IT-PHB-05` | `tests/integration/workflow-phase-b.spec.js` | `npx playwright test tests/integration/workflow-phase-b.spec.js --grep "IT-PHB-05"` |
| 20 | `ACC-SUP-01` | `tests/integration/management-screens.spec.js` | `npx playwright test tests/integration/management-screens.spec.js --grep "ACC-SUP-01"` |
| 21 | `ACC-SUP-02` | `tests/integration/acceptance-checklist.spec.js` | `npx playwright test tests/integration/acceptance-checklist.spec.js --grep "ACC-SUP-02"` |
| 22 | `ACC-REP-01` | `tests/integration/acceptance-checklist.spec.js` / `tests/integration/management-screens.spec.js` | `npx playwright test tests/integration/acceptance-checklist.spec.js tests/integration/management-screens.spec.js --grep "ACC-REP-01"` |
| 23 | `ACC-HIS-01` | `tests/integration/acceptance-checklist.spec.js` / `tests/integration/management-screens.spec.js` | `npx playwright test tests/integration/acceptance-checklist.spec.js tests/integration/management-screens.spec.js --grep "ACC-HIS-01"` |
| 24 | `ACC-ADM-01` | `tests/integration/admin.spec.js` | `npx playwright test tests/integration/admin.spec.js --grep "ACC-ADM-01"` |
| 25 | `ACC-ADM-02` | `tests/integration/admin.spec.js` | `npx playwright test tests/integration/admin.spec.js --grep "ACC-ADM-02"` |
| 26 | `ACC-ADM-03` | `tests/integration/workflow-phase-a.spec.js` | `npx playwright test tests/integration/workflow-phase-a.spec.js --grep "ACC-ADM-03"` |
| 27 | `ACC-SYNC-01` | `tests/integration/cross-client-sync.spec.js` | `npx playwright test tests/integration/cross-client-sync.spec.js --grep "ACC-SYNC-01"` |
| 28 | `ACC-SYNC-02` | `tests/integration/workflow-phase-c.spec.js` | `npx playwright test tests/integration/workflow-phase-c.spec.js --grep "ACC-SYNC-02"` |
| 29 | `ACC-SYNC-03` | `tests/integration/workflow-phase-c.spec.js` | `npx playwright test tests/integration/workflow-phase-c.spec.js --grep "ACC-SYNC-03"` |
| 30 | `IT-PHD-01` | `tests/integration/workflow-phase-d.spec.js` | `npx playwright test tests/integration/workflow-phase-d.spec.js --grep "IT-PHD-01"` |
| 31 | `IT-PHD-02` | `tests/integration/workflow-phase-d.spec.js` | `npx playwright test tests/integration/workflow-phase-d.spec.js --grep "IT-PHD-02"` |
| 32 | `IT-PHD-03` | `tests/integration/workflow-phase-d.spec.js` | `npx playwright test tests/integration/workflow-phase-d.spec.js --grep "IT-PHD-03"` |
| 33 | `IT-PURSUP-01` | `tests/integration/purchase-supplier-flow.spec.js` | `npx playwright test tests/integration/purchase-supplier-flow.spec.js --grep "IT-PURSUP-01"` |
| 34 | `IT-PURSUP-02` | `tests/integration/purchase-supplier-flow.spec.js` | `npx playwright test tests/integration/purchase-supplier-flow.spec.js --grep "IT-PURSUP-02"` |
| 35 | `IT-MOB-01` | `tests/integration/mobile-floating-ui.spec.js` | `npx playwright test tests/integration/mobile-floating-ui.spec.js --grep "IT-MOB-01"` |
| 36 | `IT-MOB-02` | `tests/integration/mobile-floating-ui.spec.js` | `npx playwright test tests/integration/mobile-floating-ui.spec.js --grep "IT-MOB-02"` |
| 37 | `IT-NAV-01` | `tests/integration/detail-scroll.spec.js` | `npx playwright test tests/integration/detail-scroll.spec.js --grep "IT-NAV-01"` |
| 38 | `IT-ORD-01` | `tests/integration/orders-actions.spec.js` | `npx playwright test tests/integration/orders-actions.spec.js --grep "IT-ORD-01"` |
| 39 | `IT-REP-01` | `tests/integration/reports-shortcuts.spec.js` | `npx playwright test tests/integration/reports-shortcuts.spec.js --grep "IT-REP-01"` |
| 40 | `IT-NAV-02` | `tests/integration/mobile-floating-ui.spec.js` | `npx playwright test tests/integration/mobile-floating-ui.spec.js --grep "IT-NAV-02"` |
| 41 | `IT-NAV-03` | `tests/integration/mobile-floating-ui.spec.js` | `npx playwright test tests/integration/mobile-floating-ui.spec.js --grep "IT-NAV-03"` |
| 42 | `IT-NAV-04` | `tests/integration/mobile-floating-ui.spec.js` | `npx playwright test tests/integration/mobile-floating-ui.spec.js --grep "IT-NAV-04"` |
| 43 | `IT-TAB-01` | `tests/integration/mobile-floating-ui.spec.js` | `npx playwright test tests/integration/mobile-floating-ui.spec.js --grep "IT-TAB-01"` |
| 44 | `IT-PAG-01` | `tests/integration/pagination-settings.spec.js` | `npx playwright test tests/integration/pagination-settings.spec.js --grep "IT-PAG-01"` |
| 45 | `UT-DB-01` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_01_create_product_and_stock_summary` |
| 46 | `UT-DB-02` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_02_stock_out_cannot_exceed_inventory` |
| 47 | `UT-DB-03` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_03_inventory_adjustment_receipt_updates_stock_with_reason` |
| 48 | `UT-DB-04` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_04_customer_return_receipt_increases_stock` |
| 49 | `UT-DB-05` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_05_supplier_return_receipt_reduces_stock` |
| 50 | `UT-DB-06` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_06_inventory_adjustment_requires_reason` |
| 51 | `UT-DB-07` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_07_repair_purchase_document_deletes_invalid_paid_purchase_and_detaches_links` |
| 52 | `UT-DB-08` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_08_repair_purchase_document_rejects_valid_paid_purchase_with_receipt` |
| 53 | `UT-DB-09` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_09_repair_purchase_document_cancels_draft_with_paid_markers` |
| 54 | `UT-DB-10` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_10_legacy_received_purchase_backfills_received_at_from_updated_at` |
| 55 | `UT-NORM-01` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_norm_01_save_sync_state_persists_relational_tables` |
| 56 | `UT-NORM-02` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_norm_02_receipt_creation_persists_normalized_receipt_tables` |
| 57 | `UT-NORM-03` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_norm_03_legacy_app_state_is_migrated_to_normalized_tables_on_bootstrap` |
| 58 | `UT-NORM-04` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_norm_04_empty_purchase_drafts_are_not_persisted` |
| 59 | `UT-SYNC-01` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_sync_01_save_sync_state_accepts_matching_expected_updated_at` |
| 60 | `UT-SYNC-02` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_sync_02_save_sync_state_rejects_stale_expected_updated_at` |
| 61 | `UT-AUD-01` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_aud_01_save_sync_state_logs_cart_status_changes_with_actor` |
| 62 | `UT-AUD-02` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_aud_02_save_sync_state_logs_purchase_status_changes_with_actor` |
| 63 | `UT-AUD-03` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_aud_03_receipt_history_lists_phase_b_receipts_with_source_context` |
| 64 | `UT-HIS-01` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_his_01_product_history_supports_actor_filter` |
| 65 | `UT-HIS-02` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_his_02_product_history_supports_date_range_filter` |
| 66 | `UT-REP-01` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_rep_01_monthly_report_separates_phase_b_receipts_from_sales_and_purchases` |

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
- Khi thêm/sửa/xóa mã test trong bảng này, phải cập nhật đồng thời `docs/TEST_CASE_DESCRIPTIONS.md`.
- Nếu tách thêm group mới, ưu tiên giữ cùng tiền tố chuẩn như `ACC-`, `IT-`, `UT-`.
