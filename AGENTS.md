# AGENTS.md

## Mục tiêu project

Ứng dụng này là hệ thống quản lý thực phẩm chay chạy bằng Python stdlib + SQLite + SPA frontend.

Mục tiêu khi làm việc trong repo này:

- giữ app chạy được ngay bằng `python app.py`
- ưu tiên luồng nghiệp vụ thật cho cửa hàng nhỏ trên mobile
- thay đổi nhỏ, đúng chỗ, tránh phá dữ liệu đang dùng
- luôn giữ đồng bộ giữa code, help trong app và tài liệu người dùng
- khi sửa file client `.js`, phải giữ cơ chế version cache-busting hoạt động: mỗi file dùng version dạng `version-chính.N`, `N` tự tăng theo lần đổi nội dung trong cùng version chính, bỏ qua khác biệt line ending `CRLF/LF`, và reset về `1` khi version chính đổi

## Stack và cấu trúc chính

- Backend: `app.py`
- Backend package phụ trợ: `qltpchay/`
- Frontend: `static/index.html`, `static/app.js`, `static/styles.css`
- Frontend shared modules: `static/modules/`
- DB: `data/inventory.db`
- Config hệ thống runtime: `data/system_config.json`
- Manifest version client JS: `data/js_asset_versions.json`
- Tài liệu người dùng: `README.md`, `docs/HUONG_DAN_SU_DUNG.md`, `docs/DEPLOY_WINDOWS.md`
- Tài liệu design: `docs/SCREEN_DESIGN.md`, `docs/DB_DESIGN.md`, `docs/BUSINESS_FLOW.md`, các tài liệu detail `docs/*_DESIGN.md`
- Tài liệu test: `docs/TESTING.md`
- Dữ liệu seed: `data/List.txt`, `data/List_price.txt`
- Test unit + integration: `tests/`

### Module backend hiện tại

- `qltpchay/constants.py`: đường dẫn và hằng số hệ thống
- `qltpchay/helpers.py`: parse/format helpers dùng chung
- `qltpchay/config.py`: đọc/ghi config hệ thống
- `qltpchay/auth.py`: session và cookie admin
- `qltpchay/importer.py`: seed/import sản phẩm ban đầu
- `qltpchay/store.py`: logic kho, báo cáo, sync state, import/export
- `qltpchay/http_handler.py`: request handler HTTP
- `app.py`: entrypoint/CLI bootstrap mỏng

### Module frontend hiện tại

- `static/app.js`: entrypoint chính và orchestration UI
- `static/modules/app-state.js`: state dùng chung và storage keys
- `static/modules/dom.js`: DOM refs dùng chung
- `static/modules/screen-config.js`: help/meta/search config theo màn
- `static/modules/utils.js`: format/escape/utility dùng chung

## Nguồn sự thật của nghiệp vụ

Khi cần hiểu logic hiện tại, đọc theo thứ tự:

1. `README.md`
2. `docs/HUONG_DAN_SU_DUNG.md`
3. `docs/SCREEN_DESIGN.md`
4. `docs/DB_DESIGN.md`
5. `docs/BUSINESS_FLOW.md`
6. tài liệu design detail liên quan, ví dụ `docs/PHIEU_DISPLAY_DESIGN.md`
7. `qltpchay/store.py`
8. `app.py`
9. `static/app.js`

Không giả định từ trí nhớ cũ nếu code hiện tại nói khác.
## Quy ước Logging (Ghi log)

- Luôn log các action nghiệp vụ quan trọng và các exception, lỗi của Web App trong backend bằng module `qltpchay.logger`.
- Khi gọi `log_error` cho các lỗi hệ thống, cần truyền `exc_info=True`.
- Log sẽ luôn hiển thị ở Server Console.
- Nếu `debug.file_logging` được bật trong config, log sẽ được lưu vào file trong thư mục `logs/` với định dạng tên file chứa ngày hiện tại (ví dụ `logs/app.2023-10-27.log`). Qua ngày mới file sẽ tự động đổi tên sang ngày mới. Hệ thống sẽ tự động xóa các file log cũ hơn 1 năm (365 ngày).
- Thiết lập mức độ ghi log thông qua tham số `debug.log_level` trong file config (có thể đặt là "INFO", "DEBUG", "WARNING", "ERROR").

