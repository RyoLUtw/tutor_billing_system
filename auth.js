// auth.js — adds silent token bootstrap so refreshes don’t require clicking “Sign in”
let tokenClient = null;
let accessToken = null;
let tokenExpiryMs = 0; // epoch ms

const SCOPES = [
  "https://www.googleapis.com/auth/drive.appdata", // hidden DB file
  "https://www.googleapis.com/auth/drive.file"     // optional visible backups
].join(" ");

// A harmless local hint so we can know they’ve granted once (we do NOT store tokens)
const GRANT_HINT_KEY = "drive_grant_hint";

// NEW: set when the user explicitly clicks Sign out; blocks silent bootstrap
const SIGNED_OUT_KEY = "drive_signed_out";



// Expose current token to other modules
export function getAccessToken() { return accessToken; }

// Wait until the GIS script is available
function waitForGIS() {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function poll() {
      if (window.google?.accounts?.oauth2) return resolve();
      if (Date.now() - start > 5000) return reject(new Error("Google Identity Services not loaded"));
      setTimeout(poll, 50);
    })();
  });
}

export function initAuth({ onChange } = {}) {
  const $in = document.getElementById("signin");
  const $out = document.getElementById("signout");
  const $status = document.getElementById("auth-status");

  // small UI helper
  const setUi = (signedIn) => {
    if (!$in || !$out || !$status) return;
    $in.style.display = signedIn ? "none" : "inline-block";
    $out.style.display = signedIn ? "inline-block" : "none";
    $status.textContent = signedIn ? "Connected to Google Drive" : "Not signed in";
  };
  setUi(false);

  return waitForGIS().then(() => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: "332987792434-u7r3hdl46asbqo0si3ngqu46kdbgf2at.apps.googleusercontent.com", // keep your actual Client ID here
      scope: SCOPES,
      callback: (resp) => {
        // Called on successful token fetch (silent or via button)
        accessToken = resp.access_token;

        // Tokens last ~1 hour; renew slightly early
        const ttlSec = resp.expires_in ? Math.max(0, resp.expires_in - 300) : 3000; // minus 5 min
        tokenExpiryMs = Date.now() + ttlSec * 1000;

        // Remember grant; and clear "signed out" because user just signed in
        try {
          localStorage.setItem(GRANT_HINT_KEY, "1");
          localStorage.removeItem(SIGNED_OUT_KEY); // <-- NEW
        } catch { }

        setUi(true);
        onChange?.({ signedIn: true });
        console.log("[Auth] Token received; expires in ~", Math.round(ttlSec / 60), "min");
      },
    });

    // Wire the buttons (first time needs a user gesture with prompt:'consent')
    if ($in) $in.onclick = () => tokenClient.requestAccessToken({ prompt: "consent" });
    if ($out) $out.onclick = () => {
      // Clear in-memory token
      accessToken = null;
      tokenExpiryMs = 0;

      // Mark that the user intentionally signed out (blocks silent bootstrap)
      try {
        localStorage.setItem(SIGNED_OUT_KEY, "1");
        localStorage.removeItem(GRANT_HINT_KEY); // optional: also remove the grant hint
      } catch { }

      setUi(false);
      onChange?.({ signedIn: false });
      console.log("[Auth] Signed out (token cleared; silent bootstrap disabled)");
    };


    // Silent bootstrap on page load — but only if user hasn't explicitly signed out
    setTimeout(() => {
      try {
        const grantHint = localStorage.getItem(GRANT_HINT_KEY) === "1";
        const signedOut = localStorage.getItem(SIGNED_OUT_KEY) === "1";
        if (grantHint && !signedOut) {
          tokenClient.requestAccessToken({ prompt: "" }); // silent token fetch
        } else {
          // Remain signed out until user clicks Sign in
          // console.debug("[Auth] Silent bootstrap skipped (signedOut or no grant)");
        }
      } catch {
        // ignore; user can click Sign in manually
      }
    }, 0);


    // Helper your app can call to refresh the token silently when it expires mid-session
    return {
      requireFreshToken: async () => {
        // Don’t auto-refresh if user explicitly signed out
        const signedOut = localStorage.getItem(SIGNED_OUT_KEY) === "1";
        if (signedOut) return null;
    
        if (!accessToken || Date.now() > tokenExpiryMs) {
          tokenClient.requestAccessToken({ prompt: "" }); // silent renew
          await new Promise(r => setTimeout(r, 200));     // wait for callback
        }
        setUi(!!accessToken);
        return accessToken;
      }
    };
  }).catch(err => {
    console.error(err);
    return null;
  });
}
