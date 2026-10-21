// Linux: o'rnatilgan dasturlar (.desktop fayllari: tizim, foydalanuvchi, Snap, Flatpak), ikonkalar, avtoyangilanish.
package main

import (
	"bufio"
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"image"
	"image/png"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"time"
)

type desktopApp struct {
	id, name, icon, cat string
}

func appDirs() []string {
	home, _ := os.UserHomeDir()
	dirs := []string{filepath.Join(home, ".local/share/applications")}
	for _, d := range strings.Split(os.Getenv("XDG_DATA_DIRS"), ":") {
		if d != "" {
			dirs = append(dirs, filepath.Join(d, "applications"))
		}
	}
	return append(dirs, "/usr/local/share/applications", "/usr/share/applications", "/var/lib/snapd/desktop/applications",
		"/var/lib/flatpak/exports/share/applications", filepath.Join(home, ".local/share/flatpak/exports/share/applications"))
}

// execID — Exec= qatoridan dastur kaliti: "env X=1 /usr/bin/google-chrome-stable %U" → chrome.exe,
// "flatpak run org.telegram.desktop" → telegram.exe, "/snap/bin/spotify" → spotify.exe
func execID(execLine, file string) string {
	f := strings.Fields(execLine)
	for len(f) > 0 && (f[0] == "env" || strings.Contains(f[0], "=")) {
		f = f[1:]
	}
	if len(f) == 0 {
		return ""
	}
	bin := filepath.Base(strings.Trim(f[0], `"'`))
	if bin == "flatpak" {
		for i := len(f) - 1; i > 0; i-- {
			if a := f[i]; !strings.HasPrefix(a, "-") && !strings.HasPrefix(a, "%") && strings.Count(a, ".") >= 2 {
				return linuxID(a)
			}
		}
		return linuxID(strings.TrimSuffix(filepath.Base(file), ".desktop"))
	}
	if bin == "snap" && len(f) > 2 && f[1] == "run" {
		bin = f[2]
	}
	if bin == "gtk-launch" || bin == "sh" || bin == "bash" {
		return ""
	}
	return linuxID(bin)
}

// catOfDesktop — .desktop Categories → Focusgate kategoriyasi
func catOfDesktop(c string) string {
	c = ";" + c + ";"
	switch {
	case strings.Contains(c, ";Game;"):
		return "games"
	case strings.Contains(c, ";WebBrowser;"):
		return "web"
	case strings.Contains(c, ";InstantMessaging;") || strings.Contains(c, ";Chat;"):
		return "social"
	case strings.Contains(c, ";Education;"):
		return "study"
	case strings.Contains(c, ";AudioVideo;") || strings.Contains(c, ";Video;") || strings.Contains(c, ";Audio;"):
		return "fun"
	case strings.Contains(c, ";Office;") || strings.Contains(c, ";Development;") || strings.Contains(c, ";Graphics;"):
		return "work"
	}
	return ""
}

// desktopEntries — menyuda ko'rinadigan barcha dasturlar (birinchi topilgani saqlanadi: foydalanuvchiniki ustun).
func desktopEntries() []desktopApp {
	seen := map[string]bool{}
	var out []desktopApp
	lang := Lang()
	for _, dir := range appDirs() {
		files, _ := filepath.Glob(filepath.Join(dir, "*.desktop"))
		for _, file := range files {
			b, err := os.ReadFile(file)
			if err != nil || len(b) > 1<<18 {
				continue
			}
			var name, locName, ex, icon, cats string
			typ, hidden, inEntry := "", false, false
			sc := bufio.NewScanner(bytes.NewReader(b))
			for sc.Scan() {
				l := strings.TrimSpace(sc.Text())
				if strings.HasPrefix(l, "[") {
					inEntry = l == "[Desktop Entry]"
					continue
				}
				if !inEntry {
					continue
				}
				k, v, ok := strings.Cut(l, "=")
				if !ok {
					continue
				}
				switch strings.TrimSpace(k) {
				case "Name":
					name = v
				case "Name[" + lang + "]":
					locName = v
				case "Exec":
					ex = v
				case "Icon":
					icon = v
				case "Categories":
					cats = v
				case "Type":
					typ = v
				case "NoDisplay", "Hidden":
					hidden = hidden || strings.EqualFold(v, "true")
				}
			}
			if typ != "Application" || hidden || ex == "" {
				continue
			}
			id := execID(ex, file)
			if id == "" || seen[id] || Protected[id] || sysExe[id] || junk.MatchString(id) || strings.HasPrefix(id, "focusgate") {
				continue
			}
			if locName != "" {
				name = locName
			}
			if name == "" || junkName.MatchString(name) {
				continue
			}
			seen[id] = true
			out = append(out, desktopApp{id: id, name: name, icon: icon, cat: catOfDesktop(cats)})
		}
	}
	return out
}

