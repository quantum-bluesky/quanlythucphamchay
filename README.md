# Quản lý nhanh đồ thực phẩm chay

Ứng dụng web nhẹ để theo dõi tồn kho cá nhân cho thực phẩm chay đông lạnh. Hệ thống dùng Python chuẩn và SQLite, không cần cài thêm package ngoài.

## Tính năng chính

- Dashboard tồn kho hiển thị toàn bộ sản phẩm và cảnh báo sắp hết
- Quản lý giá nhập nhanh ngay trên từng sản phẩm và tính giá trị tồn
- Nhập kho / xuất kho nhanh từ một form chính hoặc nút tắt trên từng thẻ sản phẩm
- Quản lý khách hàng, giỏ hàng nháp và checkout nhiều mặt hàng trong một lần
- Lưu khách hàng, nhà cung cấp, giỏ hàng nháp và phiếu nhập vào SQLite để mở tiếp trên máy khác cùng server
- In nhanh danh sách hàng và tổng tiền cho khách ngay từ giỏ hàng hoặc từ lịch sử đơn
- Giao diện theo menu nghiệp vụ riêng cho tồn kho, tạo đơn, đơn hàng, khách hàng và sản phẩm
- Các màn chọn đối tượng đều có ô tìm kiếm/gõ tên để thao tác nhanh trên điện thoại
- Quản lý nhập hàng với phiếu nhập nháp, trạng thái đặt hàng/nhập kho và gợi ý sản phẩm cần nhập
- Quản lý khách hàng có thêm số liên lạc, địa chỉ ship và link Zalo
- Quản lý đơn hàng có trạng thái thanh toán
- Quản lý danh mục sản phẩm gồm tên, loại thực phẩm, đơn vị tính, ngưỡng cảnh báo
- Lịch sử giao dịch gần đây để kiểm tra lại thao tác mới nhất

## Chạy ứng dụng

```powershell
python app.py
```

Sau đó mở trình duyệt tại `http://127.0.0.1:8000`.

Dữ liệu nghiệp vụ được lưu trong `data\inventory.db`. Nếu nhiều máy cùng mở vào cùng một địa chỉ app/server thì sẽ dùng chung một nguồn dữ liệu.

Có thể bind theo IP / domain / port tùy ý:

```powershell
python app.py --host 0.0.0.0 --port 8080
```

Hoặc:

```powershell
python app.py serve --host 192.168.1.10 --port 9000
```

## Khởi tạo danh mục từ `data\List.txt`

```powershell
python app.py init
```

Mặc định lệnh này sẽ đọc `data\List_price.txt`. Mỗi dòng có thể ở dạng:

```text
1. Tên sản phẩm | 0
```

Hoặc dạng đầy đủ:

```text
Tên sản phẩm | Loại thực phẩm | Đơn vị | Ngưỡng cảnh báo | Giá
```

Hệ thống sẽ tự bỏ số thứ tự đầu dòng như `1.` hoặc `2.`, rồi thêm sản phẩm vào database. Nếu chạy lại, các tên đã có sẽ được tự động bỏ qua.

Nếu muốn xóa toàn bộ dữ liệu hiện có rồi import lại sạch từ `List.txt`:

```powershell
python app.py init --reset
```

## Chạy test

```powershell
python -m unittest discover -s tests
```
