# Task – Chuẩn hóa ID Database để đồng bộ dữ liệu giữa nhiều Server

## 1. Bối cảnh

Project hiện tại có chức năng Export/Import CSV giữa nhiều Server độc lập.

Theo tài liệu `Export _Import_walkthrough.md` đã cập nhật ở bản vá 3.23.2:

- ID của `products` hiện là auto-increment và **không đồng bộ giữa các Server**.
- Ví dụ:
  - Server A: `id = 10` là Mì Gói.
  - Server B: `id = 10` lại là Nước Mắm.
- Vì vậy không thể sử dụng `id` nội bộ để nhận diện cùng một object giữa nhiều Server.
- Bản vá 3.23.2 đã bỏ việc match Product bằng `id` khi Import CSV và chuyển sang match bằng `Tên sản phẩm`.
- Unit test hiện tại của bản vá: `103/103 Passed`.

File tham khảo:

```text
Export _Import_walkthrough.md
```

Đây là implementation context quan trọng và phải được giữ nguyên trong quá trình phân tích.

---

# 2. Mục tiêu

Cần đánh giá và thiết kế lại hệ thống ID của Database để:

1. Các đối tượng nghiệp vụ quan trọng có một **ID ổn định / global ID**.
2. Cùng một object khi Export từ Server A và Import sang Server B vẫn có thể nhận diện chính xác.
3. Không phụ thuộc vào auto-increment ID của từng Database.
4. Có thể chạy nhiều Server độc lập nhưng vẫn trao đổi dữ liệu an toàn.
5. CSV Export/Import có thể sử dụng Global ID để xác định object.
6. Không phụ thuộc vào tên để nhận diện object trong tương lai.
7. Giữ được local database primary key nếu điều đó có lợi cho performance/architecture.
8. Không làm mất dữ liệu hiện tại.
9. Có migration path rõ ràng từ DB hiện tại sang DB chuẩn.
10. Có thể áp dụng cho các object khác, không chỉ `products`.

---

# 3. Nguyên tắc rất quan trọng

**Không được mặc định rằng phải thay toàn bộ `INTEGER AUTOINCREMENT` thành UUID.**

Trước tiên phải phân tích kiến trúc hiện tại.

Cần phân biệt:

### Local Database ID

Ví dụ:

```text
id INTEGER PRIMARY KEY AUTOINCREMENT
```

ID này chỉ có ý nghĩa trong một Database/Server.

### Global / Stable ID

ID này phải:

- unique toàn hệ thống;
- không thay đổi trong lifetime của object;
- có thể export/import;
- không phụ thuộc vào Server;
- không phụ thuộc vào thứ tự insert;
- không bị collision khi tạo object trên nhiều Server độc lập.

Nếu phù hợp, có thể giữ:

```text
id              -> local PK
global_id       -> stable cross-server identifier
```

Ví dụ:

```text
products
--------
id          INTEGER PRIMARY KEY
global_id   TEXT UNIQUE NOT NULL
name
...
```

Đây chỉ là ví dụ. **Codex phải quyết định kiến trúc cuối cùng dựa trên codebase thực tế.**

---

# 4. Investigation bắt buộc trước khi sửa

Không được bắt đầu bằng việc sửa schema.

Phải khảo sát toàn bộ Database và application code.

## 4.1 Inventory toàn bộ bảng

Liệt kê tất cả bảng hiện có.

Với mỗi bảng xác định:

```text
Table
Primary Key
PK type
Auto increment?
Foreign Keys
Referenced by
Business entity
Có xuất CSV?
Có import CSV?
Có cần cross-server identity?
```

---

# 5. Xác định các Business Entity

Phân loại tất cả object nghiệp vụ.

Ít nhất phải kiểm tra:

- Product
- Category
- Customer
- Supplier
- Import Order
- Import Order Detail
- Export Order
- Export Order Detail
- Payment
- Debt
- Inventory
- Inventory Movement
- User
- Admin
- các Master Data khác
- các object được reference bởi CSV

