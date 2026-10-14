# 🛡 LevelUpDay Focusgate — Windows agenti

Soat yonida (tray) ishlaydigan kichik dastur:

- **Kuzatish** — har soniyada faol oynani o'qiydi, dastur/saytda o'tgan vaqtni hisoblaydi (2 daqiqa harakatsiz bo'lsa hisoblanmaydi). Saytlar brauzer oynasi sarlavhasidan aniqlanadi (YouTube, Instagram, TikTok, ...).
- **Bloklash** — har 2 soniyada qoidalarni tekshiradi: kunlik limit, jadval, doimiy blok, seans limiti, fokus sessiyasi. Bloklangan dastur yopiladi, bloklangan sayt tabi (Ctrl+W) yopiladi. Tizim jarayonlari hech qachon yopilmaydi.
- **Sinxronlash** — har 30 soniyada `supabase/functions/focusgate` bilan: foydalanish → `fg_usage`, sozlamalar ← `fg_config`.
- **Ulash** — birinchi ishga tushishda brauzerda `levelupday.github.io/LevelUpDay/#fgpair=XXXX-XXXX` ochiladi, foydalanuvchi "Ulash" ni bosadi.
- **O'rnatish** — o'zini `%LOCALAPPDATA%\Programs\LevelUpDay Focusgate\` ga ko'chiradi va Windows bilan birga ishga tushadi. Holat: `%APPDATA%\LevelUpDay\Focusgate\state.json`.

## Yig'ish (Linux/macOS/Windows)

```bash
cd focusgate-agent
go test ./...                       # yadro testlari (platformaga bog'liq emas)
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 \
  go build -trimpath -ldflags "-H=windowsgui -s -w" -o dist/Focusgate.exe .
```

Ikonka/versiya resurslari (`rsrc_windows_*.syso`) `go-winres simply --icon assets/icon.png --manifest gui ...` bilan yaratilgan.

Chiqarish: `gh release create focusgate-v0.1.0 dist/Focusgate.exe` — sayt `releases/latest/download/Focusgate.exe` havolasidan yuklaydi.