## Quy ước kiểm tra Database thực tế trước khi viết/sửa code

Trước khi bắt tay vào viết mới hoặc chỉnh sửa bất kỳ câu lệnh SQL, hàm thao tác database, migration, model, hay API payload liên quan trong một project bất kỳ:

1. **Bắt buộc đọc tài liệu DB & kiểm tra Schema DB thực tế**:
   - Không được tự ý phỏng đoán tên cột hoặc cấu trúc bảng (ví dụ: `unit_price` vs `unit_amount` vs `unit_cost`).
   - Phải kiểm tra cấu trúc bảng thực tế bằng `PRAGMA table_info(table_name)` trên file database thật hoặc kiểm tra hàm `_initialize_schema()` trong `qltpchay/store.py` / `docs/DB_DESIGN.md`.
2. **Đối chiếu & Xác nhận khi có sai lệch**:
   - Nếu phát hiện tài liệu thiết kế (`docs/DB_DESIGN.md`) và database thực tế có sự khác biệt về tên cột, kiểu dữ liệu hoặc quan hệ bảng, phải confirm rõ ràng và thống nhất để chỉnh sửa trước khi bắt tay vào code.
3. **Mục đích**:
   - Tránh triệt để việc viết nhầm các thông số/tên cột của DB (để lấy đúng và đủ các field,...), ngăn ngừa các lỗi runtime `sqlite3.OperationalError: no such column` hoặc làm lệch/mất dữ liệu khi ghi vào DB.

## Quy ước nghiệp vụ hiện tại

- `products.price` là `giá nhập mặc định`
- `products.sale_price` là `giá bán mặc định`
- user thường không được chỉnh tồn kho trực tiếp ở màn `Tồn kho`
- luồng tồn kho chuẩn phải đi qua `đơn chờ xuất` hoặc `phiếu chờ nhập`
- chỉ `Master Admin` mới được bypass quy trình chuẩn để chỉnh tồn trực tiếp
- khi sửa workflow nghiệp vụ, phải cập nhật cả:
  - help trong app ở `SCREEN_HELP` trong `static/app.js`
  - `README.md`
  - `docs/HUONG_DAN_SU_DUNG.md`
  - `docs/SCREEN_DESIGN.md` nếu thay đổi common design / layout / field hiển thị / điều hướng giữa màn
  - `docs/DB_DESIGN.md` nếu thay đổi schema, migration, ledger, state sync, audit hoặc cách tính tồn
  - `docs/BUSINESS_FLOW.md` nếu thay đổi workflow nghiệp vụ, trạng thái chứng từ hoặc rule xử lý
  - tài liệu design detail liên quan như `docs/PHIEU_DISPLAY_DESIGN.md` nếu thay đổi chi tiết theo domain
  - nếu có thay đổi deploy/config, cập nhật thêm `docs/DEPLOY_WINDOWS.md`

## Cách chạy

Chạy app (môi trường test, mặc định dùng `data/system_config.json`):

```powershell
python app.py
```

Chạy app trên môi trường production (dùng `data/system_config.production.json`):

```powershell
# Windows PowerShell
$env:APP_ENV="production"; python app.py
# Linux/bash
APP_ENV=production python app.py
```

Chạy với host/port cụ thể:

```powershell
python app.py --host 0.0.0.0 --port 8000
```

Xem config runtime:

```powershell
python app.py config
```

Khởi tạo dữ liệu:

```powershell
python app.py init
python app.py init --reset
```

## Kiểm tra bắt buộc sau khi sửa

Ít nhất phải chạy:

```powershell
node --check static/app.js
python -m py_compile app.py
```

Nếu thay logic backend hoặc schema, ưu tiên chạy thêm:

```powershell
python -m unittest discover -s tests
```

Nếu thay workflow UI, menu, selector, sync state hoặc điều hướng, ưu tiên chạy thêm:

```powershell
npm run test:integration
```

Trên môi trường Linux hiện tại đã có virtualenv `.venv` với `python3-venv`; trước khi chạy full integration suite cần activate:

```bash
source .venv/bin/activate
npm run test:integration
```

Không cần tạo symlink tạm `python -> python3` nếu đã activate `.venv`.

Suite integration dùng `Playwright` và fixture DB tạm, được cấu hình ở:

