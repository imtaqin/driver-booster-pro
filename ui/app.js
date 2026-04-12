/* ============================================================
   Driver Booster Pro - Application Logic
   Driver Navigator Style: tabs, driver rows, action buttons
   ============================================================ */

var App = {
    state: { sysInfo:null, drivers:null, updates:null },

    init: function() {
        this.setupTabs();
        this.setupFilters();
        this.refreshSysInfo();
        this.refreshIcons();
    },

    refreshIcons: function() {
        if (window.lucide) lucide.createIcons();
    },

    // ---- Tab Navigation ----
    setupTabs: function() {
        var self = this;
        document.querySelectorAll('.toolbar-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                var id = tab.dataset.tab;
                document.querySelectorAll('.toolbar-tab').forEach(function(t){ t.classList.remove('active'); });
                tab.classList.add('active');
                document.querySelectorAll('.tab-page').forEach(function(p){ p.classList.remove('active'); });
                var target = document.getElementById('tab-' + id);
                if (target) target.classList.add('active');
            });
        });
    },

    // ---- Filter Pills ----
    setupFilters: function() {
        var self = this;
        document.querySelectorAll('.pill').forEach(function(btn) {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.pill').forEach(function(b){ b.classList.remove('active'); });
                btn.classList.add('active');
                self.filterDrivers(btn.dataset.filter);
            });
        });
    },

    filterDrivers: function(f) {
        document.querySelectorAll('.drv-row').forEach(function(row) {
            var show = f === 'all' ||
                (f === 'outdated' && row.classList.contains('outdated')) ||
                (f === 'error' && row.classList.contains('error')) ||
                (f === 'signed' && row.dataset.signed === 'true');
            row.style.display = show ? '' : 'none';
        });
    },

    // ---- Loading ----
    showLoading: function(text) {
        document.getElementById('loading-text').textContent = text;
        document.getElementById('loading-overlay').style.display = 'flex';
        this.refreshIcons();
    },
    hideLoading: function() {
        document.getElementById('loading-overlay').style.display = 'none';
    },

    // ---- System Info ----
    refreshSysInfo: function() {
        var self = this;
        this.showLoading('Collecting system information...');
        fetch('/api/sysinfo').then(function(r){ return r.json(); }).then(function(info) {
            self.state.sysInfo = info;
            self.renderSysInfo(info);
            self.hideLoading();
        }).catch(function(e) {
            console.error(e);
            self.hideLoading();
        });
    },

    renderSysInfo: function(d) {
        this.set('sys-name', d.computerName);
        this.set('sys-os', d.osName);
        this.set('sys-version', d.osVersion);
        this.set('sys-build', d.osBuild);
        this.set('sys-arch', d.architecture);
        this.set('sys-cpu', d.cpuName);
        this.set('sys-cores', d.cpuCores);
        this.set('sys-ram-total', d.totalRam);
        this.set('sys-ram-used', d.usedRam);
        this.set('sys-ram-free', d.freeRam);
        this.set('sys-ram-pct', (d.ramPercent||0)+'%');
        this.set('sys-disk-total', d.diskTotal);
        this.set('sys-disk-used', d.diskUsed);
        this.set('sys-disk-free', d.diskFree);
        this.set('sys-disk-pct', (d.diskPercent||0)+'%');
        var rb = document.getElementById('sys-ram-bar');
        var db = document.getElementById('sys-disk-bar');
        if(rb) rb.style.width = (d.ramPercent||0)+'%';
        if(db) db.style.width = (d.diskPercent||0)+'%';
    },

    // ---- Driver Scan ----
    scanDrivers: function() {
        var self = this;
        this.showLoading('Scanning drivers... This may take a moment.');
        // Switch to drivers tab
        document.querySelectorAll('.toolbar-tab').forEach(function(t){ t.classList.remove('active'); });
        document.querySelector('[data-tab="drivers"]').classList.add('active');
        document.querySelectorAll('.tab-page').forEach(function(p){ p.classList.remove('active'); });
        document.getElementById('tab-drivers').classList.add('active');

        // Update steps
        this.setStep(2);

        fetch('/api/drivers/scan').then(function(r){ return r.json(); }).then(function(result) {
            self.state.drivers = result;
            self.renderDrivers(result);
            self.updateScanStats(result);
            self.hideLoading();
        }).catch(function(e) {
            console.error(e);
            self.hideLoading();
        });
    },

    updateScanStats: function(r) {
        this.set('scan-stat-total', r.totalCount);
        this.set('scan-stat-outdated', r.outdatedCount);
        this.set('scan-stat-errors', r.errorCount);
    },

    renderDrivers: function(result) {
        document.getElementById('driver-result-count').style.display = 'block';
        document.getElementById('driver-filter-strip').style.display = 'flex';
        this.set('drv-total-2', result.totalCount);
        this.set('drv-outdated-2', result.outdatedCount);
        this.set('drv-time-2', result.scanTime);

        var list = document.getElementById('driver-list');
        if (!result.drivers || result.drivers.length === 0) {
            list.innerHTML = '<div class="placeholder-msg"><i data-lucide="search-x"></i><p>No drivers found</p></div>';
            this.refreshIcons();
            return;
        }

        var self = this;
        list.innerHTML = result.drivers.map(function(d) {
            var cls = ['drv-row'];
            if (d.needsUpdate) cls.push('outdated');
            if (d.status === 'Error' || d.status === 'Degraded') cls.push('error');

            var icon = self.driverIcon(d.deviceClass);
            var barClass = d.needsUpdate ? 'warn' : (d.status === 'Error' ? 'err' : 'ok');

            var signBadge = d.isSigned
                ? '<span class="drv-badge signed"><i data-lucide="shield-check"></i> Signed</span>'
                : '<span class="drv-badge unsigned"><i data-lucide="shield-x"></i></span>';

            var actionBtn = d.needsUpdate
                ? '<button class="drv-btn install-btn"><i data-lucide="download"></i> Download</button>' +
                  '<button class="drv-btn"><i data-lucide="play"></i> Install</button>'
                : '<button class="drv-btn installed-btn"><i data-lucide="circle-check"></i> Up to date</button>';

            return '<div class="' + cls.join(' ') + '" data-signed="' + d.isSigned + '">' +
                '<div class="drv-icon"><i data-lucide="' + icon + '"></i></div>' +
                '<div class="drv-info">' +
                    '<div class="drv-name">' + self.esc(d.deviceName) + '</div>' +
                    '<div class="drv-meta">' + self.esc(d.manufacturer||'Unknown') + ' &middot; v' + self.esc(d.driverVersion||'?') + ' &middot; ' + self.esc(d.driverDate) + ' ' + signBadge + '</div>' +
                '</div>' +
                '<div class="drv-progress">' +
                    '<div class="drv-bar"><div class="drv-bar-fill ' + barClass + '"></div></div>' +
                '</div>' +
                '<div class="drv-actions">' + actionBtn + '</div>' +
            '</div>';
        }).join('');

        // Show CTA if there are outdated drivers
        var cta = document.getElementById('cta-update-all');
        if (result.outdatedCount > 0) {
            cta.style.display = 'flex';
            this.set('cta-count', result.outdatedCount);
        } else {
            cta.style.display = 'none';
        }

        this.refreshIcons();
    },

    driverIcon: function(cls) {
        if (!cls) return 'package';
        var u = cls.toUpperCase();
        var m = {
            'DISPLAY':'monitor','MEDIA':'volume-2','AUDIO':'volume-2','SOUND':'volume-2',
            'NET':'wifi','NETWORK':'wifi','USB':'usb','HID':'mouse','KEYBOARD':'keyboard',
            'DISK':'hard-drive','STORAGE':'hard-drive','PROCESSOR':'cpu','SYSTEM':'settings',
            'BLUETOOTH':'bluetooth','CAMERA':'camera','IMAGE':'camera','PRINT':'printer',
            'BATTERY':'battery-charging','FIRMWARE':'circuit-board','SECURITY':'shield',
            'SENSOR':'thermometer'
        };
        for (var k in m) { if (u.indexOf(k) !== -1) return m[k]; }
        return 'package';
    },

    // ---- Windows Update ----
    checkUpdates: function() {
        var self = this;
        this.showLoading('Checking for Windows updates...');
        // Switch to updates tab
        document.querySelectorAll('.toolbar-tab').forEach(function(t){ t.classList.remove('active'); });
        document.querySelector('[data-tab="updates"]').classList.add('active');
        document.querySelectorAll('.tab-page').forEach(function(p){ p.classList.remove('active'); });
        document.getElementById('tab-updates').classList.add('active');

        fetch('/api/updates/check').then(function(r){ return r.json(); }).then(function(result) {
            self.state.updates = result;
            self.renderUpdates(result);
            self.hideLoading();
        }).catch(function(e) {
            console.error(e);
            self.hideLoading();
        });
    },

    renderUpdates: function(result) {
        var list = document.getElementById('update-list');

        if (result.error) {
            list.innerHTML = '<div class="placeholder-msg"><i data-lucide="alert-circle"></i><p style="color:var(--red)">' + this.esc(result.error) + '</p></div>';
            this.refreshIcons();
            return;
        }

        if (!result.updates || result.updates.length === 0) {
            list.innerHTML = '<div class="placeholder-msg"><i data-lucide="circle-check"></i><p>Your system is fully up to date!</p></div>';
            this.refreshIcons();
            return;
        }

        var pending = result.updates.filter(function(u){return !u.isInstalled;});
        var installed = result.updates.filter(function(u){return u.isInstalled;});
        var self = this;
        var html = '';

        if (pending.length > 0) {
            html += '<div class="upd-section pend"><i data-lucide="download"></i> Pending (' + pending.length + ')</div>';
            html += pending.map(function(u) {
                return '<div class="upd-row pending">' +
                    '<div class="upd-title">' + self.esc(u.title) + '</div>' +
                    '<div class="upd-meta">' +
                        (u.kbArticle ? '<span class="upd-tag"><i data-lucide="file-text"></i> '+self.esc(u.kbArticle)+'</span>' : '') +
                        (u.category ? '<span class="upd-tag"><i data-lucide="folder"></i> '+self.esc(u.category)+'</span>' : '') +
                        (u.size ? '<span class="upd-tag"><i data-lucide="hard-drive"></i> '+self.esc(u.size)+'</span>' : '') +
                        (u.severity && u.severity !== 'Unspecified' ? '<span class="upd-tag"><i data-lucide="alert-triangle"></i> '+self.esc(u.severity)+'</span>' : '') +
                    '</div>' +
                '</div>';
            }).join('');
        }

        if (installed.length > 0) {
            html += '<div class="upd-section inst"><i data-lucide="check-circle"></i> Recently Installed (' + installed.length + ')</div>';
            html += installed.map(function(u) {
                return '<div class="upd-row done"><div class="upd-title">' + self.esc(u.title) + '</div></div>';
            }).join('');
        }

        list.innerHTML = html;
        this.refreshIcons();
    },

    // ---- Step bar ----
    setStep: function(n) {
        for (var i = 1; i <= 3; i++) {
            var el = document.getElementById('step-' + i);
            if (!el) continue;
            el.classList.remove('active', 'done');
            if (i < n) el.classList.add('done');
            if (i === n) el.classList.add('active');
        }
    },

    // ---- Helpers ----
    set: function(id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = (val != null && val !== '') ? val : '--';
    },
    esc: function(s) {
        if (!s) return '';
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }
};

document.addEventListener('DOMContentLoaded', function() { App.init(); });
