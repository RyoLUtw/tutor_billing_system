// driveStorage.js  — Drive adapter with optional token auto-refresh

let TOKEN = null;
let getFreshToken = null; // function that returns a fresh access token string

export function setDriveToken(t) { TOKEN = t; }
export function setTokenRefresher(fn) { getFreshToken = fn; }

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const DB_NAME = "tutor_billing.json";

async function call(url, opts = {}) {
  if (!TOKEN) throw new Error("Not signed in");

  // First attempt with current token
  const doFetch = async (bearer) => {
    const headers = { ...(opts.headers || {}), Authorization: `Bearer ${bearer}` };
    const res = await fetch(url, { ...opts, headers });
    return res;
  };

  let res = await doFetch(TOKEN);

  // If expired/invalid and we have a refresher, try once more
  if (res.status === 401 && typeof getFreshToken === "function") {
    try {
      const newToken = await getFreshToken(); // app supplies this
      if (newToken) {
        TOKEN = newToken; // update cached token
        res = await doFetch(newToken);
      }
    } catch (e) {
      // fall through; we'll throw the 401 below
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res;
}

async function findDbFile() {
  const q = encodeURIComponent(`name='${DB_NAME}' and trashed=false`);
  const url = `${API}/files?q=${q}&spaces=appDataFolder&fields=files(id,name,modifiedTime,version)`;
  const data = await (await call(url)).json();
  return data.files?.[0] || null;
}

async function createEmptyDb() {
  const metadata = { name: DB_NAME, parents: ["appDataFolder"], mimeType: "application/json" };
  const body =
    `--foo\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--foo\r\nContent-Type: application/json\r\n\r\n{}\r\n--foo--`;
  const url = `${UPLOAD}/files?uploadType=multipart&fields=id,name,modifiedTime,version`;
  const res = await call(url, { method: "POST", headers: { "Content-Type": "multipart/related; boundary=foo" }, body });
  return res.json();
}

export async function ensureDbFile() {
  return (await findDbFile()) || (await createEmptyDb());
}

export async function loadAll() {
  const file = await ensureDbFile();
  const url = `${API}/files/${file.id}?alt=media`; // download raw JSON
  const txt = await (await call(url)).text();
  const data = txt ? JSON.parse(txt) : {};
  return { data, meta: file };
}

export async function saveAll(obj, fileId) {
  const metadata = { name: DB_NAME, mimeType: "application/json" };
  const body =
    `--foo\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--foo\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(obj)}\r\n--foo--`;
  const url = `${UPLOAD}/files/${fileId}?uploadType=multipart&fields=id,name,modifiedTime,version`;
  const res = await call(url, { method: "PATCH", headers: { "Content-Type": "multipart/related; boundary=foo" }, body });
  return res.json(); // updated metadata
}

// Optional: quick smoke test
export async function smokeTestDrive() {
  const { data, meta } = await loadAll();
  const updated = { ...data, __lastOpenedAt: new Date().toISOString() };
  await saveAll(updated, meta.id);
  console.log("[Drive] heartbeat wrote to", meta.name);
}

// --- Visible backup helpers (My Drive), NOT in appDataFolder ---

// Creates (if needed) and returns a visible folder in "My Drive"
// Default name: "Tutor Billing System"
export async function ensureVisibleFolder(name = "Tutor Billing System") {
  // Look for an existing folder with this name
  const q = encodeURIComponent(
    `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const url = `${API}/files?q=${q}&fields=files(id,name)`;
  const found = await (await call(url)).json();
  if (found.files?.length) return found.files[0];

  // Create the folder
  const meta = { name, mimeType: "application/vnd.google-apps.folder" };
  const res = await call(`${API}/files?fields=id,name`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(meta)
  });
  return res.json();
}

// Writes the provided bundle JSON as a visible, timestamped backup file
// Returns the created file's metadata { id, name, modifiedTime }
export async function writeVisibleBackup(bundle, filename) {
  const folder = await ensureVisibleFolder("Tutor Billing System");
  const ts = new Date();
  const defaultName = `backup_${ts.toISOString().slice(0,10)}_${String(ts.getHours()).padStart(2,"0")}${String(ts.getMinutes()).padStart(2,"0")}${String(ts.getSeconds()).padStart(2,"0")}.json`;
  const name = filename || defaultName;

  const meta = {
    name,
    parents: [folder.id],
    mimeType: "application/json"
  };

  // Multipart upload: metadata + JSON content in one request
  const body =
    `--foo\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--foo\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(bundle)}\r\n--foo--`;

  const url = `${UPLOAD}/files?uploadType=multipart&fields=id,name,modifiedTime`;
  const res = await call(url, {
    method: "POST",
    headers: { "Content-Type": "multipart/related; boundary=foo" },
    body
  });
  return res.json();
}