- `playwright.config.js`
- `tests/integration/run_test_server.py`

Nếu không chạy được test, phải nói rõ lý do trong báo cáo cuối.

## Nguyên tắc sửa code

- không thêm package runtime ngoài nếu chưa thật cần; app hiện vẫn chạy tốt bằng stdlib
- không đổi schema DB mà bỏ quên migration trong `_initialize_schema()`
- không phá dữ liệu cũ; mọi cột mới phải có hướng tương thích ngược
- giữ patch nhỏ, sửa đúng nguồn gốc thay vì workaround ở UI
- không bỏ quên cơ chế cache-busting client JS; nếu thay đổi file `.js`, phải chắc rằng version của file đó vẫn được tăng/ghi nhận đúng theo manifest
- không revert thay đổi của user nếu không được yêu cầu
- ưu tiên mobile UX vì app được dùng nhiều trên điện thoại
- khi thêm button/action mới trên mobile, cân nhắc thu gọn, sticky, overflow `...` và tránh che nội dung
- nếu yêu cầu mới làm lệch workflow/UI đã được định nghĩa trong tài liệu design hoặc business flow, phải confirm rõ lại với user trước khi sửa; không tự đổi ngầm hành vi đã được document
- khi sửa code, cần comment `#Issue...` liên quan hoặc comment giải thích ý nghĩa của những đoạn sửa code đó trực tiếp trong code để dễ theo dõi sau này

## Quy ước UI/UX cho repo này

- ưu tiên gọn, rõ, thao tác nhanh trên mobile
- trong list/card mobile:
  - chỉ để 1-2 hành động chính hiện trực tiếp
  - hành động phụ gom vào `...` khi hợp lý
- các list dài nên có phân trang `Trước / Sau`
- các màn chính nên có search linh hoạt theo tên đối tượng
- popup/help phải đóng được bằng click ra ngoài hoặc nút đóng

## Những điểm cần cẩn trọng

- `data/system_config.json` là config runtime thật, không hardcode lại username/password admin vào nơi khác
- module `Master Admin` có import/export và backup/restore DB, nên mọi thay đổi liên quan dữ liệu phải cân nhắc tương thích
- phần `state` đồng bộ qua SQLite/server đang dùng để chia sẻ giữa nhiều máy; tránh đưa dữ liệu nghiệp vụ quan trọng trở lại `localStorage`
- nếu thay đổi semantics của giá:
  - kiểm tra màn `Sản phẩm`
  - kiểm tra `Tạo đơn xuất hàng`
  - kiểm tra `Quản lý nhập hàng`
  - kiểm tra `Báo cáo`

## Quy định về mã hóa ký tự (UTF-8 Encoding Standard)

- Dự án hoàn toàn sử dụng tiếng Việt và bảng mã chuẩn `UTF-8`; tuyệt đối không dựa trên hoặc sử dụng codec `cp932` hay bảng mã tiếng Nhật/OEM khác.
- Tất cả các thao tác đọc/ghi file văn bản (`.py`, `.js`, `.html`, `.css`, `.json`, `.md`, `.txt`, `.sql`, `.db`) bắt buộc phải chỉ định `encoding="utf-8"`.
- Khi thực thi các lệnh Python CLI / scratch script / kiểm tra terminal trên môi trường Windows:
  - Đảm bảo môi trường chạy dùng UTF-8 (ví dụ: `PYTHONIOENCODING=utf-8`).
  - Khi in chuỗi tiếng Việt hoặc debug ra console, sử dụng `json.dumps(..., ensure_ascii=True)` hoặc cấu hình `sys.stdout.reconfigure(encoding='utf-8')` để tránh lỗi `UnicodeEncodeError`.
- Khi thao tác với SQLite hoặc file cấu hình, luôn đảm bảo luồng dữ liệu truyền nhận ở định dạng UTF-8.

## Quy ước Git theo Issue

Áp dụng như global rule khi làm việc theo danh sách Issue:

- mỗi Issue phải có branch riêng
- mỗi Issue phải có commit riêng
- không gộp 2 Issue vào cùng 1 branch hoặc cùng 1 commit
- các Issue `xxx.y` thì đưa gom lại vào cùng 1 Issue `xxx` (vd: Issue 155.1, 155.2, 155.3, 155.4 thì gom lại thành 1 Issue 155)
- sau khi xong từng Issue, phải báo rõ:
  - branch đã tạo
  - commit hash
  - các file đã sửa
  - cách test đã chạy

