// app.js

// --- NEW: imports for Google auth + Drive storage ---
import { initAuth, getAccessToken } from "./auth.js";
import { setDriveToken, loadAll, saveAll, ensureDbFile, setTokenRefresher, writeVisibleBackup, ensureVisibleFolder } from "./driveStorage.js";
import importView from "./importView.js";


// 0) App-wide in-memory state (same shape as before)
let students = [];                  // was: localStorage 'studentsData'
let archivedStudents = [];          // was: localStorage 'archivedStudentsData'
let parents = [];                   // was: localStorage 'parentsData'
let monthlySchedulesByMonth = {};   // was: localStorage 'monthlySchedulesByMonth'
let salaryReviews = [];             // unchanged (in‑memory derived)

// Drive metadata for the hidden JSON file
let driveMeta = null;
// Track cloud version to detect drift
let lastSeenVersion = null;
let lastSeenModifiedTime = null;

// Debounced save timer
let _saveTimer = null;
// Guard: don't trigger cloud save while we seed localStorage on load
let _suppressPatch = false;

// --- Cloud status UI helper ---
function setCloudStatus(text, color = "#555") {
  let el = document.getElementById("cloud-status");
  if (!el) {
    // Attach to the existing auth bar if present
    const authBar = document.getElementById("auth-bar");
    el = document.createElement("span");
    el.id = "cloud-status";
    el.style.marginLeft = "12px";
    el.style.fontSize = "0.9rem";
    if (authBar) {
      authBar.appendChild(el);
    } else {
      // Fallback: create a small top bar
      const wrap = document.createElement("div");
      wrap.style.cssText = "padding:6px 10px;border-bottom:1px solid #eee;background:#fafafa;";
      wrap.appendChild(el);
      document.body.insertBefore(wrap, document.body.firstChild);
    }
  }
  el.textContent = text;
  el.style.color = color;
}

// Returns the exact bundle shape we persist to Drive's hidden file
function getCurrentBundle() {
  return makeBundleFromState();
}

// One-file import handler: apply bundle and queue a Drive save
async function handleOneFileImport(bundle) {
  // Defensive defaults to avoid undefined keys
  const safe = {
    studentsData: Array.isArray(bundle?.studentsData) ? bundle.studentsData : [],
    archivedStudentsData: Array.isArray(bundle?.archivedStudentsData) ? bundle.archivedStudentsData : [],
    parentsData: Array.isArray(bundle?.parentsData) ? bundle.parentsData : [],
    months: (bundle && typeof bundle.months === "object" && !Array.isArray(bundle.months)) ? bundle.months : {}
  };
  applyBundleToState(safe);      // seeds localStorage + memory
  queueCloudSave();              // debounced save to hidden Drive file
  setCloudStatus("Imported bundle; saving to Drive…");
  router();                      // refresh UI with new data
}

// Visible manual backup: write the current bundle to My Drive
async function exportVisibleDriveNow(filename) {
  try {
    setCloudStatus("Backing up to My Drive…");
    const meta = await writeVisibleBackup(getCurrentBundle(), filename);
    const ts = meta?.modifiedTime ? new Date(meta.modifiedTime).toLocaleString() : "";
    setCloudStatus(`Backup saved to My Drive: ${meta?.name} (${ts})`, "#2a7");
  } catch (e) {
    console.error("[Backup] visible backup failed:", e);
    setCloudStatus("Backup failed. See console.", "#c00");
  }
}



// 1) Helpers to pack/unpack the single JSON we store in Drive
function applyBundleToState(bundle) {
  const safe = {
    studentsData: Array.isArray(bundle?.studentsData) ? bundle.studentsData : [],
    archivedStudentsData: Array.isArray(bundle?.archivedStudentsData) ? bundle.archivedStudentsData : [],
    parentsData: Array.isArray(bundle?.parentsData) ? bundle.parentsData : [],
    // you currently store schedules under "months" in Drive
    monthlySchedulesByMonth: (bundle && typeof bundle.months === "object" && !Array.isArray(bundle.months)) ? bundle.months : {}
  };

  // 1) Seed localStorage so legacy reads stay working
  _suppressPatch = true; // don't trigger cloud save while seeding
  localStorage.setItem("studentsData", JSON.stringify(safe.studentsData));
  localStorage.setItem("archivedStudentsData", JSON.stringify(safe.archivedStudentsData));
  localStorage.setItem("parentsData", JSON.stringify(safe.parentsData));
  localStorage.setItem("monthlySchedulesByMonth", JSON.stringify(safe.monthlySchedulesByMonth));
  _suppressPatch = false;

  // 2) Mirror into in-memory state used by your views
  students = safe.studentsData;
  archivedStudents = safe.archivedStudentsData;
  parents = safe.parentsData;
  monthlySchedulesByMonth = safe.monthlySchedulesByMonth;
}


function makeBundleFromState() {
  return {
    studentsData: students,
    archivedStudentsData: archivedStudents,
    parentsData: parents,
    months: monthlySchedulesByMonth
  };
}

