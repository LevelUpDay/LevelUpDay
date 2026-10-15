// O'rnatilgan LevelUpDay ilovasi (Chrome/Edge PWA) identifikatori: Chromium uni manifest "id" (to'liq URL)
// ning SHA-256 xeshidan oladi — dastlabki 16 bayt, har bir 16-lik raqam 'a'..'p' harfiga (crx_file::id_util::GenerateId).
package main

import "crypto/sha256"

// ManifestID — manifest.json: "id": "./" → start_url bo'yicha to'liq manzil.
const ManifestID = AppURL

func ChromeAppID(manifestID string) string {
	h := sha256.Sum256([]byte(manifestID))
	b := make([]byte, 32)
	for i := 0; i < 16; i++ {
		b[2*i] = 'a' + h[i]>>4
		b[2*i+1] = 'a' + h[i]&15
	}
	return string(b)
}
