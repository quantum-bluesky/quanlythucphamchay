# Flask Route Inventory

Issue #182 route-registration inventory generated from `create_app()` with a test admin path. It lists Flask registrations; it is not a claim that every response contract has passed a differential test.

The app registers 183 URL rules. After collapsing admin-prefix aliases, this is 94 endpoint/path groups and 94 distinct method/path contracts, including 87 API method/path contracts. The configured admin prefix remains dynamic at runtime.

| Method | Path | Endpoint | Also registered under admin prefix |
|---|---|---|---|
| `GET` | `/` | `public_home` | No |
| `GET` | `/ProductList` | `product_list` | No |
| `POST` | `/api/adjustments/inventory` | `create_inventory_adjustment` | Yes |
| `GET` | `/api/admin/backup` | `download_database_backup` | Yes |
| `DELETE` | `/api/admin/customers/<customer_id>/hard` | `hard_delete_customer` | Yes |
| `GET` | `/api/admin/export/<entity_type>` | `export_master_data` | Yes |
| `POST` | `/api/admin/import/<entity_type>` | `import_master_data` | Yes |
| `GET` | `/api/admin/legacy-audit` | `get_admin_legacy_audit` | Yes |
| `POST` | `/api/admin/legacy-audit/apply-safe-fixes` | `apply_legacy_audit_safe_fixes` | Yes |
| `POST` | `/api/admin/legacy-audit/link-purchase-receipt` | `link_legacy_purchase_receipt` | Yes |
| `POST` | `/api/admin/legacy-audit/link-purchase-source` | `link_legacy_purchase_source` | Yes |
| `POST` | `/api/admin/login` | `login_admin` | Yes |
| `POST` | `/api/admin/logout` | `logout_session` | Yes |
| `GET` | `/api/admin/mail-config` | `get_admin_mail_config` | Yes |
| `PUT` | `/api/admin/mail-config` | `update_admin_mail_config` | Yes |
| `POST` | `/api/admin/orders/edit-locked` | `admin_edit_locked_order` | Yes |
| `POST` | `/api/admin/products/<int:product_id>/change-base-unit` | `change_product_base_unit` | Yes |
| `DELETE` | `/api/admin/products/<int:product_id>/hard` | `hard_delete_product` | Yes |
| `GET` | `/api/admin/public-web-config` | `get_admin_public_web_config` | Yes |
| `PUT` | `/api/admin/public-web-config` | `update_admin_public_web_config` | Yes |
| `POST` | `/api/admin/purchases/edit-locked` | `admin_edit_locked_purchase` | Yes |
| `POST` | `/api/admin/restore` | `restore_database` | Yes |
| `GET` | `/api/admin/status` | `get_auth_status` | Yes |
| `DELETE` | `/api/admin/suppliers/<supplier_id>/hard` | `hard_delete_supplier` | Yes |
| `POST` | `/api/admin/test-mail` | `test_admin_mail` | Yes |
| `GET` | `/api/admin/zalo-groups` | `get_zalo_groups` | Yes |
| `POST` | `/api/admin/zalo-groups` | `save_zalo_group` | Yes |
| `DELETE` | `/api/admin/zalo-groups/<group_id>` | `delete_zalo_group` | Yes |
| `POST` | `/api/carts/item` | `update_cart_item` | Yes |
| `POST` | `/api/carts/payment` | `update_cart_payment` | Yes |
| `POST` | `/api/document-cancel-requests/<request_id>/approve` | `approve_document_cancel_request` | Yes |
| `GET` | `/api/document-cancel-requests/<request_id>/history` | `get_document_cancel_request_history` | Yes |
| `POST` | `/api/document-cancel-requests/<request_id>/reject` | `reject_document_cancel_request` | Yes |
| `GET` | `/api/orders/<cart_id>/history` | `get_order_history` | Yes |
| `POST` | `/api/orders/<document_id>/cancel-request` | `create_order_cancel_request` | Yes |
| `POST` | `/api/orders/bulk-create` | `bulk_create_orders` | Yes |
| `POST` | `/api/orders/bulk-requests/<request_id>/approve` | `approve_bulk_order_request` | Yes |
| `POST` | `/api/orders/bulk-requests/<request_id>/delete` | `delete_bulk_order_request` | Yes |
| `GET` | `/api/orders/bulk-requests/<request_id>/history` | `get_bulk_order_request_history` | Yes |
| `POST` | `/api/orders/bulk-requests/<request_id>/process` | `process_bulk_order_request` | Yes |
| `POST` | `/api/orders/bulk-requests/<request_id>/reject` | `reject_bulk_order_request` | Yes |
| `POST` | `/api/orders/checkout` | `checkout_order` | Yes |
| `POST` | `/api/orders/commit` | `commit_order` | Yes |
| `POST` | `/api/orders/quick-create` | `quick_create_order` | Yes |
| `POST` | `/api/orders/ship` | `ship_order` | Yes |
| `POST` | `/api/procurement/batch/finish` | `finish_procurement_batch` | Yes |
| `POST` | `/api/procurement/batch/refresh-lock` | `refresh_procurement_batch_lock` | Yes |
| `POST` | `/api/procurement/batch/start` | `start_procurement_batch` | Yes |
| `GET` | `/api/procurement/planner` | `get_procurement_planner` | Yes |
| `POST` | `/api/procurement/purchases/create-draft` | `create_procurement_purchase_draft` | Yes |
| `POST` | `/api/procurement/purchases/create-drafts` | `create_procurement_purchase_drafts` | Yes |
| `GET` | `/api/procurement/status` | `get_procurement_status` | Yes |
| `GET` | `/api/product-movements` | `get_product_movements` | Yes |
| `POST` | `/api/products` | `create_product` | Yes |
| `GET` | `/api/products` | `get_products` | Yes |
| `DELETE` | `/api/products/<int:product_id>` | `delete_product` | Yes |
| `PUT` | `/api/products/<int:product_id>` | `update_product` | Yes |
| `POST` | `/api/products/<int:product_id>/change-base-unit` | `change_product_base_unit` | Yes |
| `PUT` | `/api/products/<int:product_id>/price` | `update_product_price` | Yes |
| `POST` | `/api/products/<int:product_id>/restore` | `restore_product` | Yes |
| `PUT` | `/api/products/<int:product_id>/sale-price` | `update_product_sale_price` | Yes |
| `GET` | `/api/products/deleted` | `get_deleted_products` | Yes |
| `GET` | `/api/products/history` | `get_product_history` | Yes |
| `POST` | `/api/products/images/upload` | `upload_product_image` | Yes |
| `GET` | `/api/public/orders` | `public_orders` | Yes |
| `POST` | `/api/public/orders` | `submit_public_order` | Yes |
| `GET` | `/api/public/products` | `public_products` | Yes |
| `GET` | `/api/public/zalo-callback` | `finish_zalo_login` | Yes |
| `GET` | `/api/public/zalo-login` | `start_zalo_login` | Yes |
| `POST` | `/api/purchases/<document_id>/cancel-request` | `create_purchase_cancel_request` | Yes |
| `GET` | `/api/purchases/<purchase_id>/history` | `get_purchase_history` | Yes |
| `POST` | `/api/purchases/mark-paid` | `mark_purchase_paid` | Yes |
| `POST` | `/api/purchases/payment` | `update_purchase_payment` | Yes |
| `POST` | `/api/purchases/quick-create` | `quick_create_purchase` | Yes |
| `POST` | `/api/purchases/receive` | `receive_purchase` | Yes |
| `POST` | `/api/purchases/received-item-expiry` | `update_received_purchase_item_expiry` | Yes |
| `POST` | `/api/purchases/repair` | `repair_purchase` | Yes |
| `GET` | `/api/receipts/history` | `get_receipt_history` | Yes |
| `GET` | `/api/reports/monthly` | `get_monthly_report` | Yes |
| `POST` | `/api/returns/customers` | `create_customer_return` | Yes |
| `POST` | `/api/returns/suppliers` | `create_supplier_return` | Yes |
| `GET` | `/api/runtime-version` | `get_runtime_version` | Yes |
| `POST` | `/api/session/login` | `login_session` | Yes |
| `POST` | `/api/session/logout` | `logout_session` | Yes |
| `GET` | `/api/session/status` | `get_auth_status` | Yes |
| `GET` | `/api/state` | `get_application_state` | Yes |
| `PUT` | `/api/state` | `save_application_state` | Yes |
| `POST` | `/api/transactions` | `create_transaction` | Yes |
| `GET` | `/api/transactions` | `get_transactions` | Yes |
| `GET` | `/favicon.ico` | `favicon` | No |
| `GET` | `/images/<path:relative_path>` | `uploaded_image` | Yes |
| `GET` | `/static/<path:relative_path>` | `static_asset` | Yes |
| `GET` | `{admin_path}` | `admin_home` | No |
| `GET` | `{admin_path}/` | `admin_home` | No |

Response body/status, headers/cookies, authorization and side effects are verified by `tests/test_flask_app.py` and the Playwright fixture suites. Legacy remains available with `--http-backend legacy` while the remaining differential and deployment gates are completed.
