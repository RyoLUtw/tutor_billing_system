// importView.js — two-tab Import/Export admin screen
// Tab 1: Legacy Import (students/parents/schedules in separate files)
// Tab 2: One-file Import/Export (bundle == the exact JSON your app saves to Drive)
// Callbacks expected from app.js:
//   - onImport(bundle): legacy import (already implemented in app.js as handleLegacyImport)
//   - onImportOne(bundle): one-file import (app.js: handleOneFileImport)
//   - onExportVisibleDrive(filename?): visible backup to My Drive (app.js: exportVisibleDriveNow)
//   - getBundle(): returns current bundle for "download to device"

export default {
  render(rootEl, { onImport, onImportOne, onExportVisibleDrive, getBundle }) {
    // Basic layout: simple tab strip + two panels
    rootEl.innerHTML = `
      <div style="padding:16px;max-width:980px;margin:auto;">
        <h2 style="margin:0 0 12px;">Data Tools</h2>
        <div style="display:flex; gap:8px; border-bottom:1px solid #eee; margin-bottom:16px;">
          <button id="tab-legacy" data-tab="legacy" style="border:0;background:none;padding:8px 12px;border-bottom:2px solid #333;font-weight:700;cursor:pointer;">Legacy Import</button>
          <button id="tab-one" data-tab="one" style="border:0;background:none;padding:8px 12px;border-bottom:2px solid transparent;cursor:pointer;">One-file Import / Export</button>
        </div>

        <!-- Panel: Legacy Import -->
        <section id="panel-legacy">
          <p style="color:#555;margin:0 0 16px;">
            Select your previously exported JSON files and click <strong>Import & Save</strong>.
          </p>

          <div style="display:grid;grid-template-columns:180px 1fr;gap:10px 16px;align-items:center;">
            <label>Students JSON</label>
            <input type="file" id="imp-students" accept=".json" />

            <label>Parents JSON</label>
            <input type="file" id="imp-parents" accept=".json" />

            <label>Schedules JSON</label>
            <input type="file" id="imp-schedules" accept=".json" />

            <label>Settings JSON</label>
            <input type="file" id="imp-settings" accept=".json" />
          </div>

          <div style="margin-top:16px;">
            <button id="imp-do">Import & Save</button>
            <button id="imp-clear" style="margin-left:8px;">Clear selections</button>
            <span id="imp-msg" style="margin-left:12px;color:#555;"></span>
          </div>

          <details style="margin-top:16px;color:#666;">
            <summary>Accepted formats</summary>
            <ul>
              <li><b>Students:</b> <code>{studentsData:[], archivedStudentsData:[]}</code>, <code>{active:[], archived:[]}</code>, or <code>[...]</code></li>
              <li><b>Parents:</b> <code>{parentsData:[]}</code> or <code>[...]</code></li>
              <li><b>Schedules:</b> <code>{monthlySchedulesByMonth:{}}</code>, <code>{months:{}}</code>, or a top-level map <code>{"YYYY-MM": {...}}</code></li>
              <li><b>Settings:</b> <code>{appSettings:{pc:{...}, mobile:{...}}}</code>, <code>{settings:{...}}</code>, or an older raw settings object</li>
            </ul>
          </details>
        </section>

        <!-- Panel: One-file Import / Export (bundle) -->
        <section id="panel-one" style="display:none;">
          <p style="color:#555;margin:0 0 12px;">
            The one-file bundle is exactly what the app stores in Drive: 
            <code>{ studentsData, archivedStudentsData, parentsData, months, appSettings }</code>.
          </p>

          <!-- One-file import -->
          <h3 style="margin:12px 0 8px;">One-file Import</h3>
          <div style="display:grid;grid-template-columns:180px 1fr;gap:10px 16px;align-items:center;">
            <label>Bundle JSON</label>
            <input type="file" id="one-bundle" accept=".json" />
          </div>
          <div style="margin-top:12px;">
            <button id="one-import">Apply & Save</button>
            <span id="one-imp-msg" style="margin-left:12px;color:#555;"></span>
          </div>

          <!-- One-file export -->
          <h3 style="margin:18px 0 8px;">One-file Export</h3>
          <div style="display:flex; gap:8px; align-items:center;">
            <button id="one-export-drive">Export to Google Drive</button>
            <button id="one-export-device">Download to Device</button>
            <input id="one-filename" type="text" placeholder="Optional filename…" style="margin-left:8px;min-width:240px;" />
            <span id="one-exp-msg" style="margin-left:12px;color:#555;"></span>
          </div>
        </section>
      </div>
    `;

    // --- Simple tab switcher (no external CSS) ---
    const btnLegacy = rootEl.querySelector('#tab-legacy');
    const btnOne    = rootEl.querySelector('#tab-one');
    const panelLegacy = rootEl.querySelector('#panel-legacy');
    const panelOne    = rootEl.querySelector('#panel-one');

    function activate(tab) {
      const isLegacy = tab === 'legacy';
      // underline / bold current tab
      btnLegacy.style.borderBottomColor = isLegacy ? '#333' : 'transparent';
      btnLegacy.style.fontWeight = isLegacy ? '700' : '400';
      btnOne.style.borderBottomColor = !isLegacy ? '#333' : 'transparent';
      btnOne.style.fontWeight = !isLegacy ? '700' : '400';

      // show/hide panels
      panelLegacy.style.display = isLegacy ? '' : 'none';
      panelOne.style.display = !isLegacy ? '' : 'none';
    }
    btnLegacy.onclick = () => activate('legacy');
    btnOne.onclick    = () => activate('one');
    activate('legacy'); // default tab

    // --- Legacy Import logic (same as before; supports your backup shapes) ---
    const $msg = rootEl.querySelector('#imp-msg');
    const $btn = rootEl.querySelector('#imp-do');
    const $clr = rootEl.querySelector('#imp-clear');

    const $S = rootEl.querySelector('#imp-students');
    const $P = rootEl.querySelector('#imp-parents');
    const $M = rootEl.querySelector('#imp-schedules');
    const $Settings = rootEl.querySelector('#imp-settings');

    const readJson = (inputEl) => new Promise((resolve) => {
      const f = inputEl.files && inputEl.files[0];
      if (!f) return resolve(null);
      const r = new FileReader();
      r.onload = () => {
        try { resolve(JSON.parse(r.result)); }
        catch (e) { resolve({ __parseError: String(e) }); }
      };
      r.readAsText(f);
    });

    function normalizeStudent(stu) {
      if (!stu || typeof stu !== 'object') return stu;
      const out = { ...stu };
      // Normalize classDay -> classDays (CSV -> array)
      if (!Array.isArray(out.classDays)) {
        if (typeof out.classDays === 'string') {
          out.classDays = out.classDays.split(',').map(s => s.trim()).filter(Boolean);
        } else if (typeof out.classDay === 'string') {
          out.classDays = out.classDay.split(',').map(s => s.trim()).filter(Boolean);
        } else {
          out.classDays = out.classDays || [];
        }
      }
      delete out.classDay;
      return out;
    }

    function normalizeStudentsFile(s) {
      const active = Array.isArray(s?.studentsData) ? s.studentsData
                    : Array.isArray(s?.active) ? s.active
                    : Array.isArray(s) ? s
                    : [];
      const archived = Array.isArray(s?.archivedStudentsData) ? s.archivedStudentsData
                      : Array.isArray(s?.archived) ? s.archived
                      : [];
      const normActive = active.map(normalizeStudent);
      const normArchived = archived.map(normalizeStudent);
      const archivedIds = new Set(normArchived.map(x => x?.id).filter(Boolean));
      const dedupActive = normActive.filter(x => x && !archivedIds.has(x.id));
      return { studentsData: dedupActive, archivedStudentsData: normArchived };
    }

    function normalizeParentsFile(p) {
      return Array.isArray(p?.parentsData) ? p.parentsData
           : Array.isArray(p) ? p
           : [];
    }

    function normalizeSchedulesFile(m) {
      // Recognize common containers
      if (m && typeof m?.monthlySchedulesByMonth === 'object' && !Array.isArray(m.monthlySchedulesByMonth)) {
        return m.monthlySchedulesByMonth;
      }
      if (m && typeof m?.months === 'object' && !Array.isArray(m.months)) {
        return m.months;
      }
      // Or a raw top-level month map { "YYYY-MM": {...} }
      if (m && typeof m === 'object' && !Array.isArray(m)) {
        const monthKeys = Object.keys(m);
        const looksLikeMonths = monthKeys.length > 0 &&
          monthKeys.every(k => /^\d{4}-(0[1-9]|1[0-2])$/.test(k) && typeof m[k] === 'object' && !Array.isArray(m[k]));
        if (looksLikeMonths) return m;
      }
      return {};
    }

    function normalizeSettingsFile(s) {
      const source = s?.appSettings || s?.settings || s;
      if (!source || typeof source !== 'object' || Array.isArray(source)) {
        return {};
      }

      const hasProfiles = !!(source.pc || source.mobile || source.desktop);
      if (hasProfiles) {
        const out = {};
        const pc = normalizeVisualSettings(source.pc || source.desktop);
        const mobile = normalizeVisualSettings(source.mobile);
        if (Object.keys(pc).length) out.pc = pc;
        if (Object.keys(mobile).length) out.mobile = mobile;
        return out;
      }

      const shared = normalizeVisualSettings(source);
      if (!Object.keys(shared).length) return {};
      return {
        pc: shared,
        mobile: { ...shared }
      };
    }

    function normalizeVisualSettings(source) {
      if (!source || typeof source !== 'object' || Array.isArray(source)) {
        return {};
      }
      const out = {};
      const rawFontSize = Number(source.contentFontSizeRem);
      if (Number.isFinite(rawFontSize)) {
        out.contentFontSizeRem = Number(Math.min(1.8, Math.max(0.9, rawFontSize)).toFixed(2));
      }
      const numericSettings = [
        ["buttonPaddingY", 4, 24],
        ["buttonPaddingX", 8, 36],
        ["tableCellPaddingY", 6, 32],
        ["tableCellPaddingX", 8, 40]
      ];
      numericSettings.forEach(([key, min, max]) => {
        const value = Number(source[key]);
        if (Number.isFinite(value)) {
          out[key] = Number(Math.min(max, Math.max(min, value)).toFixed(0));
        }
      });
      return out;
    }

    $clr.onclick = () => { $S.value=''; $P.value=''; $M.value=''; $Settings.value=''; $msg.textContent=''; };

    $btn.onclick = async () => {
      if (typeof onImport !== 'function') {
        $msg.textContent = 'Import handler not available.'; $msg.style.color = '#c00'; return;
      }
      $msg.textContent = 'Reading files…'; $msg.style.color = '#555';

      const s = await readJson($S);
      const p = await readJson($P);
      const m = await readJson($M);
      const settings = await readJson($Settings);
      if (s?.__parseError || p?.__parseError || m?.__parseError || settings?.__parseError) {
        $msg.textContent = 'One or more files could not be parsed.'; $msg.style.color = '#c00'; return;
      }

      const { studentsData, archivedStudentsData } = normalizeStudentsFile(s);
      const parentsData = normalizeParentsFile(p);
      const months = normalizeSchedulesFile(m);
      const appSettings = normalizeSettingsFile(settings);
      const bundle = { studentsData, archivedStudentsData, parentsData, months };
      if (Object.keys(appSettings).length) {
        bundle.appSettings = appSettings;
      }

      try {
        $msg.textContent = 'Importing…';
        await onImport(bundle);
        $msg.textContent = 'Imported and saved to Drive.'; $msg.style.color = '#2a7';
      } catch (e) {
        console.error(e);
        $msg.textContent = 'Import failed. See console.'; $msg.style.color = '#c00';
      }
    };

    // --- One-file Import/Export logic ---
    const $oneFile = rootEl.querySelector('#one-bundle');
    const $oneImp  = rootEl.querySelector('#one-import');
    const $oneImpMsg = rootEl.querySelector('#one-imp-msg');

    const $expDrive = rootEl.querySelector('#one-export-drive');
    const $expDevice = rootEl.querySelector('#one-export-device');
    const $expName = rootEl.querySelector('#one-filename');
    const $expMsg = rootEl.querySelector('#one-exp-msg');

    $oneImp.onclick = async () => {
      if (typeof onImportOne !== 'function') {
        $oneImpMsg.textContent = 'Import handler not available.'; $oneImpMsg.style.color = '#c00'; return;
      }
      const f = $oneFile.files && $oneFile.files[0];
      if (!f) { $oneImpMsg.textContent = 'Please choose a bundle JSON first.'; $oneImpMsg.style.color = '#c00'; return; }
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const obj = JSON.parse(reader.result);
          const importedSettings = normalizeSettingsFile(obj);
          // Minimal validation of expected top-level keys
          const bundle = {
            studentsData: Array.isArray(obj?.studentsData) ? obj.studentsData : [],
            archivedStudentsData: Array.isArray(obj?.archivedStudentsData) ? obj.archivedStudentsData : [],
            parentsData: Array.isArray(obj?.parentsData) ? obj.parentsData : [],
            months: (obj && typeof obj?.months === 'object' && !Array.isArray(obj.months)) ? obj.months : {}
          };
          if (Object.keys(importedSettings).length) {
            bundle.appSettings = importedSettings;
          }
          $oneImpMsg.textContent = 'Importing…'; $oneImpMsg.style.color = '#555';
          await onImportOne(bundle);
          $oneImpMsg.textContent = 'Imported and saved to Drive.'; $oneImpMsg.style.color = '#2a7';
        } catch (e) {
          console.error(e);
          $oneImpMsg.textContent = 'Invalid JSON. See console.'; $oneImpMsg.style.color = '#c00';
        }
      };
      reader.readAsText(f);
    };

    $expDrive.onclick = async () => {
      if (typeof onExportVisibleDrive !== 'function' || typeof getBundle !== 'function') {
        $expMsg.textContent = 'Export helpers not available.'; $expMsg.style.color = '#c00'; return;
      }
      try {
        $expMsg.textContent = 'Exporting to My Drive…'; $expMsg.style.color = '#555';
        const filename = ($expName.value || '').trim() || null;
        await onExportVisibleDrive(filename);
        $expMsg.textContent = 'Backup saved to My Drive.'; $expMsg.style.color = '#2a7';
      } catch (e) {
        console.error(e);
        $expMsg.textContent = 'Export to Drive failed. See console.'; $expMsg.style.color = '#c00';
      }
    };

    $expDevice.onclick = () => {
      if (typeof getBundle !== 'function') {
        $expMsg.textContent = 'Exporter not available.'; $expMsg.style.color = '#c00'; return;
      }
      try {
        const bundle = getBundle();
        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        const ts = new Date();
        const defaultName = `tutor_billing_export_${ts.toISOString().slice(0,10)}.json`;
        a.href = URL.createObjectURL(blob);
        a.download = (document.getElementById('one-filename').value || '').trim() || defaultName;
        a.click();
        URL.revokeObjectURL(a.href);
        $expMsg.textContent = 'Downloaded to your device.'; $expMsg.style.color = '#2a7';
      } catch (e) {
        console.error(e);
        $expMsg.textContent = 'Export failed. See console.'; $expMsg.style.color = '#c00';
      }
    };
  }
};
