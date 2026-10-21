// Server bilan aloqa: supabase/functions/focusgate (ulash va sinxronlash).
package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	FunctionURL = "https://zzcvpenkevxlurgpjltz.supabase.co/functions/v1/focusgate"
	AppURL      = "https://levelupday.github.io/LevelUpDay/"
	Version     = "0.6.3"
)

var ErrUnauthorized = errors.New("unauthorized")
var ErrExpired = errors.New("expired")

var httpc = &http.Client{Timeout: 20 * time.Second}

func call(body map[string]any, out any) error {
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", FunctionURL, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "LevelUpDay-Focusgate/"+Version)
	res, err := httpc.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	switch res.StatusCode {
	case 401:
		return ErrUnauthorized
	case 410:
		return ErrExpired
	}
	if res.StatusCode >= 300 {
		return fmt.Errorf("server %d: %s", res.StatusCode, string(data))
	}
	return json.Unmarshal(data, out)
}

func PairStart(name string) (string, error) {
	var r struct {
		Code string `json:"code"`
	}
	if err := call(map[string]any{"action": "pair_start", "name": name}, &r); err != nil {
		return "", err
	}
	if r.Code == "" {
		return "", errors.New("no code")
	}
	return r.Code, nil
}

// PairPoll — token tayyor bo'lsa qaytaradi, aks holda "".
func PairPoll(code string) (string, error) {
	var r struct {
		Token   string `json:"token"`
		Pending bool   `json:"pending"`
	}
	if err := call(map[string]any{"action": "pair_poll", "code": code}, &r); err != nil {
		return "", err
	}
	return r.Token, nil
}

type SyncResult struct {
	Config Config `json:"config"`
	Device struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"device"`
	Now int64 `json:"now"`
}

// Sync — apps nil bo'lmasa, o'rnatilgan dasturlar ro'yxati ham yuboriladi.
func Sync(token, name string, resetSeen int64, rows []UsageRow, apps []InstalledApp, events []Event) (*SyncResult, error) {
	if rows == nil {
		rows = []UsageRow{}
	}
	body := map[string]any{"action": "sync", "token": token, "version": Version, "usage": rows, "name": name, "reset_seen": resetSeen}
	if apps != nil {
		body["apps"] = apps
	}
	if len(events) > 0 {
		body["events"] = events
	}
	var r SyncResult
	if err := call(body, &r); err != nil {
		return nil, err
	}
	return &r, nil
}

func PairURL(code string) string { return AppURL + "#fgpair=" + code }

// ---------- Avtoyangilanish: downloads/version.json ----------
type updateInfo struct {
	Version string `json:"version"`
	SHA256  string `json:"sha256"`
	URL     string `json:"url"`
}

func newer(a, b string) bool { // a > b ?
	pa, pb := strings.Split(a, "."), strings.Split(b, ".")
	for i := 0; i < 3; i++ {
		var x, y int
		if i < len(pa) {
			x, _ = strconv.Atoi(pa[i])
		}
		if i < len(pb) {
			y, _ = strconv.Atoi(pb[i])
		}
		if x != y {
			return x > y
		}
	}
	return false
}
