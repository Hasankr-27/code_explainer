// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_SIZE  = 50 * 1024;
const SUPPORTED = ['.py', '.js', '.java'];

const LANG_COLOR = { py:'#3572A5', js:'#c9a800', java:'#B07219' };
const HLJS_LANG  = { py:'python', js:'javascript', java:'java' };

// ─── Translations ─────────────────────────────────────────────────────────────

const TRANSLATIONS = {
    en: {
        files:'FILES', source:'SOURCE',
        tabStruct:'Structure', tabRel:'Relations', tabDiag:'Diagram',
        dropMain:'Drop files here', dropOr:'or', browse:'browse',
        dropHint:'.py .js .java · max 50 KB',
        emptyMain:'Upload a source file to explore its structure',
        emptyHint:'Supports Python, JavaScript, Java',
        noClasses:'No classes or functions detected in this file.',
        noMethods:'No methods detected', viewCode:'View Code', view:'View',
        extends:'extends', implements:'implements', creates:'new →', subclass:'↳ subclass',
        secTypes:'Class Types', secInh:'Inheritance', secInst:'Object Creation',
        params:'params', addFiles:'Add files',
        legExt:'extends', legImpl:'implements', legNew:'creates (new)',
        typeAbstract:'abstract', typeInterface:'interface', typeConcrete:'class',
        noRel:'No classes found to analyze.',
        noDiag:'Upload a file to generate the diagram.',
        errUnsupported:'is not a supported file type. Use .py .js .java',
        errTooBig:'exceeds the 50 KB limit',
        imports:'IMPORTS', importsCount:'imports',
        fieldsSect:'FIELDS', methods:'METHODS', noFields:'No fields',
        objCreations:'Object Creations', noObjCreations:'No instantiations'
    },
    tr: {
        files:'DOSYALAR', source:'KAYNAK',
        tabStruct:'Yapı', tabRel:'İlişkiler', tabDiag:'Diyagram',
        dropMain:'Dosyaları buraya bırakın', dropOr:'veya', browse:'gözat',
        dropHint:'.py .js .java · maks 50 KB',
        emptyMain:'Yapıyı keşfetmek için bir kaynak dosyası yükleyin',
        emptyHint:'Python, JavaScript, Java desteklenir',
        noClasses:'Bu dosyada sınıf veya fonksiyon bulunamadı.',
        noMethods:'Metot bulunamadı', viewCode:'Kodu Gör', view:'Gör',
        extends:'genişletir', implements:'uygular', creates:'yeni →', subclass:'↳ alt sınıf',
        secTypes:'Sınıf Tipleri', secInh:'Kalıtım', secInst:'Nesne Oluşturma',
        params:'parametre', addFiles:'Dosya ekle',
        legExt:'genişletir', legImpl:'uygular', legNew:'oluşturur (new)',
        typeAbstract:'soyut', typeInterface:'arayüz', typeConcrete:'sınıf',
        noRel:'Analiz edilecek sınıf bulunamadı.',
        noDiag:'Diyagram oluşturmak için dosya yükleyin.',
        errUnsupported:'desteklenmeyen dosya türü. .py .js .java kullanın',
        errTooBig:'50 KB sınırını aşıyor',
        imports:'İÇE AKTARMALAR', importsCount:'içe aktarma',
        fieldsSect:'ALANLAR', methods:'METODLAR', noFields:'Alan yok',
        objCreations:'Oluşturulan Nesneler', noObjCreations:'Nesne oluşturulmadı'
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

let files     = [];
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
            try {
                const content = e.target.result;
                const extKey  = ext.slice(1);
                files.push({ name: f.name, size: f.size, ext: extKey, content, parsed: parseCode(content, extKey) });
                if (activeIdx === null) activeIdx = files.length - 1;
                renderAll();
            } catch (err) {
                showError(`"${f.name}" — parse error: ${err.message}`);
            }
        };
        reader.onerror = () => showError(`"${f.name}" — ${t('errRead') || 'could not read file'}`);
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
        try {
            const f = files[activeIdx];
            activeFileName.textContent = f.name;
            activeFileLang.textContent = f.ext.toUpperCase();
            // Run once; also stamps m.newCalls onto each method object
            f.relations = analyzeRelations(f.content, f.parsed.classes, f.ext);
            renderFileList();
            renderCode(f);
            renderStructure(f);
            renderRelations(f);
            renderDiagram(f);
        } catch (err) {
            console.error('renderAll error:', err);
            showError('Render error: ' + err.message);
        }
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
    const pad = 8;

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
    const { classes, functions, imports } = f.parsed;

    // Imports section — wrapped for padding, outside the grid
    if (imports && imports.length) {
        const wrapper = mk('div', 'imports-wrapper');
        const imp = buildImportsSection(imports);
        if (imp) { wrapper.appendChild(imp); structureBody.appendChild(wrapper); }
    }

    if (!classes.length && !functions.length) {
        const msg = mk('div', 'empty-state');
        msg.innerHTML = `<p>${t('noClasses')}</p>`;
        structureBody.appendChild(msg);
        return;
    }

    const classType = detectClassTypes(f.content, classes);
    const grid = mk('div', 'struct-grid');
    classes.forEach(cls  => grid.appendChild(buildClassCard(cls, classType[cls.name] || 'concrete')));
    functions.forEach(fn => grid.appendChild(buildFnCard(fn)));
    structureBody.appendChild(grid);
}

function detectClassTypes(content, classes) {
    const lines = content.split('\n');
    const classType = {};
    for (const line of lines) {
        const tr = line.trim();
        let m;
        if ((m = tr.match(/(?:^|\s)abstract\s+class\s+(\w+)/)))         classType[m[1]] = 'abstract';
        if ((m = tr.match(/(?:^|\s)interface\s+(\w+)/)))                 classType[m[1]] = 'interface';
        if ((m = tr.match(/(?:^|\s)enum\s+(\w+)/)))                      classType[m[1]] = 'enum';
        if ((m = tr.match(/(?:^|\s)type\s+(\w+)(?:<[^>]*)?\s*=/)))      classType[m[1]] = 'type';
    }
    // tsType set by parseTS takes precedence over content scan
    classes.forEach(c => {
        if (c.tsType) classType[c.name] = c.tsType;
        else if (!classType[c.name]) classType[c.name] = 'concrete';
    });
    return classType;
}