### Quy tắc chọn base branch

- nếu có yêu cầu fix lại/chỉnh sửa bổ sung cho một Issue vừa làm xong (và chưa có nhánh mới nào khác đè lên), KHÔNG tạo branch mới, mà phải tiếp tục checkout và thêm commit trực tiếp trên chính branch của Issue cũ đó
- nếu user giao nhiều Issue liên tiếp và Issue sau có chủ đích kế thừa kết quả của Issue trước, branch mới phải được tạo từ branch Issue gần nhất vừa hoàn thành trong chuỗi đó
- nếu Issue mới độc lập, không có yêu cầu kế thừa, hoặc user chỉ giao 1 Issue riêng lẻ, branch mới phải được tạo từ branch gốc hiện hành đã được user/team dùng làm base cho đợt làm việc
- nếu worktree đang có thay đổi dở dang, conflict base branch, hoặc chưa rõ Issue mới có phụ thuộc Issue trước hay không, phải confirm lại trước khi tạo branch để tránh chồng sai nền

### Quy tắc đặt tên branch

- format bắt buộc: `codex/{IssueNo}_{IssueName}`
- chuẩn hóa `IssueName` theo thứ tự:
  - thay dấu cách, dấu `,` và dấu `:` bằng `_`
  - loại bỏ ký tự không hợp lệ khi đặt tên branch Git
  - nếu sau khi thay thế xuất hiện chuỗi `_-_` thì đổi thành `-`
  - giữ nguyên chữ có dấu nếu Git vẫn chấp nhận hợp lệ
- ví dụ:
  - Issue No: `129`
  - IssueName: `Màn xử lý thiếu: Loại bỏ các mục hiển thị trùng lặp`
  - Branch: `codex/129_Màn_xử_lý_thiếu_Loại_bỏ_các_mục_hiển_thị_trùng_lặp`

### Quy tắc thực thi

- trước khi sửa code cho một Issue, mặc định phải tạo đúng branch của Issue đó trước
- hoàn thành code và test cơ bản xong mới tạo commit cho đúng Issue tương ứng
- không amend hoặc nhét thêm thay đổi của Issue khác vào commit đã tạo, trừ khi user yêu cầu rõ
- nếu một Issue buộc phải phụ thuộc Issue trước để chạy đúng, cần nêu rõ branch kế thừa nào đã được dùng làm base khi báo cáo kết quả
- nếu chưa thể chạy đủ test, phải nói rõ đã chạy test nào, thiếu test nào, và lý do
- khi làm nhiều Issue trong một chuỗi, sau mỗi Issue phải dừng ở trạng thái branch/commit của chính Issue đó để có thể review hoặc tách tiếp nhánh kế thừa cho Issue sau
- tuyệt đối không tự ý lấy các file untracked/ngoài git đã có từ trước (không phải do quá trình code sinh ra) để đưa vào commit tùy tiện; nếu cần đưa những file đó vào commit, bắt buộc phải hỏi và được user xác nhận trước.

## Quy ước tăng version theo Issue

Áp dụng như global rule sau khi hoàn thành từng Issue:

- version runtime chính được lưu ở `data/system_config.json` theo format `x.y.z`
- version asset JS build được quản lý riêng ở `data/js_asset_versions.json` để tạo version đầy đủ dạng `x.y.z.n`
- mỗi Issue sau khi fix xong phải tự tăng đúng `version chính` trong `data/system_config.json`, rồi đưa thay đổi này vào commit của chính Issue đó
- không dồn nhiều Issue vào cùng một lần tăng version chính

### Quy tắc phân loại mức độ Issue

- Issue nhỏ:
  - sửa hẹp
  - ít file
  - không đổi workflow chính
  - không đổi schema
  - chỉ tăng `z` thêm `1`
- Issue trung bình đến khá lớn:
  - đụng nhiều file hoặc nhiều lớp backend/frontend/docs/test
  - có đổi workflow đáng kể nhưng vẫn trong một phạm vi chức năng
  - có thêm permission, audit, UI flow, API flow, hoặc migration nhỏ tương thích ngược
  - tăng `y` thêm `1`
