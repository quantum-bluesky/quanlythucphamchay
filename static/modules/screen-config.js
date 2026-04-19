const MOBILE_FLOATING_HINT =
  "Trên điện thoại, menu nổi, tìm kiếm nhanh và cụm nút điều hướng sẽ tự thu vào mép màn hình khi bạn chạm ra ngoài; chạm lại vào phần mép còn lộ ra để mở đúng cụm cần dùng.";
const DESKTOP_MENU_HINT =
  "Trên PC/tablet, menu nghiệp vụ sẽ tự thu gọn khi bạn rê chuột hoặc bấm ra ngoài khung menu; hover hoặc bấm nút Mở menu để bung lại nhanh.";
const DESKTOP_PAGINATION_HINT =
  "Trên PC/tablet, danh sách sẽ tự tính số mục mỗi trang theo khung hiển thị; nếu cần xem ít hoặc nhiều hơn, dùng combobox 25/50/100 ngay trên thanh phân trang.";

export const SCREEN_HELP = {
  inventory: {
    title: "Kiểm tra nhập xuất hàng tồn",
    overview: "Dùng màn này để xem tồn hiện tại, biết mặt hàng đang chờ nhập hoặc chờ xuất, rồi chuyển đúng sang đơn/phiếu liên quan.",
    steps: [
      "Gõ tên mặt hàng ở ô tìm kiếm để thu gọn danh sách cần xem.",
      "Bấm Xuất hoặc Nhập ngay trên từng mặt hàng để mở đơn chờ / phiếu chờ liên quan, hoặc tạo luồng mới nếu chưa có.",
      "Nếu card có badge Chờ xuất hoặc Chờ nhập, bấm trực tiếp vào badge để sang đúng màn đang xử lý mặt hàng đó.",
      "Nếu có máy khác vừa cập nhật tồn hoặc giá, màn hình sẽ tự nạp lại khi bạn đang rảnh thao tác; trong lúc đang gõ thì app sẽ tạm hoãn để tránh mất dữ liệu đang nhập.",
      "Chỉ Master Admin mới được chỉnh tồn trực tiếp; khi đăng nhập sẽ hiện cảnh báo riêng ở màn tồn kho và bắt buộc nhập lý do điều chỉnh.",
      "Nếu cần xử lý sai lệch sau khi chứng từ đã xử lý, dùng nút Phiếu DC hoặc mở khối Phiếu điều chỉnh tồn để lập chứng từ tăng/giảm mới thay vì sửa ngược đơn/phiếu cũ.",
      "Kéo xuống phần Lịch sử gần đây để kiểm tra các giao dịch mới nhất trước khi tiếp tục thao tác khác.",
      DESKTOP_PAGINATION_HINT,
      DESKTOP_MENU_HINT,
      MOBILE_FLOATING_HINT,
    ],
    related: [
      { menu: "create-order", label: "Sang tạo đơn xuất" },
      { menu: "purchases", label: "Sang nhập hàng" },
      { menu: "products", label: "Quản lý sản phẩm" },
    ],
  },
  "create-order": {
    title: "Tạo đơn xuất hàng",
    overview: "Màn này dành cho luồng bán hàng: chọn khách, thêm nhiều mặt hàng vào giỏ, chỉnh số lượng và giá bán rồi chốt đơn.",
    steps: [
      "Chọn khách hàng có sẵn hoặc gõ tên để mở giỏ hàng cho khách hiện hành.",
      "Tìm mặt hàng ở danh sách chọn hàng, tick để thêm vào giỏ. Giá bán mặc định sẽ lấy theo giá bán chung của sản phẩm.",
      "Các mặt hàng đã chọn sẽ được gom lên khối giỏ hiện hành phía trên và tự ẩn khỏi danh sách chọn phía dưới để tránh nhìn sót hoặc chọn trùng.",
      "Nếu máy khác vừa nhập thêm hàng hoặc đổi giá nhập mặc định, danh sách chọn hàng sẽ tự cập nhật khi bạn không còn focus ở ô đang gõ.",
      "Nếu có 2 máy cùng sửa một giỏ nháp, app sẽ chặn ghi đè và báo xung đột để bạn tải lại dữ liệu mới nhất trước khi lưu tiếp.",
      "Khi mở detail của dòng hàng, bạn có thể đổi giá bán cho riêng đơn này hoặc bấm Giá chung để cập nhật giá bán mặc định của sản phẩm sau khi xác nhận.",
      "Nếu thiếu hàng, hệ thống sẽ chuyển sang luồng nhập hàng; chỉ Master Admin mới có quyền chỉnh tồn trực tiếp.",
      DESKTOP_PAGINATION_HINT,
      DESKTOP_MENU_HINT,
      MOBILE_FLOATING_HINT,
    ],
    related: [
      { menu: "orders", label: "Xem đơn hàng" },
      { menu: "customers", label: "Quản lý khách hàng" },
      { menu: "purchases", label: "Lên phiếu nhập" },
    ],
  },
  orders: {
    title: "Quản lý đơn hàng",
    overview: "Theo dõi các giỏ hàng nháp, đơn đã chốt, đơn đã thanh toán và tra cứu lịch sử đơn theo khách hay mặt hàng.",
    steps: [
      "Dùng ô tìm kiếm để lọc theo khách hàng, mã đơn hoặc tên mặt hàng.",
      "Bật hoặc tắt các tùy chọn hiện đơn đã xong và đã thanh toán để thu gọn danh sách.",
      "Đơn đã chốt chỉ còn các thao tác xem/in và cập nhật thanh toán; app sẽ khóa sửa trực tiếp để giữ lịch sử đúng workflow.",
      "Nếu phát hiện sai sau khi đã chốt đơn, bấm Trả hàng trên đúng đơn để tạo sẵn phiếu trả khách, hoặc mở khối Phiếu trả hàng khách để nhập tay từng dòng độc lập.",
      "Master Admin cũng không được xóa hoặc hủy ngược đơn đã chốt; các đơn đó phải được điều chỉnh bằng phiếu mới để giữ audit.",
      DESKTOP_PAGINATION_HINT,
      DESKTOP_MENU_HINT,
      MOBILE_FLOATING_HINT,
    ],
    related: [
      { menu: "create-order", label: "Quay lại tạo đơn" },
      { menu: "customers", label: "Xem khách hàng" },
      { menu: "reports", label: "Xem báo cáo" },
    ],
  },
  customers: {
    title: "Quản lý khách hàng",
    overview: "Dùng để thêm mới, sửa, xóa mềm và tra cứu thông tin giao hàng, số liên lạc, Zalo của khách.",
    steps: [
      "Mở vào màn là thấy ngay danh sách khách hàng hiện hành.",
      "Form tạo/sửa được thu gọn sẵn để ưu tiên phần danh sách; bấm Thêm mới hoặc Sửa để mở đúng lúc cần nhập liệu.",
      "Tìm nhanh bằng tên, số điện thoại hoặc địa chỉ để tránh nhập trùng.",
      DESKTOP_PAGINATION_HINT,
      DESKTOP_MENU_HINT,
      MOBILE_FLOATING_HINT,
    ],
    related: [
      { menu: "create-order", label: "Sang tạo đơn" },
      { menu: "orders", label: "Xem đơn liên quan" },
      { menu: "history", label: "Khôi phục khách đã xóa" },
    ],
  },
  products: {
    title: "Quản lý sản phẩm",
    overview: "Dùng để thêm mới, sửa nhanh giá nhập, giá bán mặc định và thông tin mặt hàng, ngừng bán hoặc kiểm tra lịch sử thay đổi sản phẩm.",
    steps: [
      "Tìm đúng mặt hàng trong danh sách để sửa nhanh ngay trên từng ô.",
      "Khi sửa, đọc nhãn bên trái của từng dòng để tránh nhầm giữa Giá nhập và Giá bán.",
      "Nếu cần thêm mới, dùng form phía dưới danh sách.",
      "Xem phần Lịch sử sản phẩm bên dưới để biết thay đổi gần đây trước khi chỉnh tiếp.",
      "Có thể lọc lịch sử theo người thao tác, từ ngày và đến ngày để đối chiếu audit nhanh.",
      DESKTOP_PAGINATION_HINT,
      DESKTOP_MENU_HINT,
      MOBILE_FLOATING_HINT,
    ],
    related: [
      { menu: "inventory", label: "Xem tồn kho" },
      { menu: "purchases", label: "Chuẩn bị nhập hàng" },
      { menu: "history", label: "Khôi phục sản phẩm đã xóa" },
    ],
  },
  purchases: {
    title: "Quản lý nhập hàng",
    overview: "Màn này quản lý phiếu nhập nháp, đơn đã đặt, hàng đã về và trạng thái thanh toán nhập hàng.",
    steps: [
      "Xem ngay danh sách phiếu nhập hiện hành khi mở màn.",
      "Tạo hoặc mở phiếu nhập, thêm sản phẩm cần mua rồi cập nhật trạng thái theo tiến trình.",
      "Các mặt hàng đã thêm vào phiếu sẽ được gom vào phần tóm tắt phiếu phía trên và tự ẩn khỏi danh sách gợi ý phía dưới để màn hình gọn hơn.",
      "Nếu có máy khác vừa tạo hoặc sửa phiếu nhập, màn hình sẽ tự làm mới khi bạn không còn nhập dở ở ô hiện tại.",
      "Nếu 2 máy cùng lưu trên một phiếu nháp, app sẽ báo xung đột đồng bộ và tự tải lại để tránh ghi đè dữ liệu của nhau.",
      "Trong detail từng dòng nhập, bạn có thể sửa số lượng, giá nhập và bấm Giá chung để cập nhật giá nhập mặc định của sản phẩm sau khi xác nhận.",
      "Nếu đang gõ tên NCC mới chưa có sẵn, bấm nút NCC để mở thẳng form nhà cung cấp với tên đang nhập; nếu tên đó đã có, app sẽ mở luôn chế độ sửa NCC rồi quay lại phiếu nhập sau khi lưu.",
      "Phiếu nhập chỉ được đánh dấu đã thanh toán sau khi đã nhập kho; app sẽ khóa thao tác trả tiền sớm hơn bước này.",
      "Nếu gặp dữ liệu lỗi cũ kiểu phiếu bị lệch marker/trạng thái, như dính Đã thanh toán nhưng chưa có Nhập kho thật hoặc đang hiện thành Nháp sai, app sẽ hiện cảnh báo và cho phép Hủy/Xóa để dọn trạng thái lỗi mà không khôi phục lại thành nháp.",
      "Phiếu đã nhập kho, đã thanh toán hoặc đã hủy sẽ chuyển sang chế độ chỉ xem; nếu sai sót thì bấm Trả NCC trên phiếu cũ hoặc mở khối Phiếu trả NCC để lập phiếu độc lập.",
      "Master Admin cũng không được xóa hoặc hủy ngược phiếu đã khóa, trừ ngoại lệ phiếu lỗi dữ liệu nói trên; ngoài ngoại lệ đó thì chỉ phiếu nháp mới được xóa hẳn.",
      "Ẩn các phiếu đã thanh toán để giữ màn hình gọn; bật lại khi cần đối chiếu lịch sử.",
      DESKTOP_PAGINATION_HINT,
      DESKTOP_MENU_HINT,
      MOBILE_FLOATING_HINT,
    ],
    related: [
      { menu: "suppliers", label: "Quản lý nhà cung cấp" },
      { menu: "inventory", label: "Kiểm tra tồn kho" },
      { menu: "create-order", label: "Quay lại đơn xuất" },
    ],
  },
  suppliers: {
    title: "Quản lý nhà cung cấp",
    overview: "Lưu và tra cứu nhà cung cấp để dùng lại trong phiếu nhập, tránh nhập trùng thông tin nguồn hàng.",
    steps: [
      "Mở màn là thấy danh sách nhà cung cấp hiện có.",
      "Form tạo/sửa được thu gọn sẵn để ưu tiên phần danh sách; bấm Thêm mới hoặc Sửa để mở đúng lúc cần nhập liệu.",
      "Nếu đi từ màn Nhập hàng sang bằng nút NCC, form sẽ mở sẵn với tên nhà cung cấp đang gõ; nếu NCC đã tồn tại thì app chuyển thẳng sang chế độ sửa để cập nhật nhanh rồi quay lại phiếu nhập.",
      "Tìm theo tên, số điện thoại hoặc địa chỉ trước khi thêm để tránh trùng lặp.",
      DESKTOP_PAGINATION_HINT,
      DESKTOP_MENU_HINT,
      MOBILE_FLOATING_HINT,
    ],
    related: [
      { menu: "purchases", label: "Sang nhập hàng" },
      { menu: "history", label: "Khôi phục NCC đã xóa" },
    ],
  },
  reports: {
    title: "Báo cáo và lợi nhuận",
    overview: "Theo dõi nhập xuất, doanh thu, giá vốn, lãi gộp, chứng từ trả hàng/điều chỉnh và danh sách mặt hàng cần nhập thêm.",
    steps: [
      "Chọn tháng xem chính hoặc dùng bộ lọc Từ ngày - Đến ngày để xem một khoảng cụ thể.",
      "Đọc các thẻ tổng hợp để tách riêng nhập hàng, bán hàng, hoàn tiền khách, trả NCC và điều chỉnh tồn.",
      "Xem tiếp xu hướng theo tháng, đề xuất nhập thêm và chi tiết từng sản phẩm bên dưới.",
      "Kéo xuống phần Audit chứng từ để tra cứu nhanh phiếu điều chỉnh tồn, phiếu trả hàng khách và phiếu trả NCC trong kỳ đang xem.",
      DESKTOP_PAGINATION_HINT,
      DESKTOP_MENU_HINT,
      MOBILE_FLOATING_HINT,
    ],
    related: [
      { menu: "inventory", label: "Kiểm tra tồn kho" },
      { menu: "orders", label: "Đối chiếu đơn hàng" },
      { menu: "purchases", label: "Đối chiếu nhập hàng" },
    ],
  },
  history: {
    title: "Lịch sử và khôi phục",
    overview: "Quản lý các đối tượng đã xóa mềm và khôi phục lại khi ràng buộc cho phép.",
    steps: [
      "Chọn đúng nhóm đối tượng đã xóa cần xem: sản phẩm, khách hàng hoặc nhà cung cấp.",
      "Đọc cảnh báo ràng buộc trước khi khôi phục để biết đối tượng nào đang trùng hoặc đang bị khóa logic.",
      "Khôi phục xong thì quay lại màn nghiệp vụ tương ứng để tiếp tục thao tác.",
      DESKTOP_PAGINATION_HINT,
      DESKTOP_MENU_HINT,
      MOBILE_FLOATING_HINT,
    ],
    related: [
      { menu: "products", label: "Quay lại sản phẩm" },
      { menu: "customers", label: "Quay lại khách hàng" },
      { menu: "suppliers", label: "Quay lại nhà cung cấp" },
    ],
  },
  admin: {
    title: "Master Admin",
    overview: "Màn này vừa là nơi login hệ thống, vừa là nơi tài khoản admin quản trị master data, backup và restore.",
    steps: [
      "Dùng tài khoản user hoặc admin đã cấu hình trong file hệ thống để login. Nếu bật EnableLogin thì phải login mới dùng được app.",
      "Dùng export/import để quản trị dữ liệu master của sản phẩm, khách hàng và nhà cung cấp (hỗ trợ cả JSON và CSV).",
      "User thường chỉ dùng được phần nghiệp vụ chung; riêng Master Admin mới thấy module quản trị và chỉnh tồn trực tiếp.",
      "Session user thường dùng session_timeout_minutes, còn admin dùng admin_session_timeout_minutes trong system_config.json.",
      "Chỉ restore database khi đã hiểu rõ rằng dữ liệu hiện tại sẽ bị ghi đè bằng bản phục hồi.",
      DESKTOP_MENU_HINT,
      MOBILE_FLOATING_HINT,
    ],
    related: [
      { menu: "history", label: "Xem lịch sử & khôi phục nghiệp vụ" },
      { menu: "reports", label: "Quay lại báo cáo" },
    ],
  },
  about: {
    title: "About ứng dụng",
    overview: "Màn này hiển thị phiên bản app đang chạy và vài thông tin hệ thống cơ bản để đối chiếu nhanh.",
    steps: [
      "Bấm vào badge Version ở đầu ứng dụng để mở màn About.",
      "Kiểm tra phiên bản hiện tại trước khi trao đổi lỗi, cập nhật hoặc hỗ trợ từ xa.",
      "Dùng các nút đi nhanh để quay lại tồn kho, báo cáo hoặc Master Admin.",
      DESKTOP_MENU_HINT,
      MOBILE_FLOATING_HINT,
    ],
    related: [
      { menu: "inventory", label: "Quay lại tồn kho" },
      { menu: "reports", label: "Xem báo cáo" },
      { menu: "admin", label: "Mở Master Admin" },
    ],
  },
};

