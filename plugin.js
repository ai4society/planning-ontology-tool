// --- General Configs ---
const PY_MODULE_URL = "https://rawcdn.githack.com/ai4society/planning-ontology-tool/3603308c506f68f1f3dcfbbfefae32b2123b0497/ontology.py";
const PY_MODULE_NAME = "ontology";
const PY_FUNC_NAME = "create_ontology";

const RDF_TYPE_PREDICATE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
const RDF_LABEL_PREDICATE = "http://www.w3.org/2000/01/rdf-schema#label"

const RDF_IGNORE_PREDICATES = [
  RDF_TYPE_PREDICATE,
  RDF_LABEL_PREDICATE,
  "http://www.w3.org/2000/01/rdf-schema#subClassOf",
  "http://www.w3.org/2000/01/rdf-schema#comment",
  "http://www.w3.org/2002/07/owl#inverseOf",
  "http://www.w3.org/2002/07/owl#versionIRI"
];

// UI Color Theme - Brick red primary with muted accents
const COLORS = {
  primary: '#8B3A3A',
  primaryHover: '#A04545',
  primaryDark: '#6B2D2D',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  border: '#E0DDD9',
  borderLight: '#EBE8E4',
  textPrimary: '#3D3935',
  textSecondary: '#6B6560',
  textMuted: '#9A948D',
  hover: '#F5F2EF',
  accentBlue: '#5B7C99',
  accentGreen: '#5B8A6F',
  accentPurple: '#7B6B8D',
  accentOrange: '#B87333',
  accentGold: '#C4A35A',
  accentTeal: '#5A8A8A'
};

const D3_STYLE = {
  node: {
    default: {
      radius: 15,
      fill: '#9E9E9E',
      stroke: '#616161',
      strokeWidth: 2
    },
    classes: {
      domain: { fill: '#E57373' },      // Soft vibrant red
      problem: { fill: '#81C784' },     // Soft vibrant green
      plan: { fill: '#A3C9A8' },        // Muted mint for plan containers
      plan_step: { fill: '#F9CE6B' },   // Warm yellow for plan steps
      action: { fill: '#64B5F6' },      // Soft vibrant blue
      precondition: { fill: '#4DD0E1' }, // Soft vibrant cyan
      effect: { fill: '#BA68C8' },      // Soft vibrant purple
      predicate: { fill: '#FFD54F' },   // Soft vibrant yellow
      parameter: { fill: '#FFB74D' },   // Soft vibrant orange
      planner: { fill: '#90CAF9' }      // Soft vibrant light blue
    }
  },
  edge: {
    stroke: '#78909C',
    strokeWidth: 1.5,
    markerSize: 6
  },
  text: {
    fontSize: '10px',
    fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
    fill: '#37474F'
  }
};

const PLUGIN_LIBS = [
  "https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js",
  "https://cdn.jsdelivr.net/npm/rdflib@2.2.6/dist/rdflib.min.js",
  "https://cdn.jsdelivr.net/npm/jsonld@1.8.1/dist/jsonld.min.js",
  "https://cdn.jsdelivr.net/npm/n3@1.17.3/browser/n3.min.js",
  "https://rdf.js.org/comunica-browser/versions/v4/engines/query-sparql/comunica-browser.js",
  "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js"
];

var PLUGIN_MODAL = `
  <div class="modal fade" id="chooseFiles" tabindex="-1" role="dialog"
      aria-labelledby="chooseModalLabel" aria-hidden="true">
    <div class="modal-dialog">
      <div class="modal-content">

        <div class="modal-body">
          <form class="form-horizontal">
            <div class="form-group">
              <label class="col-sm-4 control-label">Domain file</label>
              <div class="col-sm-6">
                <select id="domainSelect" class="form-control file-selection"></select>
              </div>
            </div>
            <div class="form-group">
              <label class="col-sm-4 control-label">Problem file</label>
              <div class="col-sm-6">
                <select id="problemSelect" class="form-control file-selection"></select>
              </div>
            </div>
            <div class="form-group">
              <label class="col-sm-4 control-label">Plan file <small style="color:#999">(optional)</small></label>
              <div class="col-sm-6">
                <select id="planSelect" class="form-control file-selection">
                  <option value="">-- No plan --</option>
                </select>
              </div>
            </div>
          </form>
        </div>

        <div class="modal-footer">
          <button id="filesChosenBtn" class="btn btn-primary" data-dismiss="modal">
            Generate Knowledge Graph
          </button>
          <button type="button" class="btn btn-default" data-dismiss="modal">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>`;

/**
 * Run a Python snippet inside the Pyodide VM.
 * Requires `window.pyodideReady` to be a Promise that resolves to a loaded Pyodide.
 * @param {string} code - Python source to execute.
 * @returns {Promise<any>} - Python snippet return.
*/
async function pyRun(code) {
  await window.pyodideReady;
  return await window.pyodide.runPythonAsync(code);
}

