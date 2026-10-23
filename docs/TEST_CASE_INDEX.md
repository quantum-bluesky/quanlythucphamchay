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
| 172 | `UT-AUTH-16` | `tests/test_auth_http.py` | `python -m unittest tests.test_auth_http.AuthHttpTests.test_ut_auth_16_public_products_expose_internal_low_stock_status` |
| 173 | `IT-PUB-01` | `tests/integration/public-product-list.spec.js` | `npx playwright test tests/integration/public-product-list.spec.js --grep IT-PUB-01` |
| 174 | `UT-AUTH-17` | `tests/test_auth_http.py` | `python -m unittest tests.test_auth_http.AuthHttpTests.test_ut_auth_17_product_update_can_hide_item_from_public_catalog` |
| 175 | `IT-PUB-02` | `tests/integration/product-metadata.spec.js` | `npx playwright test tests/integration/product-metadata.spec.js --grep IT-PUB-02` |
| 176 | `IT-PUB-03` | `tests/integration/public-product-list.spec.js` | `npx playwright test tests/integration/public-product-list.spec.js --grep IT-PUB-03` |
| 177 | `UT-LUN-01` | `tests/test_lunar_calendar.py` | `python -m unittest tests.test_lunar_calendar.VietnameseLunarCalendarTests.test_ut_lunar_01_known_vietnamese_new_year_dates` |
| 178 | `UT-LUN-02` | `tests/test_lunar_calendar.py` | `python -m unittest tests.test_lunar_calendar.VietnameseLunarCalendarTests.test_ut_lunar_02_identifies_vietnamese_leap_month` |
| 179 | `UT-LUN-03` | `tests/test_lunar_calendar.py` | `python -m unittest tests.test_lunar_calendar.VietnameseLunarCalendarTests.test_ut_lunar_03_rejects_non_date_input` |
| 180 | `IT-PUB-04` | `tests/integration/public-product-list.spec.js` | `npx playwright test tests/integration/public-product-list.spec.js --grep IT-PUB-04` |
| 181 | `IT-PUB-05` | `tests/integration/public-product-list.spec.js` | `npx playwright test tests/integration/public-product-list.spec.js --grep IT-PUB-05` |
| 184 | `UT-LUN-04` | `tests/test_lunar_calendar.py` | `python -m unittest tests.test_lunar_calendar.VietnameseLunarCalendarTests.test_ut_lunar_04_counts_down_to_lunar_first_and_fifteenth` |
| 185 | `UT-LUN-05` | `tests/test_lunar_calendar.py` | `python -m unittest tests.test_lunar_calendar.VietnameseLunarCalendarTests.test_ut_lunar_05_includes_today_and_rejects_non_date_input` |
| 186 | `IT-PUB-06` | `tests/integration/public-product-list.spec.js` | `npx playwright test tests/integration/public-product-list.spec.js --grep IT-PUB-06` |
| 164 | `IT-UNIT-03` | `tests/integration/unit-quantity-roundtrip.spec.js` | `npx playwright test --grep IT-UNIT-03` |
| 165 | `UT-UNIT-01` | `tests/test_cart_item_update.py` | `python -m unittest discover -s tests -p test_cart_item_update.py` |
| 166 | `UT-UNIT-02` | `tests/test_cart_item_update.py` | `python -m unittest discover -s tests -p test_cart_item_update.py` |
| 167 | `UT-UNIT-03` | `tests/test_cart_item_update.py` | `python -m unittest discover -s tests -p test_cart_item_update.py` |
| 168 | `UT-UNIT-04` | `tests/test_cart_item_update.py` | `python -m unittest discover -s tests -p test_cart_item_update.py` |
| 169 | `UT-UNIT-05` | `tests/test_cart_item_update.py` | `python -m unittest discover -s tests -p test_cart_item_update.py` |
| 170 | `UT-UNIT-06` | `tests/test_cart_item_update.py` | `python -m unittest discover -s tests -p test_cart_item_update.py` |
| 171 | `UT-UNIT-07` | `tests/test_cart_item_update.py` | `python -m unittest discover -s tests -p test_cart_item_update.py` |
| 162 | `IT-UNIT-01` | `tests/integration/unit-quantity-roundtrip.spec.js` | `npx playwright test --grep IT-UNIT-01` |
| 163 | `IT-UNIT-02` | `tests/integration/unit-quantity-roundtrip.spec.js` | `npx playwright test --grep IT-UNIT-02` |
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
| 27 | `ACC-LOG-01` | `tests/integration/login.spec.js` | `npx playwright test tests/integration/login.spec.js --grep "ACC-LOG-01"` |
| 28 | `IT-LOG-04` | `tests/integration/login.spec.js` | `npx playwright test tests/integration/login.spec.js --grep "IT-LOG-04"` |
| 28 | `ACC-SYNC-01` | `tests/integration/cross-client-sync.spec.js` | `npx playwright test tests/integration/cross-client-sync.spec.js --grep "ACC-SYNC-01"` |
| 29 | `ACC-SYNC-02` | `tests/integration/workflow-phase-c.spec.js` | `npx playwright test tests/integration/workflow-phase-c.spec.js --grep "ACC-SYNC-02"` |
| 30 | `ACC-SYNC-03` | `tests/integration/workflow-phase-c.spec.js` | `npx playwright test tests/integration/workflow-phase-c.spec.js --grep "ACC-SYNC-03"` |
| 30 | `IT-PHD-01` | `tests/integration/workflow-phase-d.spec.js` | `npx playwright test tests/integration/workflow-phase-d.spec.js --grep "IT-PHD-01"` |
| 31 | `IT-PHD-02` | `tests/integration/workflow-phase-d.spec.js` | `npx playwright test tests/integration/workflow-phase-d.spec.js --grep "IT-PHD-02"` |
| 32 | `IT-PHD-03` | `tests/integration/workflow-phase-d.spec.js` | `npx playwright test tests/integration/workflow-phase-d.spec.js --grep "IT-PHD-03"` |
| 33 | `IT-PURSUP-01` | `tests/integration/purchase-supplier-flow.spec.js` | `npx playwright test tests/integration/purchase-supplier-flow.spec.js --grep "IT-PURSUP-01"` |
| 34 | `IT-PURSUP-02` | `tests/integration/purchase-supplier-flow.spec.js` | `npx playwright test tests/integration/purchase-supplier-flow.spec.js --grep "IT-PURSUP-02"` |
| 35 | `IT-PURSUP-03` | `tests/integration/purchase-supplier-flow.spec.js` | `npx playwright test tests/integration/purchase-supplier-flow.spec.js --grep "IT-PURSUP-03"` |
| 36 | `IT-PURSUP-04` | `tests/integration/purchase-supplier-flow.spec.js` | `npx playwright test tests/integration/purchase-supplier-flow.spec.js --grep "IT-PURSUP-04"` |
| 37 | `IT-PURSUP-05` | `tests/integration/purchase-supplier-flow.spec.js` | `npx playwright test tests/integration/purchase-supplier-flow.spec.js --grep "IT-PURSUP-05"` |
| 38 | `IT-PURSUP-06` | `tests/integration/purchase-supplier-flow.spec.js` | `npx playwright test tests/integration/purchase-supplier-flow.spec.js --grep "IT-PURSUP-06"` |
| 39 | `IT-PURSUP-07` | `tests/integration/purchase-supplier-flow.spec.js` | `npx playwright test tests/integration/purchase-supplier-flow.spec.js --grep "IT-PURSUP-07"` |
| 39 | `IT-MOB-01` | `tests/integration/mobile-floating-ui.spec.js` | `npx playwright test tests/integration/mobile-floating-ui.spec.js --grep "IT-MOB-01"` |
| 40 | `IT-MOB-02` | `tests/integration/mobile-floating-ui.spec.js` | `npx playwright test tests/integration/mobile-floating-ui.spec.js --grep "IT-MOB-02"` |
| 41 | `IT-NAV-01` | `tests/integration/detail-scroll.spec.js` | `npx playwright test tests/integration/detail-scroll.spec.js --grep "IT-NAV-01"` |
| 42 | `IT-ORD-01` | `tests/integration/orders-actions.spec.js` | `npx playwright test tests/integration/orders-actions.spec.js --grep "IT-ORD-01"` |
| 43 | `IT-REP-01` | `tests/integration/reports-shortcuts.spec.js` | `npx playwright test tests/integration/reports-shortcuts.spec.js --grep "IT-REP-01"` |
| 44 | `IT-NAV-02` | `tests/integration/mobile-floating-ui.spec.js` | `npx playwright test tests/integration/mobile-floating-ui.spec.js --grep "IT-NAV-02"` |
| 45 | `IT-NAV-03` | `tests/integration/mobile-floating-ui.spec.js` | `npx playwright test tests/integration/mobile-floating-ui.spec.js --grep "IT-NAV-03"` |
| 46 | `IT-NAV-04` | `tests/integration/mobile-floating-ui.spec.js` | `npx playwright test tests/integration/mobile-floating-ui.spec.js --grep "IT-NAV-04"` |
| 47 | `IT-TAB-01` | `tests/integration/mobile-floating-ui.spec.js` | `npx playwright test tests/integration/mobile-floating-ui.spec.js --grep "IT-TAB-01"` |
| 48 | `IT-PAG-01` | `tests/integration/pagination-settings.spec.js` | `npx playwright test tests/integration/pagination-settings.spec.js --grep "IT-PAG-01"` |
| 49 | `IT-ORD-03` | `tests/integration/orders-actions.spec.js` | `npx playwright test tests/integration/orders-actions.spec.js --grep "IT-ORD-03"` |
| 50 | `IT-PURSUP-08` | `tests/integration/purchase-supplier-flow.spec.js` | `npx playwright test tests/integration/purchase-supplier-flow.spec.js --grep "IT-PURSUP-08"` |
| 51 | `IT-ORD-04` | `tests/integration/orders-actions.spec.js` | `npx playwright test tests/integration/orders-actions.spec.js --grep "IT-ORD-04"` |
| 52 | `IT-ORD-05` | `tests/integration/orders-actions.spec.js` | `npx playwright test tests/integration/orders-actions.spec.js --grep "IT-ORD-05"` |
| 119 | `IT-PURSUP-09` | `tests/integration/purchase-supplier-flow.spec.js` | `npx playwright test tests/integration/purchase-supplier-flow.spec.js --grep "IT-PURSUP-09"` |
| 120 | `IT-PURSUP-10` | `tests/integration/purchase-supplier-flow.spec.js` | `npx playwright test tests/integration/purchase-supplier-flow.spec.js --grep "IT-PURSUP-10"` |
| 121 | `IT-ORD-06` | `tests/integration/orders-actions.spec.js` | `npx playwright test tests/integration/orders-actions.spec.js --grep "IT-ORD-06"` |
| 122 | `IT-PURSUP-11` | `tests/integration/purchase-supplier-flow.spec.js` | `npx playwright test tests/integration/purchase-supplier-flow.spec.js --grep "IT-PURSUP-11"` |
| 123 | `IT-ORD-07` | `tests/integration/orders-actions.spec.js` | `npx playwright test tests/integration/orders-actions.spec.js --grep "IT-ORD-07"` |
| 124 | `IT-ORD-08` | `tests/integration/orders-actions.spec.js` | `npx playwright test tests/integration/orders-actions.spec.js --grep "IT-ORD-08"` |
| 125 | `IT-ORD-09` | `tests/integration/orders-actions.spec.js` | `npx playwright test tests/integration/orders-actions.spec.js --grep "IT-ORD-09"` |
| 53 | `UT-DB-01` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_01_create_product_and_stock_summary` |
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
| 67 | `ACC-PUR-03` | `tests/integration/workflow-phase-a.spec.js` | `npx playwright test tests/integration/workflow-phase-a.spec.js --grep "ACC-PUR-03"` |
| 68 | `ACC-SCR-CAP-01` | `tests/integration/capture-screens.spec.js` | `npx playwright test tests/integration/capture-screens.spec.js --grep "ACC-SCR-CAP-01"` |
| 69 | `ACC-SCR-CAP-02` | `tests/integration/capture-screens.spec.js` | `npx playwright test tests/integration/capture-screens.spec.js --grep "ACC-SCR-CAP-02"` |
| 70 | `UT-DB-11` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_11_purchase_must_be_ordered_before_receive_and_ordered_remains_editable` |
| 71 | `IT-STS-01` | `tests/integration/workflow-phase-a.spec.js` | `npx playwright test tests/integration/workflow-phase-a.spec.js --grep "IT-STS-01"` |
| 72 | `UT-AUTH-06` | `tests/test_auth_http.py` | `python -m unittest tests.test_auth_http.AuthHttpTests.test_ut_auth_06_static_html_and_js_are_served_with_versioned_client_assets` |
| 73 | `UT-JSVER-01` | `tests/test_js_asset_versions.py` | `python -m unittest tests.test_js_asset_versions.JavaScriptAssetVersionManagerTests.test_ut_jsver_01_versions_increment_per_changed_file_and_reset_when_main_version_changes` |
| 74 | `UT-AUD-04` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_aud_04_product_master_import_logs_actor_for_restore_and_update` |
| 75 | `UT-HIS-03` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_his_03_product_history_lists_changed_fields_for_inline_update` |
| 76 | `UT-JSVER-02` | `tests/test_js_asset_versions.py` | `python -m unittest tests.test_js_asset_versions.JavaScriptAssetVersionManagerTests.test_ut_jsver_02_index_and_module_imports_receive_version_query` |
| 77 | `UT-JSVER-03` | `tests/test_js_asset_versions.py` | `python -m unittest tests.test_js_asset_versions.JavaScriptAssetVersionManagerTests.test_ut_jsver_03_manifest_version_matches_system_config_version` |
| 78 | `UT-JSVER-04` | `tests/test_js_asset_versions.py` | `python -m unittest tests.test_js_asset_versions.JavaScriptAssetVersionManagerTests.test_ut_jsver_04_line_ending_only_changes_do_not_increment_file_counter` |
| 79 | `UT-JSVER-05` | `tests/test_js_asset_versions.py` | `python -m unittest tests.test_js_asset_versions.JavaScriptAssetVersionManagerTests.test_ut_jsver_05_legacy_raw_crlf_hash_migrates_without_incrementing_counter` |
| 80 | `UT-INVSORT-01` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_invsort_01_product_life_fields_and_priority_metrics_are_normalized` |
| 81 | `UT-INVSORT-02` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_invsort_02_master_csv_and_seed_import_accept_life_fields` |
| 82 | `IT-INV-SORT-01` | `tests/integration/inventory-sort.spec.js` | `npx playwright test tests/integration/inventory-sort.spec.js --grep "IT-INV-SORT-01"` |
| 83 | `IT-INV-SORT-02` | `tests/integration/inventory-sort.spec.js` | `npx playwright test tests/integration/inventory-sort.spec.js --grep "IT-INV-SORT-02"` |
| 84 | `IT-PROD-LIFE-01` | `tests/integration/inventory-sort.spec.js` | `npx playwright test tests/integration/inventory-sort.spec.js --grep "IT-PROD-LIFE-01"` |
| 85 | `UT-SYNC-03` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_sync_03_discount_updates_are_allowed_before_paid_and_locked_after_paid` |
| 86 | `UT-DB-12` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_12_repair_purchase_document_allows_regular_draft_delete_and_ordered_cancel_but_rejects_ordered_delete` |
| 87 | `UT-SYNC-04` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_sync_04_cart_workflow_supports_draft_cancel_and_completed_paid_locks` |
| 88 | `UT-DB-13` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_13_checkout_order_consumes_real_expiry_lots_in_fefo_order` |
| 89 | `UT-DB-14` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_14_supplier_return_can_target_a_specific_batch` |
| 90 | `UT-DB-15` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_15_purchase_requires_supplier_before_ordered_or_received` |
| 91 | `ACC-PUR-05` | `tests/integration/workflow-phase-a.spec.js` | `npx playwright test tests/integration/workflow-phase-a.spec.js --grep "ACC-PUR-05"` |
| 92 | `IT-PUR-01` | `tests/integration/workflow-phase-a.spec.js` | `npx playwright test tests/integration/workflow-phase-a.spec.js --grep "IT-PUR-01"` |
| 93 | `UT-DB-16` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_16_purchase_receipt_auto_calculates_expiry_from_received_date_or_manufacture_date` |
| 94 | `UT-DB-17` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_17_received_purchase_expiry_update_syncs_purchase_items_batches_and_receipt_items` |
| 95 | `UT-SYNC-05` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_sync_05_committed_cart_locks_customer_but_allows_ship_address_until_completed` |
| 96 | `UT-ORD-15` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_ord_15_commit_and_ship_cart_order_follow_new_workflow` |
| 97 | `UT-ORD-16` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_ord_16_commit_can_use_ordered_purchase_coverage_without_double_reserve` |
| 98 | `UT-DB-18` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_10a_ordered_purchase_without_supplier_is_repairable` |
| 99 | `UT-DB-19` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_13_legacy_audit_reports_safe_and_manual_issues` |
| 100 | `UT-DB-20` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_14_apply_safe_legacy_fixes_backfills_cart_paid_at_and_purchase_received_at` |
| 101 | `UT-DB-21` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_16_attach_purchase_receipt_code_repairs_invalid_paid_purchase` |
| 102 | `UT-DB-22` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_17_attach_purchase_source_cart_repairs_missing_source_code` |
| 103 | `UT-PROC-01` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_proc_01_batch_lock_allows_single_owner` |
| 104 | `UT-PROC-02` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_proc_02_planner_assigns_one_product_to_one_batch_purchase` |
| 105 | `UT-PROC-03` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_proc_03_batch_create_groups_products_by_supplier` |
| 106 | `UT-PROC-04` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_proc_04_non_owner_cannot_edit_batch_purchase_draft_but_only_receives_prebatch_non_batch_purchase_and_pay` |
| 107 | `UT-PROC-05` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_proc_05_assignment_releases_when_batch_purchase_is_cancelled` |
| 108 | `UT-PROC-06` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_proc_06_start_batch_rejects_existing_open_purchase_conflicts` |
| 109 | `UT-PROC-07` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_proc_07_batch_create_supports_mixed_shortage_and_extra_lines` |
| 110 | `UT-PROC-08` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_proc_08_extra_line_for_same_product_merges_into_existing_batch_purchase_without_extra_assignment` |
| 111 | `UT-AUTH-04B` | `tests/test_auth_http.py` | `python -m unittest tests.test_auth_http.AuthHttpTests.test_ut_auth_04b_procurement_permission_user_can_start_batch_without_admin` |
| 112 | `IT-PROC-01` | `tests/integration/procurement-batch-lock.spec.js` | `npx playwright test tests/integration/procurement-batch-lock.spec.js --grep "IT-PROC-01"` |
| 113 | `IT-PROC-02` | `tests/integration/procurement-batch-lock.spec.js` (`EnableMultiuserConflictCheck=true`) | `npx playwright test tests/integration/procurement-batch-lock.spec.js --grep "IT-PROC-02"` |
| 114 | `IT-PROC-03` | `tests/integration/procurement-batch-lock.spec.js` | `npx playwright test tests/integration/procurement-batch-lock.spec.js --grep "IT-PROC-03"` |
| 115 | `IT-PROC-04` | `tests/integration/procurement-batch-lock.spec.js` | `npx playwright test tests/integration/procurement-batch-lock.spec.js --grep "IT-PROC-04"` |
| 122 | `IT-PROC-05` | `tests/integration/procurement-batch-lock.spec.js` | `npx playwright test tests/integration/procurement-batch-lock.spec.js --grep "IT-PROC-05"` |
| 116 | `UT-ORD-17` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_ord_17_bulk_create_orders_commit_valid_is_partial_and_idempotent` |
| 117 | `UT-AUTH-09` | `tests/test_auth_http.py` | `python -m unittest tests.test_auth_http.AuthHttpTests.test_ut_auth_09_bulk_order_permissions_split_draft_and_commit` |
| 118 | `ACC-ORD-17` | `tests/integration/bulk-orders-mobile.spec.js` | `npx playwright test tests/integration/bulk-orders-mobile.spec.js --grep "ACC-ORD-17"` |
| 123 | `UT-ORD-18` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_ord_18_bulk_order_request_lifecycle_blocks_duplicates_until_processed` |
| 124 | `UT-AUTH-10` | `tests/test_auth_http.py` | `python -m unittest tests.test_auth_http.AuthHttpTests.test_ut_auth_10_order_batch_manage_can_override_duplicate_warning_for_direct_commit` |
| 125 | `UT-AUTH-11` | `tests/test_auth_http.py` | `python -m unittest tests.test_auth_http.AuthHttpTests.test_ut_auth_11_bulk_order_request_lifecycle_supports_approve_reject_and_owner_process` |
| 126 | `ACC-ORD-18` | `tests/integration/bulk-orders-mobile.spec.js` | `npx playwright test tests/integration/bulk-orders-mobile.spec.js --grep "ACC-ORD-18"` |
| 127 | `UT-ORD-19` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_ord_19_entity_change_history_tracks_bulk_request_and_cart_edits` |
| 128 | `UT-AUTH-12` | `tests/test_auth_http.py` | `python -m unittest tests.test_auth_http.AuthHttpTests.test_ut_auth_12_history_routes_return_request_and_order_audit_timeline` |
| 129 | `ACC-ORD-19` | `tests/integration/bulk-orders-mobile.spec.js` | `npx playwright test tests/integration/bulk-orders-mobile.spec.js --grep "ACC-ORD-19"` |
| 130 | `UT-ORD-20` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_ord_20_pending_bulk_order_request_can_be_deleted_and_recreated` |
| 131 | `UT-AUTH-13` | `tests/test_auth_http.py` | `python -m unittest tests.test_auth_http.AuthHttpTests.test_ut_auth_13_pending_bulk_order_request_delete_allows_owner_and_manager_only` |
| 132 | `ACC-ORD-20` | `tests/integration/bulk-orders-mobile.spec.js` | `npx playwright test tests/integration/bulk-orders-mobile.spec.js --grep "ACC-ORD-20"` |
| 133 | `UT-ORD-21` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_ord_21_bulk_editing_saved_draft_or_committed_updates_same_cart` |
| 134 | `UT-SYNC-06` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_sync_06_payment_updates_persist_payment_metadata_for_cart_and_purchase` |
| 135 | `IT-PAY-01` | `tests/integration/payments-management.spec.js` | `npx playwright test tests/integration/payments-management.spec.js --grep "IT-PAY-01"` |
| 136 | `UT-MOV-01` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_mov_01_product_movements_return_empty_summary_for_product_without_transactions` |
| 137 | `UT-MOV-02` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_mov_02_product_movements_support_product_with_only_in_transactions` |
| 138 | `UT-MOV-03` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_mov_03_product_movements_support_product_with_only_out_transactions` |
| 139 | `UT-MOV-04` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_mov_04_product_movements_compute_opening_totals_running_balance_and_document_links` |
| 140 | `UT-MOV-05` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_mov_05_product_movements_warn_on_filtered_mismatch_and_skip_compare_for_past_date` |
| 141 | `UT-MOV-06` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_mov_06_product_movements_ignore_unaffected_drafts_and_validate_date_range` |
| 142 | `UT-AUTH-14` | `tests/test_auth_http.py` | `python -m unittest tests.test_auth_http.AuthHttpTests.test_ut_auth_14_product_movements_route_returns_selected_product_history` |
| 143 | `IT-MOV-01` | `tests/integration/product-movements.spec.js` | `npx playwright test tests/integration/product-movements.spec.js --grep "IT-MOV-01"` |
| 144 | `IT-MOV-02` | `tests/integration/product-movements.spec.js` | `npx playwright test tests/integration/product-movements.spec.js --grep "IT-MOV-02"` |
| 144A | `IT-MOV-03` | `tests/integration/product-movements.spec.js` | `npx playwright test tests/integration/product-movements.spec.js --grep "IT-MOV-03"` |
| 144B | `IT-MOV-04` | `tests/integration/product-movements.spec.js` | `npx playwright test tests/integration/product-movements.spec.js --grep "IT-MOV-04"` |
| 145 | `UT-QUICK-01` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_quick_01_create_quick_purchase_ordered_does_not_increase_stock` |
| 146 | `UT-QUICK-02` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_quick_02_create_quick_purchase_paid_records_stock_and_history` |
| 147 | `UT-QUICK-03` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_quick_03_create_quick_sale_committed_does_not_decrease_stock` |
| 148 | `UT-QUICK-04` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_quick_04_create_quick_sale_paid_records_stock_and_history` |
| 149 | `UT-QUICK-05` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_quick_05_quick_documents_validate_required_party_and_stock` |
| 150 | `UT-AUTH-12B` | `tests/test_auth_http.py` | `python -m unittest tests.test_auth_http.AuthHttpTests.test_ut_auth_12b_quick_purchase_and_sale_routes_create_documents_with_history` |
| 151 | `UT-AUTH-15` | `tests/test_auth_http.py` | `python -m unittest tests.test_auth_http.AuthHttpTests.test_ut_auth_15_inventory_adjust_permission_user_can_adjust_without_admin_role` |
| 152 | `UT-CANCEL-01` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_cancel_01_completed_order_cancellation_request_approval_restores_stock_and_nets_report` |
| 153 | `UT-CANCEL-02` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_cancel_02_received_purchase_cancellation_request_approval_reduces_stock_and_nets_report` |
| 154 | `UT-CANCEL-03` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_cancel_03_purchase_cancellation_rejects_when_original_stock_was_partially_used` |
| 155 | `UT-CANCEL-04` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_cancel_04_reject_document_cancel_request_keeps_original_document_unchanged` |
| 156 | `UT-AUTH-12C` | `tests/test_auth_http.py` | `python -m unittest tests.test_auth_http.AuthHttpTests.test_ut_auth_12c_document_cancel_request_flow_requires_permission_and_updates_state` |
| 157 | `ACC-CANCEL-01` | `tests/integration/document-cancel-approval.spec.js` | `npx playwright test tests/integration/document-cancel-approval.spec.js --grep "ACC-CANCEL-01"` |
| 158 | `ACC-QUICK-06` | `tests/integration/quick-documents-duplicate.spec.js` | `npx playwright test tests/integration/quick-documents-duplicate.spec.js --grep "ACC-QUICK-06"` |
| 159 | `IT-UI-01` | `tests/integration/ui-feedback-layering.spec.js` | `npx playwright test tests/integration/ui-feedback-layering.spec.js --grep "IT-UI-01"` |
| 160 | `IT-INV-02` | `tests/integration/inventory-purchase-shortcut.spec.js` | `npx playwright test tests/integration/inventory-purchase-shortcut.spec.js --grep "IT-INV-02"` |
| 161 | `UT-SYNC-02B` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_sync_02b_save_sync_state_ignores_conflict_if_disabled` |
| 162 | `UT-ORD-19` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_ord_custom_ship_date` |
| 163 | `UT-PUR-02` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_pur_custom_receive_date` |
| 164 | `UT-QUICK-06` | `tests/test_app.py` | `python -m unittest tests.test_app.InventoryStoreTests.test_ut_quick_06_quick_purchase_target_purchase_with_conversion_unit_and_unsaved_id` |
| 165 | `ACC-QUICK-07` | `tests/integration/quick-purchase-active-order.spec.js` | `npx playwright test tests/integration/quick-purchase-active-order.spec.js` |
| 187 | `UT-AUTH-18` | `tests/test_auth_http.py` | `python -m unittest tests.test_auth_http.AuthHttpTests.test_ut_auth_18_admin_mail_config_and_test_mail_require_master_admin` |
| 188 | `ACC-ADM-04` | `tests/integration/admin.spec.js` | `npx playwright test tests/integration/admin.spec.js --grep "ACC-ADM-04"` |
| 166 | `IT-PURSUP-08` | `tests/integration/purchase-create-select-supplier.spec.js` | `npx playwright test tests/integration/purchase-create-select-supplier.spec.js` |
| 167 | `IT-LIST-01` | `tests/integration/list-inputs-clear-button.spec.js` | `npx playwright test tests/integration/list-inputs-clear-button.spec.js --grep "IT-LIST-01"` |
| 168 | `IT-INV-03` | `tests/integration/inventory-clear-all-stock.spec.js` | `npx playwright test tests/integration/inventory-clear-all-stock.spec.js --grep "IT-INV-03"` |
| 177 | `UT-BASEUNIT-01` | `tests/test_change_base_unit.py` | `python -m unittest tests.test_change_base_unit.ChangeProductBaseUnitTests.test_basic_change_base_unit` |
| 178 | `UT-BASEUNIT-02` | `tests/test_change_base_unit.py` | `python -m unittest tests.test_change_base_unit.ChangeProductBaseUnitTests.test_change_base_unit_scales_existing_secondary_conversions` |
| 179 | `UT-BASEUNIT-03` | `tests/test_change_base_unit.py` | `python -m unittest tests.test_change_base_unit.ChangeProductBaseUnitTests.test_change_base_unit_when_target_already_secondary_unit` |
| 180 | `UT-BASEUNIT-04` | `tests/test_change_base_unit.py` | `python -m unittest tests.test_change_base_unit.ChangeProductBaseUnitTests.test_change_base_unit_updates_open_carts_without_distorting_display` |
| 181 | `UT-BASEUNIT-05` | `tests/test_change_base_unit.py` | `python -m unittest tests.test_change_base_unit.ChangeProductBaseUnitTests.test_reversibility_conversion` |
| 182 | `UT-BASEUNIT-06` | `tests/test_change_base_unit.py` | `python -m unittest tests.test_change_base_unit.ChangeProductBaseUnitTests.test_validation_errors` |
| 183 | `UT-BASEUNIT-07` | `tests/test_change_base_unit.py` | `python -m unittest tests.test_change_base_unit.ChangeProductBaseUnitHTTPTests.test_http_change_base_unit_endpoint_and_permission` |
| 184 | `IT-ORDER-01` | `tests/integration/cross-client-sync.spec.js` | `npx playwright test tests/integration/cross-client-sync.spec.js --grep IT-ORDER-01` |
| 185 | `IT-ADM-EDIT-01` | `tests/integration/test-admin-edit.spec.js` | `node node_modules/@playwright/test/cli.js test tests/integration/test-admin-edit.spec.js --grep IT-ADM-EDIT-01` |

