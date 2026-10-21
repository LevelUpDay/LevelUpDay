#!/bin/sh
# LevelUpDay Focusgate — Linux o'rnatuvchisi / installer
#   curl -fsSL https://levelupday.github.io/LevelUpDay/downloads/install-linux.sh | sh
# Faylni yuklab oladi, sha256 ni tekshiradi va ishga tushiradi. Focusgate o'zini
# ~/.local/share/levelupday-focusgate ga o'rnatadi va avtoishga tushirishni yoqadi (root kerak emas).
set -eu

BASE="${FOCUSGATE_BASE:-https://levelupday.github.io/LevelUpDay/downloads}"

case "$(uname -m)" in
  x86_64 | amd64) ARCH=amd64 ;;
  aarch64 | arm64) ARCH=arm64 ;;
  *) echo "Focusgate: bu protsessor turi qo'llab-quvvatlanmaydi / unsupported CPU: $(uname -m)" >&2; exit 1 ;;
esac
FILE="focusgate-linux-$ARCH"

if [ "$(id -u)" = "0" ]; then
  echo "Focusgate: sudo'siz, oddiy foydalanuvchi sifatida ishga tushiring / run it as your normal user, not root." >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

get() {
  if command -v curl >/dev/null 2>&1; then curl -fsSL "$1" -o "$2"
  elif command -v wget >/dev/null 2>&1; then wget -q "$1" -O "$2"
  else echo "Focusgate: curl yoki wget kerak / curl or wget is required" >&2; exit 1
  fi
}

echo "⬇  Focusgate ($ARCH) yuklanmoqda / downloading…"
get "$BASE/$FILE?t=$(date +%s)" "$TMP/$FILE"
get "$BASE/$FILE.sha256?t=$(date +%s)" "$TMP/$FILE.sha256"

WANT="$(cut -d' ' -f1 < "$TMP/$FILE.sha256")"
if command -v sha256sum >/dev/null 2>&1; then HAVE="$(sha256sum "$TMP/$FILE" | cut -d' ' -f1)"
else HAVE="$(shasum -a 256 "$TMP/$FILE" | cut -d' ' -f1)"
fi
if [ "$WANT" != "$HAVE" ]; then
  echo "Focusgate: fayl buzilgan (sha256 mos emas) / checksum mismatch" >&2
  exit 1
fi

chmod +x "$TMP/$FILE"
# O'zini o'rnatadi, eski nusxani to'xtatadi va o'rnatilgan nusxani fon rejimida ishga tushiradi
"$TMP/$FILE"
sleep 1
echo "✅ Focusgate o'rnatildi / installed. Brauzerda \"Ulash / Connect\" ni bosing."
echo "   Tray (panel)dagi 🛡 belgisi orqali boshqariladi. O'chirish: menyuda LevelUpDay → \"Focusgate'ni o'chirish\""