// Handle an imported legacy bundle from the Import view
async function handleLegacyImport(bundle) {
  try {
    // Make sure we have a Drive file to save into
    if (!driveMeta) {
      const { meta } = await loadAll(); // also creates file if missing
      driveMeta = meta;
    }
    // Seed localStorage + memory (your helper does both safely)
    applyBundleToState(bundle);

    // Persist to Drive (debounced)
    queueCloudSave();

    // Optional: navigate back to Profile after import
    // window.location.hash = "#/profile";
  } catch (e) {
    console.error("[Import] Failed to apply/save bundle:", e);
    alert("Import failed. See console for details.");
  }
}


// Intercept direct writes to localStorage from any view and sync them to Drive
(function patchLocalStorage() {
  const watched = new Set([
    "studentsData",
    "archivedStudentsData",
    "parentsData",
    "monthlySchedulesByMonth"
  ]);
  const _origSet = localStorage.setItem.bind(localStorage);

  localStorage.setItem = (key, value) => {
    _origSet(key, value);             // keep original behavior

    if (_suppressPatch) return;       // ignore while seeding on load
    if (!watched.has(key)) return;    // only mirror the keys we store in Drive

    try {
      if (key === "studentsData") students = JSON.parse(value || "[]");
      else if (key === "archivedStudentsData") archivedStudents = JSON.parse(value || "[]");
      else if (key === "parentsData") parents = JSON.parse(value || "[]");
      else if (key === "monthlySchedulesByMonth") monthlySchedulesByMonth = JSON.parse(value || "{}");
    } catch (e) {
      console.warn("[Drive] JSON parse failed for key:", key, e);
    }

    // Any change to these keys should persist to Drive (debounced)
    queueCloudSave();
  };
})();

function showConflictDialog(freshMeta) {
  return new Promise((resolve) => {
    // overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,0.35);
      display:flex; align-items:center; justify-content:center; z-index:9999;
    `;
    // dialog
    const box = document.createElement('div');
    box.style.cssText = `
      background:#fff; padding:16px; max-width:520px; width:92%;
      border-radius:8px; box-shadow:0 10px 30px rgba(0,0,0,.3); font-family:sans-serif;
    `;
    const when = freshMeta?.modifiedTime ? new Date(freshMeta.modifiedTime).toLocaleString() : 'unknown time';
    box.innerHTML = `
      <h3 style="margin:0 0 8px;">Cloud version changed</h3>
      <p style="margin:0 0 12px; color:#444;">
        Someone (or another device) updated this file in Google Drive at <b>${when}</b>.<br>
        Choose what to do:
      </p>
      <div style="display:flex; gap:8px; margin-top:10px;">
        <button id="btn-reload">Reload cloud</button>
        <button id="btn-overwrite">Overwrite with my changes</button>
        <button id="btn-cancel" style="margin-left:auto;">Cancel</button>
      </div>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const cleanup = (val) => { document.body.removeChild(overlay); resolve(val); };
    box.querySelector('#btn-reload').onclick = () => cleanup('reload');
    box.querySelector('#btn-overwrite').onclick = () => cleanup('overwrite');
    box.querySelector('#btn-cancel').onclick = () => cleanup(null);
  });
}



// 2) Centralized debounced cloud save (call after any mutation)
function queueCloudSave() {
  if (!driveMeta) return; // not signed in yet
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    try {
      const bundle = makeBundleFromState();

      // --- Preflight: did the cloud file change since we loaded it? ---
      const freshMeta = await ensureDbFile(); // light metadata call (id, name, version, modifiedTime)
      const drifted =
        lastSeenVersion && freshMeta?.version && freshMeta.version !== lastSeenVersion;

      if (drifted) {
        setCloudStatus("Conflict detected.");
        const choice = await showConflictDialog(freshMeta);

        if (choice === 'reload') {
          // Pull latest cloud copy and replace local state
          const { data, meta } = await loadAll();
          driveMeta = meta;
          lastSeenVersion = meta?.version || null;
          lastSeenModifiedTime = meta?.modifiedTime || null;
          applyBundleToState(data);
          setCloudStatus(`Reloaded cloud version (${new Date(lastSeenModifiedTime).toLocaleString()})`);
          router();
          return; // no save
        }
        if (choice === null) {
          setCloudStatus("Save canceled due to conflict.", "#c00");
          return; // user canceled
        }
        // else: overwrite → fall through to save below
      }

      // --- Save current local state to Drive ---
      setCloudStatus("Saving…");
      const updatedMeta = await saveAll(bundle, driveMeta.id);
      driveMeta = updatedMeta;
      lastSeenVersion = updatedMeta?.version || null;
      lastSeenModifiedTime = updatedMeta?.modifiedTime || null;

      const ts = lastSeenModifiedTime ? new Date(lastSeenModifiedTime).toLocaleString() : "";
      setCloudStatus(`Saved: ${ts}`, "#2a7");
    } catch (err) {
      console.error("[Drive] save failed:", err);
      setCloudStatus("Save failed. See console.", "#c00");
    }
  }, 1500); // debounce
}


