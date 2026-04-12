package winupdate

import (
	"encoding/json"
	"time"

	"github.com/mumur/driver-booster/internal/cmdutil"
)

type Update struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	KBArticle   string `json:"kbArticle"`
	Category    string `json:"category"`
	Size        string `json:"size"`
	IsInstalled bool   `json:"isInstalled"`
	IsDownloaded bool  `json:"isDownloaded"`
	IsMandatory bool   `json:"isMandatory"`
	Severity    string `json:"severity"`
}

type CheckResult struct {
	Updates        []Update  `json:"updates"`
	PendingCount   int       `json:"pendingCount"`
	InstalledCount int       `json:"installedCount"`
	CheckTime      string    `json:"checkTime"`
	CheckedAt      time.Time `json:"checkedAt"`
	Error          string    `json:"error,omitempty"`
}

type InstallResult struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type Checker struct{}

func NewChecker() *Checker {
	return &Checker{}
}

func (c *Checker) Check() CheckResult {
	start := time.Now()
	result := CheckResult{
		Updates: []Update{},
	}

	// Use PowerShell COM object for Windows Update Agent
	psScript := `
$ErrorActionPreference = 'SilentlyContinue'
$Session = New-Object -ComObject Microsoft.Update.Session
$Searcher = $Session.CreateUpdateSearcher()

# Get installed update history (recent 50)
$HistoryCount = $Searcher.GetTotalHistoryCount()
$History = $Searcher.QueryHistory(0, [Math]::Min($HistoryCount, 50))

$installed = @()
foreach ($entry in $History) {
    if ($entry.Title) {
        $installed += @{
            Title = $entry.Title
            Description = $entry.Description
            Date = $entry.Date.ToString("yyyy-MM-dd")
            ResultCode = $entry.ResultCode
        }
    }
}

# Search for pending updates
try {
    $SearchResult = $Searcher.Search("IsInstalled=0")
    $pending = @()
    foreach ($update in $SearchResult.Updates) {
        $kb = ""
        if ($update.KBArticleIDs.Count -gt 0) { $kb = "KB" + $update.KBArticleIDs.Item(0) }
        $cat = ""
        if ($update.Categories.Count -gt 0) { $cat = $update.Categories.Item(0).Name }
        $sev = if ($update.MsrcSeverity) { $update.MsrcSeverity } else { "Unspecified" }
        $sz = ""
        if ($update.MaxDownloadSize -gt 0) {
            $mb = [Math]::Round($update.MaxDownloadSize / 1MB, 1)
            $sz = "$mb MB"
        }
        $pending += @{
            Title = $update.Title
            Description = $update.Description
            KBArticle = $kb
            Category = $cat
            Size = $sz
            IsDownloaded = $update.IsDownloaded
            IsMandatory = $update.IsMandatory
            Severity = $sev
        }
    }
} catch {
    $pending = @()
}

@{
    Installed = $installed
    Pending = $pending
} | ConvertTo-Json -Depth 3 -Compress
`
	out, err := cmdutil.HiddenCommand("powershell", "-NoProfile", "-Command", psScript).Output()
	if err != nil {
		result.Error = "Failed to check updates: " + err.Error()
		result.CheckTime = time.Since(start).Round(time.Millisecond).String()
		result.CheckedAt = time.Now()
		return result
	}

	var raw struct {
		Installed []struct {
			Title       string `json:"Title"`
			Description string `json:"Description"`
			Date        string `json:"Date"`
			ResultCode  int    `json:"ResultCode"`
		} `json:"Installed"`
		Pending []struct {
			Title        string `json:"Title"`
			Description  string `json:"Description"`
			KBArticle    string `json:"KBArticle"`
			Category     string `json:"Category"`
			Size         string `json:"Size"`
			IsDownloaded bool   `json:"IsDownloaded"`
			IsMandatory  bool   `json:"IsMandatory"`
			Severity     string `json:"Severity"`
		} `json:"Pending"`
	}

	if err := json.Unmarshal(out, &raw); err != nil {
		result.Error = "Failed to parse update data"
		result.CheckTime = time.Since(start).Round(time.Millisecond).String()
		result.CheckedAt = time.Now()
		return result
	}

	for _, p := range raw.Pending {
		result.Updates = append(result.Updates, Update{
			Title:        p.Title,
			Description:  p.Description,
			KBArticle:    p.KBArticle,
			Category:     p.Category,
			Size:         p.Size,
			IsInstalled:  false,
			IsDownloaded: p.IsDownloaded,
			IsMandatory:  p.IsMandatory,
			Severity:     p.Severity,
		})
		result.PendingCount++
	}

	for _, i := range raw.Installed {
		result.Updates = append(result.Updates, Update{
			Title:       i.Title,
			Description: i.Description,
			IsInstalled: true,
			Category:    "Installed",
		})
		result.InstalledCount++
	}

	result.CheckTime = time.Since(start).Round(time.Millisecond).String()
	result.CheckedAt = time.Now()
	return result
}

func (c *Checker) Install(titles []string) InstallResult {
	// Trigger Windows Update installation via PowerShell
	psScript := `
$Session = New-Object -ComObject Microsoft.Update.Session
$Searcher = $Session.CreateUpdateSearcher()
$SearchResult = $Searcher.Search("IsInstalled=0")
$ToInstall = New-Object -ComObject Microsoft.Update.UpdateColl

foreach ($update in $SearchResult.Updates) {
    if ($update.IsDownloaded -eq $false) {
        $Downloader = $Session.CreateUpdateDownloader()
        $dl = New-Object -ComObject Microsoft.Update.UpdateColl
        $dl.Add($update) | Out-Null
        $Downloader.Updates = $dl
        $Downloader.Download() | Out-Null
    }
    $ToInstall.Add($update) | Out-Null
}

if ($ToInstall.Count -gt 0) {
    $Installer = $Session.CreateUpdateInstaller()
    $Installer.Updates = $ToInstall
    $Result = $Installer.Install()
    Write-Output "Installed $($ToInstall.Count) updates. Result: $($Result.ResultCode)"
} else {
    Write-Output "No updates to install."
}
`
	out, err := cmdutil.HiddenCommand("powershell", "-NoProfile", "-Command", psScript).Output()
	if err != nil {
		return InstallResult{
			Success: false,
			Message: "Installation failed: " + err.Error(),
		}
	}

	return InstallResult{
		Success: true,
		Message: string(out),
	}
}
