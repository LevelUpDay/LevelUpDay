//go:build windows

// Dastur ikonkasini exe ichidan olib, 32×32 PNG (data URL) ga aylantiradi — saytda harf o'rniga haqiqiy ikonka.
package main

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/png"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	gdi32                 = windows.NewLazySystemDLL("gdi32.dll")
	pPrivateExtractIconsW = user32.NewProc("PrivateExtractIconsW")
	pGetIconInfo          = user32.NewProc("GetIconInfo")
	pDestroyIcon          = user32.NewProc("DestroyIcon")
	pGetDC                = user32.NewProc("GetDC")
	pReleaseDC            = user32.NewProc("ReleaseDC")
	pGetDIBits            = gdi32.NewProc("GetDIBits")
	pDeleteObject         = gdi32.NewProc("DeleteObject")
)

type iconInfo struct {
	fIcon              int32
	xHotspot, yHotspot uint32
	hbmMask, hbmColor  uintptr
}

type bitmapInfo struct {
	Size                         uint32
	Width, Height                int32
	Planes, BitCount             uint16
	Compression, SizeImage       uint32
	XPelsPerMeter, YPelsPerMeter int32
	ClrUsed, ClrImportant        uint32
	Colors                       [2]uint32
}

func dib(hdc, hbm uintptr, size int) []byte {
	bi := bitmapInfo{Size: 40, Width: int32(size), Height: -int32(size), Planes: 1, BitCount: 32}
	buf := make([]byte, size*size*4)
	if r, _, _ := pGetDIBits.Call(hdc, hbm, 0, uintptr(size), uintptr(unsafe.Pointer(&buf[0])), uintptr(unsafe.Pointer(&bi)), 0); r == 0 {
		return nil
	}
	return buf
}

var iconCache = map[string]string{}

// IconPNG — exe faylning birinchi ikonkasi (bo'lmasa "").
func IconPNG(path string) string {
	if path == "" {
		return ""
	}
	if v, ok := iconCache[path]; ok {
		return v
	}
	out := ""
	defer func() { iconCache[path] = out }()
	const size = 32
	p, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return ""
	}
	var hicon uintptr
	var id uint32
	n, _, _ := pPrivateExtractIconsW.Call(uintptr(unsafe.Pointer(p)), 0, size, size, uintptr(unsafe.Pointer(&hicon)), uintptr(unsafe.Pointer(&id)), 1, 0)
	if n == 0 || n == 0xFFFFFFFF || hicon == 0 {
		return ""
	}
	defer pDestroyIcon.Call(hicon)
	var ii iconInfo
	if r, _, _ := pGetIconInfo.Call(hicon, uintptr(unsafe.Pointer(&ii))); r == 0 {
		return ""
	}
	if ii.hbmMask != 0 {
		defer pDeleteObject.Call(ii.hbmMask)
	}
	if ii.hbmColor == 0 {
		return ""
	}
	defer pDeleteObject.Call(ii.hbmColor)
	hdc, _, _ := pGetDC.Call(0)
	defer pReleaseDC.Call(0, hdc)
	px := dib(hdc, ii.hbmColor, size)
	if px == nil {
		return ""
	}
	hasAlpha := false
	for i := 0; i < size*size; i++ {
		if px[i*4+3] != 0 {
			hasAlpha = true
			break
		}
	}
	var mask []byte
	if !hasAlpha && ii.hbmMask != 0 {
		mask = dib(hdc, ii.hbmMask, size)
	}
	img := image.NewNRGBA(image.Rect(0, 0, size, size))
	visible := 0
	for i := 0; i < size*size; i++ {
		b, g, r, a := px[i*4], px[i*4+1], px[i*4+2], px[i*4+3]
		if !hasAlpha {
			a = 255
			if mask != nil && mask[i*4] != 0 {
				a = 0
			}
		}
		if a > 20 {
			visible++
		}
		img.Pix[i*4], img.Pix[i*4+1], img.Pix[i*4+2], img.Pix[i*4+3] = r, g, b, a
	}
	if visible < 20 { // bo'sh ikonka
		return ""
	}
	var buf bytes.Buffer
	if png.Encode(&buf, img) != nil {
		return ""
	}
	out = "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())
	return out
}
