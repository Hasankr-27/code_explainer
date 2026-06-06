// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_SIZE  = 100 * 1024;
const SUPPORTED = ['.py', '.js', '.java', '.c', '.cpp'];

const LANG_COLOR = { py:'#3572A5', js:'#c9a800', java:'#B07219', c:'#555', cpp:'#f34b7d' };
const HLJS_LANG  = { py:'python', js:'javascript', java:'java', c:'c', cpp:'cpp' };

// ─── State ────────────────────────────────────────────────────────────────────

let files     = [];    // Array of {name, size, ext, content, parsed}
let activeIdx = null;

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const $  = id => document.getElementById(id);
const dropZone         = $('drop-zone');
const fileInput        = $('file-input');
const browseBtn        = $('browse-btn');
const addFileBtn       = $('add-file-btn');
const uploadSection    = $('upload-section');
const fileListSection  = $('file-list-section');
const fileListEl       = $('file-list');
const codeViewerSection= $('code-viewer-section');
const codeContainer    = $('code-container');
const lineNumsEl       = $('line-nums');
const codeEl           = $('code-el');
const hlOverlay        = $('hl-overlay');
const structureBody    = $('structure-body');
const emptyState       = $('empty-state');
const errorToast       = $('error-toast');
const errorMsg         = $('error-msg');
const closeToast       = $('close-toast');
const fileIndicator    = $('file-indicator');
const activeFileName   = $('active-file-name');
const activeFileLang   = $('active-file-lang');

// ─── Toast ────────────────────────────────────────────────────────────────────

let toastTimer;
function showError(msg) {
    errorMsg.textContent = msg;
    errorToast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => errorToast.classList.add('hidden'), 5000);
}
closeToast.addEventListener('click', () => errorToast.classList.add('hidden'));

// ─── File Management ──────────────────────────────────────────────────────────

function getExt(name) {
    const i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(i).toLowerCase() : '';
}

function fmtSize(b) {
    return b < 1024 ? b + ' B' : Math.round(b / 1024) + ' KB';
}

function addFiles(incoming) {
    for (const f of incoming) {
        const ext = getExt(f.name);
        if (!SUPPORTED.includes(ext)) { showError(`"${f.name}" — unsupported type. Use .py .js .java .c .cpp`); continue; }
        if (f.size > MAX_SIZE)         { showError(`"${f.name}" exceeds 100 KB (${fmtSize(f.size)})`); continue; }
        if (files.some(x => x.name === f.name && x.size === f.size)) continue;

        const reader = new FileReader();
        reader.onload = e => {
            const content = e.target.result;
            const extKey  = ext.slice(1);
            files.push({ name: f.name, size: f.size, ext: extKey, content, parsed: parseCode(content, extKey) });
            if (activeIdx === null) activeIdx = files.length - 1;
            renderAll();
        };
        reader.readAsText(f);
    }
}

function removeFile(idx) {
    files.splice(idx, 1);
    if (files.length === 0) {
        activeIdx = null;
    } else {
        activeIdx = Math.min(activeIdx, files.length - 1);
    }
    clearHighlight();
    renderAll();
}

function selectFile(idx) {
    activeIdx = idx;
    clearHighlight();
    renderAll();
}

// ─── Render All ───────────────────────────────────────────────────────────────

function renderAll() {
    const hasFiles = files.length > 0 && activeIdx !== null;

    uploadSection.classList.toggle('hidden', hasFiles);
    fileListSection.classList.toggle('hidden', !hasFiles);
    codeViewerSection.classList.toggle('hidden', !hasFiles);
    fileIndicator.classList.toggle('hidden', !hasFiles);

    if (hasFiles) {
        const f = files[activeIdx];
        activeFileName.textContent = f.name;
        activeFileLang.textContent = f.ext.toUpperCase();
        renderFileList();
        renderCode(f);
        renderStructure(f);
    } else {
        structureBody.innerHTML = '';
        structureBody.appendChild(emptyState);
        emptyState.classList.remove('hidden');
    }
}

// ─── File List ────────────────────────────────────────────────────────────────

