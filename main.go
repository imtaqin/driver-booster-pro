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

	"github.com/jchv/go-webview2"
	"github.com/mumur/driver-booster/internal/bridge"
	"github.com/mumur/driver-booster/internal/drivers"
	"github.com/mumur/driver-booster/internal/sysinfo"
	"github.com/mumur/driver-booster/internal/winupdate"
)

//go:embed ui/*
var uiFS embed.FS

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
