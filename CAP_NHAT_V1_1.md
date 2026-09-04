# Cap nhat Phom Online v1.1

Ban nay them 3 nhom tinh nang:

1. Bai bo theo tung nguoi choi: moi nguoi co mot hang toi da 4 la da danh. La bi nguoi ke tiep an se duoc xoa khoi hang bai bo cua nguoi da danh.
2. Am thanh: boc, danh, an, ha phom, toi luot va ket thuc van. Nut loa tren thanh tren cung bat/tat am thanh. Khong can file MP3.
3. Diem tran tich luy: chu phong chon `Diem van` 1, 5, 10 hoac 20.

## Cong thuc diem tran mac dinh

- 2 nguoi: hang 1 `+1`, hang 2 `-1`.
- 3 nguoi: hang 1 `+2`, hang 2 `0`, hang 3 `-2`.
- 4 nguoi: hang 1 `+3`, hang 2 `+1`, hang 3 `-1`, hang 4 `-3`.
- Tat ca cac muc tren nhan voi `Diem van`.

Vi du 4 nguoi va `Diem van = 5`: `+15, +5, -5, -15`.

Diem tran duoc giu khi bam `CHOI VAN MOI` trong cung phong. Neu Render khoi dong lai hoac phong bi xoa thi diem se ve 0 vi ban MVP dang luu phong trong RAM.

## Cap nhat repo hien tai

Ban dang o thu muc:

```bash
/e/Game_vui/phom-online/phom-online
```

Giai nen goi cap nhat va chep de cac file vao dung thu muc repo. Sau do chay:

```bash
npm test
npm start
```

Mo `http://localhost:3000` va test bang 2 trinh duyet/thiet bi.

Neu on, dung `Ctrl+C` de dung server, sau do:

```bash
git status
git add .
git commit -m "Add discard piles sound and match points"
git push
```

Neu Render dang bat Auto-Deploy, Render se tu deploy commit moi. Vao Render > phom-online > Events/Logs de theo doi.

Sau deploy, tren dien thoai/PC nen hard refresh de tranh cache file JS/CSS cu.
