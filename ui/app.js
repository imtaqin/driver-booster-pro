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
    },

    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const page = item.dataset.page;
                document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
                item.classList.add('active');
                document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
                document.getElementById('page-' + page).classList.add('active');
            });
        });
    },

    setupFilters() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filterDrivers(btn.dataset.filter);
            });
        });
    },

    filterDrivers(filter) {
        document.querySelectorAll('.driver-card').forEach(card => {
            const show = filter === 'all' ||
                (filter === 'outdated' && card.classList.contains('outdated')) ||
                (filter === 'error' && card.classList.contains('error')) ||
                (filter === 'signed' && card.dataset.signed === 'true');
            card.style.display = show ? '' : 'none';
        });
    },

    showLoading(text) {
        document.getElementById('loading-text').textContent = text;
        document.getElementById('loading-overlay').style.display = 'flex';
    },

    hideLoading() {
        document.getElementById('loading-overlay').style.display = 'none';
    },

    // System Info
    async refreshSysInfo() {
        this.showLoading('Collecting system information...');
        try {
            const res = await fetch('/api/sysinfo');
            const info = await res.json();
            this.state.sysInfo = info;
            this.renderSysInfo(info);
            this.updateDashboardResources(info);
        } catch (e) {
            console.error('Failed to get sysinfo:', e);
        }
        this.hideLoading();
    },

    renderSysInfo(info) {
        document.getElementById('sys-name').textContent = info.computerName || '--';
        document.getElementById('sys-os').textContent = info.osName || '--';
        document.getElementById('sys-version').textContent = info.osVersion || '--';
        document.getElementById('sys-build').textContent = info.osBuild || '--';
        document.getElementById('sys-arch').textContent = info.architecture || '--';
        document.getElementById('sys-cpu').textContent = info.cpuName || '--';
        document.getElementById('sys-cores').textContent = info.cpuCores || '--';
        document.getElementById('sys-ram-total').textContent = info.totalRam || '--';
        document.getElementById('sys-ram-used').textContent = info.usedRam || '--';
        document.getElementById('sys-ram-free').textContent = info.freeRam || '--';
        document.getElementById('sys-ram-pct').textContent = (info.ramPercent || 0) + '%';
        document.getElementById('sys-disk-total').textContent = info.diskTotal || '--';
        document.getElementById('sys-disk-used').textContent = info.diskUsed || '--';
        document.getElementById('sys-disk-free').textContent = info.diskFree || '--';
        document.getElementById('sys-disk-pct').textContent = (info.diskPercent || 0) + '%';
    },

    updateDashboardResources(info) {
        document.getElementById('dash-ram-percent').textContent = (info.ramPercent || 0) + '%';
        document.getElementById('dash-ram-detail').textContent = (info.usedRam || '--') + ' / ' + (info.totalRam || '--');
        document.getElementById('dash-ram-bar').style.width = (info.ramPercent || 0) + '%';
        document.getElementById('dash-disk-detail').textContent = (info.diskUsed || '--') + ' / ' + (info.diskTotal || '--');
        document.getElementById('dash-disk-bar').style.width = (info.diskPercent || 0) + '%';

        if (info.ramPercent > 80) {
            document.getElementById('dash-ram-bar').style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
        }
        if (info.diskPercent > 85) {
            document.getElementById('dash-disk-bar').style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
        }
    },

    // Drivers
    async scanDrivers() {
        this.showLoading('Scanning drivers... This may take a moment.');
        try {
            const res = await fetch('/api/drivers/scan');
            const result = await res.json();
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
        document.getElementById('drv-total').textContent = result.totalCount;
        document.getElementById('drv-outdated').textContent = result.outdatedCount;
        document.getElementById('drv-errors').textContent = result.errorCount;
        document.getElementById('drv-time').textContent = result.scanTime;

        const list = document.getElementById('driver-list');
        if (!result.drivers || result.drivers.length === 0) {
            list.innerHTML = '<div class="empty-state"><p>No drivers found.</p></div>';
            return;
        }

        list.innerHTML = result.drivers.map(d => {
            const classes = ['driver-card'];
            if (d.needsUpdate) classes.push('outdated');
            if (d.status === 'Error' || d.status === 'Degraded') classes.push('error');

            const icon = this.getClassIcon(d.deviceClass);
            const badges = [];
            if (d.isSigned) badges.push('<span class="badge badge-signed">Signed</span>');
            else badges.push('<span class="badge badge-unsigned">Unsigned</span>');
            if (d.needsUpdate) badges.push('<span class="badge badge-outdated">Outdated</span>');
            else badges.push('<span class="badge badge-ok">OK</span>');

            return '<div class="' + classes.join(' ') + '" data-signed="' + d.isSigned + '">' +
                '<div class="driver-class-icon">' + icon + '</div>' +
                '<div class="driver-info">' +
                    '<div class="driver-name">' + this.esc(d.deviceName) + '</div>' +
                    '<div class="driver-meta">' + this.esc(d.manufacturer || 'Unknown') + ' &bull; v' + this.esc(d.driverVersion || '?') + ' &bull; ' + this.esc(d.driverDate) + '</div>' +
                '</div>' +
                '<div class="driver-badges">' + badges.join('') + '</div>' +
            '</div>';
        }).join('');
    },

    updateDashboardDrivers(result) {
        document.getElementById('dash-driver-count').textContent = result.totalCount;
        document.getElementById('dash-outdated-count').textContent = result.outdatedCount;
    },

    getClassIcon(cls) {
        const icons = {
            'DISPLAY': '\uD83D\uDDA5',
            'MEDIA': '\uD83D\uDD0A',
            'NET': '\uD83C\uDF10',
            'USB': '\uD83D\uDD0C',
            'HIDCLASS': '\uD83D\uDDB1',
            'KEYBOARD': '\u2328',
            'DISKDRIVE': '\uD83D\uDCBE',
            'PROCESSOR': '\u26A1',
            'SYSTEM': '\u2699',
            'BLUETOOTH': '\uD83D\uDCE1',
            'CAMERA': '\uD83D\uDCF7',
            'PRINTER': '\uD83D\uDDA8',
        };
        if (!cls) return '\uD83D\uDCE6';
        var upper = cls.toUpperCase();
        for (var key in icons) {
            if (upper.indexOf(key) !== -1) return icons[key];
        }
        return '\uD83D\uDCE6';
    },

    // Updates
    async checkUpdates() {
        this.showLoading('Checking for Windows updates...');
        try {
            const res = await fetch('/api/updates/check');
            const result = await res.json();
            this.state.updates = result;
            this.renderUpdates(result);
            document.getElementById('dash-update-count').textContent = result.pendingCount;
        } catch (e) {
            console.error('Failed to check updates:', e);
        }
        this.hideLoading();
    },

    renderUpdates(result) {
        const list = document.getElementById('update-list');

        if (result.error) {
            list.innerHTML = '<div class="empty-state"><p style="color:var(--danger)">' + this.esc(result.error) + '</p></div>';
            return;
        }

        if (!result.updates || result.updates.length === 0) {
            list.innerHTML = '<div class="empty-state"><p>Your system is up to date!</p></div>';
            return;
        }

        const pending = result.updates.filter(u => !u.isInstalled);
        const installed = result.updates.filter(u => u.isInstalled);

        let html = '';

        if (pending.length > 0) {
            html += '<h3 style="margin:8px 0;font-size:14px;color:var(--info)">Pending Updates (' + pending.length + ')</h3>';
            html += pending.map(u =>
                '<div class="update-card pending">' +
                    '<div class="update-title">' + this.esc(u.title) + '</div>' +
                    '<div class="update-meta">' +
                        (u.kbArticle ? '<span>' + this.esc(u.kbArticle) + '</span>' : '') +
                        (u.category ? '<span>' + this.esc(u.category) + '</span>' : '') +
                        (u.size ? '<span>' + this.esc(u.size) + '</span>' : '') +
                        (u.severity && u.severity !== 'Unspecified' ? '<span>' + this.esc(u.severity) + '</span>' : '') +
                        (u.isMandatory ? '<span style="color:var(--danger)">Mandatory</span>' : '') +
                    '</div>' +
                '</div>'
            ).join('');
        }

        if (installed.length > 0) {
            html += '<h3 style="margin:16px 0 8px;font-size:14px;color:var(--success)">Recently Installed (' + installed.length + ')</h3>';
            html += installed.map(u =>
                '<div class="update-card installed">' +
                    '<div class="update-title">' + this.esc(u.title) + '</div>' +
                '</div>'
            ).join('');
        }

        list.innerHTML = html;
    },

    esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
};

document.addEventListener('DOMContentLoaded', function() { App.init(); });
