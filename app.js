// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_SIZE  = 50 * 1024;
const SUPPORTED = ['.py', '.js', '.java', '.c', '.cpp'];

const LANG_COLOR = { py:'#3572A5', js:'#c9a800', java:'#B07219', c:'#555', cpp:'#f34b7d' };
const HLJS_LANG  = { py:'python', js:'javascript', java:'java', c:'c', cpp:'cpp' };

// ─── Translations ─────────────────────────────────────────────────────────────

const TRANSLATIONS = {
    en: {
        files:'FILES', source:'SOURCE',
        tabStruct:'Structure', tabRel:'Relations', tabDiag:'Diagram',
        dropMain:'Drop files here', dropOr:'or', browse:'browse',
        dropHint:'.py .js .java .c .cpp · max 50 KB',
        emptyMain:'Upload a source file to explore its structure',
        emptyHint:'Supports Python, JavaScript, Java, C, C++',
        noClasses:'No classes or functions detected in this file.',
        noMethods:'No methods detected', viewCode:'View Code', view:'View',
        extends:'extends', implements:'implements', creates:'new →', subclass:'↳ subclass',
        secTypes:'Class Types', secInh:'Inheritance', secInst:'Object Creation',
        params:'params', addFiles:'Add files',
        legExt:'extends', legImpl:'implements', legNew:'creates (new)',
        typeAbstract:'abstract', typeInterface:'interface', typeConcrete:'class',
        noRel:'No classes found to analyze.',
        noDiag:'Upload a file to generate the diagram.',
        errUnsupported:'is not a supported file type. Use .py .js .java .c .cpp',
        errTooBig:'exceeds the 50 KB limit'
    },
    tr: {
        files:'DOSYALAR', source:'KAYNAK',
        tabStruct:'Yapı', tabRel:'İlişkiler', tabDiag:'Diyagram',
        dropMain:'Dosyaları buraya bırakın', dropOr:'veya', browse:'gözat',
        dropHint:'.py .js .java .c .cpp · maks 50 KB',
        emptyMain:'Yapıyı keşfetmek için bir kaynak dosyası yükleyin',
        emptyHint:'Python, JavaScript, Java, C, C++ desteklenir',
        noClasses:'Bu dosyada sınıf veya fonksiyon bulunamadı.',
        noMethods:'Metot bulunamadı', viewCode:'Kodu Gör', view:'Gör',
        extends:'genişletir', implements:'uygular', creates:'yeni →', subclass:'↳ alt sınıf',
        secTypes:'Sınıf Tipleri', secInh:'Kalıtım', secInst:'Nesne Oluşturma',
        params:'parametre', addFiles:'Dosya ekle',
        legExt:'genişletir', legImpl:'uygular', legNew:'oluşturur (new)',
        typeAbstract:'soyut', typeInterface:'arayüz', typeConcrete:'sınıf',
        noRel:'Analiz edilecek sınıf bulunamadı.',
        noDiag:'Diyagram oluşturmak için dosya yükleyin.',
        errUnsupported:'desteklenmeyen dosya türü. .py .js .java .c .cpp kullanın',
        errTooBig:'50 KB sınırını aşıyor'
    }
};

let uiLang = 'en';
function t(key) { return TRANSLATIONS[uiLang][key] || TRANSLATIONS.en[key] || key; }

function switchLang(newLang) {
    uiLang = newLang;
    $('btn-en').classList.toggle('active', uiLang === 'en');
    $('btn-tr').classList.toggle('active', uiLang === 'tr');
    document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
    if (activeIdx !== null) renderAll();
}

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
const relationsBody    = $('relations-body');
const diagramBody      = $('diagram-body');
const diagramSvg       = $('diagram-svg');
const emptyState       = $('empty-state');
const errorToast       = $('error-toast');
const errorMsg         = $('error-msg');
const closeToast       = $('close-toast');
const fileIndicator    = $('file-indicator');
const activeFileName   = $('active-file-name');
const activeFileLang   = $('active-file-lang');

let activeTab = 'struct';

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
        if (!SUPPORTED.includes(ext)) { showError(`"${f.name}" — ${t('errUnsupported')}`); continue; }
        if (f.size > MAX_SIZE)         { showError(`"${f.name}" ${t('errTooBig')} (${fmtSize(f.size)})`); continue; }
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

// ─── Tab Switching ────────────────────────────────────────────────────────────

