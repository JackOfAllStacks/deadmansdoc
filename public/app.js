(() => {
  const state = {
    recordId: null,
    sessionId: null,
    resumeCode: null,
  };

  const screenStart = document.getElementById("screen-start");
  const screenChat = document.getElementById("screen-chat");
  const startForm = document.getElementById("start-form");
  const resumeForm = document.getElementById("resume-form");
  const showResumeBtn = document.getElementById("show-resume");
  const startError = document.getElementById("start-error");
  const parentFields = document.getElementById("parent-fields");
  const messagesEl = document.getElementById("messages");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const resumeBadge = document.getElementById("resume-badge");

  startForm.addEventListener("change", (e) => {
    if (e.target.name === "mode") {
      parentFields.hidden = e.target.value !== "parent";
    }
  });

  showResumeBtn.addEventListener("click", () => {
    resumeForm.hidden = !resumeForm.hidden;
  });

  function showError(msg) {
    startError.textContent = msg;
    startError.hidden = false;
  }

  function addBubble(role, text) {
    const div = document.createElement("div");
    div.className = `bubble ${role}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function enterChat({ recordId, sessionId, resumeCode, history }) {
    state.recordId = recordId;
    state.sessionId = sessionId;
    state.resumeCode = resumeCode;

    try {
      localStorage.setItem("handover:lastResumeCode", resumeCode);
    } catch {
      /* localStorage unavailable, non-fatal */
    }

    resumeBadge.hidden = false;
    resumeBadge.textContent = `Your code to come back: ${resumeCode}`;

    screenStart.hidden = true;
    screenChat.hidden = false;

    messagesEl.innerHTML = "";
    if (history && history.length) {
      for (const m of history) addBubble(m.role, m.content);
      addBubble("system-note", "Picking back up where you left off.");
    } else {
      addBubble(
        "system-note",
        "Write down your code above somewhere safe — it's how you get back in if you stop."
      );
    }
    chatInput.focus();
  }

  startForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    startError.hidden = true;
    const data = new FormData(startForm);
    const payload = {
      action: "create",
      mode: data.get("mode"),
      subjectName: data.get("subjectName") || null,
      initiatorRelationship: data.get("initiatorRelationship") || null,
      whoIsPresent: data.get("whoIsPresent") || null,
      consentGiven: data.get("consent") === "on",
    };

    try {
      const res = await fetch("/api/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) return showError(body.error || "Couldn't start a session.");
      enterChat(body);
    } catch {
      showError("Couldn't reach the server. Please try again.");
    }
  });

  resumeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    startError.hidden = true;
    const data = new FormData(resumeForm);
    const payload = {
      action: "resume",
      resumeCode: data.get("resumeCode"),
      whoIsPresent: data.get("whoIsPresent") || null,
    };

    try {
      const res = await fetch("/api/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) return showError(body.error || "Couldn't find that code.");
      enterChat(body);
    } catch {
      showError("Couldn't reach the server. Please try again.");
    }
  });

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = "";
    addBubble("user", text);

    const thinking = addBubble("assistant", "...");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId: state.recordId,
          sessionId: state.sessionId,
          message: text,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        thinking.textContent = body.error || "Something went wrong.";
        return;
      }
      thinking.textContent = body.reply;
    } catch {
      thinking.textContent = "Couldn't reach the server. Please try again.";
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
  });

  try {
    const lastCode = localStorage.getItem("handover:lastResumeCode");
    if (lastCode) {
      const input = resumeForm.querySelector('[name="resumeCode"]');
      if (input) input.value = lastCode;
    }
  } catch {
    /* localStorage unavailable, non-fatal */
  }
})();
