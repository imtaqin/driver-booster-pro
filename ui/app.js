/* ============================================================
   Driver Booster Pro - Application Logic
   ============================================================ */

const App = {
    state: {
        sysInfo: null,
        drivers: null,
        updates: null,
    },

    init() {
        this.setupNavigation();
        this.setupFilters();
        this.refreshSysInfo();
        // Re-render Lucide icons after DOM mutations
        this.refreshIcons();
    },

    refreshIcons() {
        if (window.lucide) {
            lucide.createIcons();
        }
    },

    // ---- Navigation ----
    setupNavigation() {
        document.querySelectorAll('.nav-item[data-page]').forEach(function(item) {
            item.addEventListener('click', function() {
                var page = item.dataset.page;
                document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
                item.classList.add('active');
                document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
                var target = document.getElementById('page-' + page);
                if (target) target.classList.add('active');
            });
        });
    },

    // ---- Filters ----
    setupFilters() {
        var self = this;
        document.querySelectorAll('.filter-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                self.filterDrivers(btn.dataset.filter);
            });
        });
    },

    filterDrivers(filter) {
        document.querySelectorAll('.driver-card').forEach(function(card) {
            var show = filter === 'all' ||
                (filter === 'outdated' && card.classList.contains('outdated')) ||
                (filter === 'error' && card.classList.contains('error')) ||
                (filter === 'signed' && card.dataset.signed === 'true');
            card.style.display = show ? '' : 'none';
        });
    },

    // ---- Loading ----
    showLoading(text) {
        document.getElementById('loading-text').textContent = text;
        document.getElementById('loading-overlay').style.display = 'flex';
        this.refreshIcons();
    },

    hideLoading() {
        document.getElementById('loading-overlay').style.display = 'none';
    },

    // ---- System Info ----
    async refreshSysInfo() {
        this.showLoading('Collecting system information...');
        try {
            var res = await fetch('/api/sysinfo');
            var info = await res.json();
            this.state.sysInfo = info;
            this.renderSysInfo(info);
            this.updateDashboardResources(info);
        } catch (e) {
            console.error('Failed to get sysinfo:', e);
        }
        this.hideLoading();
    },

    renderSysInfo(info) {
        this.setText('sys-name', info.computerName);
        this.setText('sys-os', info.osName);
        this.setText('sys-version', info.osVersion);
        this.setText('sys-build', info.osBuild);
        this.setText('sys-arch', info.architecture);
        this.setText('sys-cpu', info.cpuName);
        this.setText('sys-cores', info.cpuCores);
        this.setText('sys-ram-total', info.totalRam);
        this.setText('sys-ram-used', info.usedRam);
        this.setText('sys-ram-free', info.freeRam);
        this.setText('sys-ram-pct', (info.ramPercent || 0) + '%');
        this.setText('sys-disk-total', info.diskTotal);
        this.setText('sys-disk-used', info.diskUsed);
        this.setText('sys-disk-free', info.diskFree);
        this.setText('sys-disk-pct', (info.diskPercent || 0) + '%');
    },

    updateDashboardResources(info) {
        this.setText('dash-ram-percent', (info.ramPercent || 0) + '%');
        this.setText('dash-ram-detail', (info.usedRam || '--') + ' / ' + (info.totalRam || '--'));
        document.getElementById('dash-ram-bar').style.width = (info.ramPercent || 0) + '%';
        this.setText('dash-disk-detail', (info.diskUsed || '--') + ' / ' + (info.diskTotal || '--'));
        document.getElementById('dash-disk-bar').style.width = (info.diskPercent || 0) + '%';

        // Warn color for high usage
        var ramBar = document.getElementById('dash-ram-bar');
        var diskBar = document.getElementById('dash-disk-bar');
        if (info.ramPercent > 80) {
            ramBar.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
        } else {
            ramBar.style.background = '';
        }
        if (info.diskPercent > 85) {
            diskBar.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
        } else {
            diskBar.style.background = '';
        }
    },

    // ---- Drivers ----
    async scanDrivers() {
        this.showLoading('Scanning drivers... This may take a moment.');
        try {
            var res = await fetch('/api/drivers/scan');
            var result = await res.json();
            this.state.drivers = result;
            this.renderDrivers(result);
            this.updateDashboardDrivers(result);
        } catch (e) {
            console.error('Failed to scan drivers:', e);
        }
        this.hideLoading();
    },

    renderDrivers(result) {
        document.getElementById('driver-summary').style.display = 'flex';
        document.getElementById('driver-filters').style.display = 'flex';
        this.setText('drv-total', result.totalCount);
        this.setText('drv-outdated', result.outdatedCount);
        this.setText('drv-errors', result.errorCount);
        this.setText('drv-time', result.scanTime);

        var list = document.getElementById('driver-list');
        if (!result.drivers || result.drivers.length === 0) {
            list.innerHTML =
                '<div class="empty-state">' +
                    '<div class="empty-icon"><i data-lucide="search-x"></i></div>' +
                    '<h3>No Drivers Found</h3>' +
                    '<p>No driver information was returned.</p>' +
                '</div>';
            this.refreshIcons();
            return;
        }

        var self = this;
        list.innerHTML = result.drivers.map(function(d) {
            var classes = ['driver-card'];
            if (d.needsUpdate) classes.push('outdated');
            if (d.status === 'Error' || d.status === 'Degraded') classes.push('error');

            var iconName = self.getClassIconName(d.deviceClass);

            var badges = '';
            if (d.isSigned) {
                badges += '<span class="badge badge-signed"><i data-lucide="shield-check"></i> Signed</span>';
            } else {
                badges += '<span class="badge badge-unsigned"><i data-lucide="shield-x"></i> Unsigned</span>';
            }
            if (d.needsUpdate) {
                badges += '<span class="badge badge-outdated"><i data-lucide="clock"></i> Outdated</span>';
            } else {
                badges += '<span class="badge badge-ok"><i data-lucide="circle-check"></i> OK</span>';
            }

            return '<div class="' + classes.join(' ') + '" data-signed="' + d.isSigned + '">' +
                '<div class="driver-class-icon"><i data-lucide="' + iconName + '"></i></div>' +
                '<div class="driver-info">' +
                    '<div class="driver-name">' + self.esc(d.deviceName) + '</div>' +
                    '<div class="driver-meta">' +
                        self.esc(d.manufacturer || 'Unknown') +
                        ' <span class="driver-meta-sep">&middot;</span> v' + self.esc(d.driverVersion || '?') +
                        ' <span class="driver-meta-sep">&middot;</span> ' + self.esc(d.driverDate) +
                    '</div>' +
                '</div>' +
                '<div class="driver-badges">' + badges + '</div>' +
            '</div>';
        }).join('');

        this.refreshIcons();
    },

    updateDashboardDrivers(result) {
        this.setText('dash-driver-count', result.totalCount);
        this.setText('dash-outdated-count', result.outdatedCount);
    },

    getClassIconName(cls) {
        if (!cls) return 'package';
        var upper = cls.toUpperCase();
        var map = {
            'DISPLAY': 'monitor',
            'MEDIA': 'volume-2',
            'AUDIO': 'volume-2',
            'SOUND': 'volume-2',
            'NET': 'wifi',
            'NETWORK': 'wifi',
            'USB': 'usb',
            'HID': 'mouse',
            'KEYBOARD': 'keyboard',
            'DISK': 'hard-drive',
            'STORAGE': 'hard-drive',
            'PROCESSOR': 'cpu',
            'SYSTEM': 'settings',
            'BLUETOOTH': 'bluetooth',
            'CAMERA': 'camera',
            'IMAGE': 'camera',
            'PRINT': 'printer',
            'BATTERY': 'battery-charging',
            'BIOMETRIC': 'fingerprint',
            'FIRMWARE': 'circuit-board',
            'SECURITY': 'shield',
            'SENSOR': 'thermometer',
        };
        for (var key in map) {
            if (upper.indexOf(key) !== -1) return map[key];
        }
        return 'package';
    },

    // ---- Updates ----
    async checkUpdates() {
        this.showLoading('Checking for Windows updates...');
        try {
            var res = await fetch('/api/updates/check');
            var result = await res.json();
            this.state.updates = result;
            this.renderUpdates(result);
            this.setText('dash-update-count', result.pendingCount);
        } catch (e) {
            console.error('Failed to check updates:', e);
        }
        this.hideLoading();
    },

    renderUpdates(result) {
        var list = document.getElementById('update-list');

        if (result.error) {
            list.innerHTML =
                '<div class="empty-state">' +
                    '<div class="empty-icon"><i data-lucide="alert-circle"></i></div>' +
                    '<h3>Error</h3>' +
                    '<p style="color:var(--danger)">' + this.esc(result.error) + '</p>' +
                '</div>';
            this.refreshIcons();
            return;
        }

        if (!result.updates || result.updates.length === 0) {
            list.innerHTML =
                '<div class="empty-state">' +
                    '<div class="empty-icon"><i data-lucide="circle-check"></i></div>' +
                    '<h3>All Up to Date</h3>' +
                    '<p>Your system is fully updated.</p>' +
                '</div>';
            this.refreshIcons();
            return;
        }

        var pending = result.updates.filter(function(u) { return !u.isInstalled; });
        var installed = result.updates.filter(function(u) { return u.isInstalled; });
        var self = this;
        var html = '';

        if (pending.length > 0) {
            html += '<div class="update-section-title pending"><i data-lucide="download"></i> Pending Updates (' + pending.length + ')</div>';
            html += pending.map(function(u) {
                return '<div class="update-card pending">' +
                    '<div class="update-title">' + self.esc(u.title) + '</div>' +
                    '<div class="update-meta">' +
                        (u.kbArticle ? '<span class="update-tag"><i data-lucide="file-text"></i> ' + self.esc(u.kbArticle) + '</span>' : '') +
                        (u.category ? '<span class="update-tag"><i data-lucide="folder"></i> ' + self.esc(u.category) + '</span>' : '') +
                        (u.size ? '<span class="update-tag"><i data-lucide="hard-drive"></i> ' + self.esc(u.size) + '</span>' : '') +
                        (u.severity && u.severity !== 'Unspecified' ? '<span class="update-tag"><i data-lucide="alert-triangle"></i> ' + self.esc(u.severity) + '</span>' : '') +
                        (u.isMandatory ? '<span class="update-tag" style="color:var(--danger)"><i data-lucide="alert-circle"></i> Mandatory</span>' : '') +
                    '</div>' +
                '</div>';
            }).join('');
        }

        if (installed.length > 0) {
            html += '<div class="update-section-title installed"><i data-lucide="check-circle"></i> Recently Installed (' + installed.length + ')</div>';
            html += installed.map(function(u) {
                return '<div class="update-card installed">' +
                    '<div class="update-title">' + self.esc(u.title) + '</div>' +
                '</div>';
            }).join('');
        }

        list.innerHTML = html;
        this.refreshIcons();
    },

    // ---- Utility ----
    setText(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = (value != null && value !== '') ? value : '--';
    },

    esc(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
};

// Boot
document.addEventListener('DOMContentLoaded', function() {
    App.init();
});
