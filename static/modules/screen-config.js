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
      "Nếu cần xử lý sai lệch sau khi chứng từ đã xử lý, ưu tiên tạo phiếu điều chỉnh tồn thay vì sửa ngược đơn/phiếu cũ.",
      "Kéo xuống phần Lịch sử gần đây để kiểm tra các giao dịch mới nhất trước khi tiếp tục thao tác khác.",
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
      "Nếu máy khác vừa nhập thêm hàng hoặc đổi giá nhập mặc định, danh sách chọn hàng sẽ tự cập nhật khi bạn không còn focus ở ô đang gõ.",
      "Khi mở detail của dòng hàng, bạn có thể đổi giá bán cho riêng đơn này hoặc bấm Giá chung để cập nhật giá bán mặc định của sản phẩm sau khi xác nhận.",
      "Nếu thiếu hàng, hệ thống sẽ chuyển sang luồng nhập hàng; chỉ Master Admin mới có quyền chỉnh tồn trực tiếp.",
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
      "Nếu phát hiện sai sau khi đã chốt đơn, hãy tạo phiếu trả hàng khách hoặc phiếu điều chỉnh phù hợp thay vì sửa ngược đơn cũ.",
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
      "Dùng form phía trên để thêm mới hoặc sửa dữ liệu khách đang chọn.",
      "Tìm nhanh bằng tên, số điện thoại hoặc địa chỉ để tránh nhập trùng.",
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
      "Nếu có máy khác vừa tạo hoặc sửa phiếu nhập, màn hình sẽ tự làm mới khi bạn không còn nhập dở ở ô hiện tại.",
      "Trong detail từng dòng nhập, bạn có thể sửa số lượng, giá nhập và bấm Giá chung để cập nhật giá nhập mặc định của sản phẩm sau khi xác nhận.",
      "Phiếu nhập chỉ được đánh dấu đã thanh toán sau khi đã nhập kho; app sẽ khóa thao tác trả tiền sớm hơn bước này.",
      "Phiếu đã nhập kho, đã thanh toán hoặc đã hủy sẽ chuyển sang chế độ chỉ xem; nếu sai sót thì xử lý bằng phiếu trả NCC hoặc chứng từ điều chỉnh mới.",
      "Ẩn các phiếu đã thanh toán để giữ màn hình gọn; bật lại khi cần đối chiếu lịch sử.",
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
      "Dùng form để thêm mới hoặc sửa thông tin liên lạc và ghi chú làm việc.",
      "Tìm theo tên, số điện thoại hoặc địa chỉ trước khi thêm để tránh trùng lặp.",
    ],
    related: [
      { menu: "purchases", label: "Sang nhập hàng" },
      { menu: "history", label: "Khôi phục NCC đã xóa" },
    ],
  },
  reports: {
    title: "Báo cáo và lợi nhuận",
    overview: "Theo dõi nhập xuất, doanh thu, giá vốn, lãi gộp và danh sách mặt hàng cần nhập thêm.",
    steps: [
      "Chọn tháng xem chính hoặc dùng bộ lọc Từ ngày - Đến ngày để xem một khoảng cụ thể.",
      "Đọc các thẻ tổng hợp để tách riêng chi nhập hàng, doanh thu, giá vốn và lãi gộp.",
      "Xem tiếp xu hướng theo tháng, đề xuất nhập thêm và chi tiết từng sản phẩm bên dưới.",
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
    ],
    related: [
      { menu: "products", label: "Quay lại sản phẩm" },
      { menu: "customers", label: "Quay lại khách hàng" },
      { menu: "suppliers", label: "Quay lại nhà cung cấp" },
    ],
  },
  admin: {
    title: "Master Admin",
    overview: "Dành cho tài khoản admin để xuất nhập master data, backup và restore toàn hệ thống.",
    steps: [
      "Đăng nhập bằng tài khoản admin đã cấu hình trong file hệ thống.",
      "Dùng export/import để quản trị dữ liệu master của sản phẩm, khách hàng và nhà cung cấp.",
      "Chỉ restore database khi đã hiểu rõ rằng dữ liệu hiện tại sẽ bị ghi đè bằng bản phục hồi.",
    ],
    related: [
      { menu: "history", label: "Xem lịch sử & khôi phục nghiệp vụ" },
      { menu: "reports", label: "Quay lại báo cáo" },
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
