// js/pages/backup.js
// Mirrors ui/backup.py's BackupPage exactly, wired to the real backend
// (/api/backup/*, see server.js) instead of a static 2-row preview table:
//   - Status card: Last Backup (type + file name + timestamp), automatic
//     daily backup hint, and the resolved backup folder (NAS if reachable,
//     else a local folder on the server — same fallback the desktop app
//     does).
//   - "Backup Now (Force)" — same as the desktop app's manual_force_backup():
//     always creates an extra backup immediately.
//   - "Download Latest Backup" — a browser can't open an arbitrary NAS/
//     network folder the way the desktop app's "Open Backup Folder" does,
//     so this is the practical web equivalent: downloads the most recent
//     successful backup file straight from the server.
//   - Recent Backups table: Type / File Name / Taken On / Status / Details,
//     same columns as the desktop app, plus a Download button per
//     successful row (the desktop app doesn't need this since it already
//     has the folder open on the same PC).
//   - The server itself runs the automatic once-a-day backup check on a
//     timer (server.js), so it happens even if nobody has this page open —
//     this page just displays that status and lets you force an extra one.
window.PAGES = window.PAGES || {};

window.PAGES.backup = {
  name: 'Backup & Restore',
  icon: 'fa-cloud-arrow-down',
  sub: 'Database backup and restore points',
  html: `
    <div class="page-head">
      <i class="fa-solid fa-cloud-arrow-down" style="color:var(--blue);"></i><h2>Backup &amp; Restore</h2>
      <button type="button" class="info-btn" data-info="An automatic backup runs once per day in the background while the server is running. Backup Now creates an extra backup immediately, without affecting the daily automatic routine."><i class="fa-solid fa-circle-info"></i></button>
      <button class="btn btn-ghost" type="button" id="bkBtnDownloadLatest"><i class="fa-solid fa-folder-open"></i> Download Latest Backup</button>
      <button class="btn btn-green" type="button" id="bkBtnForce"><i class="fa-solid fa-bolt"></i> Backup Now (Force)</button>
    </div>

    <div class="panel" id="bkStatusCard">
      <div id="bkLastBackup" style="color:var(--txt); font-size:14px; font-weight:700;">Last Backup: Checking...</div>
      <div style="color:var(--txt-muted); font-size:12px; margin-top:4px;">Automatic daily backup: active (checked every few minutes on the server, runs once per day).</div>
      <div id="bkLocation" style="color:var(--txt-muted); font-size:12px; margin-top:4px;"></div>
    </div>

    <div class="table-wrap"><table>
      <thead><tr><th>Type</th><th>File Name</th><th>Taken On</th><th>Status</th><th>Details</th><th></th></tr></thead>
      <tbody id="bkBody"><tr><td colspan="6" style="text-align:center; color:var(--txt-muted); font-style:italic;">Loading...</td></tr></tbody>
    </table></div>
  `,

  init() {
    const $ = (id) => document.getElementById(id);
    const btnForce = $('bkBtnForce');
    const btnDownloadLatest = $('bkBtnDownloadLatest');
    const lastBackupEl = $('bkLastBackup');
    const locationEl = $('bkLocation');
    const tbody = $('bkBody');

    const currentRole = window.currentUserRole || 'User';
    const isAdmin = currentRole === 'SuperAdmin' || currentRole === 'Admin';

    if (!isAdmin) {
      lastBackupEl.innerHTML = '<span style="color:var(--gold);"><i class="fa-solid fa-lock"></i> Restricted:</span> Database Backup operations require Admin or SuperAdmin permissions.';
      if (locationEl) locationEl.textContent = '';
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--txt-muted); font-style:italic; padding:28px;"><i class="fa-solid fa-shield-halved" style="font-size:24px; margin-bottom:8px; display:block; opacity:0.6;"></i>You are logged in with the <strong>${currentRole}</strong> role. Backup history is accessible to Administrators.</td></tr>`;
      if (btnForce) btnForce.style.display = 'none';
      if (btnDownloadLatest) btnDownloadLatest.style.display = 'none';
      return;
    }

    let latestSuccessFile = null;

    function downloadBackup(fileName) {
      const a = document.createElement('a');
      a.href = `${window.API_BASE}/backup/download/${encodeURIComponent(fileName)}`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    async function refreshStatus() {
      let data;
      if (window.Skeleton) {
        tbody.innerHTML = window.Skeleton.tableRows(6, 4, { pillCols: [3] });
      }
      try {
        data = await window.Api.get('/backup/status');
      } catch (e) {
        lastBackupEl.textContent = 'Last Backup: Could not load backup status.';
        if (window.Skeleton) {
          tbody.innerHTML = window.Skeleton.tableError(6, e.message || 'Could not load backup history.', { retryId: 'btnRetryBackup' });
          window.Skeleton.wireRetry('btnRetryBackup', () => refreshStatus());
        } else {
          tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--txt-muted); font-style:italic;">Could not load backup history.</td></tr>`;
        }
        return;
      }

      locationEl.textContent = `Backup Folder: ${data.backupDir}  (${data.onNas ? 'NAS - safe' : 'Local server folder only - NAS not reachable right now'})`;

      if (data.lastBackup) {
        lastBackupEl.textContent = `Last Backup: ${data.lastBackup.taken_on}  (${data.lastBackup.backup_type})  -  ${data.lastBackup.file_name}`;
        latestSuccessFile = data.lastBackup.file_name;
      } else {
        lastBackupEl.textContent = 'Last Backup: Not done yet';
        latestSuccessFile = null;
      }

      const rows = data.recent || [];
      if (!rows.length) {
        if (window.Skeleton) {
          tbody.innerHTML = window.Skeleton.tableEmpty(6, 'No database backups recorded yet', { icon: 'fa-solid fa-database', desc: 'Click "Back Up Database Now" above to trigger an immediate snapshot.' });
        } else {
          tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--txt-muted); font-style:italic;">No backups recorded yet.</td></tr>`;
        }
        return;
      }
      tbody.innerHTML = rows.map((r) => `
        <tr>
          <td data-label="Type">${r.backup_type}</td>
          <td data-label="File Name">${r.file_name}</td>
          <td data-label="Taken On">${r.taken_on}</td>
          <td data-label="Status" style="color:${r.status === 'Success' ? '#2ECC71' : 'var(--red)'}; font-weight:700;">${r.status}</td>
          <td data-label="Details" style="max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${(r.details || '-').replace(/"/g, '&quot;')}">${r.details || '-'}</td>
          <td data-label="">${r.status === 'Success' ? `<button class="btn btn-ghost bk-download-row" style="padding:5px 12px;" data-file="${r.file_name}">Download</button>` : ''}</td>
        </tr>`).join('');

      tbody.querySelectorAll('.bk-download-row').forEach((btn) => {
        btn.addEventListener('click', () => downloadBackup(btn.dataset.file));
      });
    }

    btnDownloadLatest.addEventListener('click', () => {
      if (!latestSuccessFile) {
        if (window.showWarning) window.showWarning('No Backup Yet', 'No successful backup has been taken yet.');
        else window.openModal('No Backup Yet', '<p>No successful backup has been taken yet.</p>');
        return;
      }
      downloadBackup(latestSuccessFile);
    });

    btnForce.addEventListener('click', async () => {
      btnForce.disabled = true;
      const originalLabel = btnForce.innerHTML;
      btnForce.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Backing up...';
      try {
        const result = await window.Api.post('/backup/run');
        const note = result.onNas ? '' : '<br><br><i class="fa-solid fa-circle-info"></i> Note: Network storage is currently unreachable; backup safely saved to the local server storage.';
        if (window.showSuccess) {
          window.showSuccess('Backup Complete', `Data safely backed up as Excel file:<br><strong>${result.fileName}</strong>${note}`);
        } else {
          window.openModal('Backup Complete', `<p>Data safely backed up as Excel file:<br><strong>${result.fileName}</strong>${note}</p>`);
        }
        if (window.showToast) window.showToast('Backup created successfully.', 'success');
      } catch (err) {
        if (window.showError) {
          window.showError('Backup Failed', `Could not generate database backup:<br>${err.message}`);
        } else {
          window.openModal('Backup Failed', `<p style="color:var(--red);">Could not generate backup:<br>${err.message}</p>`);
        }
      } finally {
        btnForce.disabled = false;
        btnForce.innerHTML = originalLabel;
        refreshStatus();
      }
    });

    refreshStatus();
  },
};