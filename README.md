# Phỏm Online MVP

Web game Tá Lả/Phỏm realtime cho 2–4 người, chạy trên điện thoại và máy tính.

## Chức năng

- Tạo phòng / vào phòng bằng mã 6 ký tự
- 2–4 người
- Realtime qua Socket.IO
- Chia 10 lá cho người đầu, 9 lá cho người còn lại
- Bốc nọc, ăn bài bỏ nếu lá đó tạo được phỏm, đánh bài
- Tự nhận diện phỏm bộ và phỏm dây
- Hạ phỏm ở vòng cuối
- Kết thúc sau 4 vòng, tính điểm bài rác; nhận diện Ù/Móm cơ bản
- Tự kết nối lại bằng token lưu trong trình duyệt
- Responsive cho mobile và desktop

## Chạy local

Yêu cầu Node.js 20+.

```bash
npm install
npm start
```

Mở http://localhost:3000

Để điện thoại cùng Wi-Fi truy cập máy tính, lấy IP LAN của máy tính, ví dụ 192.168.1.10 rồi mở:

```text
http://192.168.1.10:3000
```

Nếu không vào được, mở TCP port 3000 trong Windows Firewall.

## Test

```bash
npm test
```

## Deploy Render

- Push source lên GitHub.
- Render > New > Web Service > chọn repository.
- Runtime: Node.
- Build Command: `npm install`
- Start Command: `npm start`
- Instance: Free.
- Deploy.

Ứng dụng tự dùng `process.env.PORT` và bind `0.0.0.0`, phù hợp Render.

## Lưu ý MVP

Luật Phỏm giữa các nhóm có thể khác nhau. Bản này chưa có gửi bài, tái, ăn chốt, đền, ù khan và luật tính tiền/điểm nâng cao. Toàn bộ phòng được giữ trong RAM nên khi host Free restart/spin-down, phòng đang có sẽ mất.