/* Imports collapsible section */
function buildImportsSection(imports) {
    const section = mk('div', 'imports-section');
    let expanded = false;

    const hdr = mk('div', 'imports-hdr');
    const chevron = mk('span', 'chevron');
    chevron.textContent = '▾';
    chevron.style.transform = 'rotate(-90deg)';

    const badge = mk('span', 'badge');
    badge.style.cssText = 'background:rgba(100,100,100,.15);color:#888;border-radius:20px;font-size:9px;padding:2px 7px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;';
    badge.textContent = t('imports');

    const count = mk('span', 'imports-count');
    count.textContent = `${imports.length} ${t('importsCount')}`;

    hdr.append(chevron, badge, count);

    const body = mk('div', 'imports-body hidden');
    imports.forEach(imp => {
        const chip = mk('span', 'import-chip');
        chip.textContent = imp;
        chip.title = imp;
        body.appendChild(chip);
    });

    hdr.addEventListener('click', () => {
        expanded = !expanded;
        body.classList.toggle('hidden', !expanded);
        chevron.style.transform = expanded ? '' : 'rotate(-90deg)';
    });

    section.append(hdr, body);
    return section;
}

/* Class card — accordion, collapsed by default */
function buildClassCard(cls, type) {
    const card = mk('div', `s-card s-card-${type}`);

    // ── Header ──
    const hdr = mk('div', 's-card-hdr');

    const chevron = mk('span', 'chevron');
    chevron.textContent = '▾';
    chevron.style.transform = 'rotate(-90deg)';
    chevron.style.transition = 'transform .22s ease';

    const typeBadge = mk('span', `badge badge-type-${type}`);
    typeBadge.textContent = type.toUpperCase();

    const nameEl = mk('span', 'sc-name');
    nameEl.textContent = cls.name;
    nameEl.title = cls.name;

    const lineEl = mk('span', 'c-line');
    lineEl.textContent = `L${cls.lineStart}`;

    const viewBtn = mk('button', 'view-btn');
    viewBtn.textContent = t('viewCode');
    viewBtn.addEventListener('click', e => {
        e.stopPropagation();
        highlightLines(cls.lineStart, cls.lineEnd);
    });

    hdr.append(chevron, typeBadge, nameEl, lineEl, viewBtn);
    card.appendChild(hdr);

    // ── Expandable body ──
    const body = mk('div', 's-card-body');

    if (cls.bases) {
        const extRow = mk('div', 'extends-row');
        extRow.style.padding = '4px 14px 2px';
        extRow.innerHTML = `<span class="lbl">${t('extends')}</span><span class="val">${esc(cls.bases)}</span>`;
        body.appendChild(extRow);
    }

    // Fields sub-section
    if (cls.fields && cls.fields.length) {
        const fHdr = mk('div', 'card-section-hdr');
        fHdr.textContent = t('fieldsSect');
        body.appendChild(fHdr);
        const fs = buildFieldsSection(cls.fields);
        fs.style.margin = '0 10px 4px';
        body.appendChild(fs);
    }

    // Methods sub-section
    const mHdr = mk('div', 'card-section-hdr');
    mHdr.textContent = t('methods');
    body.appendChild(mHdr);

    if ((cls.methods || []).length) {
        const list = mk('div', 'methods-list');
        list.style.margin = '0 10px 10px';
        (cls.methods || []).forEach(m => list.appendChild(buildMethodCard(m)));
        body.appendChild(list);
    } else {
        const nm = mk('div', 'no-methods');
        nm.style.padding = '4px 14px 10px';
        nm.textContent = t('noMethods');
        body.appendChild(nm);
    }

    card.appendChild(body);

    // Each card has its own closure-local state — completely isolated
    let cardOpen = false;
    hdr.addEventListener('click', e => {
        if (e.target.classList.contains('view-btn')) return;
        cardOpen = !cardOpen;
        body.style.maxHeight  = cardOpen ? '4000px' : '0px';
        body.style.borderTopWidth = cardOpen ? '1px' : '0px';
        card.classList.toggle('open', cardOpen);
        chevron.style.transform = cardOpen ? '' : 'rotate(-90deg)';
    });

    return card;
}

/* Fields section inside class card */
function buildFieldsSection(fields) {
    const section = mk('div', 'fields-list');
    const lbl = mk('div', 'fields-section-label');
    lbl.textContent = t('fieldsSect');
    section.appendChild(lbl);

    fields.forEach(field => {
        const card = mk('div', 'f-card');
        const row  = mk('div', 'f-row');

        const badge = mk('span', 'badge badge-field');
        badge.textContent = 'field';

        const name = mk('span', 'f-name');
        name.textContent = field.name;
        name.title = field.name;

        row.append(badge, name);

        if (field.type) {
            const typeEl = mk('span', 'f-type');
            typeEl.textContent = field.type;
            typeEl.title = field.type;
            row.appendChild(typeEl);
        }
        if (field.isStatic) {
            const tag = mk('span', 'f-tag static-tag');
            tag.textContent = 'static';
            row.appendChild(tag);
        }
        if (field.isFinal) {
            const tag = mk('span', 'f-tag final-tag');
            tag.textContent = 'final';
            row.appendChild(tag);
        }

        card.appendChild(row);
        section.appendChild(card);
    });
    return section;
}

/* Standalone function card — accordion, collapsed by default */
function buildFnCard(fn) {
    const card = mk('div', 's-card s-card-fn');

    const hdr = mk('div', 's-card-hdr');

    const chevron = mk('span', 'chevron');
    chevron.textContent = '▾';
    chevron.style.transform = 'rotate(-90deg)';
    chevron.style.transition = 'transform .22s ease';

    const badge = mk('span', 'badge badge-type-fn');
    badge.textContent = 'FN';

    const nameEl = mk('span', 'sc-name');
    nameEl.textContent = fn.name;
    nameEl.title = fn.name;

    const lineEl = mk('span', 'c-line');
    lineEl.textContent = `L${fn.lineStart}`;

    const viewBtn = mk('button', 'view-btn');
    viewBtn.textContent = t('viewCode');
    viewBtn.addEventListener('click', e => {
        e.stopPropagation();
        highlightLines(fn.lineStart, fn.lineEnd);
    });

    hdr.append(chevron, badge, nameEl);
    if (fn.returnType) {
        const ret = mk('span', 'ret-badge');
        ret.textContent = fn.returnType;
        hdr.appendChild(ret);
    }
    hdr.append(lineEl, viewBtn);
    card.appendChild(hdr);

    if (fn.params || fn.description) {
        const body = mk('div', 's-card-body');
        if (fn.description) {
            const d = mk('div', 'c-desc');
            d.style.padding = '8px 14px';
            d.textContent = fn.description;
            body.appendChild(d);
        }
        if (fn.params) {
            const p = mk('div', 'c-params');
            p.style.padding = '4px 14px 10px';
            p.innerHTML = `<span class="lbl">${t('params')}</span>${esc(fn.params)}`;
            body.appendChild(p);
        }
        card.appendChild(body);

        let fnOpen = false;
        hdr.addEventListener('click', e => {
            if (e.target.classList.contains('view-btn')) return;
            fnOpen = !fnOpen;
            body.style.maxHeight  = fnOpen ? '4000px' : '0px';
            body.style.borderTopWidth = fnOpen ? '1px' : '0px';
            card.classList.toggle('open', fnOpen);
            chevron.style.transform = fnOpen ? '' : 'rotate(-90deg)';
        });
    }

    return card;
}