function renderFileList() {
    fileListEl.innerHTML = '';
    files.forEach((f, i) => {
        const li = mk('li', 'file-item' + (i === activeIdx ? ' active' : ''));

        const badge = mk('span', 'file-lang');
        badge.style.background = LANG_COLOR[f.ext] || '#555';
        badge.textContent = f.ext.toUpperCase();

        const name = mk('span', 'file-name');
        name.textContent = f.name;
        name.title = f.name;

        const size = mk('span', 'file-size');
        size.textContent = fmtSize(f.size);

        const rm = mk('button', 'file-remove');
        rm.textContent = '×';
        rm.title = 'Remove';
        rm.addEventListener('click', e => { e.stopPropagation(); removeFile(i); });

        li.append(badge, name, size, rm);
        li.addEventListener('click', () => selectFile(i));
        fileListEl.appendChild(li);
    });
}

// ─── Code Viewer ──────────────────────────────────────────────────────────────

function renderCode(f) {
    const lang = HLJS_LANG[f.ext] || 'plaintext';
    codeEl.innerHTML = hljs.highlight(f.content, { language: lang }).value;

    const lineCount = f.content.split('\n').length;
    lineNumsEl.textContent = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');
}

// ─── Line Highlighting ────────────────────────────────────────────────────────

function highlightLines(lineStart, lineEnd) {
    hlOverlay.innerHTML = '';
    if (lineStart == null) return;

    const lh = lineHeight();
    const pad = 8; // .code-pre top padding

    const band = mk('div', 'hl-band');
    band.style.top    = (pad + (lineStart - 1) * lh) + 'px';
    band.style.height = ((lineEnd - lineStart + 1) * lh) + 'px';
    hlOverlay.appendChild(band);

    // Scroll code container to reveal the highlighted block
    const target = pad + (lineStart - 1) * lh;
    codeContainer.scrollTop = Math.max(0, target - 60);
}

function clearHighlight() {
    hlOverlay.innerHTML = '';
}

function lineHeight() {
    const lines = codeEl.textContent.split('\n').length;
    if (!lines) return 21;
    return codeEl.offsetHeight / lines;
}

// ─── Structure Renderer ───────────────────────────────────────────────────────

function renderStructure(f) {
    structureBody.innerHTML = '';
    const { classes, functions } = f.parsed;

    if (!classes.length && !functions.length) {
        const msg = mk('div', 'empty-state');
        msg.style.flex = '0';
        msg.innerHTML = '<p style="margin-top:20px">No classes or functions detected in this file.</p>';
        structureBody.appendChild(msg);
        return;
    }

    classes.forEach(cls  => structureBody.appendChild(buildClassCard(cls)));
    functions.forEach(fn => structureBody.appendChild(buildFnCard(fn)));
}

/* Class card */
function buildClassCard(cls) {
    const card = mk('div', 's-card cls');
    let collapsed = false;

    // Header
    const hdr = mk('div', 'c-hdr');
    hdr.innerHTML = `
        <span class="chevron">▾</span>
        <span class="badge badge-cls">class</span>
        <span class="c-name" title="${esc(cls.name)}">${esc(cls.name)}</span>
        <span class="c-line">L${cls.lineStart}</span>
        <button class="view-btn">View Code</button>
    `;
    hdr.querySelector('.view-btn').addEventListener('click', e => {
        e.stopPropagation();
        highlightLines(cls.lineStart, cls.lineEnd);
    });
    hdr.addEventListener('click', e => {
        if (e.target.classList.contains('view-btn')) return;
        collapsed = !collapsed;
        card.classList.toggle('collapsed', collapsed);
        body.style.display = collapsed ? 'none' : '';
    });

    // Body
    const body = mk('div', 'c-body');

    if (cls.bases) {
        const ext = mk('div', 'extends-row');
        ext.innerHTML = `<span class="lbl">extends</span><span class="val">${esc(cls.bases)}</span>`;
        body.appendChild(ext);
    }

    if (cls.methods.length) {
        const list = mk('div', 'methods-list');
        cls.methods.forEach(m => list.appendChild(buildMethodCard(m)));
        body.appendChild(list);
    } else {
        const nm = mk('div', 'no-methods');
        nm.textContent = 'No methods detected';
        body.appendChild(nm);
    }

    card.append(hdr, body);
    return card;
}

