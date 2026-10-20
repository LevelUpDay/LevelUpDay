// Mahalliy aloqa: brauzer kengaytmasi shu kompyuterdagi Focusgate'ni topadi va o'zini shu kompyuterga bog'laydi.
// Faqat 127.0.0.1 da tinglaydi; bitta kompyuterda bir nechta Windows foydalanuvchisi bo'lsa — faqat hozir ekranda
// (faol sessiyada) ishlayotgan foydalanuvchining Focusgate'i javob beradi, shunda kengaytma to'g'ri qurilmaga ulanadi.
package main

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"time"

	"golang.org/x/sys/windows"
)

// Kengaytma shu portlarni ketma-ket tekshiradi (focusgate-extension/background.js → LOCAL_PORTS)
var localPorts = []int{47613, 47614, 47615, 47616, 47617}

var (
	pWTSGetActiveConsoleSessionId = kernel32.NewProc("WTSGetActiveConsoleSessionId")
)

// activeSession — bu jarayon hozir ekranda turgan (konsol) Windows sessiyasidami
func activeSession() bool {
	act, _, _ := pWTSGetActiveConsoleSessionId.Call()
	var mine uint32
	if err := windows.ProcessIdToSessionId(uint32(os.Getpid()), &mine); err != nil {
		return true
	}
	return uint32(act) == 0xFFFFFFFF || uint32(act) == mine
}

func localServer() {
	mux := http.NewServeMux()
	mux.HandleFunc("/focusgate/id", func(w http.ResponseWriter, r *http.Request) {
		// DNS rebinding'dan himoya: faqat to'g'ridan-to'g'ri 127.0.0.1 so'rovlari
		if host, _, _ := net.SplitHostPort(r.Host); host != "127.0.0.1" {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		st.mu.Lock()
		id, tok := st.DeviceID, st.Token
		st.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		active := activeSession()
		if tok == "" || id == "" || !active {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"app": "focusgate", "id": id, "v": Version})
	})
	srv := &http.Server{Handler: mux, ReadHeaderTimeout: 3 * time.Second, ReadTimeout: 5 * time.Second, WriteTimeout: 5 * time.Second}
	// Boshqa Windows foydalanuvchisining Focusgate'i portni egallagan bo'lishi mumkin — keyingisini olamiz
	for {
		for _, p := range localPorts {
			ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", p))
			if err != nil {
				continue
			}
			_ = srv.Serve(ln) // odatda qaytmaydi
		}
		time.Sleep(time.Minute) // hamma port band — keyinroq qayta urinamiz
	}
}