// 3) UPDATE FUNCTIONS (minimal changes): now call queueCloudSave() instead of localStorage
function updateStudents(newStudents) {
  students = newStudents;
  queueCloudSave();
}

function updateArchivedStudents(newArchived) {
  archivedStudents = newArchived;
  queueCloudSave();
}

function updateParents(newParents) {
  parents = newParents;
  queueCloudSave();
}

// 4) Main container and router (unchanged except: no more localStorage re-fetch)
const main = document.getElementById('app');

function router() {
  const hash = window.location.hash || '#/profile';
  main.innerHTML = ''; // clear current content

  // NEW: manage the Import / Restore tab here to match current route/state
  const importTab = document.getElementById('tab-import');
  if (importTab) {
    // show the tab only when we have Drive metadata (i.e., signed in & loaded)
    importTab.style.display = driveMeta ? 'inline-block' : 'none';
    // simple "active" hint to match your styling approach
    importTab.style.fontWeight = (hash === '#/import') ? '700' : '400';
  }

  if (hash === '#/profile') {
    studentProfileView.render(main, {
      students,
      archivedStudents,
      monthlySchedulesByMonth,
      onDataUpdate: updateStudents,
      onArchivedDataUpdate: updateArchivedStudents
    });
  }
  else if (hash === '#/monthly') {
    monthlyView.render(main, {
      students,
      monthlySchedulesByMonth,
      parents
      // add other props if needed
    });
  }
  else if (hash === '#/teacher') {
    teacherView.render(main, {
      students,
      archivedStudents,
      monthlySchedules: monthlySchedulesByMonth,
      salaryReviews
    });
  }
  else if (hash === '#/parent') {
    parentProfileView.render(main, {
      parents,
      students,
      archivedStudents,
      onParentDataUpdate: updateParents
    });
  }
  else if (hash === '#/printbill') {
    printingBillView.render(main, {
      parents,
      students,
      archivedStudents,
      monthlySchedulesByMonth
    });
  }
  else if (hash === "#/daysoff") {
    daysOffView.render(main, {
      students,
      monthlySchedulesByMonth
    });
  }
  else if (hash === "#/import") {
    importView.render(main, {
      onImport: handleLegacyImport,          // legacy (3-file) import
      onImportOne: handleOneFileImport,      // one-file import
      onExportVisibleDrive: exportVisibleDriveNow, // visible backup to My Drive
      getBundle: getCurrentBundle            // for "download to device"
    });
  }
  
  else {
    window.location.hash = '#/profile';
  }
}



// 5) Wire router events (unchanged)
window.addEventListener('hashchange', router);

// 6) App boot: initialize Google sign‑in, then load from Drive, then render
const CLIENT_ID = "332987792434-u7r3hdl46asbqo0si3ngqu46kdbgf2at.apps.googleusercontent.com"; // <--- REPLACE THIS

window.addEventListener('load', async () => {
  // Hide all tabs by default; we'll show them after sign-in succeeds
  const navEl = document.querySelector('nav');
  if (navEl) navEl.style.display = 'none';

  // Initialize Google Identity Services (GIS)
  const authHelper = await initAuth({
   onChange: async ({ signedIn }) => {
  // We’ll show/hide the entire nav here
  const navEl = document.querySelector('nav');

  if (!signedIn) {
    // Signed OUT: hide all tabs and ask the user to sign in
    setDriveToken(null);
    if (navEl) navEl.style.display = 'none';  // hide the whole nav bar
    main.innerHTML = '<div style="padding:12px;">Please sign in to Google Drive to load your data.</div>';
    return;
  }

  // Signed IN: show tabs and proceed to load from Drive
  if (navEl) navEl.style.display = '';        // restore default display from CSS
  setDriveToken(getAccessToken());

  try {
    // Ensure hidden DB file exists, then load it
    const file = await ensureDbFile();        // creates empty {} if missing
    const { data, meta } = await loadAll();
    driveMeta = meta;
    applyBundleToState(data);

    // Remember the version/timestamp for conflict detection
    lastSeenVersion = meta?.version || null;
    lastSeenModifiedTime = meta?.modifiedTime || null;

    // After a successful sign-in + data load:
    // go to the Schedule Management tab by default (#/monthly).
    // We change the hash only if we aren't already there to avoid double-render.
    if (window.location.hash !== '#/monthly') {
      window.location.hash = '#/monthly';     // the router will run via hashchange
    } else {
      router();                               // already on #/monthly; just render
    }
  } catch (err) {
    console.error("[Drive] initial load failed:", err);
    main.innerHTML = '<div style="padding:12px;color:#c00;">Failed to load data from Drive. Check console.</div>';
  }
}

  });

  // 🔄 Register token auto-refresh for driveStorage (handles the ~1-hour expiry)
  if (authHelper) {
    setTokenRefresher(async () => {
      const newToken = await authHelper.requireFreshToken();
      setDriveToken(newToken);
      return newToken;
    });
  }
});

