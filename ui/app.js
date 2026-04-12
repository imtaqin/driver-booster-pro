/* ============================================================
   Driver Booster Pro - PNG Icons Edition
   ============================================================ */

var App = {
    state: { sysInfo:null, drivers:null, updates:null },

    init: function() {
        this.setupTabs();
        this.setupFilters();
        this.refreshSysInfo();
    },

    setupTabs: function() {
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

    showLoading: function(text) {
        document.getElementById('loading-text').textContent = text;
        document.getElementById('loading-overlay').style.display = 'flex';
    },
    hideLoading: function() {
        document.getElementById('loading-overlay').style.display = 'none';
    },

    // System Info
    refreshSysInfo: function() {
        var self = this;
        this.showLoading('Collecting system information...');
        fetch('/api/sysinfo').then(function(r){ return r.json(); }).then(function(info) {
            self.state.sysInfo = info;
            self.renderSysInfo(info);
            self.hideLoading();
        }).catch(function(e) { console.error(e); self.hideLoading(); });
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

    // Driver Scan
    scanDrivers: function() {
        var self = this;
        this.showLoading('Scanning drivers...');
        // Switch to drivers tab
        document.querySelectorAll('.toolbar-tab').forEach(function(t){ t.classList.remove('active'); });
        document.querySelector('[data-tab="drivers"]').classList.add('active');
        document.querySelectorAll('.tab-page').forEach(function(p){ p.classList.remove('active'); });
        document.getElementById('tab-drivers').classList.add('active');
        this.setStep(2);

        fetch('/api/drivers/scan').then(function(r){ return r.json(); }).then(function(result) {
            self.state.drivers = result;
            self.renderDrivers(result);
            self.updateScanStats(result);
            self.hideLoading();
        }).catch(function(e) { console.error(e); self.hideLoading(); });
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
            list.innerHTML = '<div class="placeholder-msg"><img src="icon-scan.png" class="placeholder-img"><p>No drivers found</p></div>';
            return;
        }

        var self = this;
        list.innerHTML = result.drivers.map(function(d) {
            var cls = ['drv-row'];
            if (d.needsUpdate) cls.push('outdated');
            if (d.status === 'Error' || d.status === 'Degraded') cls.push('error');

            var iconFile = self.driverIconFile(d.deviceClass);
            var barClass = d.needsUpdate ? 'warn' : (d.status === 'Error' ? 'err' : 'ok');

            var signBadge = d.isSigned
                ? '<span class="drv-badge signed"><img src="icon-shield.png" class="drv-badge-img" style="width:10px;height:10px"> Signed</span>'
                : '<span class="drv-badge unsigned">Unsigned</span>';

            var actionBtn = d.needsUpdate
                ? '<button class="drv-btn install-btn"><img src="icon-download.png" style="width:13px;height:13px"> Download</button>' +
                  '<button class="drv-btn"><img src="icon-install.png" style="width:13px;height:13px"> Install</button>'
                : '<button class="drv-btn ok-btn"><img src="icon-checkmark.png" style="width:13px;height:13px"> Up to date</button>';

            return '<div class="' + cls.join(' ') + '" data-signed="' + d.isSigned + '">' +
                '<div class="drv-icon"><img src="icon-' + iconFile + '" class="drv-icon-img"></div>' +
                '<div class="drv-info">' +
                    '<div class="drv-name">' + self.esc(d.deviceName) + '</div>' +
                    '<div class="drv-meta">' + self.esc(d.manufacturer||'Unknown') +
                        ' &middot; v' + self.esc(d.driverVersion||'?') +
                        ' &middot; ' + self.esc(d.driverDate) + ' ' + signBadge + '</div>' +
                '</div>' +
                '<div class="drv-progress"><div class="drv-bar"><div class="drv-bar-fill ' + barClass + '"></div></div></div>' +
                '<div class="drv-actions">' + actionBtn + '</div>' +
            '</div>';
        }).join('');

        var cta = document.getElementById('cta-update-all');
        if (result.outdatedCount > 0) {
            cta.style.display = 'flex';
            this.set('cta-count', result.outdatedCount);
        } else {
            cta.style.display = 'none';
        }
    },

    driverIconFile: function(cls) {
        if (!cls) return 'package.png';
        var u = cls.toUpperCase();
        var m = {
            'DISPLAY':'monitor.png','MEDIA':'speaker.png','AUDIO':'speaker.png','SOUND':'speaker.png',
            'NET':'wifi.png','NETWORK':'wifi.png','USB':'usb.png','HID':'mouse.png',
            'KEYBOARD':'keyboard.png','DISK':'harddrive.png','STORAGE':'harddrive.png',
            'PROCESSOR':'cpu.png','SYSTEM':'settings.png','BLUETOOTH':'bluetooth.png',
            'CAMERA':'camera.png','IMAGE':'camera.png','PRINT':'printer.png',
            'BATTERY':'battery.png'
        };
        for (var k in m) { if (u.indexOf(k) !== -1) return m[k]; }
        return 'package.png';
    },

    // Windows Update
    checkUpdates: function() {
        var self = this;
        this.showLoading('Checking for Windows updates...');
        document.querySelectorAll('.toolbar-tab').forEach(function(t){ t.classList.remove('active'); });
        document.querySelector('[data-tab="updates"]').classList.add('active');
        document.querySelectorAll('.tab-page').forEach(function(p){ p.classList.remove('active'); });
        document.getElementById('tab-updates').classList.add('active');

        fetch('/api/updates/check').then(function(r){ return r.json(); }).then(function(result) {
            self.state.updates = result;
            self.renderUpdates(result);
            self.hideLoading();
        }).catch(function(e) { console.error(e); self.hideLoading(); });
    },

    renderUpdates: function(result) {
        var list = document.getElementById('update-list');

        if (result.error) {
            list.innerHTML = '<div class="placeholder-msg"><img src="icon-error.png" class="placeholder-img"><p style="color:var(--red)">' + this.esc(result.error) + '</p></div>';
            return;
        }
        if (!result.updates || result.updates.length === 0) {
            list.innerHTML = '<div class="placeholder-msg"><img src="icon-checkmark.png" class="placeholder-img"><p>Your system is fully up to date!</p></div>';
            return;
        }

        var pending = result.updates.filter(function(u){return !u.isInstalled;});
        var installed = result.updates.filter(function(u){return u.isInstalled;});
        var self = this;
        var html = '';

        if (pending.length > 0) {
            html += '<div class="upd-section pend"><img src="icon-download.png" style="width:16px;height:16px"> Pending (' + pending.length + ')</div>';
            html += pending.map(function(u) {
                return '<div class="upd-row pending">' +
                    '<div class="upd-title">' + self.esc(u.title) + '</div>' +
                    '<div class="upd-meta">' +
                        (u.kbArticle ? '<span class="upd-tag"><img src="icon-info.png" style="width:12px;height:12px"> '+self.esc(u.kbArticle)+'</span>' : '') +
                        (u.category ? '<span class="upd-tag"><img src="icon-package.png" style="width:12px;height:12px"> '+self.esc(u.category)+'</span>' : '') +
                        (u.size ? '<span class="upd-tag"><img src="icon-harddrive.png" style="width:12px;height:12px"> '+self.esc(u.size)+'</span>' : '') +
                        (u.severity && u.severity !== 'Unspecified' ? '<span class="upd-tag"><img src="icon-warning.png" style="width:12px;height:12px"> '+self.esc(u.severity)+'</span>' : '') +
                    '</div></div>';
            }).join('');
        }

        if (installed.length > 0) {
            html += '<div class="upd-section inst"><img src="icon-checkmark.png" style="width:16px;height:16px"> Recently Installed (' + installed.length + ')</div>';
            html += installed.map(function(u) {
                return '<div class="upd-row done"><div class="upd-title">' + self.esc(u.title) + '</div></div>';
            }).join('');
        }
        list.innerHTML = html;
    },

    setStep: function(n) {
        for (var i = 1; i <= 3; i++) {
            var el = document.getElementById('step-' + i);
            if (!el) continue;
            el.classList.remove('active', 'done');
            if (i < n) el.classList.add('done');
            if (i === n) el.classList.add('active');
        }
    },

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