/**
 * Load a Python module from a URL into Pyodide's virtual FS and import it.
 * @param {string} url - Raw .py file URL.
 * @param {string} moduleName - The module's import name (without .py).
 * @returns {Promise<any>} - A proxied PyProxy for the imported module (via pyodide.pyimport).
*/
async function loadPyModuleFromURL(url, moduleName) {
  await window.pyodideReady;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error to fetch ${url}: ${res.status}`);
  const src = await res.text();

  // Write the module file into Pyodide's in-memory filesystem.
  window.pyodide.FS.writeFile(`${moduleName}.py`, src);
  await pyRun(`
  import sys
  if "${moduleName}" not in sys.modules:
      import ${moduleName}
  ` );
  // Return a Python module proxy we can call from JS.
  return window.pyodide.pyimport(moduleName);
}

/**
 * High-level helper: make sure the Python module/function is present and then call it.
 * It expects the Python side expose a function that takes (domainText, problemText, planText)
 * and returns an ontology string (RDF/XML).
 * @param {string} domainText - PDDL domain text.
 * @param {string} problemText - PDDL problem text.
 * @param {string} planText - Optional plan text.
 * @returns {Promise<any>} - Ontology string (RDF/XML).
*/
async function createOntologyWithPython(domainText, problemText, planText = "") {
  await loadPyModuleFromURL(PY_MODULE_URL, PY_MODULE_NAME);

  let pythonFunction;
  try {
    pythonFunction = await pyRun(`
  import importlib
  module = importlib.import_module("${PY_MODULE_NAME}")
  getattr(module, "${PY_FUNC_NAME}")
    `);
  } catch (e) {
    throw new Error(`Function "${PY_FUNC_NAME}" not found in module "${PY_MODULE_NAME}".`);
  }

  // Call the Python function directly from JS
  return pythonFunction(domainText, problemText, planText);
}

define(function (require, exports, module) {

  /**
   * Returns the full HTML layout string.
   * @param {string} viewerId
   * @returns {string} - HTML string
 */
  function getPluginLayout(viewerId) {
    return `<style>
        .kg-root{
          width:100%; height:100%;
          display:grid;
          grid-template-columns: auto 1fr 360px;
          grid-template-areas: "templates canvas sparql";
          background:${COLORS.surface}; overflow:hidden; position:relative;
          font-family: "Inter", "Segoe UI", Arial, sans-serif;
        }

        /* Header with title and info button */
        .kg-header{
          position:absolute; top:10px; left:16px; right:376px;
          z-index:10;
        }
        .kg-header-top{
          display:flex; align-items:center; gap:10px; margin-bottom:4px;
        }
        .kg-title{
          font-size:17px; font-weight:600; color:${COLORS.primary};
          margin:0; letter-spacing:-0.3px;
        }
        .kg-title a{
          color:inherit; text-decoration:none;
        }
        .kg-title a:hover{
          text-decoration:underline;
        }
        .kg-description{
          font-size:11px; line-height:1.4; color:${COLORS.textSecondary};
          margin:0; word-wrap:break-word; white-space:normal;
        }
        .kg-description em{ color:${COLORS.primary}; font-style:italic; }
        .kg-description .kg-link{
          color:${COLORS.accentBlue}; cursor:pointer; text-decoration:underline;
          font-weight:500;
        }
        .kg-info-btn{
          width:26px; height:26px; border-radius:50%;
          border:1.5px solid ${COLORS.primary}; background:${COLORS.surface};
          color:${COLORS.primary}; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          transition:all 0.2s ease; font-size:14px; font-weight:600;
          font-family:Georgia, serif; font-style:italic;
        }
        .kg-info-btn:hover{ background:${COLORS.primary}; color:${COLORS.surface}; }
        .kg-info-btn.glow{
          animation: infoGlow 1s ease-in-out;
        }
        @keyframes infoGlow{
          0%{ box-shadow:0 0 0 0 rgba(139,58,58,0.4); transform:scale(1); }
          25%{ box-shadow:0 0 12px 4px rgba(139,58,58,0.6); transform:scale(1.15); }
          50%{ box-shadow:0 0 8px 2px rgba(139,58,58,0.4); transform:scale(1.1); }
          75%{ box-shadow:0 0 12px 4px rgba(139,58,58,0.6); transform:scale(1.15); }
          100%{ box-shadow:0 0 0 0 rgba(139,58,58,0); transform:scale(1); }
        }

        /* Info Popup */
        .kg-info-popup{
          position:fixed; top:0; left:0; right:0; bottom:0;
          background:rgba(61,57,53,0.5); z-index:1000;
          display:flex; align-items:center; justify-content:center;
        }
        .kg-info-popup-content{
          background:${COLORS.surface}; border-radius:12px;
          box-shadow:0 8px 32px rgba(0,0,0,0.15);
          max-width:520px; width:90%; max-height:80vh; overflow:auto;
        }
        .kg-info-popup-header{
          display:flex; justify-content:space-between; align-items:center;
          padding:20px 24px; border-bottom:1px solid ${COLORS.border};
        }
        .kg-info-popup-header h2{ margin:0; font-size:20px; font-weight:600; color:${COLORS.primary}; }
        .kg-info-close{
          width:32px; height:32px; border:none; background:transparent;
          font-size:24px; color:${COLORS.textSecondary}; cursor:pointer;
          border-radius:6px; transition:all 0.2s ease; line-height:1;
        }
        .kg-info-close:hover{ background:${COLORS.hover}; color:${COLORS.textPrimary}; }
        .kg-info-popup-body{ padding:24px; }
        .kg-info-section{ margin-bottom:24px; }
        .kg-info-section:last-child{ margin-bottom:0; }
        .kg-info-section h3{
          font-size:12px; font-weight:600; color:${COLORS.textSecondary};
          margin:0 0 12px 0; text-transform:uppercase; letter-spacing:0.5px;
        }
        .kg-info-links{ list-style:none; padding:0; margin:0; }
        .kg-info-links li{ margin-bottom:10px; }
        .kg-info-links a{
          color:${COLORS.primary}; text-decoration:none; font-size:14px;
          display:inline-flex; align-items:center; gap:6px; font-weight:500;
        }
        .kg-info-links a:hover{ text-decoration:underline; }
        .kg-info-links svg{ width:16px; height:16px; opacity:0.7; }
        .kg-citation-note{ font-size:13px; color:${COLORS.textSecondary}; margin:0 0 12px 0; }
        .kg-bibtex{
          background:${COLORS.background}; border:1px solid ${COLORS.border};
          border-radius:8px; padding:12px;
          font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size:10px; line-height:1.5; white-space:pre-wrap; word-break:break-all;
          color:${COLORS.textPrimary}; margin:0 0 12px 0; max-height:180px; overflow:auto;
        }
        .kg-copy-btn{
          padding:8px 16px; background:${COLORS.primary}; color:${COLORS.surface};
          border:none; border-radius:6px; font-size:12px; font-weight:500;
          cursor:pointer; transition:background 0.2s ease;
        }
        .kg-copy-btn:hover{ background:${COLORS.primaryHover}; }

        /* Base button style */
        .kg-btn{
          display:inline-flex; align-items:center; justify-content:center;
          font-size:12px; font-weight:500; padding:8px 12px;
          border-radius:6px; border:1px solid ${COLORS.border};
          background:${COLORS.surface}; color:${COLORS.textPrimary};
          box-shadow:0 1px 3px rgba(0,0,0,.08); cursor:pointer;
          user-select:none; line-height:1; transition:all 0.2s ease;
        }
        .kg-btn:hover{ background:${COLORS.hover}; border-color:${COLORS.textMuted}; }

        /* Templates panel */
        .kg-templates-panel{
          grid-area:templates;
          width:300px; min-width:280px; max-width:50vw; height:100%;
          background:${COLORS.background}; border-right:1px solid ${COLORS.border};
          display:flex; flex-direction:column; overflow:hidden; resize:horizontal;
          padding-top:50px; /* Leave room for main header */
        }
        .kg-templates-header{
          padding:10px 16px; border-bottom:1px solid ${COLORS.border};
          background:${COLORS.background};
        }
        .kg-templates-title{
          font-size:11px; font-weight:600; color:${COLORS.textMuted}; margin:0;
          text-transform:uppercase; letter-spacing:0.5px;
        }
        .kg-templates-content{ flex:1; overflow:auto; padding:16px; }

        /* Collapsible template cards */
        .kg-query-template{
          margin-bottom:12px; border:1px solid ${COLORS.border};
          border-radius:8px; overflow:hidden; background:${COLORS.surface};
          transition:all 0.25s ease;
        }
        .kg-query-template:hover{
          box-shadow:0 2px 8px rgba(0,0,0,0.08);
          border-color:${COLORS.textMuted};
          transform:translateY(-1px);
        }
        .kg-query-template.is-open{
          box-shadow:0 2px 10px rgba(0,0,0,0.1);
          border-color:${COLORS.textMuted};
        }
        .kg-template-header{
          width:100%; padding:12px 14px; background:${COLORS.surface};
          border:none; border-bottom:1px solid transparent;
          cursor:pointer; display:flex; justify-content:space-between; align-items:flex-start;
          text-align:left; transition:all 0.2s ease;
        }
        .kg-query-template.is-open .kg-template-header{ border-bottom-color:${COLORS.borderLight}; }
        .kg-template-header:hover{ background:${COLORS.hover}; }
        .kg-template-header-content{
          flex:1; min-width:0;
          display:flex; flex-direction:column; gap:2px;
        }
        .kg-template-title{
          font-size:13px; font-weight:600; color:${COLORS.textPrimary};
          display:block; margin-bottom:2px;
        }
        .kg-template-description{
          font-size:11px; color:${COLORS.textSecondary}; display:block;
          line-height:1.4; word-break:break-word; white-space:normal;
        }
        .kg-template-chevron{
          color:${COLORS.textMuted}; transition:transform 0.2s ease;
          flex-shrink:0; margin-left:8px;
        }
        .kg-query-template.is-open .kg-template-chevron{ transform:rotate(180deg); }
        .kg-template-body{
          max-height:0; overflow:hidden; transition:max-height 0.3s ease;
        }
        .kg-query-template.is-open .kg-template-body{ max-height:400px; }
        .kg-template-code{ padding:12px 14px; background:${COLORS.background}; }
        .kg-template-query{
          font:11px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          background:${COLORS.surface}; border:1px solid ${COLORS.borderLight};
          border-radius:6px; padding:10px; white-space:pre-wrap; word-break:break-word;
          color:${COLORS.textPrimary}; margin:0; max-height:140px; overflow:auto;
        }
        .kg-template-actions{ padding:0 14px 14px 14px; background:${COLORS.background}; }
        .kg-template-run-btn{
          padding:6px 14px; background:${COLORS.primary}; color:${COLORS.surface};
          border:none; border-radius:6px; font-size:12px; font-weight:500;
          cursor:pointer; transition:background 0.2s ease;
        }
        .kg-template-run-btn:hover{ background:${COLORS.primaryHover}; }

        /* Canvas */
        .kg-canvas{ grid-area:canvas; position:relative; background:${COLORS.surface}; }
        .kg-canvas > svg{ width:100%; height:100%; display:block; }

        /* Graph Info Box */
        .kg-graph-info{
          position:absolute; top:12px; right:12px;
          background:${COLORS.surface}; border:1px solid ${COLORS.border};
          border-radius:8px; min-width:160px;
          box-shadow:0 2px 8px rgba(0,0,0,0.08); z-index:5;
          font-size:12px; overflow:hidden; transition:all 0.2s ease;
        }
        .kg-graph-info.is-collapsed{ min-width:auto; }
        .kg-graph-info.is-collapsed .kg-graph-info-content{ display:none; }
        .kg-graph-info-header{
          display:flex; justify-content:space-between; align-items:center;
          padding:10px 12px; border-bottom:1px solid ${COLORS.borderLight};
          background:${COLORS.background};
        }
        .kg-graph-info.is-collapsed .kg-graph-info-header{ border-bottom:none; }
        .kg-graph-info-title{
          font-size:11px; font-weight:600; color:${COLORS.primary};
          text-transform:uppercase; letter-spacing:0.5px; margin:0;
        }
        .kg-graph-info-toggle{
          width:20px; height:20px; border:none; background:transparent;
          color:${COLORS.textMuted}; cursor:pointer; border-radius:4px;
          display:flex; align-items:center; justify-content:center;
          transition:all 0.2s ease;
        }
        .kg-graph-info-toggle:hover{ background:${COLORS.hover}; color:${COLORS.textPrimary}; }
        .kg-graph-info-content{ padding:10px 12px; }
        .kg-graph-info-row{
          display:flex; justify-content:space-between; align-items:center;
          padding:4px 0;
        }
        .kg-graph-info-label{ color:${COLORS.textSecondary}; }
        .kg-graph-info-value{ font-weight:600; color:${COLORS.textPrimary}; }

        /* SPARQL panel */
        .sparql-panel{
          grid-area:sparql; height:100%;
          background:${COLORS.background}; border-left:1px solid ${COLORS.border};
          display:flex; flex-direction:column; overflow:hidden;
        }
        .sparql-panel-header{
          padding:16px; border-bottom:1px solid ${COLORS.border};
          background:${COLORS.surface};
        }
        .sparql-panel-title{ font-size:14px; font-weight:600; color:${COLORS.textPrimary}; margin:0; }
        .sparql-editor{ padding:16px; background:${COLORS.surface}; border-bottom:1px solid ${COLORS.border}; }
        .sparql-editor textarea{
          width:100%; height:160px;
          font:13px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          background:${COLORS.background}; border:1px solid ${COLORS.border};
          border-radius:8px; padding:12px; outline:none; resize:vertical;
          color:${COLORS.textPrimary}; transition:border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .sparql-editor textarea:focus{
          border-color:${COLORS.primary};
          box-shadow:0 0 0 3px rgba(139,58,58,0.1);
        }
        .sparql-editor textarea::placeholder{ color:${COLORS.textMuted}; }
        .sparql-editor-actions{ display:flex; gap:10px; margin-top:12px; }
        .sparql-btn{
          padding:8px 18px; border-radius:6px; font-size:13px; font-weight:500;
          cursor:pointer; transition:all 0.2s ease;
        }
        .sparql-btn-primary{
          background:${COLORS.primary}; color:${COLORS.surface}; border:none;
        }
        .sparql-btn-primary:hover{ background:${COLORS.primaryHover}; }
        .sparql-btn-secondary{
          background:${COLORS.surface}; color:${COLORS.textPrimary};
          border:1px solid ${COLORS.border};
        }
        .sparql-btn-secondary:hover{ background:${COLORS.hover}; border-color:${COLORS.textMuted}; }
        .sparql-output-container{ flex:1; overflow:auto; padding:16px; }
        .sparql-output{
          background:${COLORS.surface}; border:1px solid ${COLORS.border};
          border-radius:8px; padding:12px;
          font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size:13px; min-height:80px; color:${COLORS.textPrimary};
        }
        .sparql-output-empty{ color:${COLORS.textMuted}; font-style:italic; }
        .sparql-output .kg-grid{ width:100%; border-collapse:collapse; font-size:12px; }
        .sparql-output .kg-grid th{
          padding:10px 12px; background:${COLORS.primary}; color:${COLORS.surface};
          text-align:left; font-weight:600; border:none;
        }
        .sparql-output .kg-grid th:first-child{ border-radius:6px 0 0 0; }
        .sparql-output .kg-grid th:last-child{ border-radius:0 6px 0 0; }
        .sparql-output .kg-grid td{
          padding:10px 12px; border-bottom:1px solid ${COLORS.borderLight};
          color:${COLORS.textPrimary};
        }
        .sparql-output .kg-grid tbody tr:hover{ background:${COLORS.hover}; }
        .sparql-output .kg-grid tbody tr:nth-child(even){ background:${COLORS.background}; }
        .sparql-output .kg-grid tbody tr:nth-child(even):hover{ background:${COLORS.hover}; }

        /* Node popup for clicked nodes */
        .kg-node-popup{
          position:absolute; z-index:100;
          background:${COLORS.surface}; border:1px solid ${COLORS.border};
          border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,0.15);
          min-width:200px; max-width:280px;
          font-size:12px; overflow:hidden;
          animation:nodePopupIn 0.2s ease-out;
        }
        @keyframes nodePopupIn{
          from{ opacity:0; transform:scale(0.9) translateY(-5px); }
          to{ opacity:1; transform:scale(1) translateY(0); }
        }
        .kg-node-popup-header{
          padding:8px 14px; background:${COLORS.primary};
          display:flex; justify-content:space-between; align-items:center;
        }
        .kg-node-popup-title{
          font-weight:600; color:${COLORS.surface}; margin:0;
          font-size:13px; max-width:200px;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .kg-node-popup-close{
          width:20px; height:20px; border:none; background:transparent;
          color:${COLORS.surface}; cursor:pointer; border-radius:4px;
          display:flex; align-items:center; justify-content:center;
          opacity:0.8; transition:opacity 0.2s; font-size:16px; line-height:1;
        }
        .kg-node-popup-close:hover{ opacity:1; }
        .kg-node-popup-body{ padding:12px 14px; }
        .kg-node-popup-row{
          display:flex; justify-content:space-between; align-items:flex-start;
          padding:6px 0; border-bottom:1px solid ${COLORS.borderLight};
        }
        .kg-node-popup-row:last-child{ border-bottom:none; }
        .kg-node-popup-label{
          color:${COLORS.textSecondary}; font-weight:500; flex-shrink:0; margin-right:10px;
        }
        .kg-node-popup-value{
          color:${COLORS.textPrimary}; text-align:right; word-break:break-word;
        }
        .kg-node-popup-badge{
          display:inline-block; padding:3px 8px; border-radius:4px;
          font-size:10px; font-weight:600; text-transform:uppercase;
        }
        .kg-node-popup-timer{
          padding:8px 14px; background:${COLORS.background};
          font-size:10px; color:${COLORS.textMuted}; text-align:center;
        }
        .kg-node-popup-comment{
          padding:8px 14px; background:${COLORS.background}; border-top:1px solid ${COLORS.borderLight};
          font-size:11px; line-height:1.4; color:${COLORS.textPrimary};
          max-height:200px; overflow-y:auto; white-space:pre-wrap;
          font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
      </style>

      <div id="${viewerId}" class="kg-root">
        <!-- Header with title and info button -->
        <div class="kg-header">
          <div class="kg-header-top">
            <h1 class="kg-title"><a href="https://ai4society.github.io/planning-ontology/" target="_blank" rel="noopener">Planning Ontology</a></h1>
            <button class="kg-info-btn" id="${viewerId}-info-btn" aria-label="About Planning Ontology" title="About Planning Ontology">i</button>
          </div>
        </div>

        <!-- Info Popup Modal -->
        <div class="kg-info-popup" id="${viewerId}-info-popup" style="display:none;">
          <div class="kg-info-popup-content">
            <div class="kg-info-popup-header">
              <h2>Planning Ontology</h2>
              <button class="kg-info-close" id="${viewerId}-info-close" aria-label="Close">&times;</button>
            </div>
            <div class="kg-info-popup-body">
              <div class="kg-info-section">
                <h3>Resources</h3>
                <ul class="kg-info-links">
                  <li><a href="https://raw.githack.com/BharathMuppasani/AI-Planning-Ontology/main/documentation/ontology_documentation.html" target="_blank" rel="noopener">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    Documentation
                  </a></li>
                  <li><a href="https://ai4society.github.io/planning-ontology/" target="_blank" rel="noopener">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    Website
                  </a></li>
                  <li><a href="https://github.com/ai4society/planning-ontology/tree/main/AI-Planning-Ontology" target="_blank" rel="noopener">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                    GitHub Repository
                  </a></li>
                  <li><a href="https://purl.archive.org/ai4s/ontology/planning" target="_blank" rel="noopener">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    Planning Ontology PURL
                  </a></li>
                </ul>
              </div>
              <div class="kg-info-section">
                <h3>Citation</h3>
                <p class="kg-citation-note">If you use this ontology in your research, please cite:</p>
                <pre class="kg-bibtex">@article{muppasani2025building,
  title={Building a planning ontology to represent and exploit planning knowledge and its aplications},
  author={Muppasani, Bharath Chandra and Gupta, Nitin and Pallagani, Vishal and Srivastava, Biplav and Mutharaju, Raghava and Huhns, Michael N and Narayanan, Vignesh},
  journal={Discover Data},
  volume={3},
  number={1},
  pages={55},
  year={2025},
  publisher={Springer}
}</pre>
                <button class="kg-copy-btn" id="${viewerId}-copy-bibtex">Copy BibTeX</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Templates panel -->
        <aside class="kg-templates-panel" id="${viewerId}-templates-panel">
          <div class="kg-templates-header">
            <h2 class="kg-templates-title">Query Templates</h2>
          </div>
          <div class="kg-templates-content" id="${viewerId}-templates-content"></div>
        </aside>

        <!-- Canvas -->
        <div class="kg-canvas">
          <svg id="${viewerId}-svg"></svg>
          <!-- Node popup (appears on node click) -->
          <div class="kg-node-popup" id="${viewerId}-node-popup" style="display:none;"></div>
          <!-- Graph Info Box -->
          <div class="kg-graph-info" id="${viewerId}-graph-info">
            <div class="kg-graph-info-header">
              <span class="kg-graph-info-title">Graph Stats</span>
              <button class="kg-graph-info-toggle" id="${viewerId}-graph-info-toggle" aria-label="Toggle stats">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M2 4l4 4 4-4"/>
                </svg>
              </button>
            </div>
            <div class="kg-graph-info-content">
              <div class="kg-graph-info-row">
                <span class="kg-graph-info-label">Domain</span>
                <span class="kg-graph-info-value" id="${viewerId}-info-domain">-</span>
              </div>
              <div class="kg-graph-info-row">
                <span class="kg-graph-info-label">Actions</span>
                <span class="kg-graph-info-value" id="${viewerId}-info-actions">-</span>
              </div>
              <div class="kg-graph-info-row">
                <span class="kg-graph-info-label">Predicates</span>
                <span class="kg-graph-info-value" id="${viewerId}-info-predicates">-</span>
              </div>
              <div class="kg-graph-info-row">
                <span class="kg-graph-info-label">Nodes</span>
                <span class="kg-graph-info-value" id="${viewerId}-info-nodes">-</span>
              </div>
              <div class="kg-graph-info-row">
                <span class="kg-graph-info-label">Edges</span>
                <span class="kg-graph-info-value" id="${viewerId}-info-edges">-</span>
              </div>
            </div>
          </div>
        </div>

        <!-- SPARQL panel -->
        <aside class="sparql-panel" id="${viewerId}-sparql-panel">
          <div class="sparql-panel-header">
            <h3 class="sparql-panel-title">SPARQL Query</h3>
          </div>
          <div class="sparql-editor">
            <textarea id="${viewerId}-sparql-input" placeholder="Enter your SPARQL query here..."></textarea>
            <div class="sparql-editor-actions">
              <button id="${viewerId}-sparql-run" class="sparql-btn sparql-btn-primary" type="button">Run Query</button>
              <button id="${viewerId}-sparql-clear" class="sparql-btn sparql-btn-secondary" type="button">Clear</button>
            </div>
          </div>
          <div class="sparql-output-container">
            <div class="sparql-output" id="${viewerId}-sparql-output">
              <span class="sparql-output-empty">Results will appear here...</span>
            </div>
          </div>
        </aside>
      </div>`;
  }

  function formatQuery(query) {
    return query
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      .trim();
  }

  /**
   * Append preset SPARQL query templates into the Templates panel.
   * @param {string} viewerId
 */
  function attachQueryTemplates(viewerId) {
    const templates = [
      {
        title: "List Actions of a Domain",
        description: "Retrieves all actions associated with a specific planning domain.",
        query: formatQuery(`
            PREFIX plan-ontology: <https://purl.org/ai4s/ontology/planning#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

            SELECT DISTINCT ?domain ?action
            WHERE {
                ?domain a plan-ontology:domain;
                        rdfs:label "your-domain".
                ?domain plan-ontology:hasMove ?action.
            }`),
        defaultOpen: true
      },
      {
        title: "Actions and Preconditions",
        description: "Displays actions and their respective preconditions defined in the ontology.",
        query: formatQuery(`
            PREFIX planning: <https://purl.org/ai4s/ontology/planning#>
            SELECT ?action ?precondition
            WHERE {
              ?action a planning:action .
              ?action planning:hasPrecondition ?precondition .
            }
            LIMIT 20`),
        defaultOpen: true
      },
      {
        title: "Domain Requirements",
        description: "Shows the requirements associated with a specific planning domain.",
        query: formatQuery(`
            PREFIX plan-ontology: <https://purl.org/ai4s/ontology/planning#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

            SELECT DISTINCT ?domain ?requirement
            WHERE {
                ?domain a plan-ontology:domain;
                        rdfs:label "your-domain".
                ?domain plan-ontology:hasRequirement ?requirement.
            }`),
        defaultOpen: false
      },
      {
        title: "Action Effects",
        description: "Lists all actions with their effects in the planning domain.",
        query: formatQuery(`
            PREFIX planning: <https://purl.org/ai4s/ontology/planning#>
            SELECT ?action ?effect
            WHERE {
              ?action a planning:action .
              ?action planning:hasEffect ?effect .
            }
            LIMIT 20`),
        defaultOpen: false
      },
      {
        title: "Action Parameters",
        description: "Shows parameters for each action in the domain.",
        query: formatQuery(`
            PREFIX planning: <https://purl.org/ai4s/ontology/planning#>
            SELECT ?action ?parameter
            WHERE {
              ?action a planning:action .
              ?action planning:hasParameter ?parameter .
            }
            LIMIT 20`),
        defaultOpen: false
      },
      {
        title: "Plan Steps (if available)",
        description: "Lists plan steps in execution order for problems that include a generated plan.",
        query: formatQuery(`
            PREFIX planning: <https://purl.org/ai4s/ontology/planning#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

            SELECT ?problem ?plan ?step ?number ?label
            WHERE {
              ?problem planning:hasPlan ?plan .
              ?plan planning:hasPlanStep ?step .
              ?step planning:hasStepNumber ?number .
              ?step rdfs:label ?label .
            }
            ORDER BY ?problem ?number`),
        defaultOpen: false
      },
    ];

    const container = document.getElementById(`${viewerId}-templates-content`);

    // Add templates to HTML with collapsible structure
    templates.forEach((t, index) => {
      const templateId = `${viewerId}-template-${index}`;
      const escapedQuery = t.query
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      container.innerHTML += `
          <div class="kg-query-template ${t.defaultOpen ? 'is-open' : ''}" data-template-id="${templateId}">
            <button class="kg-template-header" aria-expanded="${t.defaultOpen}" aria-controls="${templateId}-body">
              <div class="kg-template-header-content">
                <span class="kg-template-title">${t.title}</span>
                <span class="kg-template-description">${t.description}</span>
              </div>
              <svg class="kg-template-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 6l4 4 4-4"/>
              </svg>
            </button>
            <div class="kg-template-body" id="${templateId}-body">
              <div class="kg-template-code">
                <pre class="kg-template-query">${escapedQuery}</pre>
              </div>
              <div class="kg-template-actions">
                <button class="kg-template-run-btn" data-query="${encodeURIComponent(t.query)}">Run Query</button>
              </div>
            </div>
          </div>
        `;
    });
  }

  /**
   * Attach event handlers for template collapse/expand and run buttons.
   * @param {string} viewerId
 */
  function attachTemplateHandlers(viewerId) {
    const container = document.getElementById(`${viewerId}-templates-content`);

    // Toggle collapse/expand on header click
    container.querySelectorAll('.kg-template-header').forEach(header => {
      header.addEventListener('click', () => {
        const template = header.closest('.kg-query-template');
        const isOpen = template.classList.toggle('is-open');
        header.setAttribute('aria-expanded', isOpen);
      });
    });

    // Run button - load query into SPARQL textarea
    container.querySelectorAll('.kg-template-run-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const query = decodeURIComponent(btn.dataset.query);
        const textarea = document.getElementById(`${viewerId}-sparql-input`);
        textarea.value = query;
        textarea.focus();

        // Scroll SPARQL panel into view
        const sparqlPanel = document.getElementById(`${viewerId}-sparql-panel`);
        sparqlPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /**
   * Attach event handlers for info popup (open, close, copy BibTeX).
   * @param {string} viewerId
   * @param {function} stopGlow - Optional function to stop the glow animation
 */
  function attachInfoPopupHandler(viewerId, stopGlow) {
    const infoBtn = document.getElementById(`${viewerId}-info-btn`);
    const infoLink = document.getElementById(`${viewerId}-info-link`);
    const infoPopup = document.getElementById(`${viewerId}-info-popup`);
    const closeBtn = document.getElementById(`${viewerId}-info-close`);
    const copyBtn = document.getElementById(`${viewerId}-copy-bibtex`);

    // Open popup from info button and stop glow animation
    infoBtn.addEventListener('click', () => {
      infoPopup.style.display = 'flex';
      if (stopGlow) stopGlow();
    });

    // Open popup from description link
    if (infoLink) {
      infoLink.addEventListener('click', () => {
        infoPopup.style.display = 'flex';
      });
    }

    // Close popup via X button
    closeBtn.addEventListener('click', () => {
      infoPopup.style.display = 'none';
    });

    // Close on backdrop click
    infoPopup.addEventListener('click', (e) => {
      if (e.target === infoPopup) {
        infoPopup.style.display = 'none';
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && infoPopup.style.display === 'flex') {
        infoPopup.style.display = 'none';
      }
    });

    // Copy BibTeX to clipboard
    copyBtn.addEventListener('click', () => {
      const bibtex = document.querySelector(`#${viewerId}-info-popup .kg-bibtex`).textContent;
      navigator.clipboard.writeText(bibtex).then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 2000);
      }).catch(() => {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = bibtex;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 2000);
      });
    });
  }

  /**
   * Attach toggle handler for graph info box minimize/expand.
   * @param {string} viewerId
 */
  function attachGraphInfoToggle(viewerId) {
    const infoBox = document.getElementById(`${viewerId}-graph-info`);
    const toggleBtn = document.getElementById(`${viewerId}-graph-info-toggle`);

    // Make entire box clickable for toggle
    infoBox.style.cursor = 'pointer';
    infoBox.addEventListener('click', () => {
      infoBox.classList.toggle('is-collapsed');
      // Rotate the chevron icon
      const svg = toggleBtn.querySelector('svg');
      if (infoBox.classList.contains('is-collapsed')) {
        svg.style.transform = 'rotate(180deg)';
      } else {
        svg.style.transform = 'rotate(0deg)';
      }
    });
  }

  /**
   * Update the graph info box with statistics from the graph data.
   * @param {string} viewerId
   * @param {any} store - rdflib store
   * @param {object} graphData - { nodes, links }
 */
  function updateGraphInfo(viewerId, store, graphData) {
    // Extract domain name from store
    let domainName = '-';
    store.statements.forEach(st => {
      if (st.predicate.value === RDF_TYPE_PREDICATE &&
        st.object.value.toLowerCase().includes('domain')) {
        // Found a domain node, get its label
        const domainUri = st.subject.value;
        store.statements.forEach(labelSt => {
          if (labelSt.subject.value === domainUri &&
            labelSt.predicate.value === RDF_LABEL_PREDICATE &&
            labelSt.object.termType === 'Literal') {
            domainName = labelSt.object.value;
          }
        });
      }
    });

    // Count node types
    const actionCount = graphData.nodes.filter(n => n.class === 'action').length;
    const predicateCount = graphData.nodes.filter(n => n.class === 'predicate').length;

    // Update DOM elements
    const domainEl = document.getElementById(`${viewerId}-info-domain`);
    const actionsEl = document.getElementById(`${viewerId}-info-actions`);
    const predicatesEl = document.getElementById(`${viewerId}-info-predicates`);
    const nodesEl = document.getElementById(`${viewerId}-info-nodes`);
    const edgesEl = document.getElementById(`${viewerId}-info-edges`);

    if (domainEl) domainEl.textContent = domainName;
    if (actionsEl) actionsEl.textContent = actionCount;
    if (predicatesEl) predicatesEl.textContent = predicateCount;
    if (nodesEl) nodesEl.textContent = graphData.nodes.length;
    if (edgesEl) edgesEl.textContent = graphData.links.length;
  }

  /**
   * Create node popup handler for showing node details on click.
   * @param {string} viewerId
   * @param {object} graphData - { nodes, links }
   * @param {any} store - rdflib store for additional metadata
   * @returns {function} - Click handler function for nodes
 */
  function createNodePopupHandler(viewerId, graphData, store) {
    const popup = document.getElementById(`${viewerId}-node-popup`);
    let autoCloseTimer = null;
    let countdownInterval = null;

    // Get badge color based on node class
    const getBadgeColor = (nodeClass) => {
      const classStyle = D3_STYLE.node.classes[nodeClass];
      return classStyle ? classStyle.fill : D3_STYLE.node.default.fill;
    };

    // Find connections for a node
    const getConnections = (nodeId) => {
      const incoming = graphData.links.filter(l => l.target.id === nodeId || l.target === nodeId);
      const outgoing = graphData.links.filter(l => l.source.id === nodeId || l.source === nodeId);
      return { incoming, outgoing };
    };

    // Helper to shorten URIs for display
    const shortLabel = (uri) => {
      const parts = uri.split(/#|\//);
      return parts[parts.length - 1] || uri;
    };

    const hidePopup = () => {
      popup.style.display = 'none';
      if (autoCloseTimer) clearTimeout(autoCloseTimer);
      if (countdownInterval) clearInterval(countdownInterval);
    };

    const showPopup = (d, event) => {
      // Clear existing timers
      if (autoCloseTimer) clearTimeout(autoCloseTimer);
      if (countdownInterval) clearInterval(countdownInterval);

      const { incoming, outgoing } = getConnections(d.id);
      const badgeColor = getBadgeColor(d.class);

      let commentText = "";
      let popupContent = `
        <div class="kg-node-popup-header">
          <h3 class="kg-node-popup-title" title="${d.label}">${d.label}</h3>
          <button class="kg-node-popup-close" aria-label="Close">&times;</button>
        </div>
        <div class="kg-node-popup-body">
          <div class="kg-node-popup-row">
            <span class="kg-node-popup-label">Type</span>
            <span class="kg-node-popup-value">
              <span class="kg-node-popup-badge" style="background:${badgeColor}; color:#fff;">
                ${d.class}
              </span>
            </span>
          </div>
          <div class="kg-node-popup-row">
            <span class="kg-node-popup-label">Connections</span>
            <span class="kg-node-popup-value">${incoming.length} in / ${outgoing.length} out</span>
          </div>
          <div class="kg-node-popup-row">
            <span class="kg-node-popup-label">URI</span>
            <span class="kg-node-popup-value" style="font-size:10px; opacity:0.7;">${shortLabel(d.id)}</span>
          </div>
      `;

      // Add other properties (excluding label which is in header)
      store.statements.forEach(st => {
        if (st.subject.value === d.id && st.object.termType === "Literal") {
          if (st.predicate.value === RDF_LABEL_PREDICATE) return;

          if (st.predicate.value === "http://www.w3.org/2000/01/rdf-schema#comment") {
            commentText = st.object.value;
            return;
          }

          popupContent += `
            <div class="kg-node-popup-row">
              <span class="kg-node-popup-label">${shortLabel(st.predicate.value)}</span>
              <span class="kg-node-popup-value">${st.object.value}</span>
            </div>
          `;
        }
      });

      popupContent += `</div>`; // Close body

      if (commentText) {
        popupContent += `<div class="kg-node-popup-comment">${commentText}</div>`;
      }

      popupContent += `
      <div class="kg-node-popup-timer">
        Closing in <span id="${viewerId}-popup-countdown">30</span>s
      </div>`;

      popup.innerHTML = popupContent;

      // Position popup near the click, but within canvas bounds
      const canvas = popup.parentElement;
      const canvasRect = canvas.getBoundingClientRect();
      let x = event.clientX - canvasRect.left + 15;
      let y = event.clientY - canvasRect.top + 15;

      // Keep popup within canvas bounds
      popup.style.display = 'block';
      const popupRect = popup.getBoundingClientRect();
      if (x + popupRect.width > canvasRect.width - 20) {
        x = canvasRect.width - popupRect.width - 20;
      }
      if (y + popupRect.height > canvasRect.height - 20) {
        y = canvasRect.height - popupRect.height - 20;
      }

      popup.style.left = x + 'px';
      popup.style.top = y + 'px';

      // Attach close button handler
      popup.querySelector('.kg-node-popup-close').addEventListener('click', hidePopup);

      // Auto-close countdown
      let countdown = 30;
      const countdownEl = document.getElementById(`${viewerId}-popup-countdown`);

      countdownInterval = setInterval(() => {
        countdown--;
        if (countdownEl) countdownEl.textContent = countdown;
      }, 1000);

      autoCloseTimer = setTimeout(hidePopup, 30000);
    };

    return { showPopup, hidePopup };
  }

  /**
   * Start info button glow animation every 30 seconds.
   * Returns a stop function to cancel the glow animation.
   * @param {string} viewerId
   * @returns {function} - Call this to stop the glow animation
 */
  function startInfoButtonGlow(viewerId) {
    const infoBtn = document.getElementById(`${viewerId}-info-btn`);
    if (!infoBtn) return () => { };

    let initialTimeout = null;
    let glowInterval = null;

    const triggerGlow = () => {
      infoBtn.classList.add('glow');
      // Remove class after animation completes (1s)
      setTimeout(() => {
        infoBtn.classList.remove('glow');
      }, 1000);
    };

    // Initial glow after 3 seconds
    initialTimeout = setTimeout(() => {
      triggerGlow();
      // Then every 30 seconds
      glowInterval = setInterval(triggerGlow, 30000);
    }, 3000);

    // Return stop function
    return () => {
      if (initialTimeout) clearTimeout(initialTimeout);
      if (glowInterval) clearInterval(glowInterval);
      infoBtn.classList.remove('glow');
    };
  }

  /**
   * Escape an editor id for CSS selectors (handles spaces/parens in "Plan (1)" tabs).
   * @param {string} id
   * @returns {string}
 */
  function escapeSelector(id) {
    if (window.CSS && CSS.escape) return CSS.escape(id);
    // Escape characters that are unsafe in CSS selectors
    return id.replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
  }

  /**
   * Resolve the visible tab label for an editor id, falling back to the id itself.
   * @param {string} editorId
   * @returns {string}
  */
  function getTabLabel(editorId) {
    const labelEl = document.querySelector(`#tab-${escapeSelector(editorId)}`);
    if (!labelEl) return editorId;
    const txt = (labelEl.textContent || "").replace(/\s*×$/, "").trim();
    return txt || editorId;
  }

  /**
   * Collect open editor ids/labels. Uses window.pddl_files when available
   * and falls back to scanning tab anchors (captures planner-created "Plan (n)" tabs).
   * @returns {Array<{id:string,label:string}>}
  */
  function collectOpenEditors() {
    const editors = [];
    const seen = new Set();
    const closed = Array.isArray(window.closed_editors) ? window.closed_editors : [];

    if (Array.isArray(window.pddl_files)) {
      window.pddl_files.forEach(id => {
        if (closed.includes(id) || seen.has(id)) return;
        editors.push({ id, label: getTabLabel(id) });
        seen.add(id);
      });
    }

    // Planner-created plan tabs might not be in window.pddl_files; scan DOM anchors.
    // Support both standard Bootstrap tabs and .pddl-tab class used by solvers
    const candidates = document.querySelectorAll('a[data-toggle="tab"], a.pddl-tab');
    candidates.forEach(el => {
      let id = "";
      const href = el.getAttribute('href') || '';

      // Strategy 1: standard href="#id"
      if (href.startsWith('#') && href.length > 1) {
        id = href.slice(1);
      }

      // Strategy 2: derive from element ID (e.g. id="tab-editor4" -> "editor4")
      if (!id && el.id && el.id.startsWith('tab-')) {
        id = el.id.substring(4); // remove "tab-"
      }

      // Strategy 3: try onclick parsing as last resort (e.g. changeDocument('editor4'))
      if (!id) {
        const onClick = el.getAttribute('onclick');
        if (onClick) {
          const match = onClick.match(/changeDocument\(['"]([^'"]+)['"]\)/);
          if (match) id = match[1];
        }
      }

      if (!id || closed.includes(id) || seen.has(id)) return;

      // Use innerText/textContent and clean up 'x' close button text
      const label = ((el.innerText || el.textContent || "").replace(/\s*×$/, "").trim()) || id;
      editors.push({ id, label });
      seen.add(id);
    });

    return editors;
  }

  /**
   * Helper to get text content from a tab, whether it's an Ace editor or a plain DOM element.
   * @param {string} id - DOM ID of the tab content
   * @returns {string} - The text content
   */
  function getFileContent(id) {
    if (!id) return "";
    let text = "";
    try {
      const editor = ace.edit(id);
      if (editor && editor.getSession) {
        text = editor.getSession().getValue();
      }
    } catch (e) {
      // Not an Ace editor, fall through
    }

    if (!text) {
      const el = document.getElementById(id);
      if (el) {
        text = el.innerText || el.textContent;
      }
    }
    return text || "";
  }

  /**
   * Populate domain/problem/plan dropdowns by scanning open PDDL editors.
   * Uses regex to detect "(domain", "(problem", or plan files (actions starting with "(").
  */
  function fileChooser() {
    var domainOpts = "", problemOpts = "", planOpts = "";

    const editors = collectOpenEditors();

    editors.forEach(function (editorInfo) {
      const fileName = editorInfo.id;
      const label = editorInfo.label || fileName;

      // Skip Knowledge Graph tabs the plugin creates itself
      if (/^Knowledge Graph/i.test(label)) return;

      // Get the text from the file (if ace editor exists)
      // Get the text from the file (try Ace first, then DOM)
      const editorText = getFileContent(fileName);

      if (!editorText) {
        console.warn("Skipping empty or inaccessible tab", fileName);
        return;
      }

      var opt = `<option value="${fileName}">${label}</option>\n`;

      // Check if the file is a domain, problem, or plan
      // Plan detection: check tab name (Planning-as-a-Service uses "Plan (1)", etc.) OR content
      if (/\(domain/i.test(editorText))
        domainOpts += opt;
      else if (/\(problem/i.test(editorText))
        problemOpts += opt;
      else if (/^Plan\s*\(/i.test(label) || isPlanFile(editorText))
        planOpts += opt;
    });

    $('#domainSelect').html(domainOpts);
    $('#problemSelect').html(problemOpts);
    $('#planSelect').html('<option value="">-- No plan --</option>\n' + planOpts);
    $('#chooseFiles').modal('toggle');
  }

  /**
   * Check if a file content looks like a plan file.
   * Detects Planning-as-a-Service output or other plan formats.
   * @param {string} txt - File content
   * @returns {boolean} - True if it looks like a plan file
  */
  function isPlanFile(txt) {
    // Check for Planning-as-a-Service header
    if (/Found Plan/i.test(txt)) return true;

    // Filter non-empty, non-comment lines
    var lines = txt.split('\n').filter(line => {
      var trimmed = line.trim();
      return trimmed && !trimmed.startsWith(';');
    });

    if (lines.length === 0) return false;

    // Count simple action calls (not PDDL definitions)
    // Plan actions: (action-name param1 param2) - no colons after (
    // PDDL actions: (:action name ...) - has colon after (
    var actionLineCount = 0;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      // Match simple action calls: start with ( but NOT followed by :
      if (/^\([a-zA-Z][\w\-]*(\s|$|\))/.test(line) && !line.startsWith('(:')) {
        actionLineCount++;
      }
    }

    // If at least 30% of non-empty lines look like simple action calls, it's likely a plan
    return actionLineCount > 0 && (actionLineCount / lines.length) >= 0.3;
  }

  /**
   * Handler after user selects domain/problem/plan files.
   * Reads buffers from ACE, calls the Python converter, opens a KG tab with the result.
  */
  async function onFilesChosen() {
    $('#chooseFiles').modal('hide');

    // Get the text from the selected files
    // Get the text from the selected files
    var domainText = getFileContent($('#domainSelect').val());
    var problemText = getFileContent($('#problemSelect').val());

    // Get plan text if a plan file is selected (optional)
    var planText = "";
    var planSelectVal = $('#planSelect').val();
    if (planSelectVal) {
      planText = getFileContent(planSelectVal);
    }

    const ontologyJson = await createOntologyWithPython(domainText, problemText, planText);
    createKnowledgeGraphTab(ontologyJson);
  }

  /**
   * Load a script URL ensuring it attaches globals (temporarily disabling AMD).
   * This is useful for libraries that expect `window.<lib>` instead of AMD modules.
   * @param {string} url
   * @returns {Promise<void>}
  */
  function loadScriptGlobal(url) {
    return new Promise(function (resolve, reject) {
      // disable AMD temporarily to avoid dependencies issues
      // Forcing the disable they go to global scope
      var windowDefine = window.define;
      var amd = windowDefine && windowDefine.amd;
      if (windowDefine) windowDefine.amd = false;

      var scriptElement = document.createElement("script");
      scriptElement.src = url;
      scriptElement.async = true;

      scriptElement.onload = function () {
        console.log("✓ Script loaded:", url);
        if (windowDefine) windowDefine.amd = amd; // Restore AMD
        resolve();
      };

      scriptElement.onerror = function (e) {
        console.error("✗ Error to load the script", url, e);
        if (windowDefine) windowDefine.amd = amd; // Restore AMD even on error

        reject(new Error("Error to load the script: " + url));
      };

      document.head.appendChild(scriptElement);
    });
  }

  /**
   * Initialize the Pyodide runtime once and memoize it on window.pyodideReady.
   * @returns {Promise<any>} - The pyodide instance.
  */
  async function loadPyodideRuntime() {
    // Creates a shared Promise that other functions can await to ensure Pyodide is loaded
    window.pyodideReady = new Promise((resolve, reject) => {
      loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/"
      })
        .then((pyodide) => {
          console.log("Pyodide loaded");
          window.pyodide = pyodide;
          resolve(pyodide);
        })
        .catch(reject);
    });

    return window.pyodideReady;
  }

  /**
   * Load all third-party libs.
   * Uses simple index checks to assert globals are present.
   * Memoized as `window.kgLibsLoading` to prevent duplicate work.
  */
  async function loadKgLibs() {
    window.toastr.info("Loading dependencies...");
    if (window.kgLibsLoading) return window.kgLibsLoading;

    window.kgLibsLoading = (async () => {
      try {
        for (let i = 0; i < PLUGIN_LIBS.length; i++) {
          await loadScriptGlobal(PLUGIN_LIBS[i]);

          // After loading the “browser libs” batch, assert their globals
          if (i === 4) {
            if (!window.d3) throw new Error("window.d3 not exposed");
            if (!window.$rdf) throw new Error("window.$rdf not exposed");
            if (!window.N3) throw new Error("window.N3 not exposed");
            if (!window.Comunica) throw new Error("window.Comunica not exposed");
          }

          // After Pyodide loader, bring the runtime up and pip-install Python dependencies
          if (i === 5) {
            if (!window.loadPyodide) throw new Error("window.loadPyodide not exposed");
            await loadPyodideRuntime();
            console.log("✓ Pyodide runtime loaded");

            // Install Python packages in the Pyodide environment
            await window.pyodide.loadPackage('micropip');
            await window.pyodide.runPythonAsync(`
  import micropip
  await micropip.install(['pyodide-http', 'rdflib'])
  
  # Enables HTTPS requests inside Pyodide
  import pyodide_http

  # Without this rdflib would fail to load ontologies from HTTPS URLs.
  pyodide_http.patch_all()

  import rdflib
  import builtins

  # Dont repeat this setup unnecessarily in future calls
  builtins._net_patched = True
            `);
          }
        }
        window.toastr.info("Dependencies loaded");
      } catch (err) {
        console.error("Error loading libs:", err);
        window.toastr.error("Error loading libs");
        window.kgLibsLoading = null;
        throw err;
      }
    })();

    return window.kgLibsLoading;
  }

  /**
   * Create a new KG tab, parse/store ontology, render graph,
   * wire SPARQL panel, and attach download link.
   * @param {string} ontologyString - RDF/XML string.
  */
  async function createKnowledgeGraphTab(ontologyString) {
    try {
      // EditorDomains helper creates a new editor and sets window.current_editor 
      createEditor();
      var editorId = window.current_editor;

      // Rename the tab
      $('#tab-' + editorId).text(`Knowledge Graph(${knowledgeGraphTabsCount})`);

      // Get the container for the editor (which is shown/hidden)
      var $container = $('#' + editorId);

      $container.empty();

      // Build the plugin layout into this container.
      const viewerId = editorId + '-kg-viewer';
      $container.html(getPluginLayout(viewerId));

      attachQueryTemplates(viewerId);
      attachTemplateHandlers(viewerId);

      // Start info button glow animation and get stop function
      const stopGlow = startInfoButtonGlow(viewerId);
      attachInfoPopupHandler(viewerId, stopGlow);

      attachGraphInfoToggle(viewerId);
      knowledgeGraphTabsCount += 1;

      const container = document.getElementById(viewerId);
      if (!container)
        throw new Error(`Container not found: ${viewerId}`);

      const store = parseStore(ontologyString);
      const graphData = buildGraphData(store);

      // Create node popup handler and pass to D3 graph
      const nodePopupHandler = createNodePopupHandler(viewerId, graphData, store);
      renderD3Graph(container, graphData, nodePopupHandler);

      attachSparqlQueryHandler(store, container.id);
      updateGraphInfo(viewerId, store, graphData);

      console.log("✓ Knowledge Graph rendered");
    } catch (err) {
      console.error("❌ Erro in createKnowledgeGraphTab:", err.message);
      alert(`❌ Erro rendering the graph:\n${err.message}`);
    }
  }

  /**
   * Connect SPARQL panel buttons to the Comunica query engine.
   * @param {any} store - rdflib.js store.
   * @param {string} containerId - Viewer root id.
  */
  function attachSparqlQueryHandler(store, containerId) {
    const inputEl = document.getElementById(`${containerId}-sparql-input`);
    const outputEl = document.getElementById(`${containerId}-sparql-output`);
    const runQueryButton = document.getElementById(`${containerId}-sparql-run`);
    const clearResultsButton = document.getElementById(`${containerId}-sparql-clear`);

    runQueryButton.addEventListener('click', () => executeSparqlQuery(store, inputEl, outputEl));
    clearResultsButton.addEventListener('click', () => { outputEl.textContent = ""; });
  }

  /**
   * Execute a SPARQL query using Comunica over an N3 store built from rdflib statements.
   * @param {any} rdflibStore
   * @param {string} queryString
   * @param {AbortSignal} abortSignal - Supports timeouts/cancellation.
   * @returns {Promise<object[]>} - Rows as JSON bindings from Comunica.
  */
  async function runComunicaQueryEngine(rdflibStore, queryString, abortSignal) {
    // Convert rdflib statements to N3 quads
    const n3store = new window.N3.Store();

    rdflibStore.statements.forEach(st => {
      n3store.addQuad(st.subject, st.predicate, st.object);
    })

    const engine = new window.Comunica.QueryEngine();
    const result = await engine.query(queryString, { sources: [n3store], signal: abortSignal });

    const resultStream = await engine.resultToString(result);
    return await streamToJson(resultStream.data);
  }

  /**
   * Collect a Node stream into a string and parse as JSON.
   * @param {ReadableStream} stream
   * @returns {Promise<any>}
  */
  async function streamToJson(stream) {
    return new Promise((resolve, reject) => {
      let result = '';
      stream.on('data', (chunk) => {
        result += new TextDecoder().decode(chunk);
      });

      stream.on('end', () => resolve(JSON.parse(result)));
      stream.on('error', reject);
    });
  }

  /**
   * Validate, run, and display a SPARQL query.
   * @param {any} store - rdflib store.
   * @param {HTMLTextAreaElement} inputEl
   * @param {HTMLElement} outputEl - <pre> where results will be shown.
  */
  function executeSparqlQuery(store, inputEl, outputEl) {
    const queryString = inputEl.value.trim();
    outputEl.textContent = "";

    if (!queryString) {
      outputEl.textContent = "Please enter a SPARQL query.";
      return;
    }

    // Abort if the query exceeds 20s
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 20000); // 20s

    outputEl.textContent = "Running query…";

    runComunicaQueryEngine(store, queryString, abortController.signal)
      .then(rows => {
        clearTimeout(timeout);
        if (!rows || rows.length === 0) {
          outputEl.textContent = "No results";
          return;
        }

        // Get the value after "#"
        const formatValue = value => {
          return value.includes("#") ? value.split("#").pop() : value;
        };

        const cols = Array.from(new Set(rows.flatMap(row => Object.keys(row))));

        let html = "<table class='kg-grid'><thead><tr>";
        html += cols.map(key => `<th>${key.charAt(0).toUpperCase() + key.slice(1)}</th>`).join("");
        html += "</tr></thead><tbody>";

        rows.forEach(row => {
          html += "<tr>";
          html += cols.map(key => `<td>${formatValue(row[key])}</td>`).join("");
          html += "</tr>";
        });

        html += "</tbody></table>";
        outputEl.innerHTML = html;
      })
      .catch(err => {
        clearTimeout(timeout);
        outputEl.textContent = "Error executing the query: " + (err && err.message ? err.message : String(err));
      });
  }

  /**
   * Parse an RDF/XML string into an rdflib.js store, this functions helps to avoid error rendering the knowledge graph.
   * @param {string} ontologyString - RDF/XML content.
   * @returns {any} rdflib store
  */
  function parseStore(ontologyString) {
    const store = window.$rdf.graph();
    window.$rdf.parse(ontologyString, store, "https://purl.org/ai4s/ontology/planning#", "application/rdf+xml");
    return store;
  }

  /**
   * Convert triples into a simple {nodes, links} graph model for D3 rendering.
   * - Collect rdfs:label values for pretty node labels.
   * - Track rdf:type to infer classes (domain, problem, action, etc.).
   * - Ignore literals and a small set of noisy predicates.
   * @param {any} store - rdflib store.
   * @returns {{nodes: Array, links: Array}}
  */
  function buildGraphData(store) {
    const classMap = new Map(); // subject URI -> rdf:type short label
    const labelsMap = new Map(); // subject URI -> rdfs:label
    let domainInstance = null;

    // Gather labels and types
    store.statements.forEach(st => {
      if (st.predicate.value === RDF_LABEL_PREDICATE && st.object.termType === "Literal") {
        labelsMap.set(st.subject.value, st.object.value);
        return;
      }
      if (st.predicate.value === RDF_TYPE_PREDICATE && st.object.termType === "NamedNode") {
        const subj = st.subject.value;
        const typeLabel = shortLabel(st.object.value).toLowerCase();
        classMap.set(subj, typeLabel);
        if (typeLabel === "domain") domainInstance = subj;
      }
    });

    const nodes = [];
    const links = [];
    const nodeMap = new Map();

    function ensureNode(uri) {
      if (nodeMap.has(uri)) return nodeMap.get(uri);
      const node = {
        id: uri,
        label: labelsMap.get(uri) || shortLabel(uri),
        class: detectClass(uri, classMap, domainInstance)
      };
      nodes.push(node);
      nodeMap.set(uri, node);
      return node;
    }

    // Create edges for URI → URI statements (skip literals & ignored preds).
    store.statements.forEach(st => {
      if (RDF_IGNORE_PREDICATES.includes(st.predicate.value)) return;
      if (st.object.termType === "Literal") return;
      if (st.subject.termType !== "NamedNode" || st.predicate.termType !== "NamedNode" || st.object.termType !== "NamedNode") return;

      const subj = st.subject.value;
      const pred = st.predicate.value;
      const obj = st.object.value;

      ensureNode(subj);
      ensureNode(obj);

      links.push({
        id: `${subj}-${pred}-${obj}`,
        source: subj,
        target: obj,
        label: shortLabel(pred)
      });
    });

    return { nodes, links };
  }

  /**
   * Return a compact label for a URI (everything after last # or /).
   * @param {string} uri
   * @returns {string}
  */
  function shortLabel(uri) {
    return uri ? uri.split(/[#\/]/).pop() : "";
  }

  /**
   * Decide a node's visual class from rdf:type, with a special case for the domain instance.
   * @param {string} uri
   * @param {Map<string,string>} classMap - subject URI -> type label (lowercased).
   * @param {string} domainInstance
   * @returns {"domain"|"problem"|"action"|"parameter"|"effect"|"precondition"|"planner"|"other"}
  */
  function detectClass(uri, classMap, domainInstance) {
    if (!uri)
      return "other";

    if (uri === domainInstance)
      return "domain";

    const type = classMap.get(uri);
    const knownTypes = ["problem", "action", "parameter", "effect", "precondition", "planner", "plan", "plan_step"];
    return (type && knownTypes.includes(type)) ? type : "other";
  }

  function renderD3Graph(container, graphData, nodePopupHandler) {
    const svg = window.d3.select(`#${container.id}-svg`);
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Clear previous content
    svg.selectAll("*").remove();

    // Create arrow marker for edges
    svg.append("defs").append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 35)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", D3_STYLE.edge.markerSize)
      .attr("markerHeight", D3_STYLE.edge.markerSize)
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", D3_STYLE.edge.stroke);

    // Create zoom behavior
    const zoom = window.d3.zoom()
      .scaleExtent([0.2, 4])
      .on("zoom", function (event) {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Close popup when clicking on canvas background
    svg.on("click", function () {
      if (nodePopupHandler) {
        nodePopupHandler.hidePopup();
      }
    });

    // Main group for zooming/panning
    const g = svg.append("g");

    // Create force simulation
    const simulation = window.d3.forceSimulation(graphData.nodes)
      .force("charge", window.d3.forceManyBody().strength(-300))
      .force("link", window.d3.forceLink(graphData.links).id(d => d.id)
        .distance(200)).force("center", window.d3.forceCenter(width / 2, height / 2))
      .force("collision", window.d3.forceCollide().radius(30));

    // Create links
    const link = g.append("g")
      .selectAll("line")
      .data(graphData.links)
      .enter().append("line")
      .attr("stroke", D3_STYLE.edge.stroke)
      .attr("stroke-width", D3_STYLE.edge.strokeWidth)
      .attr("marker-end", "url(#arrowhead)");

    // Create link labels
    const linkLabel = g.append("g")
      .selectAll("text")
      .data(graphData.links)
      .enter().append("text")
      .attr("font-size", "8px")
      .attr("font-family", D3_STYLE.text.fontFamily)
      .attr("fill", D3_STYLE.text.fill)
      .attr("text-anchor", "middle")
      .attr("dy", -5)
      .style("pointer-events", "none")
      .text(d => d.label);

    // Create node groups
    const node = g.append("g")
      .selectAll("g")
      .data(graphData.nodes)
      .enter().append("g")
      .style("cursor", "pointer")
      .call(window.d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended))
      .on("click", function (event, d) {
        event.stopPropagation();
        if (nodePopupHandler) {
          nodePopupHandler.showPopup(d, event);
        }
      });

    // Add circles to nodes with hover effect
    node.append("circle")
      .attr("r", D3_STYLE.node.default.radius)
      .attr("fill", d => {
        const classStyle = D3_STYLE.node.classes[d.class];
        return classStyle ? classStyle.fill : D3_STYLE.node.default.fill;
      })
      .attr("stroke", D3_STYLE.node.default.stroke)
      .attr("stroke-width", D3_STYLE.node.default.strokeWidth)
      .on("mouseenter", function () {
        window.d3.select(this)
          .transition().duration(150)
          .attr("r", D3_STYLE.node.default.radius * 1.2)
          .attr("stroke-width", 3);
      })
      .on("mouseleave", function () {
        window.d3.select(this)
          .transition().duration(150)
          .attr("r", D3_STYLE.node.default.radius)
          .attr("stroke-width", D3_STYLE.node.default.strokeWidth);
      });

    // Add labels to nodes
    node.append("text")
      .attr("dx", 0)
      .attr("dy", 35)
      .attr("font-size", D3_STYLE.text.fontSize)
      .attr("font-family", D3_STYLE.text.fontFamily)
      .attr("fill", D3_STYLE.text.fill)
      .attr("text-anchor", "middle")
      .style("pointer-events", "none")
      .text(d => d.label);

    // Add tooltips
    node.append("title")
      .text(d => `${d.label} (${d.class})`);

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      linkLabel
        .attr("x", d => (d.source.x + d.target.x) / 2)
        .attr("y", d => (d.source.y + d.target.y) / 2);

      node
        .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  }

  window.fileChooser = fileChooser;
  window.onFilesChosen = onFilesChosen;
  window.createKnowledgeGraphTab = createKnowledgeGraphTab;
  let knowledgeGraphTabsCount = 1;

  return {
    name: "Planning Ontology (PO)",
    author: "Bharath Muppasani, Bernardo Denkvitts, Biplav Srivastava",
    email: "bharath@email.sc.edu",
    description: "Generate knowledge graphs using Planning Ontology (PO) and run SPARQL queries",

    initialize: function () {
      $('body').append(PLUGIN_MODAL);
      $('#filesChosenBtn').on('click', onFilesChosen);

      window.register_file_chooser('Plugin', {
        showChoice: fileChooser,
        selectChoice: onFilesChosen
      });

      loadKgLibs().catch(err => console.error('Preload failed (will retry later):', err));

      window.add_menu_button(
        'Knowledge Graph', 'PluginBtn', 'glyphicon-leaf',
        "window.fileChooser()"
      );

    },

    disable: function () {
      window.remove_menu_button('PluginBtn');
      window.remove_menu_button('KGBtn');
    },
    save: function () { return {}; },

    load: function (settings) { }
  };

});