## 3. Test factory Flask

| STT | Case code | File spec / test | Lệnh chạy nhanh |
| --- | --- | --- | --- |
| 189 | `UT-WEB-01` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_01_custom_admin_path_serves_admin_ui_and_root_stays_public` |
| 190 | `UT-WEB-02` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_02_factory_instances_keep_database_and_admin_route_independent` |
| 191 | `UT-WEB-03` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_03_testing_factory_rejects_runtime_database` |
| 192 | `UT-WEB-04` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_04_public_catalog_json_shape_and_filtering` |
| 193 | `UT-WEB-05` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_05_testing_factory_requires_injected_system_config` |
| 194 | `UT-WEB-06` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_06_public_order_lookup_requires_contact_identifier` |
| 195 | `UT-WEB-07` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_07_runtime_factory_uses_environment_selected_config_path` |
| 196 | `UT-WEB-08` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_08_unexpected_errors_use_project_logger_and_safe_response` |
| 197 | `UT-WEB-09` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_09_testing_factory_rejects_any_database_under_data_dir` |
| 198 | `UT-WEB-10` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_10_admin_subpath_static_asset_aliases` |
| 199 | `UT-WEB-11` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_11_admin_session_login_cookie_status_and_logout` |
| 200 | `UT-WEB-12` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_12_admin_login_rejects_normal_user_but_session_login_allows_it` |
| 201 | `UT-WEB-13` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_13_wsgi_request_smoke_for_admin_and_public_routes` |
| 202 | `UT-WEB-14` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_14_session_status_matches_legacy_handler_contract` |
| 203 | `UT-WEB-15` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_15_public_order_submission_creates_online_cart` |
| 204 | `UT-WEB-16` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_16_public_order_submission_requires_zalo_from_injected_config` |
| 205 | `UT-WEB-17` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_17_public_order_submission_maps_store_validation_to_400` |
| 206 | `UT-WEB-18` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_18_public_order_submission_logs_and_hides_unexpected_error` |
| 207 | `UT-WEB-19` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_19_public_order_submission_supports_admin_prefix_alias` |
| 208 | `UT-WEB-20` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_20_products_route_returns_products_and_summary` |
| 209 | `UT-WEB-21` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_21_products_route_requires_session_when_login_is_enabled` |
| 210 | `UT-WEB-22` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_22_products_route_accepts_authenticated_session` |
| 211 | `UT-WEB-23` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_23_passive_products_request_does_not_extend_session` |
| 212 | `UT-WEB-24` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_24_deleted_products_route_returns_soft_deleted_products` |
| 213 | `UT-WEB-25` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_25_product_history_route_preserves_filters_and_shape` |
| 214 | `UT-WEB-26` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_26_product_movements_route_forwards_filters_and_response` |
| 215 | `UT-WEB-27` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_27_product_movements_route_maps_invalid_product_id_to_400` |
| 216 | `UT-WEB-28` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_28_receipt_history_route_forwards_filters` |
| 217 | `UT-WEB-29` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_29_transactions_route_forwards_limit_and_response` |
| 218 | `UT-WEB-30` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_30_order_history_route_returns_cart_and_limited_history` |
| 219 | `UT-WEB-31` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_31_order_history_route_returns_400_when_cart_is_missing` |
| 220 | `UT-WEB-32` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_32_purchase_history_route_returns_document_and_limited_history` |
| 221 | `UT-WEB-33` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_33_purchase_history_route_returns_400_when_purchase_is_missing` |
| 222 | `UT-WEB-34` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_34_runtime_version_route_includes_runtime_and_app_metadata` |
| 223 | `UT-WEB-35` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_35_monthly_report_route_forwards_filters` |
| 224 | `UT-WEB-36` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_36_monthly_report_route_rejects_invalid_month_filter` |
| 225 | `UT-WEB-37` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_37_procurement_status_includes_config_permissions_and_lock_owner` |
| 226 | `UT-WEB-38` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_38_procurement_status_requires_session_when_login_is_enabled` |
| 227 | `UT-WEB-39` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_39_procurement_planner_forwards_scope_and_permissions` |
| 228 | `UT-WEB-40` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_40_procurement_planner_requires_login_setting_for_batch_mode` |
| 229 | `UT-WEB-41` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_41_procurement_planner_maps_invalid_scope_to_400` |
| 230 | `UT-WEB-42` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_42_application_state_returns_aggregate_and_forwards_transaction_limit` |
| 231 | `UT-WEB-43` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_43_application_state_requires_session_when_login_is_enabled` |
| 232 | `UT-WEB-44` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_44_create_product_route_persists_product_and_returns_summary` |
| 233 | `UT-WEB-45` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_45_update_product_route_preserves_explicit_private_visibility` |
| 234 | `UT-WEB-46` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_46_delete_product_route_soft_deletes_and_returns_summary` |
| 235 | `UT-WEB-47` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_47_create_product_route_maps_validation_error_to_400` |
| 236 | `UT-WEB-48` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_48_update_product_purchase_price_route_returns_product_and_summary` |
| 237 | `UT-WEB-49` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_49_update_product_sale_price_route_returns_product_and_summary` |
| 238 | `UT-WEB-50` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_50_restore_product_route_restores_soft_deleted_product` |
| 239 | `UT-WEB-51` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_51_change_base_unit_requires_master_admin_even_when_login_disabled` |
| 240 | `UT-WEB-52` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_52_change_base_unit_rejects_staff_session` |
| 241 | `UT-WEB-53` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_53_change_base_unit_allows_master_admin_and_admin_prefix` |
| 242 | `UT-WEB-54` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_54_hard_delete_product_requires_authenticated_session_when_enabled` |
| 243 | `UT-WEB-55` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_55_hard_delete_product_rejects_staff` |
| 244 | `UT-WEB-56` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_56_hard_delete_product_returns_legacy_result_for_admin` |
| 245 | `UT-WEB-57` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_57_product_image_upload_saves_binary_and_serves_returned_url` |
| 246 | `UT-WEB-58` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_58_product_image_upload_uses_configured_admin_prefix_and_safe_extension` |
| 247 | `UT-WEB-59` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_59_bulk_order_request_history_preserves_request_and_limit` |
| 248 | `UT-WEB-60` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_60_document_cancel_request_history_returns_400_when_missing` |
| 249 | `UT-WEB-61` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_61_admin_settings_reads_require_master_admin_and_redact_mail_password` |
| 250 | `UT-WEB-62` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_62_admin_legacy_audit_route_returns_store_payload` |
| 251 | `UT-WEB-63` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_63_admin_master_json_export_preserves_payload_and_download_header` |
| 252 | `UT-WEB-64` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_64_admin_master_csv_export_preserves_columns_and_utf8_bom` |
| 253 | `UT-WEB-65` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_65_admin_master_export_rejects_unsupported_format` |
| 254 | `UT-WEB-66` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_66_admin_database_backup_requires_master_admin_and_downloads_file` |
| 255 | `UT-WEB-67` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_67_state_write_requires_session_when_login_enabled` |
| 256 | `UT-WEB-68` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_68_state_write_passes_actor_role_and_keeps_aggregate_response` |
| 257 | `UT-WEB-69` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_69_state_write_maps_conflict_details_to_409` |
| 258 | `UT-WEB-70` | `tests/test_flask_app.py` | `python -m unittest tests.test_flask_app.FlaskAppFactoryTests.test_ut_web_70_state_write_rejects_non_object_json` |

## 4. Lệnh chạy nhanh theo nhóm

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
