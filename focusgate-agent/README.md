# 🛡 LevelUpDay Focusgate — Windows agenti

Soat yonida (tray) ishlaydigan kichik dastur:

- **Kuzatish** — har soniyada faol oynani o'qiydi, dastur/saytda o'tgan vaqtni hisoblaydi (2 daqiqa harakatsiz bo'lsa hisoblanmaydi). Saytlar brauzer oynasi sarlavhasidan aniqlanadi (YouTube, Instagram, TikTok, ...).
- **Bloklash** — har 2 soniyada qoidalarni tekshiradi: kunlik limit, jadval, doimiy blok, seans limiti, fokus sessiyasi. Bloklangan dastur yopiladi, bloklangan sayt tabi (Ctrl+W) yopiladi. Tizim jarayonlari hech qachon yopilmaydi.
- **v0.6** — ochilishlar soni (`opens`), kunlar bo'yicha limit (`rule.perDay`), foizli ogohlantirish (`warnAt`), rejimlar (`modes`), fokusda oq ro'yxat (`allowOnly`/`allowApps` — ro'yxatda yo'q oyna yig'iladi), ongli ochish (`mindful` — oyna yig'iladi, N soniyadan keyin "rostdan kerakmi?").
- **Sinxronlash** — har 30 soniyada `supabase/functions/focusgate` bilan: foydalanish → `fg_usage`, sozlamalar ← `fg_config`.
- **Ulash** — birinchi ishga tushishda brauzerda `levelupday.github.io/LevelUpDay/#fgpair=XXXX-XXXX` ochiladi, foydalanuvchi "Ulash" ni bosadi.
- **Dasturlar ro'yxati** — Start menyusi va ish stoli yorliqlari (.lnk, Squirrel `Update.exe --processStart` ham), `Uninstall` yozuvlari va ishlab turgan jarayonlardan yig'iladi; 6 soatda bir `fg_devices.apps` ga yuboriladi.
- **Avtoyangilanish** — 6 soatda bir `downloads/version.json` ni tekshiradi, sha256 mos kelsa o'zini almashtiradi.
- **O'rnatish** — o'zini `%LOCALAPPDATA%\Programs\LevelUpDay Focusgate\` ga ko'chiradi va Windows bilan birga ishga tushadi. Holat: `%APPDATA%\LevelUpDay\Focusgate\state.json`.

## Yig'ish (Linux/macOS/Windows)

```bash
cd focusgate-agent
go test ./...                       # yadro testlari (platformaga bog'liq emas)
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 \
  go build -trimpath -ldflags "-H=windowsgui -s -w" -o dist/Focusgate.exe .
```

Ikonka/versiya resurslari (`rsrc_windows_*.syso`) `go-winres simply --icon assets/icon.png --manifest gui ...` bilan yaratilgan.

Chiqarish: `api.go` dagi `Version` ni oshiring, yig'ing, `dist/Focusgate.exe` ni `downloads/Focusgate.exe` ga ko'chiring va `downloads/version.json` dagi `version` + `sha256` ni yangilang — o'rnatilgan agentlar o'zi yangilanadi.

## Mahalliy aloqa (v0.6.2)
`127.0.0.1:47613–47617/focusgate/id` — brauzer kengaytmasi shu kompyuterdagi Focusgate'ning qurilma ID'sini oladi va
serverga `pc_id` sifatida yuboradi (saytda kengaytma shu kompyuter ichida ko'rinadi). Faqat hozir ekrandagi (faol sessiya)
Windows foydalanuvchisining Focusgate'i javob beradi; `Host` faqat `127.0.0.1` (DNS rebinding'dan himoya).
Saytda qurilma uzilsa (401) — agent qoidalarni tozalaydi va bloklashni to'xtatadi.
