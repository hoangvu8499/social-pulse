# Social Pulse

Ứng dụng desktop lấy những bài viết nóng nhất trong ngày từ nhiều mạng xã hội, gom về một bảng xếp hạng chung, kèm số liệu tương tác và công cụ xuất dữ liệu.

![Electron](https://img.shields.io/badge/Electron-44-informational)
![React](https://img.shields.io/badge/React-19-informational)
![TypeScript](https://img.shields.io/badge/TypeScript-7-informational)

---

## Điều cần biết trước tiên

Không tồn tại API công khai nào cho "bài hot nhất Facebook hôm nay" hay "bài hot nhất Threads hôm nay". Meta đã đóng Public Feed API và Keyword Insights API từ lâu, còn CrowdTangle thì ngừng hẳn. Những gì Graph API còn cho phép là đọc Page hoặc tài khoản mà **chính bạn** quản trị.

Vì vậy ứng dụng này chia nguồn dữ liệu thành hai nhóm và nói thẳng nhóm nào làm được gì.

### Nhóm chạy ngay, không cần đăng ký

| Mạng | Nguồn | Số liệu bài | Bình luận |
|---|---|---|---|
| Bluesky | AppView công khai, feed *What's Hot* | Đầy đủ | Có, kèm lượt thích |
| Lemmy | API v3, sắp xếp `TopDay` | Có | Có, kèm điểm |
| Hacker News | Algolia Search API | Có | Có, không có điểm |
| Mastodon | `trends/statuses` | Có | Có, kèm lượt thích |
| Reddit | Atom feed công khai | **Không**, chỉ thứ hạng | Chỉ qua OAuth |

Reddit đã chặn endpoint `.json` ẩn danh, gọi thẳng sẽ nhận 403. Đường RSS còn mở nhưng không kèm số upvote hay số bình luận, và bị giới hạn khoảng một yêu cầu mỗi phút. Khai báo Client ID và Secret trong phần Cài đặt để chuyển sang OAuth, lúc đó có đủ số liệu và hạn mức cao hơn nhiều.

### Nhóm cần khóa riêng

| Mạng | Cần gì | Lấy được gì | Bình luận |
|---|---|---|---|
| YouTube | API key miễn phí | Bảng video thịnh hành theo quốc gia | Có, kèm lượt thích |
| X / Twitter | Bearer Token, gói trả phí | Bài khớp truy vấn trong 7 ngày gần nhất | Có, qua `conversation_id` |
| Threads | Access Token | **Chỉ bài của chính tài khoản bạn** | Có, không có điểm |
| Facebook | Page ID và Page Token | **Chỉ bài của Page bạn quản trị** | Có, kèm lượt thích |

Với Threads và Facebook, ứng dụng làm đúng phạm vi API cho phép: xếp hạng bài của bạn theo tương tác để biết bài nào đang chạy tốt nhất. Công cụ nào quảng cáo lấy được "top 10 Facebook toàn cầu" thì hoặc đang cào giao diện web, việc vi phạm điều khoản và dễ khiến tài khoản bị khóa, hoặc đang bán lại dữ liệu mua từ bên thứ ba.

---

## Chạy thử

```bash
npm install
npm run dev
```

Lần đầu `npm install` sẽ tải binary Electron khoảng 250 MB.

### Các lệnh khác

| Lệnh | Việc |
|---|---|
| `npm run dev` | Chạy ở chế độ phát triển, có nạp lại nóng |
| `npm run build` | Kiểm tra kiểu rồi đóng gói mã nguồn |
| `npm start` | Chạy bản đã build |
| `npm test` | Bộ test đơn vị, không chạm mạng |
| `npm run test:live` | Test tích hợp gọi API thật |
| `npm run smoke` | Quét một lần và in kết quả ra terminal |
| `npm run smoke:comments` | Quét rồi in bình luận nổi bật của bài đầu mỗi mạng |
| `npm run typecheck` | Kiểm tra kiểu cả hai phía |
| `npm run dist` | Tạo bộ cài đặt cho Windows |

> **Lưu ý khi chạy trong terminal của một số IDE.** Nếu gặp lỗi `Cannot read properties of undefined (reading 'whenReady')`, nguyên nhân là biến môi trường `ELECTRON_RUN_AS_NODE=1` đang biến binary Electron thành Node thường. Gỡ biến đó đi rồi chạy lại.

---

## Hai thang điểm, và vì sao cần cả hai

Mỗi mạng có quy mô tương tác khác nhau hàng trăm lần. Một bài Reddit năm mươi nghìn upvote và một bài Mastodon năm trăm lượt thích đều có thể là bài nóng nhất của mạng đó. So sánh bằng số tương tác thô chỉ nói lại điều ai cũng biết, là mạng đông người thì nhiều lượt thích hơn.

Nền tảng của cả hai thang điểm là **vận tốc tương tác**, tức tổng tương tác chia cho số giờ tuổi đời bài viết. Nhờ đó một bài mới đăng đang tăng nhanh không bị một bài cũ đã tích lũy nhiều tương tác che mất.

**`hotScore`** từ 0 đến 100, so bài này với bài nóng nhất của chính mạng đó. Đây là con số tự nhiên khi nhìn riêng từng mạng, và là con số hiển thị trên mỗi thẻ bài viết.

**`crossScore`** so vận tốc của bài với vận tốc trung vị của mạng đó. Vì mỗi mạng đều có đúng một bài đạt 100 `hotScore`, nếu xếp bảng gộp theo `hotScore` thì đầu bảng chỉ là một chùm điểm 100 bằng nhau và mất hết thông tin. `crossScore` giữ được sự thật rằng một bài bùng nổ gấp ba mươi lần mức thường ngày thì đáng chú ý hơn một bài chỉ gấp ba lần, dù cả hai đều đứng đầu mạng của mình. Bảng xếp hạng gộp và biểu đồ so sánh đều dùng chỉ số này.

Riêng Reddit qua đường RSS không có số liệu để tính vận tốc. Trường hợp đó ứng dụng chấm điểm thẳng theo thứ hạng Reddit đưa ra và ghi rõ là không có số liệu, thay vì bịa ra những con số trông như thật.

---

## Bình luận nổi bật

Mỗi thẻ bài viết có nút mở danh sách bình luận nổi bật. Dữ liệu được tải **khi bạn mở ra**, không kéo sẵn lúc quét. Lý do là số học: một lần quét năm mạng với mười bài mỗi mạng là năm mươi bài, kéo bình luận cho tất cả sẽ là năm mươi lượt gọi thêm và chạm trần nhịp chờ của gần hết các API công khai, trong khi bạn chỉ đọc bình luận của vài bài thực sự quan tâm.

Cách xếp hạng bình luận phụ thuộc vào thứ nguồn công bố. Mạng nào cho biết lượt thích thì xếp theo lượt thích. Hacker News không công bố điểm của từng bình luận, API trả về `points` bằng null, nên app xếp theo tổng số lượt trả lời bên dưới, tức độ dày của cuộc tranh luận mà bình luận đó mở ra, và ghi rõ trên giao diện rằng đây là thứ hạng suy ra chứ không phải số liệu thật.

---

## Kiến trúc

```
src/
  shared/      Model dữ liệu, chấm điểm, metadata nền tảng, tên kênh IPC
  main/        Tiến trình chính: provider, cache, cài đặt, lịch sử, xuất file
    providers/ Mỗi mạng một file, cùng một interface
  preload/     Cầu nối duy nhất giữa giao diện và hệ thống
  renderer/    Giao diện React
```

**Mọi provider trả về cùng một kiểu `Post`.** Tầng giao diện không cần biết bài đến từ đâu. Thêm một mạng mới chỉ là viết thêm một file trong `providers/` rồi đăng ký vào `providers/index.ts`.

**Provider không bao giờ ném lỗi ra ngoài.** Mỗi thất bại được gói lại thành `ProviderResult` có trạng thái rõ ràng, nên một mạng hỏng không kéo đổ cả lần quét, và giao diện chỉ phải đọc một kiểu dữ liệu duy nhất.

**Có lớp cache theo nhịp riêng của từng mạng.** Nhiều API công khai chặn rất gắt. Nếu lần nào bấm làm mới cũng gọi thẳng ra ngoài thì sẽ bị chặn ngay. Nút quét có cờ `force` để bỏ qua cache khi cần.

**Khóa API được mã hóa trước khi ghi ra đĩa**, bằng `safeStorage` của Electron, tức DPAPI trên Windows và Keychain trên macOS. Một bản sao file cài đặt lọt ra ngoài cũng không dùng được. Nếu hệ điều hành không cung cấp kho bảo mật, ứng dụng nói rõ điều đó trong phần Cài đặt thay vì âm thầm ghi khóa dạng chữ thường.

### Về bảo mật phía giao diện

Nội dung mạng xã hội là dữ liệu không đáng tin, nên bề mặt tiếp xúc được giữ hẹp:

- `contextIsolation` bật, `nodeIntegration` tắt, giao diện chỉ gọi được danh sách hàm cố định trong preload.
- Content Security Policy chặn mọi script từ bên ngoài.
- Mở liên kết chỉ chấp nhận `http` và `https`, để một đường dẫn lạ không thể được dùng để chạy gì đó trên máy.
- Mọi liên kết mở bằng trình duyệt hệ thống, không điều hướng trong cửa sổ ứng dụng.
- Ô xuất CSV bắt đầu bằng `=`, `+`, `-` hoặc `@` được vô hiệu hóa, tránh lỗ hổng chèn công thức vào Excel.

---

## Tính năng

- Quét song song nhiều mạng, báo tiến độ theo từng mạng
- Bảng xếp hạng gộp, kèm tab riêng cho từng mạng
- Biểu đồ so sánh mức độ sôi động giữa các mạng
- Tìm kiếm trong kết quả, sắp xếp theo độ nóng, thời gian hoặc tương tác
- Đánh dấu bài để xem lại
- Phát hiện bài mới so với lần quét trước
- Bình luận nổi bật của từng bài, tải khi mở ra
- Xuất ra CSV, JSON hoặc Markdown
- Tự động quét lại theo chu kỳ tùy chọn
- Lưu lịch sử các lần quét để đối chiếu
- Giao diện sáng và tối, cả hai đều được chọn màu riêng chứ không lật ngược lẫn nhau
- Phím tắt: `Ctrl+R` quét lại, `Ctrl+F` nhảy vào ô tìm kiếm

### Về bảng màu

Màu nhận diện các mạng không lấy theo màu thương hiệu gốc, vì đặt cạnh nhau chúng không phân biệt được: Bluesky và Facebook đều xanh dương, còn Reddit, Hacker News và YouTube đều nằm trong dải đỏ cam. Bảng màu đang dùng đã qua kiểm định về độ tách bạch, kể cả với người mù màu, ở cả hai chế độ sáng và tối. Tên mạng luôn hiển thị ngay cạnh chấm màu, nên danh tính không bao giờ chỉ dựa vào màu sắc.

---

## Thêm một mạng mới

1. Tạo `src/main/providers/<ten>.ts`, xuất một object thỏa `Provider`.
2. Map dữ liệu gốc về kiểu `Post`. Đặt `metricsAvailable: false` và điền `sourceRank` nếu nguồn chỉ cho thứ hạng.
3. Ném `CredentialsRequired` khi thiếu khóa, `NotSupported` khi nền tảng không có API cho dữ liệu đang cần.
4. Thêm `fetchComments` nếu mạng cho đọc bình luận. Không bắt buộc: bỏ trống thì app báo không hỗ trợ. Dùng `rankComments` để xếp, và đặt `metricsAvailable: false` nếu nguồn không công bố điểm.
5. Đăng ký vào `REGISTRY` trong `providers/index.ts`, thêm metadata vào `shared/platforms.ts`.
6. Thêm nhịp cache vào `TTL_SECONDS` trong `main/cache.ts`.

Không cần tự chấm điểm hay tự cắt danh sách, tầng điều phối lo phần đó.
