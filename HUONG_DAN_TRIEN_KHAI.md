# Hướng dẫn triển khai Phỏm Online

## 1. Chạy thử trên máy tính Windows

### Cài Node.js
Cài Node.js 20 LTS hoặc mới hơn từ trang chính thức Node.js.

### Chạy game
Giải nén source, sau đó có 2 cách:

**Cách dễ nhất:** double-click `start-local.bat`.

**Hoặc dùng Command Prompt:**

```bat
cd C:\duong-dan\phom-online
npm install
npm start
```

Mở trình duyệt:

```text
http://localhost:3000
```

## 2. Test bằng điện thoại trong cùng Wi-Fi

Trên PC chạy:

```bat
ipconfig
```

Tìm `IPv4 Address`, ví dụ `192.168.1.10`.

Điện thoại cùng Wi-Fi mở:

```text
http://192.168.1.10:3000
```

Nếu không vào được, cho phép Node.js qua Windows Defender Firewall hoặc mở TCP port 3000.

## 3. Đưa source lên GitHub

Tạo repository mới trên GitHub, ví dụ `phom-online`.

Trong thư mục source:

```bat
git init
git add .
git commit -m "Phom Online MVP"
git branch -M main
git remote add origin https://github.com/TEN_GITHUB/phom-online.git
git push -u origin main
```

Nếu máy chưa có Git, cài Git for Windows trước.

## 4. Deploy Render Free

1. Đăng nhập Render.
2. Chọn **New > Web Service**.
3. Kết nối GitHub và chọn repository `phom-online`.
4. Runtime: **Node**.
5. Build Command: `npm install`.
6. Start Command: `npm start`.
7. Instance/Plan: **Free**.
8. Health Check Path: `/health` nếu Render cho nhập.
9. Bấm **Create Web Service**.

Sau khi deploy, Render cấp URL dạng:

```text
https://phom-online-xxxx.onrender.com
```

Gửi URL đó cho bạn bè. Một người bấm **Tạo phòng**, gửi mã phòng 6 ký tự cho những người còn lại.

## 5. Cập nhật game sau này

Sửa source rồi chạy:

```bat
git add .
git commit -m "Update game"
git push
```

Nếu Auto Deploy đang bật, Render sẽ tự build và cập nhật phiên bản mới.

## 6. Giới hạn của bản MVP

- Phòng/ván đang chơi lưu trong RAM, không có database.
- Nếu server Render Free restart hoặc spin-down, phòng đang có sẽ mất.
- Chưa có: gửi bài vào phỏm người khác, tái, ăn chốt, đền, ù khan, chat, bot.
- Luật tính điểm hiện là bản cơ bản để nhóm bạn thử nghiệm trước.

Khi bản cơ bản ổn định, nên nâng luật Phỏm đầy đủ trước khi thêm hiệu ứng/âm thanh.
