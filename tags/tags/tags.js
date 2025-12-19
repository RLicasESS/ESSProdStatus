function $(id) { return document.getElementById(id); }

function normalizeTag(tag) {
  return String(tag || "").trim().replace(/^0+/, "");
}

function loadConfig() {
  $("apiUrl").value = localStorage.getItem("ess_tags_api_url") || "";
  $("secret").value = localStorage.getItem("ess_tags_secret") || "";
}
function saveConfig() {
  localStorage.setItem("ess_tags_api_url", $("apiUrl").value.trim());
  localStorage.setItem("ess_tags_secret", $("secret").value.trim());
}

function getApiUrl() {
  const url = (localStorage.getItem("ess_tags_api_url") || "").trim();
  if (!url) throw new Error("Set Apps Script URL first.");
  return url;
}
function getSecret() {
  return (localStorage.getItem("ess_tags_secret") || "").trim();
}

function show(el, on=true) { el.style.display = on ? "" : "none"; }

function setResult(html, danger=false) {
  const box = $("result");
  box.innerHTML = html;
  box.className = danger ? "card danger" : "card";
  show(box, true);
}

function clearUI() {
  show($("result"), false);
  show($("registerBox"), false);
  show($("tableBox"), false);
}

async function apiGet(action, params={}) {
  const base = getApiUrl();
  const secret = getSecret();
  const u = new URL(base);
  u.searchParams.set("action", action);
  if (secret) u.searchParams.set("secret", secret);
  for (const [k,v] of Object.entries(params)) u.searchParams.set(k, v);

  const res = await fetch(u.toString(), { method: "GET" });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "API error");
  return json;
}

async function apiPost(payload) {
  const base = getApiUrl();
  const secret = getSecret();
  const u = new URL(base);
  if (secret) u.searchParams.set("secret", secret);

  const res = await fetch(u.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "API error");
  return json;
}

async function lookup() {
  clearUI();
  const tag = $("tag").value.trim();
  if (!tag) { setResult("Enter Tag ID", true); return; }

  const out = await apiGet("lookup", { tag });
  if (out.found) {
    const d = out.data;
    $("tag").value = d.TAG_ID; // show full
    setResult(`
      <div><span class="k">TAG_ID</span>${d.TAG_ID}</div>
      <div><span class="k">LOT_ID</span>${d.LOT_ID}</div>
      <div><span class="k">LOT_QTY</span>${d.LOT_QTY}</div>
      <div><span class="k">PRODUCT</span>${d.PRODUCT_NAME}</div>
      <div style="margin-top:10px">
        <button id="deregBtn" style="color:#b00020">Deregister Tag</button>
      </div>
    `);

    $("deregBtn").onclick = async () => {
      if (!confirm(`Deregister tag ${d.TAG_ID}?\nThis will remove it from the Tags Table.`)) return;
      await apiPost({ action: "deregister", tag: d.TAG_ID });

      clearUI();
      setResult(
        "Tag deregistered successfully.<br><br>Please remove the tag from the lot and keep it for future use.",
        false
      );
    };
    return;
  }

  // Not found -> prompt registration
  setResult(`Tag not found: <b>${tag}</b>`, true);
  show($("registerBox"), true);
  $("lot").value = "";
  $("qty").value = "";
  $("product").value = "";
}

async function registerTag() {
  const tag = $("tag").value.trim();
  const lot = $("lot").value.trim();
  const qty = $("qty").value.trim();
  const product = $("product").value.trim();

  if (!tag || !lot || !qty || !product) {
    setResult("All fields are required to register.", true);
    return;
  }

  await apiPost({ action: "register", tag, lot, qty, product });

  show($("registerBox"), false);
  setResult("Registered successfully.", false);

  // Immediately lookup to show saved data
  await lookup();
}

async function viewTable() {
  clearUI();
  show($("tableBox"), true);
  $("tableStatus").textContent = "Loading…";

  const out = await apiGet("all");
  const rows = out.rows || [];

  const tbody = $("table").querySelector("tbody");
  tbody.innerHTML = "";

  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.TAG_ID}</td><td>${r.LOT_ID}</td><td>${r.LOT_QTY}</td><td>${r.PRODUCT_NAME}</td>`;
    tbody.appendChild(tr);
  }

  $("tableStatus").textContent = `Rows: ${rows.length}`;
}

window.addEventListener("DOMContentLoaded", () => {
  loadConfig();

  $("saveApi").onclick = () => { saveConfig(); alert("Saved Apps Script URL"); };
  $("saveSecret").onclick = () => { saveConfig(); alert("Saved Secret"); };

  $("lookup").onclick = () => lookup().catch(e => setResult(e.message, true));
  $("register").onclick = () => registerTag().catch(e => setResult(e.message, true));
  $("cancelRegister").onclick = () => show($("registerBox"), false);

  $("viewTable").onclick = () => viewTable().catch(e => setResult(e.message, true));
  $("closeTable").onclick = () => show($("tableBox"), false);

  $("tag").addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      lookup().catch(e => setResult(e.message, true));
    }
  });
});