Không chỉ kiểm tra các bảng đang có trong module CSV.

---

# 6. Phân tích quan hệ ID

Đối với mỗi bảng, xác định:

```text
Local PK
Global ID cần thiết?
FK đang reference local ID hay global ID?
Có object nào lưu ID dưới dạng text/JSON?
Có hard-code ID không?
Có dùng ID để audit không?
Có dùng ID để inventory movement không?
Có dùng ID trong CSV không?
```

Đặc biệt tìm toàn bộ code có dạng:

```python
WHERE id = ?
```

hoặc:

```python
product_id
customer_id
supplier_id
order_id
```

và xác định trường hợp nào đang có ý nghĩa:

- local database reference;
- cross-server identity.

---

# 7. Phân tích CSV hiện tại

Dựa trên bản vá 3.23.2:

> CSV hiện đang tránh dùng `products.id` để import cross-server và sử dụng tên sản phẩm.

Phải review lại toàn bộ CSV Export/Import.

Xác định:

### Export

Object nào đang export:

- `id`
- name
- code
- foreign key
- các reference khác.

### Import

Object nào đang match bằng:

- ID;
- name;
- code;
- composite key;
- hoặc logic khác.

Lập bảng:

```text
Entity | Export identity | Import matching | Problem | Proposed global ID
```

Không được chỉ sửa `products`.

---

# 8. Thiết kế Global ID

Đề xuất kiến trúc chuẩn cho project.

Cần đánh giá tối thiểu các phương án:

### Option A

Giữ local integer PK + thêm Global ID.

Ví dụ:

```text
id
global_id
```

### Option B

Dùng UUID làm primary key.

### Option C

Dùng UUID/ULID/UUIDv7 làm Global ID + local integer PK.

### Option D

Một cơ chế ID khác nếu project hiện tại có lý do đặc biệt.

Đánh giá theo:

- SQLite;
- performance;
- index size;
- readability;
- CSV;
- multi-server;
- backup/restore;
- migration;
- foreign key;
- audit;
- inventory;
- compatibility với code Python hiện tại.

Sau đó chọn **một kiến trúc chính thức**.

Không cần triển khai tất cả options.

---

# 9. Khuyến nghị cần xem xét

Đặc biệt đánh giá mô hình:

```text
local_id
global_id
```

Ví dụ:

```text
products
--------------------------------
id          INTEGER PRIMARY KEY
global_id   TEXT UNIQUE NOT NULL
name        TEXT NOT NULL
...
```

Trong đó:

- `id` phục vụ local relational FK/performance nếu phù hợp.
- `global_id` phục vụ:
  - CSV;
  - cross-server;
  - external reference;
  - audit;
  - synchronization.

Nếu chọn mô hình này, phải xác định rõ:

> Trong application code, trường hợp nào dùng `id`, trường hợp nào dùng `global_id`.

Không được để developer tiếp tục dùng nhầm `id` cho cross-server operation.

---

# 10. Global ID generation

Thiết kế cơ chế tạo Global ID.

Yêu cầu:

- Có thể generate offline.
- Không cần hỏi Server trung tâm.
- Không collision giữa nhiều Server.
- Không phụ thuộc timestamp nếu timestamp có thể gây collision.
- Không phụ thuộc auto-increment.

Ví dụ có thể xem xét UUID/UUIDv7.

Nhưng **không tự động chọn UUIDv7 chỉ vì đây là giải pháp phổ biến**. Hãy đánh giá dependency Python hiện tại và SQLite trước.

Global ID phải được generate tại thời điểm tạo object.

Ví dụ:

```text
Create Product
    ↓
generate global_id
    ↓
insert DB
```

Không được tạo Global ID bằng cách:

```text
MAX(id) + 1
```

hoặc:

```text
server_id + local_id
```

nếu cách đó không đảm bảo uniqueness lâu dài.

---

# 11. Các object cần Global ID

Không được chỉ thêm `global_id` cho `products`.

Hãy xác định đầy đủ những entity cần stable identity.

Ưu tiên cao:

