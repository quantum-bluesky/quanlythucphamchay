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
| 5 | `ACC-SALE-02` | Kiểm tra user thường gặp thiếu hàng khi chốt đơn sẽ được điều hướng sang phiếu nhập gợi ý thay vì bypass chỉnh tồn. |
| 6 | `ACC-ORD-01` | Kiểm tra màn đơn hàng render ổn định và các thao tác chính không làm vỡ màn quản lý. |
| 7 | `ACC-CUS-01` | Kiểm tra màn khách hàng render ổn định và các thao tác cơ bản hoạt động bình thường. |
| 8 | `ACC-PROD-01` | Kiểm tra màn sản phẩm và luồng sửa nhanh hoạt động ổn định cùng các màn nghiệp vụ liên quan. |
| 9 | `ACC-PUR-01` | Kiểm tra phiếu nhập chỉ được đánh dấu đã thanh toán sau khi đã nhập kho. |
| 10 | `ACC-PUR-02` | Kiểm tra đơn đã chốt và phiếu nhập đã nhận/đã thanh toán không cho sửa trực tiếp. |
| 11 | `ACC-PHB-01` | Kiểm tra API phiếu điều chỉnh tồn cập nhật tồn kho và ghi audit trail đúng. |
| 12 | `ACC-PHB-02` | Kiểm tra API phiếu trả hàng khách cộng tồn kho và ghi note giao dịch đúng. |
| 13 | `ACC-PHB-03` | Kiểm tra API phiếu trả NCC trừ tồn kho và ghi note giao dịch đúng. |
| 14 | `ACC-PHB-04` | Kiểm tra báo cáo tháng và audit chứng từ phản ánh riêng điều chỉnh tồn, trả khách và trả NCC. |
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
| 27 | `ACC-SYNC-01` | Kiểm tra màn tạo đơn tự refresh tồn kho và giá sau khi có thay đổi từ client khác. |
| 28 | `ACC-SYNC-02` | Kiểm tra sync state từ chối cập nhật giỏ hàng stale và trả metadata conflict đúng. |
| 29 | `ACC-SYNC-03` | Kiểm tra sync state từ chối cập nhật phiếu nhập stale và trả metadata conflict đúng. |
| 30 | `IT-PHD-01` | Kiểm tra product history hỗ trợ lọc theo người thao tác cho thay đổi giá mặc định. |
| 31 | `IT-PHD-02` | Kiểm tra sync state lưu `actor` khi trạng thái giỏ hàng thay đổi. |
| 32 | `IT-PHD-03` | Kiểm tra form lọc product history theo actor và ngày hoạt động đúng trên UI. |
| 33 | `IT-PURSUP-01` | Kiểm tra màn nhập hàng có thể tạo nhà cung cấp mới, quay lại phiếu nhập và giữ giá trị NCC trên UI tạm thời dù phiếu nháp rỗng không còn persist. |
| 34 | `IT-PURSUP-02` | Kiểm tra màn nhà cung cấp sửa thông tin NCC mà không ghi đè lịch sử phiếu đã thanh toán. |
| 35 | `IT-MOB-01` | Kiểm tra menu nổi/search/toolbox trên mobile tự ẩn vào mép màn hình và mở lại an toàn. |
| 36 | `IT-MOB-02` | Kiểm tra screen header vẫn hiển thị tốt trên tablet và nút Version vẫn mở được About. |
| 37 | `IT-NAV-01` | Kiểm tra khi mở giỏ nháp ở màn Đơn hàng hoặc mở phiếu ở màn Nhập hàng thì viewport tự cuộn lên đúng khối thông tin của phiếu vừa mở. |
| 38 | `IT-ORD-01` | Kiểm tra màn đơn hàng hỗ trợ mở rộng chi tiết, đánh dấu đã thanh toán và mở lại giỏ nháp. |
| 39 | `IT-REP-01` | Kiểm tra nút shortcut `Audit` trên màn `Báo cáo` tự cuộn xuống khối `Audit chứng từ` để người dùng xem lịch sử chứng từ ngay. |
| 40 | `IT-NAV-02` | Kiểm tra menu trên PC/tablet bung ra từ nút `Mở menu`, tự thu gọn khi rê chuột hoặc bấm ra ngoài, đồng thời giữ chiều rộng menu gọn. |
| 41 | `IT-NAV-03` | Kiểm tra sau khi xoay giữa màn hình dọc và ngang thì vẫn bấm được các item trong menu nghiệp vụ để chuyển màn bình thường. |
| 42 | `IT-NAV-04` | Kiểm tra trên Tablet touch thật vừa login xong vẫn tap được nút `Mở menu` và chuyển màn bằng item menu bình thường, không bị header menu chặn touch. |
| 43 | `IT-TAB-01` | Kiểm tra trên Tablet khi viewport chỉ đổi chiều cao như lúc bàn phím ảo bật lên thì ô input đang nhập vẫn giữ focus và gõ tiếp được, không bị render lại làm tắt bàn phím. |
| 44 | `IT-PAG-01` | Kiểm tra trên desktop list sản phẩm tự hiện combobox phân trang `25/50/100`, mặc định lấy mức desktop và đổi số mục trên trang đúng theo lựa chọn. |
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
| 67 | `ACC-PUR-03` | Kiểm tra phiếu nhập nháp phải được chuyển sang `Đã đặt hàng` trước khi `Nhập kho`, đồng thời phiếu `Đã đặt hàng` vẫn chỉnh sửa được trước khi nhận hàng. |
| 68 | `UT-DB-11` | Kiểm tra backend chặn `draft -> received`, cho phép `ordered` tiếp tục chỉnh sửa, rồi mới chuyển sang `received` hợp lệ. |
