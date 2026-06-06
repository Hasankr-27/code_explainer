// When served from file://, point at the local backend; otherwise use relative URLs.
const API_BASE = window.location.protocol === "file:" ? "http://localhost:8000" : "";
const SESSION_KEY = "code_explainer_session_id";

const MAX_FILE_SIZE = 100 * 1024;
const SUPPORTED_EXTS = [".py", ".js", ".java", ".c", ".cpp"];

// Ext → badge colour map
const EXT_COLORS = {
    py: "#3572A5",
    js: "#c9a800",
    java: "#B07219",
    c: "#555555",
    cpp: "#f34b7d",
};

// DOM refs
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const browseBtn = document.getElementById("browse-btn");
const fileListSection = document.getElementById("file-list-section");
const filesUl = document.getElementById("files-ul");
const analyzeBtn = document.getElementById("analyze-btn");
const btnText = analyzeBtn.querySelector(".btn-text");
const btnSpinner = analyzeBtn.querySelector(".btn-spinner");
const resultsContainer = document.getElementById("results-container");
const remainingCountEl = document.getElementById("remaining-count");
const errorToast = document.getElementById("error-toast");
const errorMessageEl = document.getElementById("error-message");
const closeToast = document.getElementById("close-toast");

let files = [];         // File objects
let selectedIdx = null; // Index of the currently selected file
let toastTimer = null;

// ── Session helpers ──────────────────────────────────────────────────────────

function getSessionId() {
    return localStorage.getItem(SESSION_KEY) || "";
}

function saveSessionId(id) {
    localStorage.setItem(SESSION_KEY, id);
}

function updateRemaining(n) {
    remainingCountEl.textContent = n;
    remainingCountEl.className = n <= 3 ? (n <= 0 ? "danger" : "warn") : "";
}

// ── Toast ────────────────────────────────────────────────────────────────────

function showError(msg) {
    errorMessageEl.textContent = msg;
    errorToast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 6000);
}

function hideToast() {
    errorToast.classList.add("hidden");
}

closeToast.addEventListener("click", hideToast);

// ── File validation & management ──────────────────────────────────────────────

function formatSize(bytes) {
    return bytes < 1024 ? bytes + " B" : Math.round(bytes / 1024) + " KB";
}

function getExt(filename) {
    const parts = filename.split(".");
    return parts.length > 1 ? "." + parts.pop().toLowerCase() : "";
}

function addFiles(incoming) {
    let added = 0;
    for (const f of incoming) {
        const ext = getExt(f.name);
        if (!SUPPORTED_EXTS.includes(ext)) {
            showError(`"${f.name}" desteklenmeyen bir tür. Kabul edilen: .py .js .java .c .cpp`);
            continue;
        }
        if (f.size > MAX_FILE_SIZE) {
            showError(`"${f.name}" 100KB sınırını aşıyor (${formatSize(f.size)}).`);
            continue;
        }
        // Skip duplicates (same name + size)
        if (files.some((x) => x.name === f.name && x.size === f.size)) continue;
        files.push(f);
        added++;
    }
    if (added > 0 && selectedIdx === null) selectedIdx = 0;
    renderFileList();
}

function removeFile(idx) {
    files.splice(idx, 1);
    if (selectedIdx === idx) {
        selectedIdx = files.length > 0 ? Math.min(idx, files.length - 1) : null;
    } else if (selectedIdx !== null && selectedIdx > idx) {
        selectedIdx--;
    }
    renderFileList();
}

function selectFile(idx) {
    selectedIdx = idx;
    renderFileList();
}

function renderFileList() {
    if (files.length === 0) {
        fileListSection.classList.add("hidden");
        analyzeBtn.disabled = true;
        return;
    }

    fileListSection.classList.remove("hidden");
    filesUl.innerHTML = "";

    files.forEach((f, i) => {
        const ext = getExt(f.name).slice(1); // without the dot
        const color = EXT_COLORS[ext] || "#888";
        const isSelected = i === selectedIdx;

        const li = document.createElement("li");
        li.className = "file-item" + (isSelected ? " selected" : "");
        li.innerHTML = `
            <span class="file-ext-badge" style="background:${color}">.${ext}</span>
            <div class="file-info">
                <div class="file-name" title="${escHtml(f.name)}">${escHtml(f.name)}</div>
                <div class="file-size">${formatSize(f.size)}</div>
            </div>
            <button class="file-remove" title="Kaldır" aria-label="Kaldır">×</button>
        `;

        li.querySelector(".file-remove").addEventListener("click", (e) => {
            e.stopPropagation();
            removeFile(i);
        });

        li.addEventListener("click", () => selectFile(i));
        filesUl.appendChild(li);
    });

    analyzeBtn.disabled = selectedIdx === null;
}