/* Method card inside a class */
function buildMethodCard(m) {
    const card = mk('div', 'm-card');

    const hdr = mk('div', 'm-hdr');
    const retLabel = m.returnType || 'void';
    const retClass = (!m.returnType || m.returnType === 'void' || m.returnType === 'None') ? 'ret-badge ret-void' : 'ret-badge';
    hdr.innerHTML = `
        <span class="badge badge-method">method</span>
        <span class="m-name" title="${esc(m.name)}">${esc(m.name)}</span>
        <span class="${retClass}">${esc(retLabel)}</span>
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

    if (m.newCalls && m.newCalls.length) {
        const ncHdr = mk('div', 'nc-section-hdr');
        ncHdr.textContent = t('objCreations');
        card.appendChild(ncHdr);

        const ncList = mk('div', 'nc-list');
        m.newCalls.forEach(nc => {
            const row = mk('div', 'nc-row');

            const badge = mk('span', 'badge badge-new');
            badge.textContent = 'NEW';

            const cls = mk('span', 'nc-cls');
            cls.textContent = nc.className;

            row.append(badge, cls);

            if (nc.varName) {
                const arrow = mk('span', 'nc-arrow');
                arrow.textContent = '→';
                const vname = mk('span', 'nc-var');
                vname.textContent = nc.varName;
                row.append(arrow, vname);
                if (nc.varType && nc.varType !== nc.className) {
                    const vtype = mk('span', 'nc-vtype');
                    vtype.textContent = nc.varType;
                    row.appendChild(vtype);
                }
            }

            const lineEl = mk('span', 'nc-line');
            lineEl.textContent = 'L' + nc.line;
            row.appendChild(lineEl);

            ncList.appendChild(row);
        });
        card.appendChild(ncList);
    }

    return card;
}

// ─── Relations Analysis ───────────────────────────────────────────────────────

/* Returns [{className, varName, varType, line}] for each instantiation in the
   given line range (1-indexed). Handles Java, JS/TS, Python, and C. */
function extractNewCalls(lines, startLine, endLine, classNames, ext) {
    const results = [];
    const CTRL = new Set(['if','while','for','switch','return','catch','else','do','case']);

    for (let i = startLine - 1; i < Math.min(endLine, lines.length); i++) {
        const raw  = lines[i];
        const tr   = raw.trim();
        const lineNum = i + 1;

        if (ext === 'py') {
            // var = ClassName(...)
            const m = tr.match(/^(\w+)\s*=\s*(\w+)\s*\(/);
            if (m && classNames.has(m[2])) {
                results.push({ className: m[2], varName: m[1], varType: m[2], line: lineNum });
            }
        } else if (ext === 'c') {
            // struct TypeName varName
            const m = tr.match(/\bstruct\s+(\w+)\s+(\w+)/);
            if (m) {
                results.push({ className: m[1], varName: m[2], varType: 'struct ' + m[1], line: lineNum });
            }
        } else {
            // Java / JS / TS: find every `new ClassName(` on this line — no filter,
            // show all instantiations including external/library classes
            const newRe = /\bnew\s+(\w+)\s*[(<]/g;
            let nm;
            while ((nm = newRe.exec(raw)) !== null) {
                const className = nm[1];

                let varName = null, varType = null;
                if (ext === 'java') {
                    // Type varName = new ClassName  (or generics/arrays)
                    const vm = raw.match(/([\w][\w<>\[\]]*)\s+(\w+)\s*=\s*new\s+[\w<>\[\]]+\s*[(<]/);
                    if (vm && !CTRL.has(vm[2])) { varType = vm[1]; varName = vm[2]; }
                } else {
                    // const/let/var varName = new ClassName  OR  varName = new ClassName
                    const vm = raw.match(/(?:(?:const|let|var)\s+)?(\w+)\s*=\s*new\s+(\w+)\s*[(<]/);
                    if (vm && vm[2] === className && !CTRL.has(vm[1]) && vm[1] !== 'new') {
                        varName = vm[1];
                    }
                }
                results.push({ className, varName, varType, line: lineNum });
            }
        }
    }
    return results;
}

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
        const m = line.match(/class\s+(\w+)(?:<[^>]*>)?(?:\s+extends\s+[\w<>, ]+?)?\s+implements\s+([\w\s,<>]+?)\s*(?:\{|$)/);
        if (m) {
            implementsMap[m[1]] = m[2].split(',').map(s => s.replace(/<[^>]*>/g,'').trim()).filter(Boolean);
        }
    }

    const instantiation = {};
    classes.forEach(cls => {
        const created = new Set();
        const re = /\bnew\s+(\w+)\s*[(<[]/g;
        const body = lines.slice(cls.lineStart - 1, cls.lineEnd).join('\n');
        let m;
        while ((m = re.exec(body)) !== null) {
            const name = m[1];
            if (classNames.has(name) && name !== cls.name) created.add(name);
        }
        if (created.size) instantiation[cls.name] = [...created];
    });

    // Per-method: extract all new-calls for Structure tab; filter to known classes for Relations
    const methodCreates = {};
    classes.forEach(cls => {
        (cls.methods || []).forEach(method => {
            const calls = extractNewCalls(lines, method.lineStart, method.lineEnd, classNames, ext);
            method.newCalls = calls;   // ALL calls → Structure tab Object Creations
            const relCalls = calls.filter(c => classNames.has(c.className));
            if (relCalls.length) methodCreates[`${cls.name}.${method.name}`] = relCalls;
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

    const rel = f.relations;

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
        viewBtn.addEventListener('click', () => { switchTab('struct'); highlightLines(cls.lineStart, cls.lineEnd); });

        hdr.append(badge, name, viewBtn);
        card.appendChild(hdr);

        const rows = [];
        if (cls.bases) rows.push(relRow(t('extends'), [{ text: cls.bases, cls: 'ext' }]));
        const impls = rel.implementsMap[cls.name];
        if (impls && impls.length) rows.push(relRow(t('implements'), impls.map(i => ({ text: i, cls: 'impl' }))));
        const creates = rel.instantiation[cls.name];
        if (creates && creates.length) rows.push(relRow(t('creates'), creates.map(c => ({ text: c, cls: 'new' }))));

        if (rows.length) {
            const rowsWrap = mk('div', 'rel-rows');
            rows.forEach(r => rowsWrap.appendChild(r));
            card.appendChild(rowsWrap);
        }
        typeSection.appendChild(card);
    });
    relationsBody.appendChild(typeSection);

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

            cls && (cls.methods || []).forEach(m => {
                const key = `${creator}.${m.name}`;
                const mc = rel.methodCreates[key];
                if (mc && mc.length) {
                    const mRow = mk('div', 'rel-row');
                    const lbl = mk('span', 'rel-row-label');
                    lbl.style.fontFamily = 'var(--font-code)';
                    lbl.textContent = m.name + '()';
                    const targets = mk('div', 'rel-targets');
                    mc.forEach(nc => {
                        const tEl = mk('span', 'rel-target new');
                        let label = 'new ' + nc.className;
                        if (nc.varName) label += ' → ' + nc.varName;
                        tEl.textContent = label;
                        const lineChip = mk('span', 'nc-line-chip');
                        lineChip.textContent = 'L' + nc.line;
                        tEl.appendChild(lineChip);
                        tEl.addEventListener('click', () => { switchTab('struct'); highlightLines(nc.line, nc.line); });
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

    const rel = f.relations;

    const BOX_W      = 270;
    const HDR_H      = 52;
    const FIELD_H    = 20;
    const ROW_H      = 22;
    const MAX_FIELDS = 999;
    const MAX_METHS  = 999;
    const PAD_X      = 44;
    const PAD_Y      = 54;
    const GAP_X      = 72;
    const GAP_Y      = 64;

    const TYPE_COLOR = {
        abstract:  '#f97316',
        interface: '#569cd6',
        enum:      '#c586c0',
        concrete:  '#4ec9b0'
    };

    const shownF = cls => Math.min((cls.fields || []).length, MAX_FIELDS);
    const shownM = cls => Math.min((cls.methods || []).length, MAX_METHS);
    const boxH = cls => {
        const sf = shownF(cls);
        const sm = shownM(cls);
        let h = HDR_H;
        if (sf > 0) h += 6 + sf * FIELD_H + 6;
        if (sf > 0 && sm > 0) h += 2; // dashed divider
        if (sm > 0) h += 6 + sm * ROW_H + 6;
        if (sf === 0 && sm === 0) h += 10;
        return h;
    };

    // Pre-compute heights
    const heights = {};
    classes.forEach(cls => { heights[cls.name] = boxH(cls); });

    // Grid layout — compute y per row using actual max heights
    const cols = Math.max(1, Math.ceil(Math.sqrt(classes.length)));
    classes.forEach((cls, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);

        let yOff = PAD_Y;
        for (let r = 0; r < row; r++) {
            let maxH = 0;
            for (let c = 0; c < cols; c++) {
                const ci = r * cols + c;
                if (ci < classes.length) maxH = Math.max(maxH, heights[classes[ci].name]);
            }
            yOff += maxH + GAP_Y;
        }

        diagPositions[cls.name] = {
            x: PAD_X + col * (BOX_W + GAP_X),
            y: yOff,
            w: BOX_W,
            h: heights[cls.name]
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

    const arrowLayer = svgEl('g');
    arrowLayer.setAttribute('id', 'arrow-layer');
    diagramSvg.appendChild(arrowLayer);

    classes.forEach(cls => {
        const pos   = diagPositions[cls.name];
        const ct    = rel.classType[cls.name] || 'concrete';
        const color = TYPE_COLOR[ct] || '#4ec9b0';
        const fields  = (cls.fields || []).slice(0, MAX_FIELDS);
        const methods = (cls.methods || []).slice(0, MAX_METHS);

        const g = svgEl('g');
        g.setAttribute('class', 'diagram-box-group');
        g.setAttribute('data-name', cls.name);
        g.setAttribute('transform', `translate(${pos.x},${pos.y})`);
        g.style.cursor = 'grab';

        // Shadow
        const shadow = svgEl('rect');
        shadow.setAttribute('x', '3'); shadow.setAttribute('y', '3');
        shadow.setAttribute('width', pos.w); shadow.setAttribute('height', pos.h);
        shadow.setAttribute('rx', '7');
        shadow.setAttribute('fill', 'rgba(0,0,0,0.35)');
        g.appendChild(shadow);

        // Main rect
        const rect = svgEl('rect');
        rect.setAttribute('x', '0'); rect.setAttribute('y', '0');
        rect.setAttribute('width', pos.w); rect.setAttribute('height', pos.h);
        rect.setAttribute('rx', '7');
        rect.setAttribute('fill', '#252526');
        rect.setAttribute('stroke', color);
        rect.setAttribute('stroke-width', '2');
        g.appendChild(rect);

        // Header bg
        const hdrRect = svgEl('rect');
        hdrRect.setAttribute('x', '0'); hdrRect.setAttribute('y', '0');
        hdrRect.setAttribute('width', pos.w); hdrRect.setAttribute('height', HDR_H);
        hdrRect.setAttribute('rx', '7');
        hdrRect.setAttribute('fill', color);
        hdrRect.setAttribute('fill-opacity', '0.16');
        g.appendChild(hdrRect);

        // Left accent bar
        const accent = svgEl('rect');
        accent.setAttribute('x', '0'); accent.setAttribute('y', '8');
        accent.setAttribute('width', '4');
        accent.setAttribute('height', HDR_H - 16);
        accent.setAttribute('rx', '2');
        accent.setAttribute('fill', color);
        g.appendChild(accent);

        // Type chip
        const chipW = ct.length * 6.5 + 12;
        const chip = svgEl('rect');
        chip.setAttribute('x', String(pos.w - chipW - 9));
        chip.setAttribute('y', '12');
        chip.setAttribute('width', String(chipW));
        chip.setAttribute('height', '18');
        chip.setAttribute('rx', '9');
        chip.setAttribute('fill', color);
        chip.setAttribute('fill-opacity', '0.28');
        g.appendChild(chip);

        const chipText = svgEl('text');
        chipText.setAttribute('x', String(pos.w - chipW / 2 - 9));
        chipText.setAttribute('y', '25');
        chipText.setAttribute('text-anchor', 'middle');
        chipText.setAttribute('font-size', '9.5');
        chipText.setAttribute('fill', color);
        chipText.setAttribute('font-family', 'Inter, sans-serif');
        chipText.setAttribute('font-weight', '700');
        chipText.textContent = ct.toUpperCase();
        g.appendChild(chipText);

        // Class name
        const nameText = svgEl('text');
        nameText.setAttribute('x', '14');
        nameText.setAttribute('y', '32');
        nameText.setAttribute('font-size', '14');
        nameText.setAttribute('font-weight', '700');
        nameText.setAttribute('fill', '#e0e0e0');
        nameText.setAttribute('font-family', 'Inter, sans-serif');
        nameText.textContent = cls.name.length > 22 ? cls.name.slice(0, 20) + '…' : cls.name;
        g.appendChild(nameText);

        // Separator between header and body
        if (fields.length > 0 || methods.length > 0) {
            const sep = svgEl('line');
            sep.setAttribute('x1', '0'); sep.setAttribute('y1', String(HDR_H));
            sep.setAttribute('x2', String(pos.w)); sep.setAttribute('y2', String(HDR_H));
            sep.setAttribute('stroke', '#333'); sep.setAttribute('stroke-width', '1');
            g.appendChild(sep);
        }

        let curY = HDR_H;

        // Fields
        if (fields.length > 0) {
            curY += 6;
            fields.forEach(field => {
                const dot = svgEl('circle');
                dot.setAttribute('cx', '14'); dot.setAttribute('cy', String(curY + 8));
                dot.setAttribute('r', '3');
                dot.setAttribute('fill', '#7098d4'); dot.setAttribute('fill-opacity', '0.7');
                g.appendChild(dot);

                const fText = svgEl('text');
                fText.setAttribute('x', '25');
                fText.setAttribute('y', String(curY + 12));
                fText.setAttribute('font-size', '11');
                fText.setAttribute('fill', '#7a9cc4');
                fText.setAttribute('font-family', "'JetBrains Mono', monospace");
                let fLabel = field.type ? `${field.name}: ${field.type}` : field.name;
                if (fLabel.length > 28) fLabel = fLabel.slice(0, 26) + '…';
                fText.textContent = fLabel;
                g.appendChild(fText);

                if (field.isStatic || field.isFinal) {
                    const tagX = pos.w - (field.isStatic && field.isFinal ? 76 : 40);
                    if (field.isStatic) {
                        const st = svgEl('text');
                        st.setAttribute('x', String(pos.w - 8));
                        st.setAttribute('y', String(curY + 12));
                        st.setAttribute('text-anchor', 'end');
                        st.setAttribute('font-size', '8');
                        st.setAttribute('fill', '#c9b000'); st.setAttribute('font-family', 'Inter, sans-serif');
                        st.textContent = 'static';
                        g.appendChild(st);
                    }
                }

                curY += FIELD_H;
            });

            if ((cls.fields || []).length > MAX_FIELDS) {
                const more = svgEl('text');
                more.setAttribute('x', '14');
                more.setAttribute('y', String(curY + 10));
                more.setAttribute('font-size', '10');
                more.setAttribute('fill', '#555');
                more.setAttribute('font-family', 'Inter, sans-serif');
                more.textContent = `+${(cls.fields || []).length - MAX_FIELDS} more`;
                g.appendChild(more);
                curY += 16;
            }
            curY += 4;
        }

        // Dashed divider between fields and methods
        if (fields.length > 0 && methods.length > 0) {
            const div = svgEl('line');
            div.setAttribute('x1', '8'); div.setAttribute('y1', String(curY));
            div.setAttribute('x2', String(pos.w - 8)); div.setAttribute('y2', String(curY));
            div.setAttribute('stroke', '#383838'); div.setAttribute('stroke-width', '1');
            div.setAttribute('stroke-dasharray', '4 4');
            g.appendChild(div);
            curY += 2;
        }

        // Methods
        if (methods.length > 0) {
            curY += 6;
            methods.forEach(m => {
                const dot = svgEl('circle');
                dot.setAttribute('cx', '14'); dot.setAttribute('cy', String(curY + 9));
                dot.setAttribute('r', '3.5');
                dot.setAttribute('fill', color); dot.setAttribute('fill-opacity', '0.65');
                g.appendChild(dot);

                const mText = svgEl('text');
                mText.setAttribute('x', '25');
                mText.setAttribute('y', String(curY + 13));
                mText.setAttribute('font-size', '11.5');
                mText.setAttribute('fill', '#aaa');
                mText.setAttribute('font-family', "'JetBrains Mono', monospace");
                const label = m.name + (m.params ? '(…)' : '()');
                mText.textContent = label.length > 26 ? label.slice(0, 24) + '…' : label;
                g.appendChild(mText);

                curY += ROW_H;
            });

            if ((cls.methods || []).length > MAX_METHS) {
                const more = svgEl('text');
                more.setAttribute('x', '14');
                more.setAttribute('y', String(curY + 10));
                more.setAttribute('font-size', '10');
                more.setAttribute('fill', '#555');
                more.setAttribute('font-family', 'Inter, sans-serif');
                more.textContent = `+${(cls.methods || []).length - MAX_METHS} more`;
                g.appendChild(more);
            }
        }

        // Drag
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
            const nx = Math.max(0, origX + e.clientX - startX);
            const ny = Math.max(0, origY + e.clientY - startY);
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

    drawArrows(rel, arrowLayer, classes);
}

function drawArrows(rel, layer, classes) {
    layer.innerHTML = '';
    classes.forEach(cls => {
        if (!cls.bases) return;
        const from = diagPositions[cls.name], to = diagPositions[cls.bases];
        if (from && to) drawArrow(layer, from, to, '#4ec9b0', 'none', 'mk-ext');
    });
    Object.entries(rel.implementsMap).forEach(([clsName, ifaces]) => {
        const from = diagPositions[clsName];
        if (!from) return;
        ifaces.forEach(iface => {
            const to = diagPositions[iface];
            if (to) drawArrow(layer, from, to, '#569cd6', '6 3', 'mk-impl');
        });
    });
    Object.entries(rel.instantiation).forEach(([creator, created]) => {
        const from = diagPositions[creator];
        if (!from) return;
        created.forEach(name => {
            const to = diagPositions[name];
            if (to) drawArrow(layer, from, to, '#dcdcaa', '3 4', 'mk-new');
        });
    });
}

function drawArrow(layer, from, to, color, dasharray, markerId) {
    const [sx, sy] = boxEdge(from, to.x + to.w / 2, to.y + to.h / 2);
    const [ex, ey] = boxEdge(to,   from.x + from.w / 2, from.y + from.h / 2);
    const mx = (sx + ex) / 2, my = (sy + ey) / 2;

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
    const cx = pos.x + pos.w / 2, cy = pos.y + pos.h / 2;
    const dx = toX - cx, dy = toY - cy;
    const hw = pos.w / 2, hh = pos.h / 2;
    if (dx === 0 && dy === 0) return [cx, cy];
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    if (absDx * hh >= absDy * hw) {
        const side = dx > 0 ? 1 : -1;
        const x = cx + side * hw;
        const y = cy + dy * (hw / absDx);
        return [x, Math.max(pos.y, Math.min(pos.y + pos.h, y))];
    } else {
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
        default:     return { classes: [], functions: [], imports: [] };
    }
}

// ── Shared: Import Parser ──────────────────────────────────────────────────

function parseImports(code, ext) {
    const lines = code.split('\n');
    const imports = [];

    for (const line of lines) {
        const trimLine = line.trim();
        if (!trimLine) continue;

        if (ext === 'java') {
            const m = trimLine.match(/^import\s+([\w.]+(?:\.\*)?)\s*;/);
            if (m) imports.push(m[1]);
        } else if (ext === 'py') {
            let m = trimLine.match(/^import\s+(.+)/);
            if (m) {
                m[1].split(',').forEach(s => {
                    const name = s.trim().split(/\s+as\s+/)[0].trim();
                    if (name) imports.push(name);
                });
                continue;
            }
            m = trimLine.match(/^from\s+([\w.]+)\s+import\s+(.+)/);
            if (m) {
                const mod = m[1];
                m[2].split(',').forEach(s => {
                    const name = s.trim().split(/\s+as\s+/)[0].trim();
                    if (name) imports.push(`${mod}.${name}`);
                });
            }
        } else if (ext === 'js' || ext === 'ts') {
            let m = trimLine.match(/^import\s+(?:type\s+)?.*\s+from\s+['"]([^'"]+)['"]/);
            if (m) { imports.push(m[1]); continue; }
            m = trimLine.match(/^import\s+['"]([^'"]+)['"]/);
            if (m) { imports.push(m[1]); continue; }
            m = trimLine.match(/require\(\s*['"]([^'"]+)['"]\s*\)/);
            if (m) imports.push(m[1]);
        } else if (ext === 'c') {
            const m = trimLine.match(/^#include\s+[<"]([^>"]+)[>"]/);
            if (m) imports.push(m[1]);
        }
    }

    return imports;
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
            classes.push({ type:'class', ...item, methods:[], fields:[] });
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

    // Extract fields after methods are known
    classes.forEach(cls => { cls.fields = parsePythonFields(lines, cls); });

    return { classes, functions: fns, imports: parseImports(code, 'py') };
}

function parsePythonFields(lines, cls) {
    const fields = [];
    const seen   = new Set();

    // Determine class body indent from first non-empty non-comment line
    let bodyIndent = -1;
    for (let i = cls.lineStart; i < Math.min(cls.lineStart + 8, cls.lineEnd); i++) {
        const raw = lines[i];
        const tr  = raw.trimStart();
        if (!tr || tr.startsWith('#')) continue;
        const ind = raw.length - tr.length;
        if (ind > cls.indent) { bodyIndent = ind; break; }
    }
    if (bodyIndent < 0) return fields;

    // Class-level typed annotations and UPPER_CASE constants
    for (let i = cls.lineStart; i < cls.lineEnd && i < lines.length; i++) {
        const raw = lines[i];
        const tr  = raw.trimStart();
        if (!tr || tr.startsWith('#') || tr.startsWith('def ') || tr.startsWith('class ')) continue;
        const ind = raw.length - tr.length;
        if (ind !== bodyIndent) continue;

        // Type annotation: name: Type or name: Type = value
        let m = tr.match(/^(\w+)\s*:\s*([\w\[\], .|"']+?)\s*(?:=.*)?$/);
        if (m && !['pass', 'return', 'raise', 'break', 'continue', 'True', 'False', 'None'].includes(m[1])) {
            if (!seen.has(m[1])) {
                seen.add(m[1]);
                fields.push({ name: m[1], type: m[2].trim(), modifiers: [], isStatic: true, isFinal: false });
                continue;
            }
        }
        // UPPER_CASE constant
        m = tr.match(/^([A-Z][A-Z0-9_]{1,})\s*=/);
        if (m && !seen.has(m[1])) {
            seen.add(m[1]);
            fields.push({ name: m[1], type: null, modifiers: [], isStatic: true, isFinal: true });
        }
    }

    // self.x in __init__
    const initMethod = cls.methods.find(m => m.name === '__init__');
    if (initMethod) {
        for (let i = initMethod.lineStart - 1; i < initMethod.lineEnd && i < lines.length; i++) {
            const tr = lines[i].trim();
            // Type-annotated: self.name: Type = ...
            let m = tr.match(/^self\.(\w+)\s*:\s*([\w\[\], .|]+?)\s*=/);
            if (m && !seen.has(m[1])) {
                seen.add(m[1]);
                fields.push({ name: m[1], type: m[2].trim(), modifiers: [], isStatic: false, isFinal: false });
                continue;
            }
            // Plain: self.name = ...
            m = tr.match(/^self\.(\w+)\s*=/);
            if (m && !seen.has(m[1])) {
                seen.add(m[1]);
                fields.push({ name: m[1], type: null, modifiers: [], isStatic: false, isFinal: false });
            }
        }
    }

    return fields;
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
            const cls = { type:'class', name:cm[1], bases:cm[2]||'', lineStart:i+1, lineEnd, methods:[], fields:[] };
            parseJSMethods(lines, i, lineEnd, cls.methods);
            cls.fields = parseJSFields(lines, cls);
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

    return { classes, functions: fns, imports: parseImports(code, 'js') };
}

function parseJSMethods(lines, clsStart, clsEnd, methods) {
    let depth = 0;
    for (let i = clsStart; i < clsEnd && i < lines.length; i++) {
        const line = lines[i];
        const prevDepth = depth;
        for (const ch of line) {
            if (ch === '{') depth++;
            if (ch === '}') depth--;
        }
        if (prevDepth !== 1) continue;

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

function parseJSFields(lines, cls) {
    const fields = [];
    const seen   = new Set();
    let depth = 0;

    for (let i = cls.lineStart - 1; i < cls.lineEnd && i < lines.length; i++) {
        const line = lines[i];
        for (const ch of line) {
            if (ch === '{') depth++;
            if (ch === '}') depth--;
        }
        if (depth !== 1) continue;

        const tr = line.trim();
        if (!tr || tr.startsWith('//') || tr.startsWith('*')) continue;
        // Skip method-like lines
        if (tr.match(/\w+\s*\(.*\)\s*\{/)) continue;

        // Class field: static? name = or #name =
        const fm = tr.match(/^(static\s+)?(?:#)?(\w+)\s*(?:=(?!=)|;)/);
        if (fm && fm[2] && !['constructor', 'get', 'set', 'async', 'if', 'for', 'while', 'return', 'class', 'function', 'const', 'let', 'var', 'import', 'export'].includes(fm[2])) {
            if (!seen.has(fm[2])) {
                seen.add(fm[2]);
                fields.push({ name: fm[2], type: null, modifiers: fm[1] ? ['static'] : [], isStatic: !!fm[1], isFinal: false });
            }
        }
    }

    // this.x = in constructor
    const ctor = cls.methods.find(m => m.name === 'constructor');
    if (ctor) {
        for (let i = ctor.lineStart - 1; i < ctor.lineEnd && i < lines.length; i++) {
            const tr = lines[i].trim();
            const m = tr.match(/^this\.(\w+)\s*=/);
            if (m && !seen.has(m[1])) {
                seen.add(m[1]);
                fields.push({ name: m[1], type: null, modifiers: [], isStatic: false, isFinal: false });
            }
        }
    }

    return fields;
}

// ── TypeScript ─────────────────────────────────────────────────────────────

function parseTS(code) {
    const lines   = code.split('\n');
    const classes = [];
    const fns     = [];

    for (let i = 0; i < lines.length; i++) {
        const tr = lines[i].trim();
        if (!tr || tr.startsWith('//') || tr.startsWith('*')) continue;

        // Interface: interface Foo<T> extends Bar, Baz {
        const im = tr.match(/^(?:export\s+)?interface\s+(\w+)(?:<[^>]*>)?\s*(?:extends\s+([\w\s,<>]+?))?\s*\{/);
        if (im) {
            const lineEnd = braceEnd(lines, i);
            const bases = im[2] ? im[2].split(',')[0].replace(/<[^>]*>/g,'').trim() : '';
            const cls = { type:'class', name:im[1], bases, lineStart:i+1, lineEnd, methods:[], fields:[], tsType:'interface' };
            parseTSMembers(lines, i, lineEnd, cls.methods, cls.fields);
            classes.push(cls);
            continue;
        }

        // Enum: [export] [const] enum Foo {
        const em = tr.match(/^(?:export\s+)?(?:const\s+)?enum\s+(\w+)\s*\{/);
        if (em) {
            const lineEnd = braceEnd(lines, i);
            classes.push({ type:'class', name:em[1], bases:'', lineStart:i+1, lineEnd, methods:[], fields:[], tsType:'enum' });
            continue;
        }

        // Class: [export] [abstract] class Foo<T> [extends Bar] [implements IBaz, IQux]
        const cm = tr.match(/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:<[^>]*>)?\s*(?:extends\s+([\w<>, ]+?))?\s*(?:implements\s+([\w\s,<>]+?))?\s*\{/);
        if (cm) {
            const lineEnd = braceEnd(lines, i);
            const bases = cm[2] ? cm[2].replace(/<[^>]*>/g,'').split(',')[0].trim() : '';
            const isAbstract = /(?:^|\s)abstract\s+class/.test(tr);
            const cls = { type:'class', name:cm[1], bases, lineStart:i+1, lineEnd, methods:[], fields:[], tsType: isAbstract ? 'abstract' : 'concrete' };
            parseTSMembers(lines, i, lineEnd, cls.methods, cls.fields);
            classes.push(cls);
            continue;
        }

        // Type alias: [export] type Foo<T> = ...
        const tam = tr.match(/^(?:export\s+)?type\s+(\w+)(?:<[^>]*>)?\s*=/);
        if (tam) {
            classes.push({ type:'class', name:tam[1], bases:'', lineStart:i+1, lineEnd:i+1, methods:[], fields:[], tsType:'type' });
            continue;
        }

        // Skip lines inside class/interface bodies
        if (classes.some(c => c.lineEnd > c.lineStart && i+1 > c.lineStart && i+1 < c.lineEnd)) continue;

        // Function declaration
        const fd = tr.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)\s*(?::\s*([^{]+?))?\s*\{/);
        if (fd) {
            fns.push({ type:'function', name:fd[1], params:clean(fd[2]), returnType:fd[3]?fd[3].trim():null, lineStart:i+1, lineEnd:braceEnd(lines,i), description: blockCommentBefore(lines,i)||lineCommentsBefore(lines,i) });
            continue;
        }

        // Arrow / const function
        const ae = tr.match(/^(?:export\s+)?(?:const|let)\s+(\w+)\s*(?::[^=]+)?\s*=\s*(?:async\s+)?\(?([^)=>{]*)\)?\s*(?::\s*[^=>{]+?)?\s*=>/);
        if (ae) {
            fns.push({ type:'function', name:ae[1], params:clean(ae[2]), returnType:null, lineStart:i+1, lineEnd:braceEnd(lines,i), description: blockCommentBefore(lines,i)||lineCommentsBefore(lines,i) });
        }
    }

    return { classes, functions: fns, imports: parseImports(code, 'ts') };
}

function parseTSMembers(lines, clsStart, clsEnd, methods, fields) {
    let depth = 0;
    for (let i = clsStart; i < clsEnd && i < lines.length; i++) {
        const line = lines[i];
        const prevDepth = depth;
        for (const ch of line) {
            if (ch === '{') depth++;
            if (ch === '}') depth--;
        }
        if (prevDepth !== 1) continue;

        const tr = line.trim();
        if (!tr || tr.startsWith('//') || tr.startsWith('*') || tr.startsWith('@')) continue;

        // Constructor
        const ctorm = tr.match(/^(?:(?:public|private|protected)\s+)?constructor\s*\(([^)]*)\)\s*(?:\{|$)/);
        if (ctorm) {
            if (tr.endsWith('{')) {
                const lineEnd = braceEnd(lines, i);
                methods.push({ type:'method', name:'constructor', params:clean(ctorm[1]), returnType:null, lineStart:i+1, lineEnd, description: blockCommentBefore(lines,i)||lineCommentsBefore(lines,i) });
                i = lineEnd - 1; depth = 1;
            }
            continue;
        }

        // Method (line has parens)
        if (tr.includes('(')) {
            const mm = tr.match(/^(?:(?:public|private|protected|static|async|abstract|override|readonly)\s+)*(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)\s*(?::\s*([^{;]+?))?\s*(?:\{|;|$)/);
            if (mm && !['if','for','while','switch','try','catch','new','super','return'].includes(mm[1])) {
                if (tr.endsWith('{')) {
                    const lineEnd = braceEnd(lines, i);
                    methods.push({ type:'method', name:mm[1], params:clean(mm[2]), returnType:mm[3]?mm[3].trim():null, lineStart:i+1, lineEnd, description: blockCommentBefore(lines,i)||lineCommentsBefore(lines,i) });
                    i = lineEnd - 1; depth = 1;
                } else {
                    // Abstract method or interface signature (ends with ; or nothing)
                    methods.push({ type:'method', name:mm[1], params:clean(mm[2]), returnType:mm[3]?mm[3].trim():null, lineStart:i+1, lineEnd:i+1, description: blockCommentBefore(lines,i)||lineCommentsBefore(lines,i) });
                }
                continue;
            }
        }

        // Field/property (no parens, has : type annotation)
        if (!tr.includes('(') && tr.includes(':')) {
            const fm = tr.match(/^((?:(?:public|private|protected|readonly|static|abstract|override|declare)\s+)*)(\w+)\??\s*:\s*([\w<>\[\],\s|&"'`]+?)\s*(?:=.*)?;?$/);
            if (fm && fm[2] && fm[2] !== 'constructor') {
                const mods = fm[1].trim().split(/\s+/).filter(Boolean);
                fields.push({
                    name: fm[2],
                    type: fm[3].trim(),
                    modifiers: mods,
                    isStatic: mods.includes('static'),
                    isFinal: mods.includes('readonly')
                });
            }
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

        const cm = trimLine.match(/^(?:(?:public|private|protected|abstract|final|static)\s+)*(?:class|interface|enum)\s+(\w+)(?:<(?:[^<>]|<[^<>]*>)*>)?(?:\s+extends\s+(\w[\w<>, .]*))?(?:\s+implements\s+[\w\s,<>.]+)?\s*\{/);
        if (cm) {
            const lineEnd = braceEnd(lines, i);
            const cls = { type:'class', name:cm[1], bases:cm[2]||'', lineStart:i+1, lineEnd, methods:[], fields:[] };
            parseJavaMethods(lines, i, lineEnd, cls.methods);
            cls.fields = parseJavaFields(lines, i, lineEnd);
            classes.push(cls);
        }
    }

    return { classes, functions: [], imports: parseImports(code, 'java') };
}

