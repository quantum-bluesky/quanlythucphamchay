# Test Case Descriptions

Tài liệu này mô tả ngắn gọn nội dung của từng mã test case đang được map trong [docs/TEST_CASE_INDEX.md](/D:/Quan/quanlythucphamchay/docs/TEST_CASE_INDEX.md).

Mục tiêu:

- tra nhanh ý nghĩa nghiệp vụ của từng mã test
- hỗ trợ người test chọn đúng case trước khi chạy
- giữ mô tả đồng bộ với bảng mapping và code test thực tế

Lưu ý:

- khi thêm, đổi hoặc xóa mã test trong `docs/TEST_CASE_INDEX.md`, phải cập nhật đồng thời tài liệu này
- mô tả nên bám theo title test và hành vi thực tế đang được assertion trong code

## Bảng mô tả test case

| STT | Mã test case | Mô tả Test Case |
| --- | --- | --- |
| 1 | `ACC-ABOUT-01` | Kiểm tra nút `Version` mở đúng màn `About` và hiển thị phiên bản app lấy từ backend. |
| 2 | `ACC-INV-01` | Kiểm tra shortcut ở màn tồn kho mở đúng luồng nhập hàng và tạo đơn xuất. |
| 3 | `ACC-INV-02` | Kiểm tra các màn tồn kho, nhập hàng, bán hàng và sản phẩm hoạt động ổn định khi điều hướng qua lại. |
| 4 | `ACC-SALE-01` | Kiểm tra chốt đơn hoàn chỉnh làm giảm tồn kho và ghi nhận đúng lịch sử đơn hàng. |
| 5 | `ACC-SALE-02` | Kiểm tra user thường khi chốt đơn sẽ vẫn chốt được nếu phần thiếu đã được cover bởi phiếu nhập `Đã đặt`, còn nếu chưa đặt đủ thì app mới báo trước để mở hoặc tạo phiếu nhập phù hợp. |
| 6 | `ACC-ORD-01` | Kiểm tra màn đơn hàng render ổn định và các thao tác chính không làm vỡ màn quản lý. |
| 7 | `ACC-CUS-01` | Kiểm tra màn khách hàng render ổn định và các thao tác cơ bản hoạt động bình thường. |
| 8 | `ACC-PROD-01` | Kiểm tra màn sản phẩm và luồng sửa nhanh hoạt động ổn định cùng các màn nghiệp vụ liên quan. |
| 9 | `ACC-PUR-01` | Kiểm tra phiếu `ordered` không được thanh toán sớm, còn phiếu `received` mới được chuyển sang `paid`. |
| 10 | `ACC-PUR-02` | Kiểm tra đơn đã chốt và phiếu nhập đã nhận/đã thanh toán không cho sửa trực tiếp. |
| 11 | `ACC-PHB-01` | Kiểm tra API phiếu điều chỉnh tồn cập nhật tồn kho và ghi audit trail đúng. |
| 12 | `ACC-PHB-02` | Kiểm tra API phiếu trả hàng khách cộng tồn kho và ghi note giao dịch đúng. |
| 13 | `ACC-PHB-03` | Kiểm tra API phiếu trả NCC trừ tồn kho và ghi note giao dịch đúng. |
| 14 | `ACC-PHB-04` | Kiểm tra báo cáo tháng và audit chứng từ phản ánh riêng điều chỉnh tồn, trả khách và trả NCC, sau khi phiếu nhập nguồn đi đúng luồng `ordered -> received`. |
| 15 | `IT-PHB-01` | Kiểm tra UI màn tồn kho tạo được phiếu điều chỉnh tồn từ form trên giao diện. |
| 16 | `IT-PHB-02` | Kiểm tra UI tạo phiếu trả hàng khách từ một đơn đã chốt. |
| 17 | `IT-PHB-03` | Kiểm tra UI hỗ trợ lập phiếu trả hàng khách độc lập không cần đơn nguồn. |
| 18 | `IT-PHB-04` | Kiểm tra UI tạo phiếu trả NCC từ một phiếu nhập đã nhận hàng. |
| 19 | `IT-PHB-05` | Kiểm tra UI hỗ trợ lập phiếu trả NCC độc lập không cần phiếu nguồn. |
| 20 | `ACC-SUP-01` | Kiểm tra màn nhà cung cấp render ổn định và các thao tác cơ bản hoạt động bình thường. |
| 21 | `ACC-SUP-02` | Kiểm tra tạo nhà cung cấp mới không làm hỏng dữ liệu các phiếu đã thanh toán kiểu legacy dùng `received_at`. |
| 22 | `ACC-REP-01` | Kiểm tra màn báo cáo làm mới dữ liệu và render ổn định sau reload. |
| 23 | `ACC-HIS-01` | Kiểm tra màn lịch sử/khôi phục render ổn định và không lỗi runtime khi truy cập. |
| 24 | `ACC-ADM-01` | Kiểm tra Master Admin login, export/import master data, backup và restore hoạt động trên fixture DB. |
| 25 | `ACC-ADM-02` | Kiểm tra cùng luồng Master Admin ở trên vẫn hoạt động đầy đủ và ổn định trong cùng spec admin. |
| 26 | `ACC-ADM-03` | Kiểm tra chỉnh tồn trực tiếp yêu cầu đăng nhập admin và bắt buộc có lý do điều chỉnh. |
| 27 | `ACC-LOG-01` | Kiểm tra login user thường và admin cập nhật đúng header `Login/Logout`, ẩn/hiện đúng module quản trị, đồng thời chỉ admin mới thấy các control tồn kho đặc quyền như panel chỉnh tồn trực tiếp và action `Phiếu DC` / sửa giá. |
| 28 | `ACC-SYNC-01` | Kiểm tra màn tạo đơn tự refresh tồn kho và giá sau khi có thay đổi từ client khác. |
| 29 | `ACC-SYNC-02` | Kiểm tra sync state từ chối cập nhật giỏ hàng stale và trả metadata conflict đúng. |
| 30 | `ACC-SYNC-03` | Kiểm tra sync state từ chối cập nhật phiếu nhập stale và trả metadata conflict đúng. |
| 30 | `IT-PHD-01` | Kiểm tra product history hỗ trợ lọc theo người thao tác cho thay đổi giá mặc định. |
| 31 | `IT-PHD-02` | Kiểm tra sync state lưu `actor` khi trạng thái giỏ hàng thay đổi. |
| 32 | `ACC-SCR-CAP-01` | Kiểm tra chụp ảnh tất cả các màn hình chính trên mobile (tồn kho, xuất hàng, đơn hàng, khách hàng, sản phẩm, nhập hàng, nhà cung cấp, báo cáo, lịch sử, admin) và lưu vào thư mục `test-results/capture/${yyyymmdd}/`. |
| 33 | `ACC-SCR-CAP-02` | Kiểm tra chụp ảnh tất cả các màn hình chính trên tablet (768x1024) và lưu vào thư mục `test-results/capture/${yyyymmdd}/tablet/`. |
| 33 | `IT-PHD-03` | Kiểm tra form lọc product history theo actor và ngày hoạt động đúng trên UI. |
| 34 | `IT-PURSUP-01` | Kiểm tra màn nhập hàng có thể mở phiếu tạm, tạo nhà cung cấp mới rồi quay lại giữ giá trị NCC trên UI dù phiếu nháp rỗng không còn persist xuống DB. |
| 35 | `IT-PURSUP-02` | Kiểm tra màn nhà cung cấp sửa thông tin NCC mà không ghi đè lịch sử phiếu đã thanh toán. |
| 36 | `IT-PURSUP-03` | Kiểm tra màn nhập hàng giữ mỗi NCC đúng 1 phiếu nháp riêng, không tạo trùng khi chuyển qua lại giữa các NCC, và khi chọn lại cùng NCC thì app mở lại phiếu nháp sẵn có để nhập tiếp. |
| 37 | `IT-PURSUP-04` | Kiểm tra phiếu nhập nháp trống có thể `Xóa phiếu` ngay trên UI, đồng thời nút `NCC` trên phiếu `Nháp` vẫn cho sang danh sách NCC để đổi sang nhà cung cấp khác trước khi đặt hàng. |
| 38 | `IT-PURSUP-05` | Kiểm tra màn nhập hàng tự chọn NCC khi mặt hàng thêm vào phiếu chưa có NCC chỉ từng nhập từ một NCC. |
| 39 | `IT-PURSUP-06` | Kiểm tra màn nhập hàng không tự điền NCC khi mặt hàng có nhiều NCC lịch sử, nhưng datalist NCC ưu tiên NCC có lịch sử nhập nhiều hơn. |
| 40 | `IT-PURSUP-07` | Kiểm tra màn nhập hàng cảnh báo khi một mặt hàng đang nằm ở phiếu mở của NCC khác, mở được danh sách phiếu liên quan để review, và vẫn cho user giữ nguyên hiện trạng nếu muốn. |
| 41 | `IT-PURSUP-08` | Kiểm tra `Nhập lại` từ phiếu `Đã nhập kho` tạo được phiếu nháp mới cùng NCC, ghi chú, giảm giá và dòng hàng, nhưng reset `Mã lô`, `HSD` và `NSX` để nhập lại theo lô mới. |
| 42 | `IT-MOB-01` | Kiểm tra menu nổi/search/toolbox trên mobile tự ẩn vào mép màn hình và mở lại an toàn. |
| 41 | `IT-MOB-02` | Kiểm tra screen header vẫn hiển thị tốt trên tablet và nút Version vẫn mở được About. |
| 42 | `IT-NAV-01` | Kiểm tra khi mở giỏ nháp ở màn Đơn hàng hoặc mở phiếu ở màn Nhập hàng thì viewport tự cuộn lên đúng khối thông tin của phiếu vừa mở. |
| 43 | `IT-ORD-01` | Kiểm tra màn đơn hàng hỗ trợ mở rộng chi tiết, đánh dấu đã thanh toán và mở lại giỏ nháp. |
| 44 | `IT-ORD-03` | Kiểm tra `Xuất lại` từ đơn `Đã xuất hàng` tạo được một đơn nháp mới với cùng khách hàng, địa chỉ giao, giảm giá khuyến mại và các dòng hàng. |
| 45 | `IT-ORD-04` | Kiểm tra `Xuất lại` khi khách đã có đơn nháp sẽ hiện hỏi có dồn thêm vào đơn nháp hiện có hay không; nếu chọn dồn thì app merge vào đúng đơn nháp đó thay vì tạo draft mới. |
| 46 | `IT-REP-01` | Kiểm tra nút shortcut `Audit` trên màn `Báo cáo` tự cuộn xuống khối `Audit chứng từ` để người dùng xem lịch sử chứng từ ngay. |
| 45 | `IT-NAV-02` | Kiểm tra menu trên PC/tablet bung ra từ nút `Mở menu`, tự thu gọn khi rê chuột hoặc bấm ra ngoài, đồng thời giữ chiều rộng menu gọn. |
| 46 | `IT-NAV-03` | Kiểm tra sau khi xoay giữa màn hình dọc và ngang thì vẫn bấm được các item trong menu nghiệp vụ để chuyển màn bình thường. |
| 47 | `IT-NAV-04` | Kiểm tra trên Tablet touch thật vừa login xong vẫn tap được nút `Mở menu` và chuyển màn bằng item menu bình thường, không bị header menu chặn touch. |
| 48 | `IT-TAB-01` | Kiểm tra trên Tablet khi viewport chỉ đổi chiều cao như lúc bàn phím ảo bật lên thì ô input đang nhập vẫn giữ focus và gõ tiếp được, không bị render lại làm tắt bàn phím. |
| 49 | `IT-PAG-01` | Kiểm tra trên desktop list sản phẩm tự hiện combobox phân trang `25/50/100`, mặc định lấy mức desktop và đổi số mục trên trang đúng theo lựa chọn. |
| 45 | `UT-DB-01` | Kiểm tra tạo sản phẩm, nhập xuất kho và tổng hợp tồn kho cơ bản ở backend. |
| 46 | `UT-DB-02` | Kiểm tra backend chặn xuất kho vượt quá tồn hiện tại. |
| 47 | `UT-DB-03` | Kiểm tra phiếu điều chỉnh tồn backend cập nhật tồn kho và yêu cầu lý do đúng. |
| 48 | `UT-DB-04` | Kiểm tra phiếu trả hàng khách backend làm tăng tồn kho đúng. |
| 49 | `UT-DB-05` | Kiểm tra phiếu trả NCC backend làm giảm tồn kho đúng. |
| 50 | `UT-DB-06` | Kiểm tra backend không cho tạo phiếu điều chỉnh tồn nếu thiếu lý do. |
| 51 | `UT-DB-07` | Kiểm tra backend cho phép xóa phiếu nhập lỗi `paid` nhưng chưa có receipt nhập kho thật, đồng thời gỡ các liên kết source tham chiếu tới mã phiếu lỗi đó. |
| 52 | `UT-DB-08` | Kiểm tra backend vẫn chặn repair/xóa đối với phiếu `paid` hợp lệ đã có receipt nhập kho thật. |
| 53 | `UT-DB-09` | Kiểm tra backend cho phép hủy phiếu đang hiện là `draft` nhưng còn sót marker `paid/receiptCode` do lệch dữ liệu, và dọn sạch các marker này. |
| 54 | `UT-DB-10` | Kiểm tra purchase legacy ở trạng thái `received` nhưng thiếu `received_at` vẫn được backfill từ `updated_at` để không bị kẹt luồng thanh toán. |
| 55 | `UT-NORM-01` | Kiểm tra `save_sync_state` persist đúng dữ liệu sang các bảng quan hệ chuẩn hóa. |
| 56 | `UT-NORM-02` | Kiểm tra các loại receipt được persist đúng vào cấu trúc bảng chuẩn hóa mới. |
| 57 | `UT-NORM-03` | Kiểm tra app state legacy được migrate sang cấu trúc bảng quan hệ khi khởi động, đồng thời bỏ qua phiếu nhập nháp rỗng. |
| 58 | `UT-NORM-04` | Kiểm tra sync state không persist phiếu nhập nháp rỗng nhưng vẫn lưu phiếu nháp có ít nhất một mặt hàng. |
| 59 | `UT-SYNC-01` | Kiểm tra sync state chấp nhận cập nhật khi `expected_updated_at` khớp. |
| 60 | `UT-SYNC-02` | Kiểm tra sync state từ chối cập nhật khi `expected_updated_at` bị stale. |
| 61 | `UT-AUD-01` | Kiểm tra thay đổi trạng thái đơn hàng được ghi audit kèm actor. |
| 62 | `UT-AUD-02` | Kiểm tra thay đổi trạng thái phiếu nhập được ghi audit kèm actor. |
| 63 | `UT-AUD-03` | Kiểm tra receipt history trả đúng source link và audit message cho các phiếu Phase B. |
| 64 | `UT-HIS-01` | Kiểm tra product history hỗ trợ lọc theo actor ở backend. |
| 65 | `UT-HIS-02` | Kiểm tra product history hỗ trợ lọc theo khoảng ngày ở backend. |
| 66 | `UT-REP-01` | Kiểm tra monthly report backend tách riêng sale/purchase với trả khách, trả NCC và điều chỉnh tồn. |
| 67 | `ACC-PUR-03` | Kiểm tra phiếu nhập nháp phải được chuyển sang `Đã đặt hàng` trước khi `Nhập kho`, phiếu `Đã đặt hàng` vẫn chỉnh sửa được nhưng NCC đã bị khóa, và tồn kho hiển thị số mới ngay sau khi nhập kho không cần F5. |
| 68 | `UT-DB-11` | Kiểm tra backend chặn `draft -> received`, cho phép `ordered` tiếp tục chỉnh sửa, rồi mới chuyển sang `received` hợp lệ. |
| 69 | `IT-STS-01` | Kiểm tra các action đổi trạng thái, hủy và xóa phiếu ở đơn hàng và phiếu nhập đều hiện dialog confirm trước khi app áp dụng thay đổi, đồng thời tồn kho hiển thị số mới ngay sau khi xuất kho không cần F5. |
| 70 | `UT-AUTH-06` | Kiểm tra server serve `index.html` và `app.js` với cache-control phù hợp, đồng thời HTML/JS đã được gắn URL version cho client asset. |
| 71 | `UT-JSVER-01` | Kiểm tra manifest version của từng file `.js` tăng đúng theo lần đổi nội dung và tự reset về `1` khi version chính đổi. |
| 72 | `UT-AUD-04` | Kiểm tra import master sản phẩm ghi đúng actor cho các log `restore` và `update`. |
| 73 | `UT-HIS-03` | Kiểm tra lịch sử sản phẩm ghi rõ từng field đổi và giá trị cũ/mới khi sửa inline. |
| 74 | `UT-JSVER-02` | Kiểm tra entrypoint HTML và các import module con đều được rewrite sang URL có query `?v=version-chính.N`. |
| 75 | `UT-JSVER-03` | Kiểm tra manifest client JS đang dùng đúng `version` chính lấy từ `data/system_config.json`. |
| 76 | `UT-JSVER-04` | Kiểm tra thay đổi line ending `LF <-> CRLF` không làm tăng counter version của file `.js`. |
| 77 | `UT-JSVER-05` | Kiểm tra manifest cũ lưu raw hash `CRLF` được migrate sang hash chuẩn hóa line ending mà vẫn giữ nguyên counter. |
| 78 | `UT-INVSORT-01` | Kiểm tra metadata hạn dùng/bảo quản, score ưu tiên chuẩn hóa, urgency tier và hạn còn lại ước tính ở backend. |
| 79 | `UT-INVSORT-02` | Kiểm tra master CSV và seed pipe-format hỗ trợ field hạn dùng/bảo quản mới nhưng vẫn tương thích file cũ. |
| 80 | `IT-INV-SORT-01` | Kiểm tra dropdown sort ở màn tồn kho nằm trong pagination mobile và sắp đúng theo tồn, ưu tiên, hạn còn lại. |
| 81 | `IT-INV-SORT-02` | Kiểm tra dropdown sort ở màn tồn kho vẫn nằm trong pagination desktop cùng page-size picker. |
| 82 | `IT-PROD-LIFE-01` | Kiểm tra màn Sản phẩm lưu được metadata hạn dùng/bảo quản từ inline edit và render lại đúng nhãn. |
| 83 | `UT-SYNC-03` | Kiểm tra đơn đã chốt chưa thanh toán và phiếu nhập đã nhận chưa thanh toán vẫn sửa được `giảm giá khuyến mại`, nhưng sau khi đánh dấu thanh toán thì field này bị khóa lại. |
| 84 | `UT-DB-12` | Kiểm tra backend chỉ cho xóa phiếu nhập `draft`, cho hủy phiếu `ordered`, và chặn xóa trực tiếp phiếu `ordered`. |
| 85 | `UT-SYNC-04` | Kiểm tra đơn hàng chặn `draft -> paid`, cho `draft -> cancelled`, cho `completed -> paid`, rồi khóa nhánh mở lại/hạ thanh toán sau khi đã `cancelled/paid`. |
| 86 | `UT-DB-13` | Kiểm tra backend khi xuất kho sẽ trừ đúng thứ tự FEFO theo HSD thật của các lô và tính lại giá vốn bình quân theo các lô đã bị trừ. |
| 87 | `UT-DB-14` | Kiểm tra backend phiếu trả NCC có thể chỉ rõ `Mã lô` để trừ đúng lô đó thay vì lấy FEFO chung. |
| 88 | `UT-DB-15` | Kiểm tra backend chặn phiếu nhập chuyển sang `Đã đặt` hoặc `Đã nhập kho` nếu chưa có nhà cung cấp. |
| 89 | `ACC-PUR-05` | Kiểm tra UI và API đều chặn phiếu nhập chưa có nhà cung cấp chuyển sang `Đã đặt hàng` hoặc `Nhập kho`. |
| 90 | `IT-PUR-01` | Kiểm tra card gợi ý ở màn `Nhập hàng` cho đổi nhanh ô `SL` trước khi bấm `+ Phiếu`; nếu phát sinh cảnh báo nhiều NCC thì vẫn có thể giữ hiện trạng và thêm đúng số lượng vào phiếu nháp. |
| 91 | `UT-DB-16` | Kiểm tra backend tự tính HSD của dòng phiếu nhập từ `ngày nhập kho + thời gian bảo quản` hoặc từ `ngày sản xuất + thời gian bảo quản`, đồng thời lưu đúng liên kết `purchase_item_id` ở receipt item. |
| 92 | `UT-DB-17` | Kiểm tra backend cho cập nhật lại HSD/NSX của dòng phiếu `received` và đồng bộ đúng sang `purchase_items`, `inventory_batches`, `inventory_receipt_items` và note transaction. |
| 93 | `UT-SYNC-05` | Kiểm tra đơn `committed` khóa khách hàng nhưng vẫn cho sửa `ship_address`, đồng thời chặn việc đổi thẳng `committed -> completed` qua sync state. |
| 94 | `UT-ORD-15` | Kiểm tra flow backend `draft -> committed -> completed`: bước `commit` chưa trừ kho, bước `ship` mới trừ kho và cập nhật trạng thái hoàn tất. |
| 95 | `UT-ORD-16` | Kiểm tra backend cho `commit` dùng phần hàng đã nằm trong phiếu nhập `ordered`, đồng thời không cho hai đơn cùng giữ vượt quá lượng cover đó. |
| 96 | `UT-DB-18` | Kiểm tra phiếu nhập `ordered` nhưng thiếu nhà cung cấp được nhận diện là dữ liệu lỗi có thể repair để UI cho sửa NCC hoặc xóa/hủy. |
| 97 | `UT-DB-19` | Kiểm tra `legacy audit` tách đúng phần `safe fixes` và `manual review` khi DB có cart thiếu `paid_at`, purchase thiếu timestamp raw, phiếu `ordered` thiếu NCC, và purchase thiếu `source_code`. |
| 98 | `UT-DB-20` | Kiểm tra `apply_safe_legacy_fixes()` backfill được `cart.paid_at` và `purchase.received_at`, đồng thời làm sạch lại số lượng anomaly an toàn trong audit. |
| 99 | `UT-DB-21` | Kiểm tra admin gắn lại `receipt_code` cho purchase legacy `paid` đang thiếu receipt và record biến mất khỏi nhóm repair lỗi tương ứng. |
| 100 | `UT-DB-22` | Kiểm tra admin gắn lại `cart_id` nguồn cho purchase legacy thiếu `source_code` và record biến mất khỏi nhóm review link nguồn. |
| 101 | `UT-PROC-01` | Kiểm tra kỳ gom nhập batch chỉ có một lock active và chỉ owner hiện tại mới kết thúc được lock. |
| 102 | `UT-PROC-02` | Kiểm tra planner batch gom nhu cầu đơn nháp/chốt theo sản phẩm và chặn tạo nhiều phiếu nhập mở cho cùng một sản phẩm thiếu. |
| 103 | `UT-PROC-03` | Kiểm tra backend tạo batch nhiều dòng và gom các sản phẩm chọn cùng NCC vào một phiếu nhập batch draft. |
| 104 | `UT-PROC-04` | Kiểm tra user không giữ khóa batch bị chặn sửa phiếu nhập `draft/ordered`, không được nhận phiếu batch hay phiếu thường phát sinh sau lock, nhưng vẫn được đi tiếp `received/paid` với phiếu không phải batch đã `ordered` từ trước lúc kỳ gom bắt đầu, kể cả khi owner đã sửa lại phiếu sau đó làm `updated_at` thay đổi; case này cũng cover đường action trực tiếp từng phiếu để tránh bị khóa oan vì sync toàn bộ collection. |
| 105 | `UT-PROC-05` | Kiểm tra assignment batch tự release khi phiếu batch bị hủy hoặc đã chuyển sang trạng thái `received`. |
| 106 | `UT-PROC-06` | Kiểm tra backend chặn `Bắt đầu kỳ gom nhập` nếu đang có nhiều phiếu nhập mở cover cùng một sản phẩm, đặc biệt khi có phiếu nguồn từ đơn hàng chồng lấn với phiếu khác. |
| 107 | `UT-PROC-07` | Kiểm tra backend tạo được purchase batch mixed lines `shortage + extra`, vẫn gom đúng theo NCC và chỉ tạo assignment cho dòng shortage. |
| 108 | `UT-PROC-08` | Kiểm tra extra row cùng sản phẩm với shortage row sẽ merge vào đúng phiếu batch/NCC đang xử lý và không tạo thêm assignment ngoài shortage. |
| 109 | `UT-AUTH-04B` | Kiểm tra user thường có permission `procurement_batch_manage` được bắt đầu kỳ gom nhập nhưng vẫn bị chặn chỉnh tồn trực tiếp vì không phải Master Admin. |
| 110 | `IT-PROC-01` | Kiểm tra UI planner khi bị chặn `Bắt đầu kỳ gom` sẽ hiện danh sách conflict và cho bấm mở đúng các phiếu nhập mở liên quan để dọn. |
| 111 | `IT-PROC-02` | Kiểm tra user không giữ khóa batch vào màn `Nhập hàng` sẽ bị khóa create/edit cấu trúc phiếu `draft/ordered`; phiếu batch không còn nút `Nhập kho`, còn ngoại lệ phiếu thường đã `ordered` từ trước lúc batch bắt đầu vẫn được `Nhập kho` rồi `Đã thanh toán`, kể cả khi owner đã sửa lại ghi chú phiếu sau lúc batch mở và không bị fail oan do sync cả collection `purchases`. |
| 112 | `IT-PROC-03` | Kiểm tra batch owner thêm được extra product có badge `Ngoài nhu cầu đơn`, tạo phiếu batch mixed lines thành công và review chung với shortage row cùng NCC. |
| 113 | `IT-PROC-04` | Kiểm tra owner đang ở flow batch khi bấm sang màn ngoài flow sẽ thấy dialog nhắc kết thúc kỳ gom; nếu không kết thúc thì app hỏi tiếp để chọn `ở lại` hoặc `đi tiếp mà vẫn giữ batch mode`, còn `OK` ở dialog đầu sẽ finish batch, release lock rồi mới điều hướng. |
