package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"unsafe"

	"github.com/jchv/go-webview2"
	"github.com/mumur/driver-booster/internal/bridge"
	"github.com/mumur/driver-booster/internal/drivers"
	"github.com/mumur/driver-booster/internal/sysinfo"
	"github.com/mumur/driver-booster/internal/winupdate"
)

//go:embed ui/*
var uiFS embed.FS

var (
	user32            = syscall.NewLazyDLL("user32.dll")
	procGetWindowLong = user32.NewProc("GetWindowLongW")
	procSetWindowLong = user32.NewProc("SetWindowLongW")
	procSetWindowPos  = user32.NewProc("SetWindowPos")
	procPostMessage   = user32.NewProc("PostMessageW")
	procShowWindow    = user32.NewProc("ShowWindow")
)

const (
	gwlStyle     = -16
	wsCaption    = 0x00C00000
	wsSysMenu    = 0x00080000
	wsThickFrame = 0x00040000
	wsMinBox     = 0x00020000
	wsMaxBox     = 0x00010000
	wsVisible    = 0x10000000
	wsPopup      = 0x80000000

	swpFrameChanged = 0x0020
	swpNoMove       = 0x0002
	swpNoSize       = 0x0001
	swpNoZOrder     = 0x0004

	wmSysCommand = 0x0112
	scMinimize   = 0xF020
	scMaximize   = 0xF030
	scRestore    = 0xF120
	scClose      = 0xF060

	swMaximize = 3
	swRestore  = 9
)

func removeWindowFrame(hwnd uintptr) {
	gwlStyleUintptr := uintptr(0xFFFFFFF0) // GWL_STYLE = -16 as unsigned
	style, _, _ := procGetWindowLong.Call(hwnd, gwlStyleUintptr)
	// Remove caption (title bar) but keep thick frame (resizable) and min/max boxes
	newStyle := (style &^ wsCaption) | wsThickFrame | wsMinBox | wsMaxBox
	procSetWindowLong.Call(hwnd, gwlStyleUintptr, newStyle)
	// Force redraw frame
	procSetWindowPos.Call(hwnd, 0, 0, 0, 0, 0,
		swpFrameChanged|swpNoMove|swpNoSize|swpNoZOrder)
}

func main() {
	// Start embedded HTTP server for UI assets
	uiContent, err := fs.Sub(uiFS, "ui")
	if err != nil {
		log.Fatal("Failed to load UI assets:", err)
	}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		log.Fatal("Failed to start UI server:", err)
	}
	port := listener.Addr().(*net.TCPAddr).Port

	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.FS(uiContent)))

	// API endpoints
	b := bridge.New(
		drivers.NewScanner(),
		winupdate.NewChecker(),
		sysinfo.NewCollector(),
	)
	mux.HandleFunc("/api/sysinfo", b.HandleSysInfo)
	mux.HandleFunc("/api/drivers", b.HandleDrivers)
	mux.HandleFunc("/api/drivers/scan", b.HandleDriverScan)
	mux.HandleFunc("/api/updates", b.HandleUpdates)
	mux.HandleFunc("/api/updates/check", b.HandleUpdateCheck)
	mux.HandleFunc("/api/updates/install", b.HandleUpdateInstall)

	go func() {
		if err := http.Serve(listener, mux); err != nil {
			log.Println("HTTP server error:", err)
		}
	}()

	// Create WebView2 window
	w := webview2.NewWithOptions(webview2.WebViewOptions{
		Debug:     false,
		AutoFocus: true,
		WindowOptions: webview2.WindowOptions{
			Title:  "Driver Booster Pro",
			Width:  1100,
			Height: 720,
			IconId: 2,
			Center: true,
		},
	})
	if w == nil {
		log.Fatal("Failed to create WebView2 window. Make sure WebView2 runtime is installed.")
	}
	defer w.Destroy()

	// Remove native title bar to use our custom one
	hwnd := uintptr(unsafe.Pointer(w.Window()))
	removeWindowFrame(hwnd)

	// Bind window control functions for custom title bar buttons
	w.Bind("windowMinimize", func() {
		procPostMessage.Call(hwnd, wmSysCommand, scMinimize, 0)
	})
	w.Bind("windowMaximize", func() {
		procPostMessage.Call(hwnd, wmSysCommand, scMaximize, 0)
	})
	w.Bind("windowRestore", func() {
		procPostMessage.Call(hwnd, wmSysCommand, scRestore, 0)
	})
	w.Bind("windowClose", func() {
		procPostMessage.Call(hwnd, wmSysCommand, scClose, 0)
	})

	// Bind Go functions to JS
	w.Bind("goGetSysInfo", func() string {
		info := b.SysInfo.Collect()
		data, _ := json.Marshal(info)
		return string(data)
	})
	w.Bind("goScanDrivers", func() string {
		result := b.DriverScanner.Scan()
		data, _ := json.Marshal(result)
		return string(data)
	})
	w.Bind("goCheckUpdates", func() string {
		result := b.UpdateChecker.Check()
		data, _ := json.Marshal(result)
		return string(data)
	})

	w.Navigate(fmt.Sprintf("http://127.0.0.1:%d/index.html", port))
	w.Run()

	// Cleanup
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		w.Destroy()
		os.Exit(0)
	}()
}
