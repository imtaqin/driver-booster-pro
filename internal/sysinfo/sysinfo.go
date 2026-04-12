package sysinfo

import (
	"fmt"
	"runtime"
	"strings"
	"syscall"
	"unsafe"

	"github.com/mumur/driver-booster/internal/cmdutil"
)

var (
	kernel32              = syscall.NewLazyDLL("kernel32.dll")
	procGlobalMemoryEx    = kernel32.NewProc("GlobalMemoryStatusEx")
	procGetDiskFreeSpaceA = kernel32.NewProc("GetDiskFreeSpaceExA")
	procGetComputerNameW  = kernel32.NewProc("GetComputerNameW")

	ntdll                = syscall.NewLazyDLL("ntdll.dll")
	procRtlGetVersion    = ntdll.NewProc("RtlGetVersion")
)

type Info struct {
	ComputerName string `json:"computerName"`
	OSName       string `json:"osName"`
	OSVersion    string `json:"osVersion"`
	OSBuild      string `json:"osBuild"`
	Architecture string `json:"architecture"`
	CPUName      string `json:"cpuName"`
	CPUCores     int    `json:"cpuCores"`
	TotalRAM     string `json:"totalRam"`
	UsedRAM      string `json:"usedRam"`
	FreeRAM      string `json:"freeRam"`
	RAMPercent   int    `json:"ramPercent"`
	DiskTotal    string `json:"diskTotal"`
	DiskFree     string `json:"diskFree"`
	DiskUsed     string `json:"diskUsed"`
	DiskPercent  int    `json:"diskPercent"`
}

type memoryStatusEx struct {
	Length               uint32
	MemoryLoad           uint32
	TotalPhys            uint64
	AvailPhys            uint64
	TotalPageFile        uint64
	AvailPageFile        uint64
	TotalVirtual         uint64
	AvailVirtual         uint64
	AvailExtendedVirtual uint64
}

type osVersionInfoExW struct {
	OSVersionInfoSize uint32
	MajorVersion      uint32
	MinorVersion      uint32
	BuildNumber       uint32
	PlatformId        uint32
	CSDVersion        [128]uint16
}

type Collector struct{}

func NewCollector() *Collector {
	return &Collector{}
}

func (c *Collector) Collect() Info {
	info := Info{
		Architecture: runtime.GOARCH,
		CPUCores:     runtime.NumCPU(),
	}

	info.ComputerName = getComputerName()
	info.CPUName = getCPUName()

	// OS version via RtlGetVersion (accurate, not subject to compatibility shims)
	var osvi osVersionInfoExW
	osvi.OSVersionInfoSize = uint32(unsafe.Sizeof(osvi))
	procRtlGetVersion.Call(uintptr(unsafe.Pointer(&osvi)))
	info.OSVersion = fmt.Sprintf("%d.%d", osvi.MajorVersion, osvi.MinorVersion)
	info.OSBuild = fmt.Sprintf("%d", osvi.BuildNumber)
	info.OSName = getWindowsProductName()

	// Memory
	var mem memoryStatusEx
	mem.Length = uint32(unsafe.Sizeof(mem))
	procGlobalMemoryEx.Call(uintptr(unsafe.Pointer(&mem)))
	info.TotalRAM = formatBytes(mem.TotalPhys)
	info.FreeRAM = formatBytes(mem.AvailPhys)
	info.UsedRAM = formatBytes(mem.TotalPhys - mem.AvailPhys)
	info.RAMPercent = int(mem.MemoryLoad)

	// Disk (C: drive)
	var freeBytesAvailable, totalBytes, totalFreeBytes uint64
	cDrive, _ := syscall.BytePtrFromString("C:\\")
	procGetDiskFreeSpaceA.Call(
		uintptr(unsafe.Pointer(cDrive)),
		uintptr(unsafe.Pointer(&freeBytesAvailable)),
		uintptr(unsafe.Pointer(&totalBytes)),
		uintptr(unsafe.Pointer(&totalFreeBytes)),
	)
	info.DiskTotal = formatBytes(totalBytes)
	info.DiskFree = formatBytes(totalFreeBytes)
	info.DiskUsed = formatBytes(totalBytes - totalFreeBytes)
	if totalBytes > 0 {
		info.DiskPercent = int(((totalBytes - totalFreeBytes) * 100) / totalBytes)
	}

	return info
}

func getComputerName() string {
	var size uint32 = 256
	buf := make([]uint16, size)
	procGetComputerNameW.Call(uintptr(unsafe.Pointer(&buf[0])), uintptr(unsafe.Pointer(&size)))
	return syscall.UTF16ToString(buf[:size])
}

func getCPUName() string {
	out, err := cmdutil.HiddenCommand("powershell", "-NoProfile", "-Command",
		"(Get-CimInstance Win32_Processor).Name").Output()
	if err != nil {
		return "Unknown CPU"
	}
	return strings.TrimSpace(string(out))
}

func getWindowsProductName() string {
	out, err := cmdutil.HiddenCommand("powershell", "-NoProfile", "-Command",
		"(Get-CimInstance Win32_OperatingSystem).Caption").Output()
	if err != nil {
		return "Windows"
	}
	return strings.TrimSpace(string(out))
}

func formatBytes(b uint64) string {
	const (
		KB = 1024
		MB = KB * 1024
		GB = MB * 1024
		TB = GB * 1024
	)
	switch {
	case b >= TB:
		return fmt.Sprintf("%.1f TB", float64(b)/float64(TB))
	case b >= GB:
		return fmt.Sprintf("%.1f GB", float64(b)/float64(GB))
	case b >= MB:
		return fmt.Sprintf("%.1f MB", float64(b)/float64(MB))
	case b >= KB:
		return fmt.Sprintf("%.1f KB", float64(b)/float64(KB))
	default:
		return fmt.Sprintf("%d B", b)
	}
}
