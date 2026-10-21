// Mahalliy aloqa: brauzer kengaytmasi shu kompyuterdagi Focusgate'ni topadi va o'zini shu kompyuterga bog'laydi.
// Faqat 127.0.0.1 da tinglaydi; bitta kompyuterda bir nechta Windows foydalanuvchisi bo'lsa — faqat hozir ekranda
// (faol sessiyada) ishlayotgan foydalanuvchining Focusgate'i javob beradi, shunda kengaytma to'g'ri qurilmaga ulanadi.
package main

import (
	"os"

	"golang.org/x/sys/windows"
)

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