function switchTab(tab) {
    activeTab = tab;
    $('tab-struct').classList.toggle('active', tab === 'struct');
    $('tab-rel').classList.toggle('active', tab === 'rel');
    $('tab-diag').classList.toggle('active', tab === 'diag');
    structureBody.classList.toggle('hidden', tab !== 'struct');
    relationsBody.classList.toggle('hidden', tab !== 'rel');
    diagramBody.classList.toggle('hidden', tab !== 'diag');
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
        renderRelations(f);
        renderDiagram(f);
    } else {
        structureBody.innerHTML = '';
        structureBody.appendChild(emptyState);
        emptyState.classList.remove('hidden');
        relationsBody.innerHTML = '';
        diagramSvg.innerHTML = '';
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
    const hlLang = HLJS_LANG[f.ext] || 'plaintext';
    codeEl.innerHTML = hljs.highlight(f.content, { language: hlLang }).value;

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
        msg.innerHTML = `<p style="margin-top:20px">${t('noClasses')}</p>`;
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

    const hdr = mk('div', 'c-hdr');
    hdr.innerHTML = `
        <span class="chevron">▾</span>
        <span class="badge badge-cls">class</span>
        <span class="c-name" title="${esc(cls.name)}">${esc(cls.name)}</span>
        <span class="c-line">L${cls.lineStart}</span>
        <button class="view-btn">${t('viewCode')}</button>
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

    const body = mk('div', 'c-body');

    if (cls.bases) {
        const ext = mk('div', 'extends-row');
        ext.innerHTML = `<span class="lbl">${t('extends')}</span><span class="val">${esc(cls.bases)}</span>`;
        body.appendChild(ext);
    }

    if (cls.methods.length) {
        const list = mk('div', 'methods-list');
        cls.methods.forEach(m => list.appendChild(buildMethodCard(m)));
        body.appendChild(list);
    } else {
        const nm = mk('div', 'no-methods');
        nm.textContent = t('noMethods');
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
        <button class="view-btn">${t('viewCode')}</button>
    `;
    hdr.querySelector('.view-btn').addEventListener('click', e => {
        e.stopPropagation();
        highlightLines(fn.lineStart, fn.lineEnd);
    });

    card.appendChild(hdr);

    if (fn.params || fn.description) {
        const body = mk('div', 'c-body');
        if (fn.description) {
            const d = mk('div', 'c-desc');
            d.textContent = fn.description;
            body.appendChild(d);
        }
        if (fn.params) {
            const p = mk('div', 'c-params');
            p.innerHTML = `<span class="lbl">${t('params')}</span>${esc(fn.params)}`;
            body.appendChild(p);
        }
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
        <button class="view-btn">${t('viewCode')}</button>
    `;
    hdr.querySelector('.view-btn').addEventListener('click', e => {
        e.stopPropagation();
        highlightLines(m.lineStart, m.lineEnd);
    });
    card.appendChild(hdr);

    if (m.description) {
        const d = mk('div', 'm-desc');
        d.textContent = m.description;
        card.appendChild(d);
    }
    if (m.params) {
        const p = mk('div', 'm-params');
        p.innerHTML = `<span style="color:var(--text-dim);margin-right:6px">${t('params')}</span>${esc(m.params)}`;
        card.appendChild(p);
    }

    return card;
}

// ─── Relations Analysis ───────────────────────────────────────────────────────

function analyzeRelations(code, classes, ext) {
    const lines = code.split('\n');
    const classNames = new Set(classes.map(c => c.name));

    const classType = {};
    for (const line of lines) {
        const trimLine = line.trim();
        let m;
        if ((m = trimLine.match(/(?:^|\s)abstract\s+class\s+(\w+)/)))  classType[m[1]] = 'abstract';
        if ((m = trimLine.match(/(?:^|\s)interface\s+(\w+)/)))          classType[m[1]] = 'interface';
        if ((m = trimLine.match(/(?:^|\s)enum\s+(\w+)/)))               classType[m[1]] = 'enum';
    }
    classes.forEach(c => { if (!classType[c.name]) classType[c.name] = 'concrete'; });

    const implementsMap = {};
    for (const line of lines) {
        const m = line.match(/class\s+(\w+)(?:\s+extends\s+\w+)?\s+implements\s+([\w\s,<>]+?)\s*(?:\{|$)/);
        if (m) {
            implementsMap[m[1]] = m[2].split(',').map(s => s.replace(/<[^>]*>/g,'').trim()).filter(Boolean);
        }
    }

    const instantiation = {};
    classes.forEach(cls => {
        const body = lines.slice(cls.lineStart - 1, cls.lineEnd).join('\n');
        const creates = new Set();
        const re = /\bnew\s+(\w+)\s*[(<[]/g;
        let m;
        while ((m = re.exec(body)) !== null) {
            const name = m[1];
            if (classNames.has(name) && name !== cls.name) creates.add(name);
        }
        if (creates.size) instantiation[cls.name] = [...creates];
    });

    const methodCreates = {};
    classes.forEach(cls => {
        cls.methods.forEach(m => {
            const body = lines.slice(m.lineStart - 1, m.lineEnd).join('\n');
            const creates = new Set();
            const re = /\bnew\s+(\w+)\s*[(<[]/g;
            let match;
            while ((match = re.exec(body)) !== null) {
                const name = match[1];
                if (classNames.has(name)) creates.add(name);
            }
            if (creates.size) methodCreates[`${cls.name}.${m.name}`] = [...creates];
        });
    });

    return { classType, implementsMap, instantiation, methodCreates };
}

// ─── Relations Renderer ───────────────────────────────────────────────────────

function renderRelations(f) {
    relationsBody.innerHTML = '';
    const { classes } = f.parsed;

    if (!classes.length) {
        const e = mk('div', 'empty-state');
        e.innerHTML = `<p>${t('noRel')}</p>`;
        relationsBody.appendChild(e);
        return;
    }

    const rel = analyzeRelations(f.content, classes, f.ext);

    // ── Section 1: Class Types ──
    const typeSection = relSection('type', t('secTypes'));
    classes.forEach(cls => {
        const ct  = rel.classType[cls.name] || 'concrete';
        const card = mk('div', 'rel-card');
        const hdr  = mk('div', 'rel-card-hdr');

        const badge = mk('span', 'rel-badge rb-' + ct);
        badge.textContent = ct;

        const name = mk('span', 'rel-name');
        name.textContent = cls.name;

        const viewBtn = mk('button', 'view-btn');
        viewBtn.textContent = t('view');
        viewBtn.addEventListener('click', () => {
            switchTab('struct');
            highlightLines(cls.lineStart, cls.lineEnd);
        });

        hdr.append(badge, name, viewBtn);
        card.appendChild(hdr);

        const rows = [];

        if (cls.bases) {
            rows.push(relRow(t('extends'), [{ text: cls.bases, cls: 'ext' }]));
        }

        const impls = rel.implementsMap[cls.name];
        if (impls && impls.length) {
            rows.push(relRow(t('implements'), impls.map(i => ({ text: i, cls: 'impl' }))));
        }

        const creates = rel.instantiation[cls.name];
        if (creates && creates.length) {
            rows.push(relRow(t('creates'), creates.map(c => ({ text: c, cls: 'new' }))));
        }

        if (rows.length) {
            const rowsWrap = mk('div', 'rel-rows');
            rows.forEach(r => rowsWrap.appendChild(r));
            card.appendChild(rowsWrap);
        }

        typeSection.appendChild(card);
    });
    relationsBody.appendChild(typeSection);

    // ── Section 2: Inheritance Map ──
    const hasInheritance = classes.some(c => c.bases || rel.implementsMap[c.name]);
    if (hasInheritance) {
        const inhSection = relSection('inh', t('secInh'));
        const childrenOf = {};
        classes.forEach(cls => {
            if (cls.bases) {
                if (!childrenOf[cls.bases]) childrenOf[cls.bases] = [];
                childrenOf[cls.bases].push(cls);
            }
        });
        Object.entries(childrenOf).forEach(([parent, children]) => {
            const card = mk('div', 'rel-card');
            const hdr  = mk('div', 'rel-card-hdr');
            const name = mk('span', 'rel-name');
            name.textContent = parent;
            const badge = mk('span', 'rel-badge rb-' + (rel.classType[parent] || 'concrete'));
            badge.textContent = rel.classType[parent] || 'class';
            hdr.append(badge, name);
            card.appendChild(hdr);

            const rowsWrap = mk('div', 'rel-rows');
            children.forEach(child => {
                const row = mk('div', 'rel-row');
                const lbl = mk('span', 'rel-row-label');
                lbl.textContent = t('subclass');
                const targets = mk('div', 'rel-targets');
                const tEl = mk('span', 'rel-target ext');
                tEl.textContent = child.name;
                tEl.addEventListener('click', () => { switchTab('struct'); highlightLines(child.lineStart, child.lineEnd); });
                targets.appendChild(tEl);
                row.append(lbl, targets);
                rowsWrap.appendChild(row);
            });
            card.appendChild(rowsWrap);
            inhSection.appendChild(card);
        });
        relationsBody.appendChild(inhSection);
    }

    // ── Section 3: Object Instantiation Map ──
    if (Object.keys(rel.instantiation).length) {
        const instSection = relSection('inst', t('secInst'));
        Object.entries(rel.instantiation).forEach(([creator, created]) => {
            const cls = classes.find(c => c.name === creator);
            const card = mk('div', 'rel-card');
            const hdr  = mk('div', 'rel-card-hdr');
            const name = mk('span', 'rel-name');
            name.textContent = creator;
            const badge = mk('span', 'rel-badge rb-' + (rel.classType[creator] || 'concrete'));
            badge.textContent = rel.classType[creator] || 'class';
            if (cls) {
                const v = mk('button', 'view-btn');
                v.textContent = t('view');
                v.addEventListener('click', () => { switchTab('struct'); highlightLines(cls.lineStart, cls.lineEnd); });
                hdr.append(badge, name, v);
            } else {
                hdr.append(badge, name);
            }
            card.appendChild(hdr);

            const rowsWrap = mk('div', 'rel-rows');
            rowsWrap.appendChild(relRow(t('creates'), created.map(c => ({ text: c, cls: 'new' }))));

            cls && cls.methods.forEach(m => {
                const key = `${creator}.${m.name}`;
                const mc = rel.methodCreates[key];
                if (mc && mc.length) {
                    const mRow = mk('div', 'rel-row');
                    const lbl = mk('span', 'rel-row-label');
                    lbl.style.fontFamily = 'var(--mono)';
                    lbl.textContent = m.name + '()';
                    const targets = mk('div', 'rel-targets');
                    mc.forEach(c => {
                        const tEl = mk('span', 'rel-target new');
                        tEl.textContent = 'new ' + c;
                        tEl.addEventListener('click', () => {
                            switchTab('struct'); highlightLines(m.lineStart, m.lineEnd);
                        });
                        targets.appendChild(tEl);
                    });
                    mRow.append(lbl, targets);
                    rowsWrap.appendChild(mRow);
                }
            });

            card.appendChild(rowsWrap);
            instSection.appendChild(card);
        });
        relationsBody.appendChild(instSection);
    }
}

function relSection(type, title) {
    const section = mk('div', 'rel-section');
    const hdr = mk('div', 'rel-section-title ' + type);
    hdr.textContent = title;
    section.appendChild(hdr);
    return section;
}

function relRow(label, targets) {
    const row = mk('div', 'rel-row');
    const lbl = mk('span', 'rel-row-label');
    lbl.textContent = label;
    const tWrap = mk('div', 'rel-targets');
    targets.forEach(({ text, cls }) => {
        const tEl = mk('span', 'rel-target ' + (cls || ''));
        tEl.textContent = text;
        tWrap.appendChild(tEl);
    });
    row.append(lbl, tWrap);
    return row;
}

// ─── Diagram Renderer ─────────────────────────────────────────────────────────

// Box positions: {className: {x, y, w, h}}
let diagPositions = {};

function renderDiagram(f) {
    diagramSvg.innerHTML = '';
    diagPositions = {};

    const { classes } = f.parsed;
    if (!classes.length) {
        const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        fo.setAttribute('x', '20'); fo.setAttribute('y', '20');
        fo.setAttribute('width', '400'); fo.setAttribute('height', '60');
        fo.innerHTML = `<div xmlns="http://www.w3.org/1999/xhtml" style="color:#777;font:13px Inter,sans-serif;padding:16px">${t('noDiag')}</div>`;
        diagramSvg.appendChild(fo);
        return;
    }

    const rel = analyzeRelations(f.content, classes, f.ext);

    // Box dimensions
    const BOX_W     = 230;
    const HDR_H     = 42;
    const ROW_H     = 20;
    const MAX_METHS = 8;
    const PAD_X     = 40;
    const PAD_Y     = 50;
    const GAP_X     = 60;
    const GAP_Y     = 50;

    // Colors by type
    const TYPE_COLOR = {
        abstract:  '#f97316',
        interface: '#569cd6',
        enum:      '#c586c0',
        concrete:  '#4ec9b0'
    };

    // Compute box heights
    const boxH = cls => {
        const shown = Math.min(cls.methods.length, MAX_METHS);
        return HDR_H + shown * ROW_H + (shown ? 6 : 0);
    };

    // Grid layout
    const cols = Math.max(1, Math.ceil(Math.sqrt(classes.length)));
    classes.forEach((cls, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        diagPositions[cls.name] = {
            x: PAD_X + col * (BOX_W + GAP_X),
            y: PAD_Y + row * (180 + GAP_Y),
            w: BOX_W,
            h: boxH(cls)
        };
    });

    // SVG canvas size
    const maxX = Math.max(...Object.values(diagPositions).map(p => p.x + p.w));
    const maxY = Math.max(...Object.values(diagPositions).map(p => p.y + p.h));
    diagramSvg.setAttribute('width',  maxX + PAD_X);
    diagramSvg.setAttribute('height', maxY + PAD_Y);

    // Arrowhead markers
    const defs = svgEl('defs');
    const mkMarker = (id, color) => {
        const marker = svgEl('marker');
        marker.setAttribute('id', id);
        marker.setAttribute('markerWidth', '8');
        marker.setAttribute('markerHeight', '8');
        marker.setAttribute('refX', '6');
        marker.setAttribute('refY', '3');
        marker.setAttribute('orient', 'auto');
        const poly = svgEl('polygon');
        poly.setAttribute('points', '0 0, 6 3, 0 6');
        poly.setAttribute('fill', color);
        marker.appendChild(poly);
        defs.appendChild(marker);
    };
    mkMarker('mk-ext',  '#4ec9b0');
    mkMarker('mk-impl', '#569cd6');
    mkMarker('mk-new',  '#dcdcaa');
    diagramSvg.appendChild(defs);

    // Arrow layer (drawn first, below boxes)
    const arrowLayer = svgEl('g');
    arrowLayer.setAttribute('id', 'arrow-layer');
    diagramSvg.appendChild(arrowLayer);

    // Box groups
    classes.forEach(cls => {
        const pos   = diagPositions[cls.name];
        const ct    = rel.classType[cls.name] || 'concrete';
        const color = TYPE_COLOR[ct] || '#4ec9b0';
        const shown = Math.min(cls.methods.length, MAX_METHS);

        const g = svgEl('g');
        g.setAttribute('class', 'diagram-box-group');
        g.setAttribute('data-name', cls.name);
        g.setAttribute('transform', `translate(${pos.x},${pos.y})`);
        g.style.cursor = 'grab';

        // Box shadow rect
        const shadow = svgEl('rect');
        shadow.setAttribute('x', '3'); shadow.setAttribute('y', '3');
        shadow.setAttribute('width', pos.w); shadow.setAttribute('height', pos.h);
        shadow.setAttribute('rx', '6');
        shadow.setAttribute('fill', 'rgba(0,0,0,0.35)');
        g.appendChild(shadow);

        // Main box
        const rect = svgEl('rect');
        rect.setAttribute('x', '0'); rect.setAttribute('y', '0');
        rect.setAttribute('width', pos.w); rect.setAttribute('height', pos.h);
        rect.setAttribute('rx', '6');
        rect.setAttribute('fill', '#252526');
        rect.setAttribute('stroke', color);
        rect.setAttribute('stroke-width', '2');
        g.appendChild(rect);

        // Header background
        const hdrRect = svgEl('rect');
        hdrRect.setAttribute('x', '0'); hdrRect.setAttribute('y', '0');
        hdrRect.setAttribute('width', pos.w); hdrRect.setAttribute('height', HDR_H);
        hdrRect.setAttribute('rx', '6');
        hdrRect.setAttribute('fill', color);
        hdrRect.setAttribute('fill-opacity', '0.18');
        g.appendChild(hdrRect);

        // Left accent
        const accent = svgEl('rect');
        accent.setAttribute('x', '0'); accent.setAttribute('y', '6');
        accent.setAttribute('width', '3');
        accent.setAttribute('height', HDR_H - 12);
        accent.setAttribute('rx', '2');
        accent.setAttribute('fill', color);
        g.appendChild(accent);

        // Type chip
        const chipW = ct.length * 6 + 10;
        const chip = svgEl('rect');
        chip.setAttribute('x', String(pos.w - chipW - 8));
        chip.setAttribute('y', '10');
        chip.setAttribute('width', String(chipW));
        chip.setAttribute('height', '16');
        chip.setAttribute('rx', '8');
        chip.setAttribute('fill', color);
        chip.setAttribute('fill-opacity', '0.3');
        g.appendChild(chip);

        const chipText = svgEl('text');
        chipText.setAttribute('x', String(pos.w - chipW/2 - 8));
        chipText.setAttribute('y', '22');
        chipText.setAttribute('text-anchor', 'middle');
        chipText.setAttribute('font-size', '9');
        chipText.setAttribute('fill', color);
        chipText.setAttribute('font-family', 'Inter, sans-serif');
        chipText.textContent = ct;
        g.appendChild(chipText);

        // Class name
        const nameText = svgEl('text');
        nameText.setAttribute('x', '12');
        nameText.setAttribute('y', '26');
        nameText.setAttribute('font-size', '13');
        nameText.setAttribute('font-weight', '600');
        nameText.setAttribute('fill', '#e0e0e0');
        nameText.setAttribute('font-family', 'Inter, sans-serif');
        nameText.textContent = cls.name.length > 20 ? cls.name.slice(0,18) + '…' : cls.name;
        g.appendChild(nameText);

        // Line separator
        if (shown > 0) {
            const sep = svgEl('line');
            sep.setAttribute('x1', '0'); sep.setAttribute('y1', String(HDR_H));
            sep.setAttribute('x2', String(pos.w)); sep.setAttribute('y2', String(HDR_H));
            sep.setAttribute('stroke', '#333'); sep.setAttribute('stroke-width', '1');
            g.appendChild(sep);
        }

        // Method rows
        for (let mi = 0; mi < shown; mi++) {
            const m = cls.methods[mi];
            const yPos = HDR_H + 6 + mi * ROW_H;

            const dot = svgEl('circle');
            dot.setAttribute('cx', '12'); dot.setAttribute('cy', String(yPos + 7));
            dot.setAttribute('r', '3');
            dot.setAttribute('fill', color); dot.setAttribute('fill-opacity', '0.6');
            g.appendChild(dot);

            const mText = svgEl('text');
            mText.setAttribute('x', '22');
            mText.setAttribute('y', String(yPos + 11));
            mText.setAttribute('font-size', '11');
            mText.setAttribute('fill', '#aaa');
            mText.setAttribute('font-family', "'JetBrains Mono', monospace");
            const label = m.name + (m.params ? '(…)' : '()');
            mText.textContent = label.length > 24 ? label.slice(0,22) + '…' : label;
            g.appendChild(mText);
        }

        if (cls.methods.length > MAX_METHS) {
            const more = svgEl('text');
            more.setAttribute('x', '12');
            more.setAttribute('y', String(HDR_H + 6 + MAX_METHS * ROW_H + 2));
            more.setAttribute('font-size', '10');
            more.setAttribute('fill', '#555');
            more.setAttribute('font-family', 'Inter, sans-serif');
            more.textContent = `+${cls.methods.length - MAX_METHS} more`;
            g.appendChild(more);
        }

        // Drag handling
        let dragging = false, startX, startY, origX, origY;

        g.addEventListener('mousedown', e => {
            dragging = true;
            startX = e.clientX; startY = e.clientY;
            origX = diagPositions[cls.name].x;
            origY = diagPositions[cls.name].y;
            g.style.cursor = 'grabbing';
            e.preventDefault();
        });

        diagramSvg.addEventListener('mousemove', e => {
            if (!dragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const nx = Math.max(0, origX + dx);
            const ny = Math.max(0, origY + dy);
            diagPositions[cls.name].x = nx;
            diagPositions[cls.name].y = ny;
            g.setAttribute('transform', `translate(${nx},${ny})`);
            drawArrows(rel, arrowLayer, classes);
        });

        diagramSvg.addEventListener('mouseup', () => {
            if (dragging) { dragging = false; g.style.cursor = 'grab'; }
        });

        diagramSvg.appendChild(g);
    });

    // Draw initial arrows
    drawArrows(rel, arrowLayer, classes);
}

function drawArrows(rel, layer, classes) {
    layer.innerHTML = '';

    // extends arrows
    classes.forEach(cls => {
        if (!cls.bases) return;
        const from = diagPositions[cls.name];
        const to   = diagPositions[cls.bases];
        if (!from || !to) return;
        drawArrow(layer, from, to, '#4ec9b0', 'none', 'mk-ext');
    });

    // implements arrows
    Object.entries(rel.implementsMap).forEach(([clsName, ifaces]) => {
        const from = diagPositions[clsName];
        if (!from) return;
        ifaces.forEach(iface => {
            const to = diagPositions[iface];
            if (!to) return;
            drawArrow(layer, from, to, '#569cd6', '6 3', 'mk-impl');
        });
    });

    // creates (new) arrows
    Object.entries(rel.instantiation).forEach(([creator, created]) => {
        const from = diagPositions[creator];
        if (!from) return;
        created.forEach(name => {
            const to = diagPositions[name];
            if (!to) return;
            drawArrow(layer, from, to, '#dcdcaa', '3 4', 'mk-new');
        });
    });
}

function drawArrow(layer, from, to, color, dasharray, markerId) {
    // Center points
    const fx = from.x + from.w / 2;
    const fy = from.y + from.h / 2;
    const tx = to.x + to.w / 2;
    const ty = to.y + to.h / 2;

    // Edge intersection points
    const [sx, sy] = boxEdge(from, tx, ty);
    const [ex, ey] = boxEdge(to, fx, fy);

    // Bezier control points
    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2;

    const path = svgEl('path');
    path.setAttribute('d', `M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-opacity', '0.75');
    if (dasharray !== 'none') path.setAttribute('stroke-dasharray', dasharray);
    path.setAttribute('marker-end', `url(#${markerId})`);
    layer.appendChild(path);
}

function boxEdge(pos, toX, toY) {
    const cx = pos.x + pos.w / 2;
    const cy = pos.y + pos.h / 2;
    const dx = toX - cx;
    const dy = toY - cy;
    const hw = pos.w / 2;
    const hh = pos.h / 2;

    if (dx === 0 && dy === 0) return [cx, cy];

    const absDx = Math.abs(dx), absDy = Math.abs(dy);

    if (absDx * hh >= absDy * hw) {
        // left or right edge
        const side = dx > 0 ? 1 : -1;
        const x = cx + side * hw;
        const y = cy + dy * (hw / absDx);
        return [x, Math.max(pos.y, Math.min(pos.y + pos.h, y))];
    } else {
        // top or bottom edge
        const side = dy > 0 ? 1 : -1;
        const y = cy + side * hh;
        const x = cx + dx * (hh / absDy);
        return [Math.max(pos.x, Math.min(pos.x + pos.w, x)), y];
    }
}

function svgEl(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
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
    const items   = [];

    for (let i = 0; i < lines.length; i++) {
        const raw     = lines[i];
        const trimmed = raw.trimStart();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const indent = raw.length - trimmed.length;

        const cm = trimmed.match(/^class\s+(\w+)(?:\s*\(([^)]*)\))?\s*:/);
        if (cm) {
            items.push({ kind:'class', name: cm[1], bases: (cm[2]||'').trim(), indent, lineStart: i+1,
                description: pyDocstring(lines, i) });
            continue;
        }

        const dm = trimmed.match(/^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([^:]+))?\s*:/);
        if (dm) {
            items.push({
                kind:'def', name: dm[1],
                params: clean(dm[2]),
                returnType: dm[3] ? dm[3].trim() : null,
                description: pyDocstring(lines, i),
                indent, lineStart: i+1
            });
        }
    }

    for (let i = 0; i < items.length; i++) {
        let end = lines.length;
        for (let j = i+1; j < items.length; j++) {
            if (items[j].indent <= items[i].indent) { end = items[j].lineStart - 1; break; }
        }
        items[i].lineEnd = end;
    }

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
        const trimLine = lines[i].trim();
        if (!trimLine || trimLine.startsWith('//')) continue;

        const cm = trimLine.match(/^(?:export\s+)?(?:default\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?/);
        if (cm && trimLine.includes('{')) {
            const lineEnd = braceEnd(lines, i);
            const cls = { type:'class', name:cm[1], bases:cm[2]||'', lineStart:i+1, lineEnd, methods:[] };
            parseJSMethods(lines, i, lineEnd, cls.methods);
            classes.push(cls);
            continue;
        }

        if (classes.some(c => i+1 > c.lineStart && i+1 < c.lineEnd)) continue;

        const fd = trimLine.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/);
        if (fd) { fns.push({ type:'function', name:fd[1], params:clean(fd[2]), lineStart:i+1, lineEnd:braceEnd(lines,i), description: blockCommentBefore(lines,i)||lineCommentsBefore(lines,i) }); continue; }

        const ae = trimLine.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(?([^)=>{]*)\)?\s*=>/);
        if (ae) { fns.push({ type:'function', name:ae[1], params:clean(ae[2]), lineStart:i+1, lineEnd:braceEnd(lines,i), description: blockCommentBefore(lines,i)||lineCommentsBefore(lines,i) }); continue; }

        const fe = trimLine.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function\s*\(([^)]*)\)/);
        if (fe) { fns.push({ type:'function', name:fe[1], params:clean(fe[2]), lineStart:i+1, lineEnd:braceEnd(lines,i), description: blockCommentBefore(lines,i)||lineCommentsBefore(lines,i) }); }
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

        const trimLine = line.trim();
        if (!trimLine || trimLine.startsWith('//') || trimLine.startsWith('*')) continue;

        const mm = trimLine.match(/^(?:(?:async|static|get|set)\s+)?(\w+)\s*\(([^)]*)\)\s*\{/);
        if (mm && !['if','for','while','switch','try','catch','else'].includes(mm[1])) {
            const lineEnd = braceEnd(lines, i);
            methods.push({ type:'method', name:mm[1], params:clean(mm[2]), lineStart:i+1, lineEnd,
                description: blockCommentBefore(lines,i)||lineCommentsBefore(lines,i) });
            i = lineEnd - 1;
            depth = 1;
        }
    }
}