function parseJavaMethods(lines, clsStart, clsEnd, methods) {
    let depth = 0;
    for (let i = clsStart; i < clsEnd && i < lines.length; i++) {
        const prevDepth = depth;
        for (const ch of lines[i]) {
            if (ch === '{') depth++;
            if (ch === '}') depth--;
        }
        if (prevDepth !== 1) continue;

        const trimLine = lines[i].trim();
        if (!trimLine || trimLine.startsWith('//') || trimLine.startsWith('*') || trimLine.startsWith('@')) continue;

        // Join continuation lines when param list spans multiple lines
        let joinedLine = trimLine;
        if (trimLine.includes('(') && !trimLine.includes(')')) {
            for (let k = i + 1; k < Math.min(i + 8, clsEnd); k++) {
                joinedLine += ' ' + lines[k].trim();
                if (lines[k].includes(')')) break;
            }
        }

        const mm = joinedLine.match(/^(?:(?:public|private|protected|static|final|abstract|synchronized|default|native)\s+)*(?:<(?:[^<>]|<[^<>]*>)*>\s+)?(\w[\w<>\[\]]*)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w\s,]+)?\s*\{/);
        if (mm && !['if','for','while','switch','try'].includes(mm[2])) {
            const lineEnd = braceEnd(lines, i);
            methods.push({ type:'method', name:mm[2], params:clean(mm[3]), returnType:mm[1], lineStart:i+1, lineEnd,
                description: blockCommentBefore(lines,i)||lineCommentsBefore(lines,i) });
            i = lineEnd - 1;
            depth = 1;
        }
    }
}

