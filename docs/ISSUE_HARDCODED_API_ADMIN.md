# Issue: Hardcoded /api/admin Endpoints

## Description
Currently, the backend REST APIs for the admin section are hardcoded to use the /api/admin/... prefix (e.g., /api/admin/login, /api/admin/orders/...). 

While the frontend UI access path can be customized via the dmin_path configuration in system_config.json (e.g., to /qlht), the underlying API calls still reveal the /admin footprint. 

This presents a security risk, as malicious users or automated scanners can probe for the /api/admin/ endpoints to identify the system and attempt unauthorized access.

## Proposed Solution
To fully obscure the admin functionalities and enhance security:

1. **Backend Adjustments**: 
   - Update qltpchay/http_handler.py to route administrative API requests using the dynamically configured dmin_path instead of the hardcoded /api/admin/ prefix.
   - Ensure backward compatibility or clear error messaging if an outdated frontend attempts to access the old endpoints.

2. **Frontend Refactoring**:
   - Update static/app.js and all controller modules (static/modules/controllers/...).
   - Modify the piRequest method (or its usages) to dynamically prepend state.admin.adminPath instead of hardcoding /api/admin/....
   - Ensure the initial configuration request (which fetches dmin_path from /api/session/status) is properly utilized before any administrative API calls are made.

## Affected Files
- qltpchay/http_handler.py
- static/app.js
- static/modules/controllers/*.js

## Complexity
- **Medium to High**: Requires a comprehensive refactoring of API call constructors in the frontend and meticulous routing adjustments in the backend. 
- Due to the high number of API calls, rigorous end-to-end integration testing will be required after implementation.
