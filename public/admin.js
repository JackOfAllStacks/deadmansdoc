(() => {
  const KEY_STORAGE = "handover:adminKey";

  const keyCard = document.getElementById("key-card");
  const keyForm = document.getElementById("key-form");
  const keyError = document.getElementById("key-error");
  const tableWrap = document.getElementById("table-wrap");
  const recordsBody = document.getElementById("records-body");
  const recordCount = document.getElementById("record-count");
  const recordsEmpty = document.getElementById("records-empty");
  const loadError = document.getElementById("load-error");
  const changeKeyBtn = document.getElementById("change-key");
  const errorsBody = document.getElementById("errors-body");
  const errorCount = document.getElementById("error-count");
  const errorsEmpty = document.getElementById("errors-empty");
  const errorTypeFilter = document.getElementById("error-type-filter");

  let allErrors = [];

  function esc(s) {
    return (s == null ? "" : String(s)).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }

  function fmtDate(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  function getKey() {
    try {
      return sessionStorage.getItem(KEY_STORAGE);
    } catch {
      return null;
    }
  }

  function setKey(key) {
    try {
      sessionStorage.setItem(KEY_STORAGE, key);
    } catch {
      /* non-fatal */
    }
  }

  function clearKey() {
    try {
      sessionStorage.removeItem(KEY_STORAGE);
    } catch {
      /* non-fatal */
    }
  }

  async function loadRecords() {
    loadError.hidden = true;
    const key = getKey();
    if (!key) return showKeyForm();

    try {
      const res = await fetch("/api/admin", {
        method: "GET",
        headers: { "x-admin-key": key },
      });
      if (res.status === 401) {
        clearKey();
        showKeyForm("That key was rejected. Try again.");
        return;
      }
      const body = await res.json();
      if (!res.ok) {
        loadError.textContent = body.error || "Couldn't load records.";
        loadError.hidden = false;
        return;
      }
      renderRecords(body.records);
      renderErrors(body.errors || []);
      keyCard.hidden = true;
      tableWrap.hidden = false;
      changeKeyBtn.hidden = false;
    } catch {
      loadError.textContent = "Couldn't reach the server. Please try again.";
      loadError.hidden = false;
    }
  }

  function showKeyForm(message) {
    keyCard.hidden = false;
    tableWrap.hidden = true;
    changeKeyBtn.hidden = true;
    if (message) {
      keyError.textContent = message;
      keyError.hidden = false;
    }
  }

  function renderRecords(records) {
    recordCount.textContent = records.length ? `(${records.length})` : "";
    recordsEmpty.hidden = records.length > 0;
    recordsBody.innerHTML = records
      .map(
        (r) => `
        <tr data-id="${esc(r.id)}">
          <td><a href="/view.html?code=${encodeURIComponent(r.resume_code)}" target="_blank" rel="noopener"><code>${esc(r.resume_code)}</code></a></td>
          <td>${esc(r.mode)}</td>
          <td>${esc(r.subject_name || "—")}</td>
          <td>${esc(r.status)}</td>
          <td>${esc(r.people_count)}</td>
          <td>${esc(r.facts_count)}</td>
          <td>${esc(r.gaps_count)}</td>
          <td>${esc(fmtDate(r.updated_at))}</td>
          <td><button class="link-button delete-btn" type="button" data-id="${esc(r.id)}">Delete</button></td>
        </tr>
      `
      )
      .join("");
  }

  // Rough severity grouping for the badge color -- not exhaustive, just
  // enough to make "is this the kind of thing I should worry about" scannable.
  const ERROR_BADGE_CLASS = {
    rate_limit: "warn",
    service_unavailable: "warn",
    auth: "bad",
    server_error: "bad",
    network_error: "bad",
    tool_schema_error: "bad",
    not_found: "bad",
    bad_request: "muted-badge",
    client_error: "muted-badge",
    app_error: "muted-badge",
    unexpected_response: "muted-badge",
    unknown: "muted-badge",
  };

  function fmtDuration(ms) {
    if (ms == null) return "—";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function renderErrors(errors) {
    allErrors = errors;

    const types = Array.from(new Set(errors.map((e) => e.error_type || "unknown"))).sort();
    const currentFilter = errorTypeFilter.value;
    errorTypeFilter.innerHTML =
      `<option value="">All</option>` +
      types.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
    errorTypeFilter.value = types.includes(currentFilter) ? currentFilter : "";

    applyErrorFilter();
  }

  function applyErrorFilter() {
    const filter = errorTypeFilter.value;
    const filtered = filter ? allErrors.filter((e) => (e.error_type || "unknown") === filter) : allErrors;

    errorCount.textContent = allErrors.length
      ? filter
        ? `(${filtered.length} of ${allErrors.length})`
        : `(${allErrors.length})`
      : "";
    errorsEmpty.hidden = filtered.length > 0;

    errorsBody.innerHTML = filtered
      .map((e) => {
        const type = e.error_type || "unknown";
        const badgeClass = ERROR_BADGE_CLASS[type] || "muted-badge";
        const providerModel = [e.provider, e.model].filter(Boolean).join(" / ") || "—";
        return `
        <tr>
          <td><code title="${esc(e.id)}">${esc(String(e.id).slice(0, 8))}</code></td>
          <td>${esc(fmtDate(e.created_at))}</td>
          <td><span class="badge ${badgeClass}">${esc(type)}</span></td>
          <td>${e.status_code != null ? esc(e.status_code) : "—"}</td>
          <td>${esc(providerModel)}</td>
          <td>${esc(fmtDuration(e.duration_ms))}</td>
          <td>${esc(e.context)}</td>
          <td>${e.resume_code ? `<a href="/view.html?code=${encodeURIComponent(e.resume_code)}" target="_blank" rel="noopener"><code>${esc(e.resume_code)}</code></a>` : "—"}</td>
          <td>${esc(e.message)}</td>
        </tr>
      `;
      })
      .join("");
  }

  errorTypeFilter.addEventListener("change", applyErrorFilter);

  recordsBody.addEventListener("click", async (e) => {
    const btn = e.target.closest(".delete-btn");
    if (!btn) return;
    const recordId = btn.dataset.id;
    if (!confirm("Permanently delete this record and everything saved for it?")) return;

    const key = getKey();
    btn.disabled = true;
    btn.textContent = "Deleting…";
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": key },
        body: JSON.stringify({ action: "delete", recordId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error || "Couldn't delete that record.");
        btn.disabled = false;
        btn.textContent = "Delete";
        return;
      }
      btn.closest("tr").remove();
    } catch {
      alert("Couldn't reach the server.");
      btn.disabled = false;
      btn.textContent = "Delete";
    }
  });

  keyForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const key = new FormData(keyForm).get("adminKey");
    if (!key) return;
    setKey(key.trim());
    keyError.hidden = true;
    loadRecords();
  });

  changeKeyBtn.addEventListener("click", () => {
    clearKey();
    showKeyForm();
  });

  loadRecords();
})();
