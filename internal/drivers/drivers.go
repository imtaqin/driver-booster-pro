package drivers

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/mumur/driver-booster/internal/cmdutil"
)

type Driver struct {
	DeviceName    string `json:"deviceName"`
	DeviceClass   string `json:"deviceClass"`
	Manufacturer  string `json:"manufacturer"`
	DriverVersion string `json:"driverVersion"`
	DriverDate    string `json:"driverDate"`
	Status        string `json:"status"`
	InfName       string `json:"infName"`
	IsSigned      bool   `json:"isSigned"`
	NeedsUpdate   bool   `json:"needsUpdate"`
}

type ScanResult struct {
	Drivers      []Driver  `json:"drivers"`
	TotalCount   int       `json:"totalCount"`
	OutdatedCount int      `json:"outdatedCount"`
	ErrorCount   int       `json:"errorCount"`
	ScanTime     string    `json:"scanTime"`
	ScannedAt    time.Time `json:"scannedAt"`
}

type Scanner struct{}

func NewScanner() *Scanner {
	return &Scanner{}
}

func (s *Scanner) Scan() ScanResult {
	start := time.Now()
	result := ScanResult{
		Drivers: []Driver{},
	}

	drivers := s.enumDriversPnP()
	result.Drivers = drivers
	result.TotalCount = len(drivers)

	for _, d := range drivers {
		if d.NeedsUpdate {
			result.OutdatedCount++
		}
		if d.Status == "Error" || d.Status == "Degraded" {
			result.ErrorCount++
		}
	}

	result.ScanTime = time.Since(start).Round(time.Millisecond).String()
	result.ScannedAt = time.Now()
	return result
}

func (s *Scanner) enumDriversPnP() []Driver {
	// Use PowerShell to enumerate PnP signed drivers via WMI
	psScript := `
Get-CimInstance Win32_PnPSignedDriver | Where-Object { $_.DeviceName -ne $null } | Select-Object -First 100 DeviceName, DeviceClass, Manufacturer, DriverVersion, DriverDate, InfName, IsSigned, Status | ConvertTo-Json -Compress
`
	out, err := cmdutil.HiddenCommand("powershell", "-NoProfile", "-Command", psScript).Output()
	if err != nil {
		return []Driver{}
	}

	var raw []struct {
		DeviceName    string  `json:"DeviceName"`
		DeviceClass   string  `json:"DeviceClass"`
		Manufacturer  string  `json:"Manufacturer"`
		DriverVersion string  `json:"DriverVersion"`
		DriverDate    string  `json:"DriverDate"`
		InfName       string  `json:"InfName"`
		IsSigned      bool    `json:"IsSigned"`
		Status        string  `json:"Status"`
	}

	if err := json.Unmarshal(out, &raw); err != nil {
		// Try as single object (when only 1 result)
		var single struct {
			DeviceName    string `json:"DeviceName"`
			DeviceClass   string `json:"DeviceClass"`
			Manufacturer  string `json:"Manufacturer"`
			DriverVersion string `json:"DriverVersion"`
			DriverDate    string `json:"DriverDate"`
			InfName       string `json:"InfName"`
			IsSigned      bool   `json:"IsSigned"`
			Status        string `json:"Status"`
		}
		if err := json.Unmarshal(out, &single); err != nil {
			return []Driver{}
		}
		raw = append(raw, single)
	}

	drivers := make([]Driver, 0, len(raw))
	for _, r := range raw {
		d := Driver{
			DeviceName:    r.DeviceName,
			DeviceClass:   normalizeClass(r.DeviceClass),
			Manufacturer:  r.Manufacturer,
			DriverVersion: r.DriverVersion,
			DriverDate:    formatDriverDate(r.DriverDate),
			InfName:       r.InfName,
			IsSigned:      r.IsSigned,
			Status:        r.Status,
		}
		d.NeedsUpdate = checkIfOutdated(r.DriverDate)
		drivers = append(drivers, d)
	}

	return drivers
}

func normalizeClass(class string) string {
	if class == "" {
		return "Other"
	}
	return class
}

func formatDriverDate(date string) string {
	if date == "" {
		return "Unknown"
	}
	// WMI returns dates like "20230115000000.000000-000" or "/Date(1234567890000)/"
	if strings.Contains(date, "/Date(") {
		return date // Will be parsed on frontend
	}
	if len(date) >= 8 {
		return date[:4] + "-" + date[4:6] + "-" + date[6:8]
	}
	return date
}

func checkIfOutdated(dateStr string) bool {
	if dateStr == "" {
		return false
	}
	// Consider drivers older than 2 years as potentially outdated
	if len(dateStr) >= 8 {
		t, err := time.Parse("20060102", dateStr[:8])
		if err != nil {
			return false
		}
		return time.Since(t) > 2*365*24*time.Hour
	}
	return false
}