// iconFile — ikonka nomi → PNG fayl (hicolor mavzusi, pixmaps, Flatpak eksporti).
func iconFile(name string) string {
	if name == "" {
		return ""
	}
	if filepath.IsAbs(name) {
		if strings.HasSuffix(strings.ToLower(name), ".png") {
			return name
		}
		return ""
	}
	home, _ := os.UserHomeDir()
	bases := []string{filepath.Join(home, ".local/share/icons"), "/usr/share/icons", "/var/lib/flatpak/exports/share/icons",
		filepath.Join(home, ".local/share/flatpak/exports/share/icons"), "/var/lib/snapd/desktop/icons"}
	for _, sz := range []string{"48x48", "64x64", "32x32", "128x128", "96x96", "256x256"} {
		for _, b := range bases {
			for _, theme := range []string{"hicolor", "Adwaita", "breeze", "Papirus"} {
				p := filepath.Join(b, theme, sz, "apps", name+".png")
				if _, err := os.Stat(p); err == nil {
					return p
				}
			}
		}
	}
	for _, p := range []string{filepath.Join("/usr/share/pixmaps", name+".png"), filepath.Join("/var/lib/snapd/desktop/icons", name+".png")} {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	if m, _ := filepath.Glob(filepath.Join("/var/lib/snapd/desktop/icons", "*"+name+"*.png")); len(m) > 0 {
		return m[0]
	}
	return ""
}

// iconPNG — PNG faylni 32×32 ga kichraytirib data URL qiladi (Windows'dagi ikonkalar bilan bir xil o'lcham).
func iconPNG(path string) string {
	if path == "" {
		return ""
	}
	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer f.Close()
	src, err := png.Decode(io.LimitReader(f, 2<<20))
	if err != nil {
		return ""
	}
	const n = 32
	dst := image.NewNRGBA(image.Rect(0, 0, n, n))
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	if w == 0 || h == 0 {
		return ""
	}
	for y := 0; y < n; y++ {
		for x := 0; x < n; x++ {
			// Qutili o'rtacha (box filter) — kichraytirishda tishli bo'lmasin
			x0, x1 := b.Min.X+x*w/n, b.Min.X+(x+1)*w/n
			y0, y1 := b.Min.Y+y*h/n, b.Min.Y+(y+1)*h/n
			if x1 <= x0 {
				x1 = x0 + 1
			}
			if y1 <= y0 {
				y1 = y0 + 1
			}
			var r, g, bl, a, c uint64
			for yy := y0; yy < y1; yy++ {
				for xx := x0; xx < x1; xx++ {
					cr, cg, cb, ca := src.At(xx, yy).RGBA()
					r, g, bl, a, c = r+uint64(cr), g+uint64(cg), bl+uint64(cb), a+uint64(ca), c+1
				}
			}
			i := dst.PixOffset(x, y)
			if a == 0 {
				continue
			}
			// premultiplied → oddiy rang
			dst.Pix[i+0] = uint8(r * 255 / a)
			dst.Pix[i+1] = uint8(g * 255 / a)
			dst.Pix[i+2] = uint8(bl * 255 / a)
			dst.Pix[i+3] = uint8(a / c >> 8)
		}
	}
	var buf bytes.Buffer
	if png.Encode(&buf, dst) != nil {
		return ""
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())
}

// ScanApps — kompyuterdagi dasturlar (menyudagilar + hozir ishlab turgan oynali dasturlar).
func ScanApps() []InstalledApp {
	var list []InstalledApp
	cats := map[string]string{}
	have := map[string]bool{}
	for _, d := range desktopEntries() {
		cat := AutoCat(d.id, "")
		if cat == "other" && d.cat != "" {
			cat = d.cat
		}
		list = append(list, InstalledApp{Exe: d.id, Name: d.name, Cat: cat, Icon: iconPNG(iconFile(d.icon))})
		cats[d.id] = cat
		have[d.id] = true
	}
	// Menyuda yo'q, lekin hozir faol oynasi bo'lgan dastur (AppImage, portativ)
	if fg, ok := GetForeground(); ok && !have[fg.Exe] && !Protected[fg.Exe] && !noTrack[fg.Exe] && !strings.HasPrefix(fg.Exe, "focusgate") {
		list = append(list, InstalledApp{Exe: fg.Exe, Name: prettyExe(fg.Exe), Cat: AutoCat(fg.Exe, fg.Path)})
	}
	sort.Slice(list, func(i, j int) bool { return strings.ToLower(list[i].Name) < strings.ToLower(list[j].Name) })
	st.mu.Lock()
	st.AppCats = cats
	st.mu.Unlock()
	return list
}

// ---------- O'rnatish joyi va avtoyangilanish ----------
func installedPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, ".local", "share", "levelupday-focusgate", "focusgate")
}