```text
Product
Customer
Supplier
Import Order
Export Order
```

Sau đó đánh giá:

```text
Category
Payment
Debt
Inventory Movement
User
...
```

Đối với các bảng chỉ mang tính:

- junction;
- temporary;
- local cache;
- derived data;

có thể không cần Global ID nếu không có lý do nghiệp vụ.

Phải giải thích lý do cho từng nhóm.

---

# 12. Foreign Key strategy

Đây là phần bắt buộc phải thiết kế rõ.

Ví dụ hiện tại:

```text
order_detail.product_id
    -> products.id
```

Nếu giữ local ID thì vẫn có thể giữ:

```text
order_detail.product_id -> products.id
```

nhưng CSV phải export:

```text
product_global_id
```

thay vì:

```text
product_id
```

Khi import:

```text
CSV product_global_id
        ↓
find local product.id
        ↓
insert order_detail.product_id = local id
```

Đây là mô hình cần đánh giá nghiêm túc.

Không được chuyển toàn bộ FK sang UUID nếu không cần thiết.

---

# 13. CSV format chuẩn mới

Thiết kế CSV format chuẩn cho cross-server.

Ví dụ:

```csv
product_global_id,name,price,...
```

thay vì:

```csv
product_id,name,price,...
```

Nếu cần backward compatibility:

```text
global_id
id
name
...
```

phải xác định rõ:

### Export version

CSV mới phải export Global ID.

### Import

Import ưu tiên:

```text
global_id
```

Nếu không có Global ID:

- xác định có hỗ trợ legacy CSV hay không;
- nếu có thì dùng logic tương thích hiện tại;
- không được silently match sai object.

---

# 14. Không dùng Name làm Identity

Đây là mục tiêu quan trọng của thay đổi.

Bản vá 3.23.2 hiện tại đã chuyển từ:

```text
id
```

sang:

```text
product name
```

để tránh xung đột ID giữa Server.

Sau khi có Global ID:

**Không tiếp tục dùng Name làm identity chính.**

Name chỉ dùng để:

- display;
- validation;
- fallback legacy;
- cảnh báo mismatch.

Ví dụ:

```text
CSV:
global_id = abc-123
name = Mì Gói
```

Server B:

```text
global_id = abc-123
name = Mì Gói Chay
```

Không được tạo product mới chỉ vì name khác.

Phải xác định:

> Đây vẫn là cùng Product vì Global ID giống nhau.

Có thể warning:

```text
Global ID matched but name differs.
```

Nếu nghiệp vụ yêu cầu reject thì phải xác định rõ trong design.

---

# 15. Migration Database hiện tại

Đây là phần rất quan trọng.

Cần tạo migration từ DB hiện tại sang DB chuẩn.

Ví dụ:

```text
Old DB
    ↓
Add global_id columns
    ↓
Generate global_id for existing records
    ↓
Validate uniqueness
    ↓
Create UNIQUE indexes
    ↓
Update application
    ↓
Update CSV
    ↓
Validation
```

Global ID của dữ liệu cũ phải:

- generate một lần;
- ổn định;
- không thay đổi trong các lần migration sau.

Không được mỗi lần startup lại generate Global ID mới.

---

# 16. Standard Database

Yêu cầu tạo ra **một bản DB chuẩn**.

Bản DB chuẩn phải:

- chứa đầy đủ schema;
- đầy đủ bảng;
- đầy đủ primary key;
- đầy đủ foreign key;
- đầy đủ Global ID;
- đầy đủ UNIQUE constraints;
- đầy đủ indexes cần thiết;
- đúng schema version;
- có thể tạo Database mới từ zero;
- có thể migrate Database cũ lên schema mới.

Không chấp nhận trạng thái:

```text
Server A dùng DB version A
Server B dùng DB version B
```

mà không có schema version/migration rõ ràng.

---

# 17. DB initialization

Kiểm tra cơ chế hiện tại để tạo DB mới.

Cần chuẩn hóa:

```text
create empty DB
    ↓
apply schema
    ↓
create indexes
    ↓
create constraints
    ↓
insert required seed/master data
```

Nếu project hiện tại đã có migration framework thì reuse.

Nếu chưa có:

- không tự ý đưa thêm framework nặng;
- thiết kế migration mechanism phù hợp với Python + SQLite hiện tại.

---

# 18. Schema version

DB chuẩn phải có schema version.

Ví dụ:

```text
schema_version
```

hoặc cơ chế migration hiện tại.

Phải biết:

```text
DB version 1
DB version 2
DB version 3
...
```

và migration path:

```text
old DB → latest DB
```

Không yêu cầu người dùng xóa DB và tạo lại nếu có thể migrate an toàn.

---

# 19. Multi-Server compatibility

Phải test scenario thực tế:

### Server A

```text
Create Product A
global_id = X
local_id = 10
```

### Server B

```text
Create unrelated Product B
global_id = Y
local_id = 10
```

Sau đó Export Product A từ Server A → Import vào Server B.

Kết quả bắt buộc:

```text
Product A
global_id = X
local_id = new local ID
```

Không được:

```text
match local_id = 10
```

và không được nhầm Product B.

---

# 20. Test scenario quan trọng

Bổ sung automated tests cho:

## Global ID

- [ ] Create object tự động sinh Global ID.
- [ ] Global ID không null.
- [ ] Global ID unique.
- [ ] Global ID không thay đổi khi update.
- [ ] Global ID không thay đổi sau restart.
- [ ] Global ID không thay đổi sau migration.

## Multi-server

- [ ] Hai DB độc lập tạo object.
- [ ] Local ID có thể giống nhau.
- [ ] Global ID không giống nhau.
- [ ] Export từ Server A → Import Server B.
- [ ] Match bằng Global ID.
- [ ] Không match bằng local ID.

## Existing data

- [ ] Migration DB cũ.
- [ ] Tất cả record cũ có Global ID.
- [ ] Không duplicate Global ID.
- [ ] FK vẫn đúng.
- [ ] Existing order vẫn reference đúng product.
- [ ] Inventory movement vẫn đúng.
- [ ] Payment/debt vẫn đúng.

## CSV

- [ ] Export chứa Global ID.
- [ ] Import ưu tiên Global ID.
- [ ] Không còn dùng local product ID để cross-server matching.
- [ ] Product name thay đổi nhưng Global ID giống → vẫn match đúng.
- [ ] Global ID không tồn tại → xử lý theo business rule rõ ràng.
- [ ] Legacy CSV không có Global ID → xử lý backward compatibility nếu cần.
- [ ] Không tạo duplicate product ngoài ý muốn.

---

# 21. Regression với bản vá 3.23.2

Bắt buộc đọc và giữ nguyên các behavior đã sửa trong:

```text
Export _Import_walkthrough.md
```

Đặc biệt không được làm regression:

### Images

CSV phải tiếp tục export `images` dưới dạng JSON hợp lệ:

```json
["url1", "url2"]
```

không quay lại:

```text
['url1', 'url2']
```

### Deleted Product

Behavior xử lý:

```text
is_deleted
wants_deleted
```

phải tiếp tục hoạt động như bản vá 3.23.2.

### Cross-server Product Import

Behavior mới phải nâng cấp từ:

```text
Name matching
```

thành:

```text
Global ID matching
```

mà không quay lại:

```text
local ID matching
```

---

# 22. Data consistency audit

Sau migration phải có script/tool để kiểm tra DB.

Ví dụ kiểm tra:

```text
Missing Global ID
Duplicate Global ID
Invalid FK
Orphan records
Invalid order references
Invalid product references
Invalid inventory movement references
```

Tạo command phù hợp với project, ví dụ:

```bash
python ... validate-db
```

Không bắt buộc đúng command trên; hãy follow architecture hiện tại.

---

# 23. Không được phá vỡ dữ liệu

Đây là database migration có rủi ro cao.

Trước khi migration:

- backup DB;
- kiểm tra schema;
- kiểm tra record count.