function parseJavaFields(lines, clsStart, clsEnd) {
    const fields = [];
    let depth = 0;
    for (let i = clsStart; i < clsEnd && i < lines.length; i++) {
        const prevDepth = depth;
        for (const ch of lines[i]) {
            if (ch === '{') depth++;
            if (ch === '}') depth--;
        }
        if (prevDepth !== 1) continue;

        const tr = lines[i].trim();
        if (!tr || tr.startsWith('//') || tr.startsWith('*') || tr.startsWith('@')) continue;
        if (tr.includes('(')) continue; // skip methods and calls
        if (tr.startsWith('{') || tr.startsWith('}')) continue;

        // [modifiers] type name [= ...] ;
        const fm = tr.match(/^((?:(?:public|private|protected|static|final|volatile|transient)\s+)*)(\w[\w<>\[\],\s]*?)\s+(\w+)\s*(?:=.+)?;$/);
        if (fm && fm[3] && fm[3] !== 'class') {
            const mods = fm[1].trim().split(/\s+/).filter(Boolean);
            fields.push({
                name: fm[3],
                type: fm[2].trim(),
                modifiers: mods,
                isStatic: mods.includes('static'),
                isFinal: mods.includes('final')
            });
        }
    }
    return fields;
}

// ── C ──────────────────────────────────────────────────────────────────────