export const SCREEN_META = {
  inventory: {
    title: "Kiểm tra tồn kho",
    subtitle: "Xem tồn hiện tại, đơn chờ nhập/xuất và đối chiếu lịch sử kho.",
  },
  "create-order": {
    title: "Tạo đơn xuất hàng",
    subtitle: "Chọn khách, thêm hàng vào giỏ và chốt đơn nhanh.",
  },
  orders: {
    title: "Đơn hàng",
    subtitle: "Theo dõi giỏ nháp, đơn đã chốt và trạng thái thanh toán.",
  },
  customers: {
    title: "Khách hàng",
    subtitle: "Lưu danh bạ giao hàng, số liên lạc và Zalo.",
  },
  products: {
    title: "Sản phẩm",
    subtitle: "Tìm, sửa nhanh giá nhập/giá bán, ngừng bán và xem lịch sử sản phẩm.",
  },
  purchases: {
    title: "Nhập hàng",
    subtitle: "Lập phiếu nhập, theo dõi tiến trình đặt và nhận hàng.",
  },
  suppliers: {
    title: "Nhà cung cấp",
    subtitle: "Quản lý nguồn hàng và thông tin liên hệ.",
  },
  reports: {
    title: "Báo cáo",
    subtitle: "Xem doanh thu, giá vốn, lãi gộp và xu hướng nhập xuất.",
  },
  history: {
    title: "Lịch sử & khôi phục",
    subtitle: "Theo dõi đối tượng đã xóa mềm và khôi phục khi đủ điều kiện.",
  },
  admin: {
    title: "Master Admin",
    subtitle: "Quản trị dữ liệu master, backup và restore hệ thống.",
  },
  about: {
    title: "About ứng dụng",
    subtitle: "Xem phiên bản app đang chạy và thông tin hệ thống cơ bản.",
  },
};

export const FLOATING_SEARCH_CONFIG = {
  inventory: {
    sourceId: "searchInput",
    placeholder: "Tìm mặt hàng tồn kho",
  },
  "create-order": {
    sourceId: "salesSearchInput",
    placeholder: "Tìm sản phẩm để thêm vào giỏ",
  },
  orders: {
    sourceId: "orderSearchInput",
    placeholder: "Tìm đơn hàng theo khách, mã đơn, mặt hàng",
  },
  customers: {
    sourceId: "customerSearchInput",
    placeholder: "Tìm khách hàng",
  },
  products: {
    sourceId: "productManageSearchInput",
    placeholder: "Tìm sản phẩm để sửa nhanh",
  },
  purchases: {
    sourceId: "purchaseSearchInput",
    placeholder: "Tìm phiếu nhập hoặc mặt hàng cần nhập",
  },
  suppliers: {
    sourceId: "supplierSearchInput",
    placeholder: "Tìm nhà cung cấp",
  },
};