/* Standalone function card */
function buildFnCard(fn) {
    const card = mk('div', 's-card fn');

    const hdr = mk('div', 'c-hdr');
    hdr.innerHTML = `
        <span class="badge badge-fn">fn</span>
        <span class="c-name" title="${esc(fn.name)}">${esc(fn.name)}</span>
        ${fn.returnType ? `<span class="ret-badge">${esc(fn.returnType)}</span>` : ''}
        <span class="c-line">L${fn.lineStart}</span>
        <button class="view-btn">View Code</button>
    `;
    hdr.querySelector('.view-btn').addEventListener('click', e => {
        e.stopPropagation();
        highlightLines(fn.lineStart, fn.lineEnd);
    });

    card.appendChild(hdr);

    if (fn.params) {
        const body = mk('div', 'c-body');
        const p = mk('div', 'c-params');
        p.innerHTML = `<span class="lbl">params</span>${esc(fn.params)}`;
        body.appendChild(p);
        card.appendChild(body);
    }

    return card;
}

/* Method card inside a class */
function buildMethodCard(m) {
    const card = mk('div', 'm-card');

    const hdr = mk('div', 'm-hdr');
    hdr.innerHTML = `
        <span class="badge badge-method">method</span>
        <span class="m-name" title="${esc(m.name)}">${esc(m.name)}</span>
        ${m.returnType ? `<span class="ret-badge">${esc(m.returnType)}</span>` : ''}
        <span class="m-line">L${m.lineStart}</span>
        <button class="view-btn">View Code</button>
    `;
    hdr.querySelector('.view-btn').addEventListener('click', e => {
        e.stopPropagation();
        highlightLines(m.lineStart, m.lineEnd);
    });
    card.appendChild(hdr);

    if (m.params) {
        const p = mk('div', 'm-params');
        p.innerHTML = `<span style="color:var(--text-dim);margin-right:6px">params</span>${esc(m.params)}`;
        card.appendChild(p);
    }

    return card;
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseCode(code, ext) {
    switch (ext) {
        case 'py':   return parsePython(code);
        case 'js':   return parseJS(code);
        case 'java': return parseJava(code);
        case 'c':    return parseCLike(code, false);
        case 'cpp':  return parseCLike(code, true);
        default:     return { classes: [], functions: [] };
    }
}

// ── Python ─────────────────────────────────────────────────────────────────

function parsePython(code) {
    const lines   = code.split('\n');
    const classes = [];
    const fns     = [];
    const items   = [];  // flat list: {kind, name, indent, lineStart, ...}

    for (let i = 0; i < lines.length; i++) {
        const raw     = lines[i];
        const trimmed = raw.trimStart();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const indent = raw.length - trimmed.length;

        // class
        const cm = trimmed.match(/^class\s+(\w+)(?:\s*\(([^)]*)\))?\s*:/);
        if (cm) {
            items.push({ kind:'class', name: cm[1], bases: (cm[2]||'').trim(), indent, lineStart: i+1 });
            continue;
        }

        // def
        const dm = trimmed.match(/^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([^:]+))?\s*:/);
        if (dm) {
            items.push({
                kind:'def', name: dm[1],
                params: clean(dm[2]),
                returnType: dm[3] ? dm[3].trim() : null,
                indent, lineStart: i+1
            });
        }
    }

    // Compute line ends by next sibling/ancestor at same or lower indent
    for (let i = 0; i < items.length; i++) {
        let end = lines.length;
        for (let j = i+1; j < items.length; j++) {
            if (items[j].indent <= items[i].indent) { end = items[j].lineStart - 1; break; }
        }
        items[i].lineEnd = end;
    }

    // Assign to classes or top-level
    for (const item of items) {
        if (item.kind === 'class') {
            classes.push({ type:'class', ...item, methods:[] });
        } else {
            const parent = [...classes].reverse().find(c =>
                c.lineStart < item.lineStart &&
                c.lineEnd   >= item.lineStart &&
                c.indent    <  item.indent
            );
            const entry = { type: parent ? 'method' : 'function', ...item };
            parent ? parent.methods.push(entry) : fns.push(entry);
        }
    }

    return { classes, functions: fns };
}

// ── JavaScript ─────────────────────────────────────────────────────────────

