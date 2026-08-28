# Project Structure

**Root:** `D:\Quan\quanlythucphamchay\`

## Folder Tree

```text
quanlythucphamchay/
├── data/
│   ├── backup/
│   │   ├── ChiNgoc/
│   │   │   ├── customers-master-20260413-125730.csv
│   │   │   ├── inventory-backup-20260413-125625.db
│   │   │   ├── products-master-20260413-125718.csv
│   │   │   └── suppliers-master-20260413-125738.csv
│   │   ├── customers-master-20260410-122506.csv
│   │   ├── inventory-backup-20260330-115726.db
│   │   ├── inventory-backup-20260401-024443.db
│   │   ├── inventory-backup-20260403-192458.db
│   │   ├── inventory-backup-20260409-140333.db
│   │   ├── inventory-backup-20260410-122841.db
│   │   ├── products-master-20260410-122430.csv
│   │   ├── products-master-20260410-124542.csv
│   │   └── suppliers-master-20260410-122515.csv
│   ├── backups/
│   │   ├── inventory-backup-20260403-150216.db
│   │   ├── inventory-backup-20260410-122841.db
│   │   ├── inventory-backup-20260410-123335.db
│   │   ├── tmplyc4h8wz.db
│   │   └── tmpq_p93zk8.db
│   ├── Template/
│   │   ├── customers-master-20260410-122506.csv
│   │   ├── products-master-20260410-122430.csv
│   │   └── suppliers-master-20260410-122515.csv
│   ├── inventory.db
│   └── system_config.json
├── docs/
│   ├── ACCEPTANCE_CHECKLIST.md
│   ├── BUSINESS_FLOW.md
│   ├── CommonUIFunction.md
│   ├── DB_DESIGN.md
│   ├── DEPLOY_WINDOWS.md
│   ├── HUONG_DAN_SU_DUNG.md
│   ├── PHASE_A_ISSUES.md
│   ├── PHASE_B_ISSUES.md
│   ├── PHASE_C_ISSUES.md
│   ├── PHASE_D_ISSUES.md
│   ├── PHIEU_DISPLAY_DESIGN.md
│   ├── SCREEN_DESIGN.md
│   ├── TASK_BREAKDOWN_STATUS.md
│   ├── TERM_GLOSSARY.md
│   ├── TEST_CASE_DESCRIPTIONS.md
│   ├── TEST_CASE_INDEX.md
│   ├── TEST_Remote.md
│   ├── TestBuildGuide.md
│   ├── TESTING.md
│   └── WORKFLOW_REVIEW.md
├── log/
│   └── env_log.txt
├── qltpchay/
│   ├── __init__.py
│   ├── auth.py
│   ├── config.py
│   ├── constants.py
│   ├── helpers.py
│   ├── http_handler.py
│   ├── importer.py
│   └── store.py
├── scripts/
│   ├── run-test-cases.ps1
│   ├── setup-debian-app-server.sh
│   ├── setup-windows.ps1
│   └── wsl-portproxy.ps1
├── static/
│   ├── modules/
│   │   ├── controllers/
│   │   │   ├── core-controller.js
│   │   │   ├── entities-controller.js
│   │   │   ├── inventory-controller.js
│   │   │   ├── products-controller.js
│   │   │   ├── purchases-controller.js
│   │   │   ├── reports-admin-controller.js
│   │   │   └── sales-controller.js
│   │   ├── domain-helpers/
│   │   │   ├── inventory-domain.js
│   │   │   ├── purchases-domain.js
│   │   │   └── sales-domain.js
│   │   ├── ui/
│   │   │   ├── core-ui.js
│   │   │   ├── entities-ui.js
│   │   │   ├── inventory-ui.js
│   │   │   ├── products-ui.js
│   │   │   ├── purchases-ui.js
│   │   │   ├── reports-admin-ui.js
│   │   │   └── sales-ui.js
│   │   ├── app-state.js
│   │   ├── dom.js
│   │   ├── entity-product-mutations.js
│   │   ├── navigation-runtime.js
│   │   ├── screen-config.js
│   │   ├── sync-runtime.js
│   │   └── utils.js
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── test-results/
│   ├── capture/
│   │   ├── mobile/
│   │   │   └── 20260423/
│   │   │       ├── 01-inventory.png
│   │   │       ├── 02-create-order.png
│   │   │       ├── 03-orders.png
│   │   │       ├── 04-customers.png
│   │   │       ├── 05-products.png
│   │   │       ├── 06-purchases.png
│   │   │       ├── 07-suppliers.png
│   │   │       ├── 08-reports.png
│   │   │       ├── 09-history.png
│   │   │       └── 10-admin.png
│   │   └── tablet/
│   │       └── 20260423/
│   │           ├── 01-inventory.png
│   │           ├── 02-create-order.png
│   │           ├── 03-orders.png
│   │           ├── 04-customers.png
│   │           ├── 05-products.png
│   │           ├── 06-purchases.png
│   │           ├── 07-suppliers.png
│   │           ├── 08-reports.png
│   │           ├── 09-history.png
│   │           └── 10-admin.png
│   ├── fix_20260415_Issue-11_8_9_10/
│   │   └── workflow-phase-b-IT-PHB-04-a60cf-ates-from-received-purchase/
│   │       ├── error-context.md
│   │       └── trace.zip
│   ├── playwright/
│   ├── test_acceptance_error_fixed_all/
│   │   ├── admin-ACC-ADM-01-ACC-ADM-0-d2898--restore-work-on-fixture-DB/
│   │   │   └── downloads/
│   │   │       ├── customers-master-20260413-152728.csv
│   │   │       └── inventory-backup-20260413-152730.db
│   │   ├── cross-client-sync-ACC-SYNC-55034-changes-from-another-client/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   └── workflow-phase-a-ACC-ADM-0-96784-es-admin-login-and-a-reason/
│   │       ├── error-context.md
│   │       └── trace.zip
│   ├── test_acceptance_error_fixed_login/
│   │   ├── acceptance-checklist-ACC-R-89ab9-story-screen-render-healthy/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── acceptance-sales-phase-b-A-0ace3-tes-stock-and-order-history/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── acceptance-sales-phase-b-A-5f85f-ion-instead-of-stock-bypass/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── acceptance-sales-phase-b-A-a4bbf-and-writes-transaction-note/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── acceptance-sales-phase-b-A-d1bcb-dates-stock-and-audit-trail/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── admin-ACC-ADM-01-ACC-ADM-0-d2898--restore-work-on-fixture-DB/
│   │   │   ├── downloads/
│   │   │   │   ├── customers-master-20260413-142406.csv
│   │   │   │   └── inventory-backup-20260413-142407.db
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── management-screens-ACC-ORD-00bda-ts-and-history-stay-healthy/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── orders-actions-IT-ORD-01-o-8b921-paid-and-reopen-draft-carts/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── purchase-supplier-flow-IT--fea85-iting-paid-purchase-history/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── workflow-phase-a-ACC-PUR-0-b78dd-rchases-reject-direct-edits/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── workflow-phase-a-ACC-PUR-0-ea611--after-it-has-been-received/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── workflow-phase-c-ACC-SYNC--55ddb-ates-with-conflict-metadata/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── workflow-phase-c-ACC-SYNC--9435a-ates-with-conflict-metadata/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   └── workflow-phase-d-IT-PHD-02-f6f87-or-when-cart-status-changes/
│   │       ├── error-context.md
│   │       └── trace.zip
│   ├── test_acceptance_error_login_enable/
│   │   ├── acceptance-checklist-ACC-A-5460c-en-with-backend-app-version/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── acceptance-checklist-ACC-I-a1f0e--import-and-sales-workflows/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── acceptance-checklist-ACC-R-89ab9-story-screen-render-healthy/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── acceptance-checklist-ACC-S-1c02a-purchases-using-received-at/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── acceptance-sales-phase-b-A-0ace3-tes-stock-and-order-history/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── acceptance-sales-phase-b-A-5f85f-ion-instead-of-stock-bypass/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── acceptance-sales-phase-b-A-a4bbf-and-writes-transaction-note/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── acceptance-sales-phase-b-A-d1bcb-dates-stock-and-audit-trail/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── admin-ACC-ADM-01-ACC-ADM-0-d2898--restore-work-on-fixture-DB/
│   │   │   ├── downloads/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── core-workflows-ACC-INV-02--d5587-y-healthy-across-navigation/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── cross-client-sync-ACC-SYNC-55034-changes-from-another-client/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── login-ACC-LOG-01-normal-us-17d4d-e-and-permissions-correctly/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── management-screens-ACC-ORD-00bda-ts-and-history-stay-healthy/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── mobile-floating-ui-IT-MOB--0f4c1-veal-without-firing-actions/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── mobile-floating-ui-IT-MOB--40d70-on-button-still-opens-about/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── orders-actions-IT-ORD-01-o-8b921-paid-and-reopen-draft-carts/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── purchase-supplier-flow-IT--2c607-y-it-back-to-the-draft-flow/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── purchase-supplier-flow-IT--fea85-iting-paid-purchase-history/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── workflow-phase-a-ACC-ADM-0-96784-es-admin-login-and-a-reason/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── workflow-phase-a-ACC-PUR-0-b78dd-rchases-reject-direct-edits/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── workflow-phase-a-ACC-PUR-0-ea611--after-it-has-been-received/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   └── workflow-phase-d-IT-PHD-03-12a56-ctor-and-date-filters-in-UI/
│   │       ├── error-context.md
│   │       └── trace.zip
│   ├── test_with_db_test_bug_chingoc/
│   │   ├── acceptance-checklist-ACC-R-89ab9-story-screen-render-healthy/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── acceptance-sales-phase-b-A-0ace3-tes-stock-and-order-history/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── acceptance-sales-phase-b-A-a4bbf-and-writes-transaction-note/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── acceptance-sales-phase-b-A-d1bcb-dates-stock-and-audit-trail/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── admin-master-admin-login-e-ef97a--restore-work-on-fixture-DB/
│   │   │   └── downloads/
│   │   │       ├── customers-master-20260410-003514.json
│   │   │       └── inventory-backup-20260410-003516.db
│   │   ├── orders-actions-orders-scre-a3ec5-paid-and-reopen-draft-carts/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── workflow-phase-a-completed-6a07e-rchases-reject-direct-edits/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   └── workflow-phase-a-purchase--e90ce--after-it-has-been-received/
│   │       ├── error-context.md
│   │       └── trace.zip
│   ├── test_with_db_test_bug_quannd/
│   │   ├── acceptance-checklist-ACC-I-a1f0e--import-and-sales-workflows/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── acceptance-checklist-ACC-R-89ab9-story-screen-render-healthy/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── acceptance-sales-phase-b-A-0ace3-tes-stock-and-order-history/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── acceptance-sales-phase-b-A-5f85f-ion-instead-of-stock-bypass/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── acceptance-sales-phase-b-A-8a8df-and-writes-transaction-note/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── acceptance-sales-phase-b-A-a4bbf-and-writes-transaction-note/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── acceptance-sales-phase-b-A-d1bcb-dates-stock-and-audit-trail/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── admin-master-admin-login-e-ef97a--restore-work-on-fixture-DB/
│   │   │   └── downloads/
│   │   │       ├── customers-master-20260409-144125.json
│   │   │       └── inventory-backup-20260409-144127.db
│   │   ├── core-workflows-inventory-p-dd828-y-healthy-across-navigation/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── cross-client-sync-create-o-96dac-changes-from-another-client/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── orders-actions-orders-scre-a3ec5-paid-and-reopen-draft-carts/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── purchase-supplier-flow-pur-19a4c-y-it-back-to-the-draft-flow/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── purchase-supplier-flow-sup-e14fe-iting-paid-purchase-history/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── workflow-phase-a-completed-6a07e-rchases-reject-direct-edits/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   ├── workflow-phase-a-purchase--e90ce--after-it-has-been-received/
│   │   │   ├── error-context.md
│   │   │   └── trace.zip
│   │   └── workflow-phase-c-state-syn-56856-ates-with-conflict-metadata/
│   │       ├── error-context.md
│   │       └── trace.zip
│   └── phase-d-product-history-filter.png
├── tests/
│   ├── integration/
│   │   ├── support/
│   │   │   └── ui.js
│   │   ├── acceptance-checklist.spec.js
│   │   ├── acceptance-sales-phase-b.spec.js
│   │   ├── admin.spec.js
│   │   ├── capture-screens.spec.js
│   │   ├── core-workflows.spec.js
│   │   ├── cross-client-sync.spec.js
│   │   ├── detail-scroll.spec.js
│   │   ├── login.spec.js
│   │   ├── management-screens.spec.js
│   │   ├── mobile-floating-ui.spec.js
│   │   ├── orders-actions.spec.js
│   │   ├── pagination-settings.spec.js
│   │   ├── purchase-supplier-flow.spec.js
│   │   ├── reports-shortcuts.spec.js
│   │   ├── run_test_server.py
│   │   ├── workflow-phase-a.spec.js
│   │   ├── workflow-phase-b.spec.js
│   │   ├── workflow-phase-c.spec.js
│   │   └── workflow-phase-d.spec.js
│   ├── test_app.py
│   └── test_auth_http.py
├── tscr/
├── AGENTS.md
├── app.py
├── ChatGPT-Đồng bộ Codex trên nhiều máy.md
├── ChatGPT-Thiết kế ứng dụng tồn kho.md
├── package-lock.json
├── package.json
├── playwright.config.js
├── playwright.config.js.1
├── playwright.config.js.qt
├── playwright.config.js.remote
└── README.md
```

## Files

- `AGENTS.md` — 8.16 KB
- `app.py` — 4.43 KB
- `ChatGPT-Đồng bộ Codex trên nhiều máy.md` — 8.2 KB
- `ChatGPT-Thiết kế ứng dụng tồn kho.md` — 4.26 KB
- `data\backup\ChiNgoc\customers-master-20260413-125730.csv` — 0.52 KB
- `data\backup\ChiNgoc\inventory-backup-20260413-125625.db` — 180 KB
- `data\backup\ChiNgoc\products-master-20260413-125718.csv` — 2.89 KB
- `data\backup\ChiNgoc\suppliers-master-20260413-125738.csv` — 0.66 KB
- `data\backup\customers-master-20260410-122506.csv` — 0.43 KB
- `data\backup\inventory-backup-20260330-115726.db` — 68 KB
- `data\backup\inventory-backup-20260401-024443.db` — 64 KB
- `data\backup\inventory-backup-20260403-192458.db` — 80 KB
- `data\backup\inventory-backup-20260409-140333.db` — 88 KB
- `data\backup\inventory-backup-20260410-122841.db` — 168 KB
- `data\backup\products-master-20260410-122430.csv` — 2.88 KB
- `data\backup\products-master-20260410-124542.csv` — 2.88 KB
- `data\backup\suppliers-master-20260410-122515.csv` — 0.76 KB
- `data\backups\inventory-backup-20260403-150216.db` — 44 KB
- `data\backups\inventory-backup-20260410-122841.db` — 168 KB
- `data\backups\inventory-backup-20260410-123335.db` — 168 KB
- `data\backups\tmplyc4h8wz.db` — 168 KB
- `data\backups\tmpq_p93zk8.db` — 64 KB
- `data\inventory.db` — 180 KB
- `data\system_config.json` — 0.48 KB
- `data\Template\customers-master-20260410-122506.csv` — 0.56 KB
- `data\Template\products-master-20260410-122430.csv` — 3.22 KB
- `data\Template\suppliers-master-20260410-122515.csv` — 0.76 KB
- `docs\ACCEPTANCE_CHECKLIST.md` — 9.18 KB
- `docs\BUSINESS_FLOW.md` — 6.01 KB
- `docs\CommonUIFunction.md` — 5.85 KB
- `docs\DB_DESIGN.md` — 8.56 KB
- `docs\DEPLOY_WINDOWS.md` — 7.64 KB
- `docs\HUONG_DAN_SU_DUNG.md` — 21.02 KB
- `docs\PHASE_A_ISSUES.md` — 3.53 KB
- `docs\PHASE_B_ISSUES.md` — 3.05 KB
- `docs\PHASE_C_ISSUES.md` — 2.54 KB
- `docs\PHASE_D_ISSUES.md` — 1.24 KB
- `docs\PHIEU_DISPLAY_DESIGN.md` — 6.84 KB
- `docs\SCREEN_DESIGN.md` — 7.25 KB
- `docs\TASK_BREAKDOWN_STATUS.md` — 3.37 KB
- `docs\TERM_GLOSSARY.md` — 4.93 KB
- `docs\TEST_CASE_DESCRIPTIONS.md` — 10.56 KB
- `docs\TEST_CASE_INDEX.md` — 13.43 KB
- `docs\TEST_Remote.md` — 3.31 KB
- `docs\TestBuildGuide.md` — 10.83 KB
- `docs\TESTING.md` — 10.63 KB
- `docs\WORKFLOW_REVIEW.md` — 7.32 KB
- `log\env_log.txt` — 8.52 KB
- `package-lock.json` — 2.28 KB
- `package.json` — 1.54 KB
- `playwright.config.js` — 0.62 KB
- `playwright.config.js.1` — 0.62 KB
- `playwright.config.js.qt` — 0.66 KB
- `playwright.config.js.remote` — 0.61 KB
- `qltpchay\__init__.py` — 0.05 KB
- `qltpchay\auth.py` — 3.37 KB
- `qltpchay\config.py` — 6.91 KB
- `qltpchay\constants.py` — 0.52 KB
- `qltpchay\helpers.py` — 2.51 KB
- `qltpchay\http_handler.py` — 42.24 KB
- `qltpchay\importer.py` — 2.33 KB
- `qltpchay\store.py` — 147.7 KB
- `README.md` — 18.4 KB
- `scripts\run-test-cases.ps1` — 3.72 KB
- `scripts\setup-debian-app-server.sh` — 12.87 KB
- `scripts\setup-windows.ps1` — 8.68 KB
- `scripts\wsl-portproxy.ps1` — 0.69 KB
- `static\app.js` — 125.13 KB
- `static\index.html` — 44.45 KB
- `static\modules\app-state.js` — 3.64 KB
- `static\modules\controllers\core-controller.js` — 7.72 KB
- `static\modules\controllers\entities-controller.js` — 12.28 KB
- `static\modules\controllers\inventory-controller.js` — 10.7 KB
- `static\modules\controllers\products-controller.js` — 6.53 KB
- `static\modules\controllers\purchases-controller.js` — 18.7 KB
- `static\modules\controllers\reports-admin-controller.js` — 9.4 KB
- `static\modules\controllers\sales-controller.js` — 16.71 KB
- `static\modules\dom.js` — 14.56 KB
- `static\modules\domain-helpers\inventory-domain.js` — 1.81 KB
- `static\modules\domain-helpers\purchases-domain.js` — 7.81 KB
- `static\modules\domain-helpers\sales-domain.js` — 10.23 KB
- `static\modules\entity-product-mutations.js` — 11.04 KB
- `static\modules\navigation-runtime.js` — 8.32 KB
- `static\modules\screen-config.js` — 19.11 KB
- `static\modules\sync-runtime.js` — 10.09 KB
- `static\modules\ui\core-ui.js` — 8.93 KB
- `static\modules\ui\entities-ui.js` — 7.61 KB
- `static\modules\ui\inventory-ui.js` — 14.71 KB
- `static\modules\ui\products-ui.js` — 8.15 KB
- `static\modules\ui\purchases-ui.js` — 14.34 KB
- `static\modules\ui\reports-admin-ui.js` — 13.8 KB
- `static\modules\ui\sales-ui.js` — 20.62 KB
- `static\modules\utils.js` — 1.74 KB
- `static\styles.css` — 56.92 KB
- `test-results\capture\mobile\20260423\01-inventory.png` — 191.61 KB
- `test-results\capture\mobile\20260423\02-create-order.png` — 155.61 KB
- `test-results\capture\mobile\20260423\03-orders.png` — 100.17 KB
- `test-results\capture\mobile\20260423\04-customers.png` — 94.55 KB
- `test-results\capture\mobile\20260423\05-products.png` — 137.05 KB
- `test-results\capture\mobile\20260423\06-purchases.png` — 142.91 KB
- `test-results\capture\mobile\20260423\07-suppliers.png` — 91.97 KB
- `test-results\capture\mobile\20260423\08-reports.png` — 394 KB
- `test-results\capture\mobile\20260423\09-history.png` — 139.65 KB
- `test-results\capture\mobile\20260423\10-admin.png` — 78.81 KB
- `test-results\capture\tablet\20260423\01-inventory.png` — 254.55 KB
- `test-results\capture\tablet\20260423\02-create-order.png` — 177.7 KB
- `test-results\capture\tablet\20260423\03-orders.png` — 142.52 KB
- `test-results\capture\tablet\20260423\04-customers.png` — 136.39 KB
- `test-results\capture\tablet\20260423\05-products.png` — 299.99 KB
- `test-results\capture\tablet\20260423\06-purchases.png` — 271.79 KB
- `test-results\capture\tablet\20260423\07-suppliers.png` — 139.33 KB
- `test-results\capture\tablet\20260423\08-reports.png` — 444.11 KB
- `test-results\capture\tablet\20260423\09-history.png` — 174.86 KB
- `test-results\capture\tablet\20260423\10-admin.png` — 120.73 KB
- `test-results\fix_20260415_Issue-11_8_9_10\workflow-phase-b-IT-PHB-04-a60cf-ates-from-received-purchase\error-context.md` — 16.21 KB
- `test-results\fix_20260415_Issue-11_8_9_10\workflow-phase-b-IT-PHB-04-a60cf-ates-from-received-purchase\trace.zip` — 2270.22 KB
- `test-results\phase-d-product-history-filter.png` — 461.76 KB
- `test-results\test_acceptance_error_fixed_all\admin-ACC-ADM-01-ACC-ADM-0-d2898--restore-work-on-fixture-DB\downloads\customers-master-20260413-152728.csv` — 0.28 KB
- `test-results\test_acceptance_error_fixed_all\admin-ACC-ADM-01-ACC-ADM-0-d2898--restore-work-on-fixture-DB\downloads\inventory-backup-20260413-152730.db` — 236 KB
- `test-results\test_acceptance_error_fixed_all\cross-client-sync-ACC-SYNC-55034-changes-from-another-client\error-context.md` — 7.24 KB
- `test-results\test_acceptance_error_fixed_all\cross-client-sync-ACC-SYNC-55034-changes-from-another-client\trace.zip` — 2118.83 KB
- `test-results\test_acceptance_error_fixed_all\workflow-phase-a-ACC-ADM-0-96784-es-admin-login-and-a-reason\error-context.md` — 7.38 KB
- `test-results\test_acceptance_error_fixed_all\workflow-phase-a-ACC-ADM-0-96784-es-admin-login-and-a-reason\trace.zip` — 13.16 KB
- `test-results\test_acceptance_error_fixed_login\acceptance-checklist-ACC-R-89ab9-story-screen-render-healthy\error-context.md` — 10.46 KB
- `test-results\test_acceptance_error_fixed_login\acceptance-checklist-ACC-R-89ab9-story-screen-render-healthy\trace.zip` — 2570.46 KB
- `test-results\test_acceptance_error_fixed_login\acceptance-sales-phase-b-A-0ace3-tes-stock-and-order-history\error-context.md` — 8.85 KB
- `test-results\test_acceptance_error_fixed_login\acceptance-sales-phase-b-A-0ace3-tes-stock-and-order-history\trace.zip` — 77.52 KB
- `test-results\test_acceptance_error_fixed_login\acceptance-sales-phase-b-A-5f85f-ion-instead-of-stock-bypass\error-context.md` — 5.13 KB
- `test-results\test_acceptance_error_fixed_login\acceptance-sales-phase-b-A-5f85f-ion-instead-of-stock-bypass\trace.zip` — 12893.68 KB
- `test-results\test_acceptance_error_fixed_login\acceptance-sales-phase-b-A-a4bbf-and-writes-transaction-note\error-context.md` — 8.85 KB
- `test-results\test_acceptance_error_fixed_login\acceptance-sales-phase-b-A-a4bbf-and-writes-transaction-note\trace.zip` — 75.08 KB
- `test-results\test_acceptance_error_fixed_login\acceptance-sales-phase-b-A-d1bcb-dates-stock-and-audit-trail\error-context.md` — 8.85 KB
- `test-results\test_acceptance_error_fixed_login\acceptance-sales-phase-b-A-d1bcb-dates-stock-and-audit-trail\trace.zip` — 75.09 KB
- `test-results\test_acceptance_error_fixed_login\admin-ACC-ADM-01-ACC-ADM-0-d2898--restore-work-on-fixture-DB\downloads\customers-master-20260413-142406.csv` — 0.06 KB
- `test-results\test_acceptance_error_fixed_login\admin-ACC-ADM-01-ACC-ADM-0-d2898--restore-work-on-fixture-DB\downloads\inventory-backup-20260413-142407.db` — 172 KB
- `test-results\test_acceptance_error_fixed_login\admin-ACC-ADM-01-ACC-ADM-0-d2898--restore-work-on-fixture-DB\error-context.md` — 8.77 KB
- `test-results\test_acceptance_error_fixed_login\admin-ACC-ADM-01-ACC-ADM-0-d2898--restore-work-on-fixture-DB\trace.zip` — 4521.81 KB
- `test-results\test_acceptance_error_fixed_login\management-screens-ACC-ORD-00bda-ts-and-history-stay-healthy\error-context.md` — 7.36 KB
- `test-results\test_acceptance_error_fixed_login\management-screens-ACC-ORD-00bda-ts-and-history-stay-healthy\trace.zip` — 6146.58 KB
- `test-results\test_acceptance_error_fixed_login\orders-actions-IT-ORD-01-o-8b921-paid-and-reopen-draft-carts\error-context.md` — 5.59 KB
- `test-results\test_acceptance_error_fixed_login\orders-actions-IT-ORD-01-o-8b921-paid-and-reopen-draft-carts\trace.zip` — 1469.6 KB
- `test-results\test_acceptance_error_fixed_login\purchase-supplier-flow-IT--fea85-iting-paid-purchase-history\error-context.md` — 10.56 KB
- `test-results\test_acceptance_error_fixed_login\purchase-supplier-flow-IT--fea85-iting-paid-purchase-history\trace.zip` — 1814.37 KB
- `test-results\test_acceptance_error_fixed_login\workflow-phase-a-ACC-PUR-0-b78dd-rchases-reject-direct-edits\error-context.md` — 15.62 KB
- `test-results\test_acceptance_error_fixed_login\workflow-phase-a-ACC-PUR-0-b78dd-rchases-reject-direct-edits\trace.zip` — 2663.22 KB
- `test-results\test_acceptance_error_fixed_login\workflow-phase-a-ACC-PUR-0-ea611--after-it-has-been-received\error-context.md` — 12.79 KB
- `test-results\test_acceptance_error_fixed_login\workflow-phase-a-ACC-PUR-0-ea611--after-it-has-been-received\trace.zip` — 1205.97 KB
- `test-results\test_acceptance_error_fixed_login\workflow-phase-c-ACC-SYNC--55ddb-ates-with-conflict-metadata\error-context.md` — 3.98 KB
- `test-results\test_acceptance_error_fixed_login\workflow-phase-c-ACC-SYNC--55ddb-ates-with-conflict-metadata\trace.zip` — 13.3 KB
- `test-results\test_acceptance_error_fixed_login\workflow-phase-c-ACC-SYNC--9435a-ates-with-conflict-metadata\error-context.md` — 3.99 KB
- `test-results\test_acceptance_error_fixed_login\workflow-phase-c-ACC-SYNC--9435a-ates-with-conflict-metadata\trace.zip` — 14.3 KB
- `test-results\test_acceptance_error_fixed_login\workflow-phase-d-IT-PHD-02-f6f87-or-when-cart-status-changes\error-context.md` — 6.59 KB
- `test-results\test_acceptance_error_fixed_login\workflow-phase-d-IT-PHD-02-f6f87-or-when-cart-status-changes\trace.zip` — 15.13 KB
- `test-results\test_acceptance_error_login_enable\acceptance-checklist-ACC-A-5460c-en-with-backend-app-version\error-context.md` — 7.1 KB
- `test-results\test_acceptance_error_login_enable\acceptance-checklist-ACC-A-5460c-en-with-backend-app-version\trace.zip` — 790.42 KB
- `test-results\test_acceptance_error_login_enable\acceptance-checklist-ACC-I-a1f0e--import-and-sales-workflows\error-context.md` — 9.28 KB
- `test-results\test_acceptance_error_login_enable\acceptance-checklist-ACC-I-a1f0e--import-and-sales-workflows\trace.zip` — 570.46 KB
- `test-results\test_acceptance_error_login_enable\acceptance-checklist-ACC-R-89ab9-story-screen-render-healthy\error-context.md` — 8.62 KB
- `test-results\test_acceptance_error_login_enable\acceptance-checklist-ACC-R-89ab9-story-screen-render-healthy\trace.zip` — 775.24 KB
- `test-results\test_acceptance_error_login_enable\acceptance-checklist-ACC-S-1c02a-purchases-using-received-at\error-context.md` — 2.45 KB
- `test-results\test_acceptance_error_login_enable\acceptance-checklist-ACC-S-1c02a-purchases-using-received-at\trace.zip` — 670.65 KB
- `test-results\test_acceptance_error_login_enable\acceptance-sales-phase-b-A-0ace3-tes-stock-and-order-history\error-context.md` — 8.85 KB
- `test-results\test_acceptance_error_login_enable\acceptance-sales-phase-b-A-0ace3-tes-stock-and-order-history\trace.zip` — 69.41 KB
- `test-results\test_acceptance_error_login_enable\acceptance-sales-phase-b-A-5f85f-ion-instead-of-stock-bypass\error-context.md` — 2.47 KB
- `test-results\test_acceptance_error_login_enable\acceptance-sales-phase-b-A-5f85f-ion-instead-of-stock-bypass\trace.zip` — 724.87 KB
- `test-results\test_acceptance_error_login_enable\acceptance-sales-phase-b-A-a4bbf-and-writes-transaction-note\error-context.md` — 8.85 KB
- `test-results\test_acceptance_error_login_enable\acceptance-sales-phase-b-A-a4bbf-and-writes-transaction-note\trace.zip` — 67.18 KB
- `test-results\test_acceptance_error_login_enable\acceptance-sales-phase-b-A-d1bcb-dates-stock-and-audit-trail\error-context.md` — 8.85 KB
- `test-results\test_acceptance_error_login_enable\acceptance-sales-phase-b-A-d1bcb-dates-stock-and-audit-trail\trace.zip` — 67.58 KB
- `test-results\test_acceptance_error_login_enable\admin-ACC-ADM-01-ACC-ADM-0-d2898--restore-work-on-fixture-DB\error-context.md` — 7.09 KB
- `test-results\test_acceptance_error_login_enable\admin-ACC-ADM-01-ACC-ADM-0-d2898--restore-work-on-fixture-DB\trace.zip` — 1017.65 KB
- `test-results\test_acceptance_error_login_enable\core-workflows-ACC-INV-02--d5587-y-healthy-across-navigation\error-context.md` — 4.15 KB
- `test-results\test_acceptance_error_login_enable\core-workflows-ACC-INV-02--d5587-y-healthy-across-navigation\trace.zip` — 553.86 KB
- `test-results\test_acceptance_error_login_enable\cross-client-sync-ACC-SYNC-55034-changes-from-another-client\error-context.md` — 8.64 KB
- `test-results\test_acceptance_error_login_enable\cross-client-sync-ACC-SYNC-55034-changes-from-another-client\trace.zip` — 735.12 KB
- `test-results\test_acceptance_error_login_enable\login-ACC-LOG-01-normal-us-17d4d-e-and-permissions-correctly\error-context.md` — 4.84 KB
- `test-results\test_acceptance_error_login_enable\login-ACC-LOG-01-normal-us-17d4d-e-and-permissions-correctly\trace.zip` — 535.77 KB
- `test-results\test_acceptance_error_login_enable\management-screens-ACC-ORD-00bda-ts-and-history-stay-healthy\error-context.md` — 8.66 KB
- `test-results\test_acceptance_error_login_enable\management-screens-ACC-ORD-00bda-ts-and-history-stay-healthy\trace.zip` — 707.37 KB
- `test-results\test_acceptance_error_login_enable\mobile-floating-ui-IT-MOB--0f4c1-veal-without-firing-actions\error-context.md` — 6.38 KB
- `test-results\test_acceptance_error_login_enable\mobile-floating-ui-IT-MOB--0f4c1-veal-without-firing-actions\trace.zip` — 657.01 KB
- `test-results\test_acceptance_error_login_enable\mobile-floating-ui-IT-MOB--40d70-on-button-still-opens-about\error-context.md` — 7.41 KB
- `test-results\test_acceptance_error_login_enable\mobile-floating-ui-IT-MOB--40d70-on-button-still-opens-about\trace.zip` — 394.65 KB
- `test-results\test_acceptance_error_login_enable\orders-actions-IT-ORD-01-o-8b921-paid-and-reopen-draft-carts\error-context.md` — 8.67 KB
- `test-results\test_acceptance_error_login_enable\orders-actions-IT-ORD-01-o-8b921-paid-and-reopen-draft-carts\trace.zip` — 818.59 KB
- `test-results\test_acceptance_error_login_enable\purchase-supplier-flow-IT--2c607-y-it-back-to-the-draft-flow\error-context.md` — 2.46 KB
- `test-results\test_acceptance_error_login_enable\purchase-supplier-flow-IT--2c607-y-it-back-to-the-draft-flow\trace.zip` — 668.45 KB
- `test-results\test_acceptance_error_login_enable\purchase-supplier-flow-IT--fea85-iting-paid-purchase-history\error-context.md` — 2.46 KB
- `test-results\test_acceptance_error_login_enable\purchase-supplier-flow-IT--fea85-iting-paid-purchase-history\trace.zip` — 728.76 KB
- `test-results\test_acceptance_error_login_enable\workflow-phase-a-ACC-ADM-0-96784-es-admin-login-and-a-reason\error-context.md` — 7.09 KB
- `test-results\test_acceptance_error_login_enable\workflow-phase-a-ACC-ADM-0-96784-es-admin-login-and-a-reason\trace.zip` — 976.3 KB
- `test-results\test_acceptance_error_login_enable\workflow-phase-a-ACC-PUR-0-b78dd-rchases-reject-direct-edits\error-context.md` — 2.44 KB
- `test-results\test_acceptance_error_login_enable\workflow-phase-a-ACC-PUR-0-b78dd-rchases-reject-direct-edits\trace.zip` — 805.31 KB
- `test-results\test_acceptance_error_login_enable\workflow-phase-a-ACC-PUR-0-ea611--after-it-has-been-received\error-context.md` — 2.43 KB
- `test-results\test_acceptance_error_login_enable\workflow-phase-a-ACC-PUR-0-ea611--after-it-has-been-received\trace.zip` — 792.3 KB
- `test-results\test_acceptance_error_login_enable\workflow-phase-d-IT-PHD-03-12a56-ctor-and-date-filters-in-UI\error-context.md` — 8.61 KB
- `test-results\test_acceptance_error_login_enable\workflow-phase-d-IT-PHD-03-12a56-ctor-and-date-filters-in-UI\trace.zip` — 689.25 KB
- `test-results\test_with_db_test_bug_chingoc\acceptance-checklist-ACC-R-89ab9-story-screen-render-healthy\error-context.md` — 7.99 KB
- `test-results\test_with_db_test_bug_chingoc\acceptance-checklist-ACC-R-89ab9-story-screen-render-healthy\trace.zip` — 2705.04 KB
- `test-results\test_with_db_test_bug_chingoc\acceptance-sales-phase-b-A-0ace3-tes-stock-and-order-history\error-context.md` — 8.21 KB
- `test-results\test_with_db_test_bug_chingoc\acceptance-sales-phase-b-A-0ace3-tes-stock-and-order-history\trace.zip` — 61.98 KB
- `test-results\test_with_db_test_bug_chingoc\acceptance-sales-phase-b-A-a4bbf-and-writes-transaction-note\error-context.md` — 8.21 KB
- `test-results\test_with_db_test_bug_chingoc\acceptance-sales-phase-b-A-a4bbf-and-writes-transaction-note\trace.zip` — 59.76 KB
- `test-results\test_with_db_test_bug_chingoc\acceptance-sales-phase-b-A-d1bcb-dates-stock-and-audit-trail\error-context.md` — 8.21 KB
- `test-results\test_with_db_test_bug_chingoc\acceptance-sales-phase-b-A-d1bcb-dates-stock-and-audit-trail\trace.zip` — 60.22 KB
- `test-results\test_with_db_test_bug_chingoc\admin-master-admin-login-e-ef97a--restore-work-on-fixture-DB\downloads\customers-master-20260410-003514.json` — 1.23 KB
- `test-results\test_with_db_test_bug_chingoc\admin-master-admin-login-e-ef97a--restore-work-on-fixture-DB\downloads\inventory-backup-20260410-003516.db` — 64 KB
- `test-results\test_with_db_test_bug_chingoc\orders-actions-orders-scre-a3ec5-paid-and-reopen-draft-carts\error-context.md` — 6.33 KB
- `test-results\test_with_db_test_bug_chingoc\orders-actions-orders-scre-a3ec5-paid-and-reopen-draft-carts\trace.zip` — 1456.13 KB
- `test-results\test_with_db_test_bug_chingoc\workflow-phase-a-completed-6a07e-rchases-reject-direct-edits\error-context.md` — 15.01 KB
- `test-results\test_with_db_test_bug_chingoc\workflow-phase-a-completed-6a07e-rchases-reject-direct-edits\trace.zip` — 3101.44 KB
- `test-results\test_with_db_test_bug_chingoc\workflow-phase-a-purchase--e90ce--after-it-has-been-received\error-context.md` — 13.53 KB
- `test-results\test_with_db_test_bug_chingoc\workflow-phase-a-purchase--e90ce--after-it-has-been-received\trace.zip` — 1439.18 KB
- `test-results\test_with_db_test_bug_quannd\acceptance-checklist-ACC-I-a1f0e--import-and-sales-workflows\error-context.md` — 8.45 KB
- `test-results\test_with_db_test_bug_quannd\acceptance-checklist-ACC-I-a1f0e--import-and-sales-workflows\trace.zip` — 2696.06 KB
- `test-results\test_with_db_test_bug_quannd\acceptance-checklist-ACC-R-89ab9-story-screen-render-healthy\error-context.md` — 17.77 KB
- `test-results\test_with_db_test_bug_quannd\acceptance-checklist-ACC-R-89ab9-story-screen-render-healthy\trace.zip` — 2683.67 KB
- `test-results\test_with_db_test_bug_quannd\acceptance-sales-phase-b-A-0ace3-tes-stock-and-order-history\error-context.md` — 8.19 KB
- `test-results\test_with_db_test_bug_quannd\acceptance-sales-phase-b-A-0ace3-tes-stock-and-order-history\trace.zip` — 78.46 KB
- `test-results\test_with_db_test_bug_quannd\acceptance-sales-phase-b-A-5f85f-ion-instead-of-stock-bypass\error-context.md` — 8.24 KB
- `test-results\test_with_db_test_bug_quannd\acceptance-sales-phase-b-A-5f85f-ion-instead-of-stock-bypass\trace.zip` — 78.57 KB
- `test-results\test_with_db_test_bug_quannd\acceptance-sales-phase-b-A-8a8df-and-writes-transaction-note\error-context.md` — 8.2 KB
- `test-results\test_with_db_test_bug_quannd\acceptance-sales-phase-b-A-8a8df-and-writes-transaction-note\trace.zip` — 76.38 KB
- `test-results\test_with_db_test_bug_quannd\acceptance-sales-phase-b-A-a4bbf-and-writes-transaction-note\error-context.md` — 8.21 KB
- `test-results\test_with_db_test_bug_quannd\acceptance-sales-phase-b-A-a4bbf-and-writes-transaction-note\trace.zip` — 76.38 KB
- `test-results\test_with_db_test_bug_quannd\acceptance-sales-phase-b-A-d1bcb-dates-stock-and-audit-trail\error-context.md` — 8.21 KB
- `test-results\test_with_db_test_bug_quannd\acceptance-sales-phase-b-A-d1bcb-dates-stock-and-audit-trail\trace.zip` — 76.76 KB
- `test-results\test_with_db_test_bug_quannd\admin-master-admin-login-e-ef97a--restore-work-on-fixture-DB\downloads\customers-master-20260409-144125.json` — 2.67 KB
- `test-results\test_with_db_test_bug_quannd\admin-master-admin-login-e-ef97a--restore-work-on-fixture-DB\downloads\inventory-backup-20260409-144127.db` — 88 KB
- `test-results\test_with_db_test_bug_quannd\core-workflows-inventory-p-dd828-y-healthy-across-navigation\error-context.md` — 9.83 KB
- `test-results\test_with_db_test_bug_quannd\core-workflows-inventory-p-dd828-y-healthy-across-navigation\trace.zip` — 4258.7 KB
- `test-results\test_with_db_test_bug_quannd\cross-client-sync-create-o-96dac-changes-from-another-client\error-context.md` — 6.26 KB
- `test-results\test_with_db_test_bug_quannd\cross-client-sync-create-o-96dac-changes-from-another-client\trace.zip` — 2135.59 KB
- `test-results\test_with_db_test_bug_quannd\orders-actions-orders-scre-a3ec5-paid-and-reopen-draft-carts\error-context.md` — 6.36 KB
- `test-results\test_with_db_test_bug_quannd\orders-actions-orders-scre-a3ec5-paid-and-reopen-draft-carts\trace.zip` — 1783.4 KB
- `test-results\test_with_db_test_bug_quannd\purchase-supplier-flow-pur-19a4c-y-it-back-to-the-draft-flow\error-context.md` — 11.72 KB
- `test-results\test_with_db_test_bug_quannd\purchase-supplier-flow-pur-19a4c-y-it-back-to-the-draft-flow\trace.zip` — 2440.3 KB
- `test-results\test_with_db_test_bug_quannd\purchase-supplier-flow-sup-e14fe-iting-paid-purchase-history\error-context.md` — 6.8 KB
- `test-results\test_with_db_test_bug_quannd\purchase-supplier-flow-sup-e14fe-iting-paid-purchase-history\trace.zip` — 24.12 KB
- `test-results\test_with_db_test_bug_quannd\workflow-phase-a-completed-6a07e-rchases-reject-direct-edits\error-context.md` — 15.18 KB
- `test-results\test_with_db_test_bug_quannd\workflow-phase-a-completed-6a07e-rchases-reject-direct-edits\trace.zip` — 2969.34 KB
- `test-results\test_with_db_test_bug_quannd\workflow-phase-a-purchase--e90ce--after-it-has-been-received\error-context.md` — 4.89 KB
- `test-results\test_with_db_test_bug_quannd\workflow-phase-a-purchase--e90ce--after-it-has-been-received\trace.zip` — 1335.63 KB
- `test-results\test_with_db_test_bug_quannd\workflow-phase-c-state-syn-56856-ates-with-conflict-metadata\error-context.md` — 3.17 KB
- `test-results\test_with_db_test_bug_quannd\workflow-phase-c-state-syn-56856-ates-with-conflict-metadata\trace.zip` — 13.31 KB
- `tests\integration\acceptance-checklist.spec.js` — 6.33 KB
- `tests\integration\acceptance-sales-phase-b.spec.js` — 20.61 KB
- `tests\integration\admin.spec.js` — 3.18 KB
- `tests\integration\capture-screens.spec.js` — 5.56 KB
- `tests\integration\core-workflows.spec.js` — 1.7 KB
- `tests\integration\cross-client-sync.spec.js` — 3.68 KB
- `tests\integration\detail-scroll.spec.js` — 5.33 KB
- `tests\integration\login.spec.js` — 2.13 KB
- `tests\integration\management-screens.spec.js` — 2.86 KB
- `tests\integration\mobile-floating-ui.spec.js` — 8.76 KB
- `tests\integration\orders-actions.spec.js` — 5.37 KB
- `tests\integration\pagination-settings.spec.js` — 3.13 KB
- `tests\integration\purchase-supplier-flow.spec.js` — 6.72 KB
- `tests\integration\reports-shortcuts.spec.js` — 1.2 KB
- `tests\integration\run_test_server.py` — 9.63 KB
- `tests\integration\support\ui.js` — 6.43 KB
- `tests\integration\workflow-phase-a.spec.js` — 16.28 KB
- `tests\integration\workflow-phase-b.spec.js` — 16.33 KB
- `tests\integration\workflow-phase-c.spec.js` — 2.79 KB
- `tests\integration\workflow-phase-d.spec.js` — 5.19 KB
- `tests\test_app.py` — 43.13 KB
- `tests\test_auth_http.py` — 7.75 KB

## Summary

- Total files: 267
- Generated at: 2026-05-06 14:05:59
