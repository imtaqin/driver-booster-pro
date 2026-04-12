package bridge

import (
	"encoding/json"
	"net/http"

	"github.com/mumur/driver-booster/internal/drivers"
	"github.com/mumur/driver-booster/internal/sysinfo"
	"github.com/mumur/driver-booster/internal/winupdate"
)

type Bridge struct {
	DriverScanner *drivers.Scanner
	UpdateChecker *winupdate.Checker
	SysInfo       *sysinfo.Collector
}

func New(ds *drivers.Scanner, uc *winupdate.Checker, si *sysinfo.Collector) *Bridge {
	return &Bridge{
		DriverScanner: ds,
		UpdateChecker: uc,
		SysInfo:       si,
	}
}

func jsonResponse(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func (b *Bridge) HandleSysInfo(w http.ResponseWriter, r *http.Request) {
	info := b.SysInfo.Collect()
	jsonResponse(w, info)
}

func (b *Bridge) HandleDrivers(w http.ResponseWriter, r *http.Request) {
	result := b.DriverScanner.Scan()
	jsonResponse(w, result)
}

func (b *Bridge) HandleDriverScan(w http.ResponseWriter, r *http.Request) {
	result := b.DriverScanner.Scan()
	jsonResponse(w, result)
}

func (b *Bridge) HandleUpdates(w http.ResponseWriter, r *http.Request) {
	result := b.UpdateChecker.Check()
	jsonResponse(w, result)
}

func (b *Bridge) HandleUpdateCheck(w http.ResponseWriter, r *http.Request) {
	result := b.UpdateChecker.Check()
	jsonResponse(w, result)
}

func (b *Bridge) HandleUpdateInstall(w http.ResponseWriter, r *http.Request) {
	result := b.UpdateChecker.Install(nil)
	jsonResponse(w, result)
}
