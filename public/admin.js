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

  function renderErrors(errors) {
    errorCount.textContent = errors.length ? `(${errors.length})` : "";
    errorsEmpty.hidden = errors.length > 0;
    errorsBody.innerHTML = errors
      .map(
        (e) => `
        <tr>
          <td>${esc(fmtDate(e.created_at))}</td>
          <td>${esc(e.context)}</td>
          <td>${e.resume_code ? `<a href="/view.html?code=${encodeURIComponent(e.resume_code)}" target="_blank" rel="noopener"><code>${esc(e.resume_code)}</code></a>` : "—"}</td>
          <td>${esc(e.message)}</td>
        </tr>
      `
      )
      .join("");
  }

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