// ── Drag & Drop ──────────────────────────────────────────────────────────────

dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));

dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    addFiles(Array.from(e.dataTransfer.files));
});

dropZone.addEventListener("click", (e) => {
    if (e.target === browseBtn || browseBtn.contains(e.target)) return;
    fileInput.click();
});

browseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.click();
});

fileInput.addEventListener("change", () => {
    addFiles(Array.from(fileInput.files));
    fileInput.value = "";
});

// ── Analysis ─────────────────────────────────────────────────────────────────

analyzeBtn.addEventListener("click", async () => {
    if (selectedIdx === null || selectedIdx >= files.length) return;

    const file = files[selectedIdx];
    setLoading(true);

    try {
        const formData = new FormData();
        formData.append("file", file);

        const sessionId = getSessionId();
        const headers = sessionId ? { "X-Session-ID": sessionId } : {};

        const resp = await fetch(`${API_BASE}/analyze`, {
            method: "POST",
            headers,
            body: formData,
        });

        const data = await resp.json();

        if (!resp.ok) {
            showError(data.detail || "Bir hata oluştu. Lütfen tekrar deneyin.");
            return;
        }

        if (data.session_id) saveSessionId(data.session_id);
        if (data.remaining_requests !== undefined) updateRemaining(data.remaining_requests);

        renderResults(data);
    } catch (_err) {
        showError("Sunucuya bağlanılamadı. Backend'in çalıştığından emin olun (uvicorn backend.main:app).");
    } finally {
        setLoading(false);
    }
});

function setLoading(on) {
    analyzeBtn.disabled = on;
    btnText.textContent = on ? "Analiz ediliyor…" : "Analiz Et";
    btnSpinner.classList.toggle("hidden", !on);
}

// ── Render results ────────────────────────────────────────────────────────────

function renderResults(data) {
    resultsContainer.innerHTML = "";

    // File name meta row
    const meta = el("div", "result-meta");
    meta.innerHTML = `Dosya: <strong>${escHtml(data.filename)}</strong>`;
    resultsContainer.appendChild(meta);

    // Summary
    resultsContainer.appendChild(buildSection("Özet", () => {
        const box = el("div", "summary-box");
        box.textContent = data.summary;
        return [box];
    }));

    // Errors
    resultsContainer.appendChild(buildSection("Hatalar ve Sorunlar", () => {
        if (data.errors && data.errors.length > 0) {
            const list = el("div", "errors-list");
            data.errors.forEach((msg) => {
                const item = el("div", "error-item");
                item.innerHTML = `<em class="error-item-icon">⚠</em><span>${escHtml(msg)}</span>`;
                list.appendChild(item);
            });
            return [list];
        }
        const ok = el("div", "no-errors");
        ok.innerHTML = `<span>✓</span> Mantıksal veya algoritmik hata bulunamadı.`;
        return [ok];
    }));

    // Classes / Functions
    if (data.classes && data.classes.length > 0) {
        resultsContainer.appendChild(buildSection(
            `Sınıflar ve Fonksiyonlar (${data.classes.length})`,
            () => {
                const cards = el("div", "class-cards");
                data.classes.forEach((item) => {
                    cards.appendChild(buildClassCard(item));
                });
                return [cards];
            }
        ));
    }
}

function buildSection(title, contentFn) {
    const section = el("div", "result-section");
    const label = el("div", "section-label");
    label.textContent = title;
    section.appendChild(label);
    contentFn().forEach((node) => section.appendChild(node));
    return section;
}

function buildClassCard(item) {
    const type = (item.type || "function").toLowerCase();
    const card = el("div", "class-card");

    const header = el("div", "class-card-header");
    const badge = el("span", `type-badge ${type}`);
    badge.textContent = type;
    const name = el("span", "class-card-name");
    name.textContent = item.name;
    header.appendChild(badge);
    header.appendChild(name);

    const body = el("div", "class-card-body");
    body.textContent = item.explanation;

    card.appendChild(header);
    card.appendChild(body);
    return card;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function el(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
}

function escHtml(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