// ── Java ───────────────────────────────────────────────────────────────────

function parseJava(code) {
    const lines   = code.split('\n');
    const classes = [];

    for (let i = 0; i < lines.length; i++) {
        const trimLine = lines[i].trim();
        if (!trimLine || trimLine.startsWith('//') || trimLine.startsWith('*')) continue;

        const cm = trimLine.match(/^(?:(?:public|private|protected|abstract|final|static)\s+)*(?:class|interface|enum)\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+[\w\s,<>]+)?\s*\{/);
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

        const trimLine = lines[i].trim();
        if (!trimLine || trimLine.startsWith('//') || trimLine.startsWith('*') || trimLine.startsWith('@')) continue;

        const mm = trimLine.match(/^(?:(?:public|private|protected|static|final|abstract|synchronized|default|native)\s+)*(?:<[^>]+>\s+)?(\w[\w<>\[\]]*)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w\s,]+)?\s*\{/);
        if (mm && !['if','for','while','switch','try'].includes(mm[2])) {
            const lineEnd = braceEnd(lines, i);
            methods.push({ type:'method', name:mm[2], params:clean(mm[3]), returnType:mm[1], lineStart:i+1, lineEnd,
                description: blockCommentBefore(lines,i)||lineCommentsBefore(lines,i) });
            i = lineEnd - 1;
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
        const trimLine = lines[i].trim();
        if (!trimLine || trimLine.startsWith('//') || trimLine.startsWith('*') || trimLine.startsWith('#')) continue;

        if (isCpp) {
            const cm = trimLine.match(/^(?:class|struct)\s+(\w+)(?:\s*:\s*(?:public|private|protected)\s+(\w+))?\s*\{/);
            if (cm) {
                const lineEnd = braceEnd(lines, i);
                const cls = { type:'class', name:cm[1], bases:cm[2]||'', lineStart:i+1, lineEnd, methods:[] };
                parseCppMethods(lines, i, lineEnd, cls.methods);
                classes.push(cls);
                i = lineEnd - 1;
                continue;
            }
        }

        if (classes.some(c => i+1 > c.lineStart && i+1 < c.lineEnd)) continue;

        const fm = trimLine.match(/^(?:static\s+|inline\s+|extern\s+)?(\w[\w\s*]*?)\s+(\w+)\s*\(([^)]*)\)\s*(?:const\s*)?\{/);
        if (fm && fm[2] && !['if','for','while','switch','do','else','return'].includes(fm[2]) && fm[1] !== 'else') {
            const lineEnd = braceEnd(lines, i);
            fns.push({ type:'function', name:fm[2], params:clean(fm[3]), returnType:fm[1].trim(), lineStart:i+1, lineEnd,
                description: blockCommentBefore(lines,i)||lineCommentsBefore(lines,i) });
            i = lineEnd - 1;
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

        const trimLine = lines[i].trim();
        if (!trimLine || trimLine.startsWith('//') || trimLine.startsWith('*')) continue;

        const mm = trimLine.match(/^(?:(?:virtual|static|inline|explicit|const|override)\s+)*(?:\w[\w\s*]*?)\s+(\w+)\s*\(([^)]*)\)\s*(?:const\s*)?\{/);
        if (mm && !['if','for','while','switch','do'].includes(mm[1])) {
            const lineEnd = braceEnd(lines, i);
            methods.push({ type:'method', name:mm[1], params:clean(mm[2]), lineStart:i+1, lineEnd,
                description: blockCommentBefore(lines,i)||lineCommentsBefore(lines,i) });
            i = lineEnd - 1;
            depth = 1;
        }
    }
}

// ─── Comment / Docstring Extraction ──────────────────────────────────────────

function pyDocstring(lines, defLineIdx) {
    for (let i = defLineIdx + 1; i < Math.min(defLineIdx + 8, lines.length); i++) {
        const trimLine = lines[i].trim();
        if (!trimLine) continue;
        const q = trimLine.startsWith('"""') ? '"""' : trimLine.startsWith("'''") ? "'''" : null;
        if (!q) break;
        const after = trimLine.slice(3);
        const end   = after.indexOf(q);
        if (end >= 0) return after.slice(0, end).trim() || null;
        let doc = after;
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
            const jt = lines[j].trim();
            const e  = jt.indexOf(q);
            if (e >= 0) { doc += ' ' + jt.slice(0, e); return doc.trim() || null; }
            doc += ' ' + jt;
        }
        return doc.trim() || null;
    }
    return null;
}

function lineCommentsBefore(lines, idx) {
    const parts = [];
    for (let i = idx - 1; i >= Math.max(0, idx - 8); i--) {
        const trimLine = lines[i].trim();
        if (trimLine.startsWith('//')) parts.unshift(trimLine.slice(2).trim());
        else if (trimLine === '') continue;
        else break;
    }
    return parts.length ? parts.join(' ') : null;
}

function blockCommentBefore(lines, idx) {
    let end = idx - 1;
    while (end >= 0 && !lines[end].trim()) end--;
    if (end < 0) return null;
    const endT = lines[end].trim();
    if (!endT.endsWith('*/')) return null;
    let start = end;
    while (start >= 0 && !lines[start].trim().startsWith('/*')) start--;
    if (start < 0) return null;
    const parts = [];
    for (let i = start; i <= end; i++) {
        const trimLine = lines[i].trim()
            .replace(/^\/\*+\s*/, '').replace(/\*+\/$/, '').replace(/^\*+\s?/, '').trim();
        if (trimLine) parts.push(trimLine);
    }
    return parts.join(' ').trim() || null;
}

// ─── Parser Helpers ───────────────────────────────────────────────────────────

function braceEnd(lines, startLine) {
    let depth = 0, opened = false;
    for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];
        let inStr = false, strCh = '', skip = false;
        for (let j = 0; j < line.length; j++) {
            const ch = line[j], nx = line[j+1];
            if (skip) { skip = false; continue; }
            if (!inStr && ch === '/' && nx === '/') break;
            if (!inStr && ch === '/' && nx === '*') { j++; continue; }
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
