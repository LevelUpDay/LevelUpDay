//go:build !windows && !linux

package main

import "fmt"

// Focusgate agenti Windows va Linux uchun. Boshqa tizimlarda (macOS) hozircha ishlamaydi.
func main() { fmt.Println("LevelUpDay Focusgate faqat Windows va Linux'da ishlaydi.") }