Sau migration:

- record count không được giảm ngoài các trường hợp được giải thích;
- FK phải còn đúng;
- inventory phải còn đúng;
- order phải còn đúng;
- payment/debt phải còn đúng;
- audit/history phải còn nguyên.

Nếu migration không thể đảm bảo an toàn:

**Không được tự động xóa hoặc overwrite dữ liệu.**

---

# 24. Deliverables

Sau khi hoàn thành phải có:

## A. DB Design

Một tài liệu mô tả:

```text
Local ID
Global ID
Primary Key
Foreign Key
Cross-server Identity
```

và quy tắc sử dụng.

## B. Standard DB

Một schema/database template chuẩn có thể dùng để tạo DB mới trên bất kỳ Server nào.

## C. Migration

Migration từ DB hiện tại → DB chuẩn.

## D. Global ID generator

Implementation chính thức.

## E. CSV update

Export/Import sử dụng Global ID.

## F. Validation tool

Tool kiểm tra DB consistency.

## G. Tests

Unit + integration + relevant E2E.

## H. Documentation

Update các tài liệu hiện tại liên quan đến:

- Database;
- CSV;
- Import/Export;
- schema;
- ID;
- multi-server.

---

# 25. Báo cáo cuối cùng

Sau khi thực hiện, báo cáo theo format:

## 1. Current DB Analysis

Liệt kê các bảng hiện tại và vấn đề về ID.

## 2. ID Design Decision

Giải thích:

- Vì sao chọn kiến trúc này.
- Local ID dùng ở đâu.
- Global ID dùng ở đâu.
- Vì sao không dùng local ID cho cross-server.

## 3. Entity Matrix

| Entity | Local PK | Global ID | Cross-server | Reason |
|---|---|---|---|---|

## 4. Database Changes

Liệt kê tất cả schema changes.

## 5. Migration

Mô tả migration và cách đảm bảo dữ liệu cũ không bị mất.

## 6. CSV Changes

Mô tả format mới và backward compatibility.

## 7. Multi-server Test

Chứng minh:

```text
Server A local_id ≠/=
Server B local_id

nhưng

Global ID vẫn xác định đúng cùng object.
```

## 8. Regression

Xác nhận các fix của bản 3.23.2 vẫn pass:

- images JSON;
- deleted product;
- CSV import;
- cross-server import.

## 9. Tests

Liệt kê test đã thêm/chạy và kết quả.

## 10. Documentation

Liệt kê tài liệu đã cập nhật.

## 11. Remaining Risks

Nếu còn vấn đề hoặc business rule chưa rõ, phải nêu rõ.

---

# 26. Acceptance Criteria

Task chỉ được xem là hoàn thành khi:

- [ ] Đã audit toàn bộ schema hiện tại.
- [ ] Đã xác định tất cả entity cần stable identity.
- [ ] Có thiết kế Local ID / Global ID rõ ràng.
- [ ] Global ID không phụ thuộc Server.
- [ ] Global ID không phụ thuộc auto-increment.
- [ ] DB mới có schema chuẩn.
- [ ] DB cũ có migration an toàn.
- [ ] CSV sử dụng Global ID làm identity chính.
- [ ] Không còn dùng local ID để match object giữa Server.
- [ ] Không dùng Name làm identity chính khi đã có Global ID.
- [ ] Multi-server import/export hoạt động đúng.
- [ ] Existing data vẫn đúng.
- [ ] Foreign keys vẫn đúng.
- [ ] Inventory/history vẫn đúng.
- [ ] Payment/debt vẫn đúng.
- [ ] Audit vẫn đúng.
- [ ] Regression của bản vá 3.23.2 vẫn pass.
- [ ] Automated tests pass.
- [ ] Documentation được cập nhật.

**Đặc biệt: Không được chỉ thêm một `global_id` vào bảng `products` rồi kết luận hoàn thành. Phải đánh giá toàn bộ DB và toàn bộ các object có khả năng được trao đổi/tham chiếu giữa nhiều Server.**