func installDir() string { return filepath.Dir(installedPath()) }

// linuxBinName — version.json dagi Linux fayli (arxitekturaga qarab)
func linuxBinName() string {
	if runtime.GOARCH == "arm64" {
		return "focusgate-linux-arm64"
	}
	return "focusgate-linux-amd64"
}

// CheckUpdate — yangi versiya bo'lsa yuklab oladi, sha256 ni tekshiradi, o'zini almashtiradi va qayta ishga tushadi.
func CheckUpdate() bool {
	if filepath.Clean(exePath) != filepath.Clean(installedPath()) {
		return false // faqat o'rnatilgan nusxa yangilanadi
	}
	c := &http.Client{Timeout: 60 * time.Second}
	res, err := c.Get(AppURL + "downloads/version.json?t=" + strconv.FormatInt(time.Now().Unix(), 10))
	if err != nil {
		return false
	}
	var u struct {
		Linux map[string]struct {
			Version string `json:"version"`
			SHA256  string `json:"sha256"`
			URL     string `json:"url"`
		} `json:"linux"`
	}
	err = json.NewDecoder(io.LimitReader(res.Body, 1<<16)).Decode(&u)
	res.Body.Close()
	info, ok := u.Linux[runtime.GOARCH]
	if err != nil || !ok || !newer(info.Version, Version) || len(info.SHA256) != 64 {
		return false
	}
	url := info.URL
	if url == "" {
		url = AppURL + "downloads/" + linuxBinName()
	}
	res, err = c.Get(url + "?v=" + info.Version)
	if err != nil {
		return false
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return false
	}
	tmp := exePath + ".new"
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o755)
	if err != nil {
		return false
	}
	h := sha256.New()
	_, err = io.Copy(io.MultiWriter(f, h), io.LimitReader(res.Body, 64<<20))
	f.Close()
	if err != nil || !strings.EqualFold(hex.EncodeToString(h.Sum(nil)), info.SHA256) {
		_ = os.Remove(tmp)
		return false
	}
	// Linux'da ishlab turgan faylni ustidan nomlash mumkin (eski jarayon eski inode'da ishlayveradi)
	if os.Rename(tmp, exePath) != nil {
		_ = os.Remove(tmp)
		return false
	}
	_ = st.Save()
	if lockFile != nil {
		lockFile.Close() // yangi nusxa qulfni olsin
	}
	if exec.Command(exePath, "--background", "--updated").Start() != nil {
		return false
	}
	return true
}

func cleanupOld() {
	_ = os.Remove(installedPath() + ".new")
	_ = os.Remove(exePath + ".new")
}