function parseCLike(code) {
    const lines = code.split('\n');
    const fns   = [];

    for (let i = 0; i < lines.length; i++) {
        const tr = lines[i].trim();
        if (!tr || tr.startsWith('//') || tr.startsWith('*') || tr.startsWith('#')) continue;

        const fm = tr.match(/^(?:static\s+|inline\s+|extern\s+)?(\w[\w\s*]*?)\s+(\w+)\s*\(([^)]*)\)\s*(?:const\s*)?\{/);
        if (fm && fm[2] && !['if','for','while','switch','do','else','return'].includes(fm[2]) && fm[1] !== 'else') {
            const lineEnd = braceEnd(lines, i);
            fns.push({ type:'function', name:fm[2], params:clean(fm[3]), returnType:fm[1].trim(), lineStart:i+1, lineEnd,
                description: blockCommentBefore(lines,i)||lineCommentsBefore(lines,i) });
            i = lineEnd - 1;
        }
    }

    return { classes: [], functions: fns, imports: parseImports(code, 'c') };
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
    let depth = 0, opened = false, inBlockComment = false;
    for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];
        let inStr = false, strCh = '', skip = false;
        for (let j = 0; j < line.length; j++) {
            const ch = line[j], nx = line[j+1];
            if (skip) { skip = false; continue; }
            if (inBlockComment) {
                if (ch === '*' && nx === '/') { inBlockComment = false; j++; }
                continue;
            }
            if (!inStr && ch === '/' && nx === '/') break;
            if (!inStr && ch === '/' && nx === '*') { inBlockComment = true; j++; continue; }
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