function parseJS(code) {
    const lines   = code.split('\n');
    const classes = [];
    const fns     = [];

    for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (!t || t.startsWith('//')) continue;

        // class
        const cm = t.match(/^(?:export\s+)?(?:default\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?/);
        if (cm && t.includes('{')) {
            const lineEnd = braceEnd(lines, i);
            const cls = { type:'class', name:cm[1], bases:cm[2]||'', lineStart:i+1, lineEnd, methods:[] };
            parseJSMethods(lines, i, lineEnd, cls.methods);
            classes.push(cls);
            continue;
        }

        // Skip lines inside a class
        if (classes.some(c => i+1 > c.lineStart && i+1 < c.lineEnd)) continue;

        // function declaration
        const fd = t.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/);
        if (fd) { fns.push({ type:'function', name:fd[1], params:clean(fd[2]), lineStart:i+1, lineEnd:braceEnd(lines,i) }); continue; }

        // arrow function / function expression
        const ae = t.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(?([^)=>{]*)\)?\s*=>/);
        if (ae) { fns.push({ type:'function', name:ae[1], params:clean(ae[2]), lineStart:i+1, lineEnd:braceEnd(lines,i) }); continue; }

        const fe = t.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function\s*\(([^)]*)\)/);
        if (fe) { fns.push({ type:'function', name:fe[1], params:clean(fe[2]), lineStart:i+1, lineEnd:braceEnd(lines,i) }); }
    }

    return { classes, functions: fns };
}

function parseJSMethods(lines, clsStart, clsEnd, methods) {
    let depth = 0;
    for (let i = clsStart; i < clsEnd && i < lines.length; i++) {
        const line = lines[i];
        for (const ch of line) {
            if (ch === '{') depth++;
            if (ch === '}') depth--;
        }
        if (depth !== 1) continue;

        const t = line.trim();
        if (!t || t.startsWith('//') || t.startsWith('*')) continue;

        // method(params) { or async/static/get/set method(params) {
        const mm = t.match(/^(?:(?:async|static|get|set)\s+)?(\w+)\s*\(([^)]*)\)\s*\{/);
        if (mm && !['if','for','while','switch','try','catch','else'].includes(mm[1])) {
            const lineEnd = braceEnd(lines, i);
            methods.push({ type:'method', name:mm[1], params:clean(mm[2]), lineStart:i+1, lineEnd });
            i = lineEnd - 2;
            depth = 1;
        }
    }
}

// ── Java ───────────────────────────────────────────────────────────────────

function parseJava(code) {
    const lines   = code.split('\n');
    const classes = [];

    for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (!t || t.startsWith('//') || t.startsWith('*')) continue;

        const cm = t.match(/^(?:(?:public|private|protected|abstract|final|static)\s+)*(?:class|interface|enum)\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+[\w\s,<>]+)?\s*\{/);
        if (cm) {
            const lineEnd = braceEnd(lines, i);
            const cls = { type:'class', name:cm[1], bases:cm[2]||'', lineStart:i+1, lineEnd, methods:[] };
            parseJavaMethods(lines, i, lineEnd, cls.methods);
            classes.push(cls);
        }
    }

    return { classes, functions: [] };
}

function parseJavaMethods(lines, clsStart, clsEnd, methods) {
    let depth = 0;
    for (let i = clsStart; i < clsEnd && i < lines.length; i++) {
        for (const ch of lines[i]) {
            if (ch === '{') depth++;
            if (ch === '}') depth--;
        }
        if (depth !== 1) continue;

        const t = lines[i].trim();
        if (!t || t.startsWith('//') || t.startsWith('*') || t.startsWith('@')) continue;

        // [modifiers] returnType methodName(params) {
        const mm = t.match(/^(?:(?:public|private|protected|static|final|abstract|synchronized|default|native)\s+)*(?:<[^>]+>\s+)?(\w[\w<>\[\]]*)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w\s,]+)?\s*\{/);
        if (mm && !['if','for','while','switch','try'].includes(mm[2])) {
            const lineEnd = braceEnd(lines, i);
            methods.push({ type:'method', name:mm[2], params:clean(mm[3]), returnType:mm[1], lineStart:i+1, lineEnd });
            i = lineEnd - 2;
            depth = 1;
        }
    }
}

// ── C / C++ ────────────────────────────────────────────────────────────────