- Issue rất lớn:
  - đổi kiến trúc hoặc workflow lớn trên nhiều domain
  - thay đổi sâu dữ liệu/trạng thái/chuẩn vận hành
  - có migration lớn, thay đổi diện rộng nhiều màn, hoặc ảnh hưởng release ở cấp major
  - tăng `x` thêm `1`

### Quy tắc reset phần version thấp hơn

- nếu tăng `z`: đổi `x.y.z` thành `x.y.(z+1)`
- nếu tăng `y`: đổi `x.y.z` thành `x.(y+1).0`
- nếu tăng `x`: đổi `x.y.z` thành `(x+1).0.0`

### Quy tắc thực thi version

- phải xác định mức độ Issue trước khi chốt commit
- nếu mức độ Issue không rõ hoặc có tranh luận giữa `z` và `y`, mặc định thiên về mức cao hơn để tránh under-version
- nếu thay đổi JS thì ngoài việc tăng `version chính` ở `data/system_config.json`, vẫn phải cập nhật đúng manifest `data/js_asset_versions.json` theo cơ chế build hiện có
- khi báo cáo xong từng Issue, nên nêu luôn version trước và version sau
- nếu trong cùng một lượt làm nhiều Issue tách branch/commit riêng, mỗi branch phải tự tăng version từ base branch thực tế của chính nó; không được giả định trước version của các Issue khác chưa merge

## Khi nhận task mới

Mặc định nên:

1. đọc file liên quan
2. đọc `docs/SCREEN_DESIGN.md`, `docs/DB_DESIGN.md`, `docs/BUSINESS_FLOW.md` và tài liệu design detail liên quan nếu task đụng UI / workflow / hiển thị / dữ liệu
3. xác định ảnh hưởng tới backend/frontend/docs
4. sửa code
5. chạy kiểm tra cú pháp tối thiểu
6. cập nhật help/docs nếu workflow, label hoặc design thay đổi
7. nếu thêm/sửa test case hoặc test spec, cập nhật ngay tài liệu test trong repo gồm `docs/TESTING.md`, `docs/TEST_CASE_INDEX.md`, `docs/TEST_CASE_DESCRIPTIONS.md` để quy ước được giữ ở mức global, không chỉ trong session hiện tại
8. nếu task được giao theo Issue, áp dụng đầy đủ `Quy ước Git theo Issue` ở trên trước khi bắt đầu sửa code
9. nếu task là Issue, xác định luôn mức tăng version theo `Quy ước tăng version theo Issue` và cập nhật `data/system_config.json` trước khi tạo commit

## Quy ước bổ sung cho tooling/setup

- nếu trong lúc làm task phát hiện thiếu tool hoặc dependency môi trường, không chỉ báo miệng rồi bỏ qua
- mặc định phải đề xuất bổ sung và nếu hợp lý thì cập nhật luôn vào script setup + tài liệu setup/test/deploy để máy khác dùng lại được
- ưu tiên giữ setup có thể chạy lặp lại nhiều lần an toàn
- đã biết một dependency tooling cần có: `PyYAML` cho workflow Git Issue / `quick_validate.py`
- Đối với môi trường Windows, khi thực thi lệnh CLI bị thiếu các công cụ Unix (như `grep`, `tail`, `head`...), tuyệt đối phải ưu tiên dùng công cụ có sẵn của Agent (`grep_search`, `view_file`) hoặc các lệnh PowerShell tương đương (`Select-String`, `Get-Content`) để công việc không bị gián đoạn. Đồng thời, nếu việc thiếu tool gây khó khăn lớn, hãy chủ động thông báo và hướng dẫn người dùng cài đặt các gói hỗ trợ (như Git Bash, GnuWin32, WSL) để môi trường hoạt động được êm ả.

## Prompt khởi động tốt cho Codex ở repo này

```text
Read AGENTS.md, README.md, docs/HUONG_DAN_SU_DUNG.md, docs/SCREEN_DESIGN.md, and .codex/config.toml first.
Then inspect app.py and static/app.js for the affected workflow before editing.
Keep changes minimal, preserve mobile UX, and run node --check static/app.js plus python -m py_compile app.py before finishing.
```