function parseCLike(code, isCpp) {
    const lines   = code.split('\n');
    const classes = [];
    const fns     = [];

    for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (!t || t.startsWith('//') || t.startsWith('*') || t.startsWith('#')) continue;

        // C++ class/struct
        if (isCpp) {
            const cm = t.match(/^(?:class|struct)\s+(\w+)(?:\s*:\s*(?:public|private|protected)\s+(\w+))?\s*\{/);
            if (cm) {
                const lineEnd = braceEnd(lines, i);
                const cls = { type:'class', name:cm[1], bases:cm[2]||'', lineStart:i+1, lineEnd, methods:[] };
                parseCppMethods(lines, i, lineEnd, cls.methods);
                classes.push(cls);
                i = lineEnd - 2;
                continue;
            }
        }

        // Skip class body
        if (classes.some(c => i+1 > c.lineStart && i+1 < c.lineEnd)) continue;

        // returnType funcName(params) {
        const fm = t.match(/^(?:static\s+|inline\s+|extern\s+)?(\w[\w\s*]*?)\s+(\w+)\s*\(([^)]*)\)\s*(?:const\s*)?\{/);
        if (fm && fm[2] && !['if','for','while','switch','do','else','return'].includes(fm[2]) && fm[1] !== 'else') {
            const lineEnd = braceEnd(lines, i);
            fns.push({ type:'function', name:fm[2], params:clean(fm[3]), returnType:fm[1].trim(), lineStart:i+1, lineEnd });
            i = lineEnd - 2;
        }
    }

    return { classes, functions: fns };
}

function parseCppMethods(lines, clsStart, clsEnd, methods) {
    let depth = 0;
    for (let i = clsStart; i < clsEnd && i < lines.length; i++) {
        for (const ch of lines[i]) {
            if (ch === '{') depth++;
            if (ch === '}') depth--;
        }
        if (depth !== 1) continue;

        const t = lines[i].trim();
        if (!t || t.startsWith('//') || t.startsWith('*')) continue;

        const mm = t.match(/^(?:(?:virtual|static|inline|explicit|const|override)\s+)*(?:\w[\w\s*]*?)\s+(\w+)\s*\(([^)]*)\)\s*(?:const\s*)?\{/);
        if (mm && !['if','for','while','switch','do'].includes(mm[1])) {
            const lineEnd = braceEnd(lines, i);
            methods.push({ type:'method', name:mm[1], params:clean(mm[2]), lineStart:i+1, lineEnd });
            i = lineEnd - 2;
            depth = 1;
        }
    }
}

// ─── Parser Helpers ───────────────────────────────────────────────────────────

/**
 * Find the 1-based line number of the closing brace matching the first '{' on or after startLine.
 * Ignores braces inside strings and line comments.
 */
function braceEnd(lines, startLine) {
    let depth = 0, opened = false;
    for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];
        let inStr = false, strCh = '', skip = false;
        for (let j = 0; j < line.length; j++) {
            const ch = line[j], nx = line[j+1];
            if (skip) { skip = false; continue; }
            if (!inStr && ch === '/' && nx === '/') break;       // line comment
            if (!inStr && ch === '/' && nx === '*') { j++; continue; } // block comment start (simple skip)
            if (!inStr && (ch === '"' || ch === "'" || ch === '`')) { inStr = true; strCh = ch; continue; }
            if (inStr && ch === '\\') { skip = true; continue; }
            if (inStr && ch === strCh) { inStr = false; continue; }
            if (inStr) continue;
            if (ch === '{') { depth++; opened = true; }
            if (ch === '}') { depth--; if (opened && depth === 0) return i + 1; }
        }
    }
    return lines.length;
}

function clean(p) {
    return p ? p.trim().replace(/\s+/g, ' ') : '';
}

// ─── DOM Helpers ──────────────────────────────────────────────────────────────

function mk(tag, cls) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    return el;
}

function esc(s) {
    if (!s) return '';
    return String(s)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;');
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'));
dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('over');
    addFiles(Array.from(e.dataTransfer.files));
});
dropZone.addEventListener('click', e => {
    if (e.target === browseBtn || browseBtn.contains(e.target)) return;
    fileInput.click();
});
browseBtn.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
addFileBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => { addFiles(Array.from(fileInput.files)); fileInput.value = ''; });
