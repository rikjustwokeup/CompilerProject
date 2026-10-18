import axios from "axios";
import "./App.css";
import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import stubs from "./defaultStubs";
import moment from "moment";
import Editor from "@monaco-editor/react";
import Split from "react-split";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

/* ───────────────────────── file types ─────────────────────────
   run    = language name the backend understands (null = can't be run)
   monaco = language id used for syntax highlighting
   The keys are also the ONLY extensions accepted by "Upload from computer"
   (same list the backend allows for Google Drive uploads).            */
const FILE_TYPES = {
  cpp: { run: "cpp", monaco: "cpp" },
  c: { run: "c", monaco: "cpp" },
  py: { run: "python", monaco: "python" },
  java: { run: "java", monaco: "java" },
  js: { run: null, monaco: "javascript" },
  ts: { run: null, monaco: "typescript" },
  json: { run: null, monaco: "json" },
  html: { run: null, monaco: "html" },
  css: { run: null, monaco: "css" },
  txt: { run: null, monaco: "plaintext" },
};
const CODE_EXTENSIONS = Object.keys(FILE_TYPES).map((ext) => `.${ext}`);
const ACCEPT = CODE_EXTENSIONS.join(",");
const RUNNABLE_HINT = ".cpp, .c, .py and .java";
const MAX_UPLOAD_BYTES = 100 * 1024; // the backend rejects code over 100,000 characters

// what the "+" button offers; each new file starts from the preset boilerplate
const NEW_FILE_OPTIONS = [
  { label: "C++", ext: "cpp", base: "main", language: "cpp", stub: stubs.cpp },
  { label: "C", ext: "c", base: "main", language: "c", stub: stubs.c },
  { label: "Python", ext: "py", base: "main", language: "python", stub: stubs.python },
  { label: "Java", ext: "java", base: "Main", language: "java", stub: stubs.java },
];

const STATUS_LABEL = { pending: "Running", success: "Finished", error: "Failed" };

const FACTS = [
  "The first computer \"bug\" was a real moth, found in the Harvard Mark II in 1947.",
  "Python is named after Monty Python, not the snake.",
  "Java was first called Oak.",
  "C++ started life as \"C with Classes\".",
  "Dennis Ritchie created C at Bell Labs in the early 1970s.",
  "Grace Hopper's A-0 system, from the early 1950s, is often called the first compiler.",
];

const INFO = {
  about: {
    title: "About us",
    body: [
      "Kompylit lets you write code in C++, C, Python or Java, run it in an isolated sandbox and read the output right next to your code.",
      "Keep several files open as tabs, upload code files from your computer, or send a file to Google Drive.",
    ],
  },
  contact: {
    title: "Contact us",
    // TODO: put your real contact details here
    body: ["Add your contact details here."],
  },
  privacy: {
    title: "Privacy notice",
    body: [
      "When you press Run, the code in the active file is sent to our server, runs in an isolated container with no network access, and is stored together with its output.",
      "Your open files and the session file list are saved only in this browser. Clearing the site's data removes them.",
      "Files you choose with \"Upload from computer\" are read inside your browser and are not sent anywhere until you press Run.",
      "Files you choose with \"Upload to Google Drive\" are sent to our server and stored in Google Drive.",
    ],
  },
};

/* helpers */
const uid = () => Math.random().toString(36).slice(2, 10);

const splitName = (name) => {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? { base: name, ext: "" } : { base: name.slice(0, dot), ext: name.slice(dot + 1).toLowerCase() };
};
const typeOf = (name) => FILE_TYPES[splitName(name).ext] || { run: null, monaco: "plaintext" };

// main.cpp -> main2.cpp -> main3.cpp ... (case-insensitive, like Windows)
const uniqueName = (base, ext, files) => {
  const taken = new Set(files.map((f) => f.name.toLowerCase()));
  let name = `${base}.${ext}`;
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base}${n}.${ext}`;
  return name;
};

// returns an error message, or "" when the name is fine
const validateName = (name, files, selfId) => {
  if (!name) return "A file name can't be empty.";
  if (name.length > 60) return "That name is too long (60 characters max).";
  const hasControlChar = Array.from(name).some((ch) => ch.charCodeAt(0) < 32);
  if (hasControlChar || /[\\/:*?"<>|]/.test(name)) return "File names can't contain \\ / : * ? \" < > |";
  if (!FILE_TYPES[splitName(name).ext]) return `Use one of these extensions: ${CODE_EXTENSIONS.join(" ")}`;
  if (files.some((f) => f.id !== selfId && f.name.toLowerCase() === name.toLowerCase())) {
    return `A file named ${name} already exists.`;
  }
  return "";
};

const readText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

/* ───────────────────────── saved session ───────────────────────── */
const SESSION_KEY = "compiler-session-v1";

const firstSession = () => {
  let language = "cpp";
  try {
    language = localStorage.getItem("default-language") || "cpp"; // kept from the old "Set default" button
  } catch (e) {
    /* storage unavailable */
  }
  const option = NEW_FILE_OPTIONS.find((o) => o.language === language) || NEW_FILE_OPTIONS[0];
  const file = { id: uid(), name: `${option.base}.${option.ext}`, content: option.stub };
  return { files: [file], openIds: [file.id], activeId: file.id };
};

const loadSession = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (saved && Array.isArray(saved.files)) {
      const files = saved.files.filter(
        (f) => f && typeof f.id === "string" && typeof f.name === "string" && typeof f.content === "string"
      );
      const ids = new Set(files.map((f) => f.id));
      const openIds = (Array.isArray(saved.openIds) ? saved.openIds : []).filter((id) => ids.has(id));
      const activeId = openIds.includes(saved.activeId) ? saved.activeId : openIds[0] ?? null;
      return { files, openIds, activeId };
    }
  } catch (e) {
    /* nothing saved, or the saved data is damaged */
  }
  return firstSession();
};

/* ───────────────────────── small pieces ───────────────────────── */
const ICONS = {
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6L6 18",
  play: "M8 5v14l11-7z",
  pencil: "M4 20h4L19 9l-4-4L4 16z",
  trash: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13",
  upload: "M12 16V4M7 9l5-5 5 5M5 20h14",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
};

function Icon({ name, filled = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

// swap this for an <img src={...} /> when you have a real logo
function LogoMark() {
  return (
    <svg className="logo-mark" viewBox="0 0 32 32" width="34" height="34" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="7" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M13 11l-5 5 5 5M19 11l5 5-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function useNarrow(query = "(max-width: 960px)") {
  const supported = typeof window !== "undefined" && typeof window.matchMedia === "function";
  const [narrow, setNarrow] = useState(() => (supported ? window.matchMedia(query).matches : false));
  useEffect(() => {
    if (!supported) return undefined;
    const mq = window.matchMedia(query);
    const onChange = (e) => setNarrow(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query, supported]);
  return narrow;
}

// ── light / dark mode ──
// The user's own choice (saved when they press the toggle) wins; the first time, follow the system setting.
const THEME_KEY = "compiler-theme";

const initialTheme = () => {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch (e) {
    /* storage unavailable */
  }
  const prefersLight =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: light)").matches;
  return prefersLight ? "light" : "dark";
};

// Editor colours for both modes. Keep these in step with the variables at the top of App.css.
const defineThemes = (monaco) => {
  monaco.editor.defineTheme("compiler-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#15071d",
      "editorGutter.background": "#15071d",
      "editor.lineHighlightBackground": "#291335",
      "editorLineNumber.foreground": "#9571a8",
      "editorLineNumber.activeForeground": "#ecd4ff",
      "editor.selectionBackground": "#552768",
      "editorCursor.foreground": "#ffc23d",
    },
  });
  monaco.editor.defineTheme("compiler-light", {
    base: "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#ffffff",
      "editorGutter.background": "#ffffff",
      "editor.lineHighlightBackground": "#f9f2fd",
      "editorLineNumber.foreground": "#b79bc4",
      "editorLineNumber.activeForeground": "#68487a",
      "editor.selectionBackground": "#e8cbf6",
      "editorCursor.foreground": "#7e22ce",
    },
  });
};

/* ───────────────────────── the app ───────────────────────── */
function App() {
  // ── files, tabs and history (all saved in this browser)
  const [session] = useState(loadSession);
  const [files, setFiles] = useState(session.files);
  const [openIds, setOpenIds] = useState(session.openIds);
  const [activeId, setActiveId] = useState(session.activeId);
  const filesRef = useRef(files);
  filesRef.current = files;

  // ── running code
  const [output, setOutput] = useState("");
  const [outputFile, setOutputFile] = useState("");
  const [status, setStatus] = useState("");
  const [jobId, setJobId] = useState("");
  const [jobDetails, setJobDetails] = useState(null);
  const pollRef = useRef(null);
  const runRef = useRef(() => {});

  // ── Google Drive upload (unchanged behaviour)
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState("");

  // ── interface state
  const [notice, setNotice] = useState(null); // { kind: "ok" | "error", lines: [] }
  const [menuOpen, setMenuOpen] = useState(false);
  const [info, setInfo] = useState(null); // "about" | "contact" | "privacy"
  const [factIndex, setFactIndex] = useState(0);
  const [theme, setTheme] = useState(initialTheme);
  const menuRef = useRef(null);
  const narrow = useNarrow();

  const activeFile = files.find((f) => f.id === activeId) || null;
  const openFiles = openIds.map((id) => files.find((f) => f.id === id)).filter(Boolean);
  const activeType = activeFile ? typeOf(activeFile.name) : null;

  // apply the theme before the browser paints, so there is no flash of the wrong colours
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) {
      /* storage unavailable - the choice just won't be remembered */
    }
  };

  // save the session shortly after anything changes
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ files, openIds, activeId }));
      } catch (e) {
        /* storage full or blocked - the app keeps working, it just won't remember */
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [files, openIds, activeId]);

  // stop polling if the page goes away
  useEffect(() => () => clearInterval(pollRef.current), []);

  // notices fade out by themselves
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(timer);
  }, [notice]);

  // close the "+" menu on outside click / Escape
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // close the info dialog on Escape
  useEffect(() => {
    if (!info) return undefined;
    const onKey = (e) => e.key === "Escape" && setInfo(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [info]);

  /* ── file actions ── */
  const updateContent = (id, content) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, content } : f)));

  const openFile = (id) => {
    setOpenIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setActiveId(id);
  };

  const closeTab = (id) => {
    const index = openIds.indexOf(id);
    const next = openIds.filter((x) => x !== id);
    setOpenIds(next);
    if (id === activeId) setActiveId(next.length ? next[Math.min(index, next.length - 1)] : null);
  };

  const createFile = (option) => {
    const file = {
      id: uid(),
      name: uniqueName(option.base, option.ext, filesRef.current),
      content: option.stub,
    };
    setFiles((prev) => [...prev, file]);
    setOpenIds((prev) => [...prev, file.id]);
    setActiveId(file.id);
    setMenuOpen(false);
  };

  const renameFile = (id) => {
    const file = files.find((f) => f.id === id);
    if (!file) return;
    const answer = window.prompt(`Rename ${file.name} (keep a code extension such as .py or .cpp):`, file.name);
    if (answer === null) return;
    const name = answer.trim();
    const problem = validateName(name, files, id);
    if (problem) {
      setNotice({ kind: "error", lines: [problem] });
      return;
    }
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
  };

  const deleteFile = (id) => {
    const file = files.find((f) => f.id === id);
    if (!file || !window.confirm(`Delete ${file.name} from this session?`)) return;
    setFiles((prev) => prev.filter((f) => f.id !== id));
    if (openIds.includes(id)) closeTab(id);
  };

  // Upload from computer: code files only, opened in new tabs
  const handleLocalUpload = async (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = ""; // lets the same file be picked again later
    if (!picked.length) return;

    const accepted = [];
    const rejected = [];
    for (const file of picked) {
      if (!FILE_TYPES[splitName(file.name).ext]) {
        rejected.push(`${file.name} isn't a code file.`);
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        rejected.push(`${file.name} is larger than ${MAX_UPLOAD_BYTES / 1024} KB.`);
        continue;
      }
      let text;
      try {
        text = await readText(file);
      } catch (err) {
        rejected.push(`${file.name} couldn't be read.`);
        continue;
      }
      if (text.includes("\u0000")) {
        rejected.push(`${file.name} looks like a binary file, not code.`);
        continue;
      }
      accepted.push({ name: file.name, content: text });
    }

    if (accepted.length) {
      let all = filesRef.current;
      const created = [];
      for (const item of accepted) {
        const { base, ext } = splitName(item.name);
        const file = { id: uid(), name: uniqueName(base, ext, all), content: item.content };
        created.push(file);
        all = [...all, file];
      }
      setFiles((prev) => [...prev, ...created]);
      setOpenIds((prev) => [...prev, ...created.map((f) => f.id)]);
      setActiveId(created[0].id);
    }

    const lines = [];
    if (accepted.length) lines.push(`Opened ${accepted.length} file${accepted.length > 1 ? "s" : ""}.`);
    setNotice({ kind: rejected.length ? "error" : "ok", lines: [...lines, ...rejected] });
  };

  // Upload to Google Drive: same behaviour as before
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploading(true);
      setUploadError("");
      setUploadResult(null);
      const { data } = await axios.post(`${API_URL}/upload`, formData);
      setUploadResult(data);
    } catch (err) {
      setUploadError(err.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  /* ── running ── */
  const handleRun = async () => {
    if (!activeFile) return;
    const language = typeOf(activeFile.name).run;
    setOutputFile(activeFile.name);
    clearInterval(pollRef.current); // never run two pollers at once

    if (!language) {
      setJobId("");
      setJobDetails(null);
      setStatus("error");
      setOutput(`${activeFile.name} can't be run. Only ${RUNNABLE_HINT} files can.`);
      return;
    }

    try {
      setJobId("");
      setStatus("");
      setOutput("");
      setJobDetails(null);
      const { data } = await axios.post(`${API_URL}/run`, { language, code: activeFile.content });
      setJobId(data.jobId);
      setStatus("pending");

      pollRef.current = setInterval(async () => {
        try {
          const { data: res } = await axios.get(`${API_URL}/status`, { params: { id: data.jobId } });
          const { job } = res;
          setStatus(job.status);
          setJobDetails(job);
          if (job.status === "pending") return;
          setOutput(job.output ?? "");
          clearInterval(pollRef.current);
        } catch (err) {
          clearInterval(pollRef.current);
          setStatus("error");
          setOutput(err.response?.data?.error || "Lost connection to the server. Please run it again.");
        }
      }, 1000);
    } catch (err) {
      setStatus("error");
      setOutput(err.response ? err.response.data?.error || "Unknown server error" : "Can't reach the server.");
    }
  };
  runRef.current = handleRun; // Ctrl+Enter inside the editor always calls the latest version

  const handleEditorMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
    // the code font loads from the web; re-measure so the cursor lines up with the text
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => monaco.editor.remeasureFonts());
    }
  };

  const timeDetails = () => {
    if (!jobDetails) return null;
    const { submittedAt, startedAt, completedAt } = jobDetails;
    const items = [{ label: "Submitted", value: moment(submittedAt).format("HH:mm:ss") }];
    if (startedAt && completedAt) {
      items.push({ label: "Run time", value: `${moment(completedAt).diff(moment(startedAt), "seconds", true)}s` });
    }
    return items;
  };

  const runDisabled = !activeFile || !activeType.run || status === "pending";
  const runTitle = !activeFile
    ? "Open or create a file first"
    : !activeType.run
    ? `Only ${RUNNABLE_HINT} files can run`
    : "Run this file (Ctrl+Enter)";

  const outputText = output
    ? output.trimEnd()
    : status === "success"
    ? "(the program finished without printing anything)"
    : status === "pending"
    ? "Waiting for the result..."
    : "Press Run (or Ctrl+Enter) to see the output here.";

  const meta = timeDetails();
  const commentMark = activeFile && splitName(activeFile.name).ext === "py" ? "#" : "//";

  return (
    <div className="studio">
      {/* left rail */}
      <aside className="rail">
        <div className="brand">
          <LogoMark />
          <span className="brand-name">Kompylit</span>
        </div>

        <section className="fact" aria-label="Programming fact">
          <p className="fact-title">Did you know?</p>
          <p className="fact-text" aria-live="polite">
            {FACTS[factIndex]}
          </p>
          <button type="button" className="link-btn" onClick={() => setFactIndex((i) => (i + 1) % FACTS.length)}>
            Show another
          </button>
        </section>

        <nav className="rail-links" aria-label="Site information">
          <button type="button" onClick={() => setInfo("about")}>
            About us
          </button>
          <button type="button" onClick={() => setInfo("contact")}>
            Contact us
          </button>
          <button type="button" onClick={() => setInfo("privacy")}>
            Privacy notice
          </button>
        </nav>
      </aside>

      {/* ───── session files ───── */}
      <aside className="files" aria-label="Session files">
        <header className="panel-head">
          <h2>Session files</h2>
        </header>

        <ul className="file-list">
          {files.length === 0 && (
            <li className="file-empty">No files yet. Create one with + or upload one from your computer.</li>
          )}
          {files.map((f) => {
            const isOpen = openIds.includes(f.id);
            return (
              <li
                key={f.id}
                data-ext={splitName(f.name).ext}
                className={`file-row${f.id === activeId ? " is-active" : ""}${isOpen ? " is-open" : ""}`}
              >
                <button type="button" className="file-open" onClick={() => openFile(f.id)} title={f.name}>
                  <span className="file-name">{f.name}</span>
                </button>
                <button type="button" className="icon-btn" aria-label={`Rename ${f.name}`} onClick={() => renameFile(f.id)}>
                  <Icon name="pencil" />
                </button>
                <button type="button" className="icon-btn" aria-label={`Delete ${f.name}`} onClick={() => deleteFile(f.id)}>
                  <Icon name="trash" />
                </button>
              </li>
            );
          })}
        </ul>

        <div className="files-actions">
          <label className="action-btn">
            <Icon name="upload" />
            <span>Upload from computer</span>
            <input
              type="file"
              multiple
              accept={ACCEPT}
              onChange={handleLocalUpload}
              className="visually-hidden"
              data-testid="local-upload"
            />
          </label>
          <label className="action-btn">
            <Icon name="upload" />
            <span>Upload to Google Drive</span>
            <input
              type="file"
              accept={ACCEPT}
              onChange={handleFileUpload}
              className="visually-hidden"
              data-testid="drive-upload"
            />
          </label>
          <p className="hint">Please enter programming files only for a smooth experience</p>

          {notice && (
            <div className={`message message-${notice.kind}`} role="status">
              {notice.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          )}
          {uploading && <p className="message message-ok">Uploading to Google Drive...</p>}
          {uploadResult && (
            <div className="message message-ok" role="status">
              <p>
                Uploaded:{" "}
                <a href={uploadResult.link} target="_blank" rel="noreferrer">
                  {uploadResult.fileName}
                </a>
              </p>
            </div>
          )}
          {uploadError && (
            <div className="message message-error" role="alert">
              <p>{uploadError}</p>
            </div>
          )}
        </div>
      </aside>

      {/* ───── workspace ───── */}
      <main className="workspace">
        <div className="tabbar">
          <div className="tabs" role="tablist" aria-label="Open files">
            {openFiles.map((f) => (
              <div key={f.id} data-ext={splitName(f.name).ext} className={`tab${f.id === activeId ? " is-active" : ""}`}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={f.id === activeId}
                  className="tab-label"
                  onClick={() => setActiveId(f.id)}
                >
                  {f.name}
                </button>
                <button type="button" className="tab-close" aria-label={`Close ${f.name}`} onClick={() => closeTab(f.id)}>
                  <Icon name="close" />
                </button>
              </div>
            ))}
          </div>

          <div className="new-file" ref={menuRef}>
            <button
              type="button"
              className="icon-btn tab-new"
              aria-label="Create a new file"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Icon name="plus" />
            </button>
            {menuOpen && (
              <ul className="menu" role="menu">
                {NEW_FILE_OPTIONS.map((o) => (
                  <li key={o.ext} role="none">
                    <button type="button" role="menuitem" data-ext={o.ext} onClick={() => createFile(o)}>
                      <span>{o.label}</span>
                      <span className="menu-ext">.{o.ext}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            className="icon-btn theme-btn"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>

          <button type="button" className="run-btn" onClick={handleRun} disabled={runDisabled} title={runTitle}>
            <Icon name="play" filled />
            <span>{status === "pending" ? "Running..." : "Run"}</span>
          </button>
        </div>

        <Split
          key={narrow ? "stacked" : "side-by-side"}
          className={`split${narrow ? " split-stacked" : ""}`}
          direction={narrow ? "vertical" : "horizontal"}
          sizes={narrow ? [55, 45] : [58, 42]}
          minSize={narrow ? 120 : 220}
          gutterSize={12}
          cursor={narrow ? "row-resize" : "col-resize"}
        >
          {/* source code */}
          <div className="editor-pane">
            {activeFile ? (
              <>
                <Editor
                  height="100%"
                  path={`${activeFile.id}/${activeFile.name}`}
                  language={activeType.monaco}
                  value={activeFile.content}
                  onChange={(value) => updateContent(activeFile.id, value ?? "")}
                  theme={theme === "dark" ? "compiler-dark" : "compiler-light"}
                  beforeMount={defineThemes}
                  onMount={handleEditorMount}
                  options={{
                    fontSize: 15,
                    fontFamily: "'IBM Plex Mono', Consolas, 'Courier New', monospace",
                    minimap: { enabled: false },
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    padding: { top: 12 },
                    // no extra strip next to the draggable divider
                    overviewRulerLanes: 0,
                    hideCursorInOverviewRuler: true,
                    overviewRulerBorder: false,
                  }}
                />
                {activeFile.content === "" && (
                  <div className="editor-hint" aria-hidden="true">
                    {commentMark} Please type your code from here...
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">
                <p>No file is open.</p>
                <p>Create one with + or pick one from Session files.</p>
              </div>
            )}
          </div>

          {/* output */}
          <section className="output-pane" aria-label="Output">
            <header className="output-head">
              <div className="output-title">
                <h2>Output</h2>
                {outputFile && <span className="output-file">{outputFile}</span>}
              </div>
              {status && <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>}
            </header>

            {(jobId || meta) && (
              <dl className="output-meta">
                {jobId && (
                  <div>
                    <dt>Job</dt>
                    <dd>{jobId}</dd>
                  </div>
                )}
                {meta &&
                  meta.map((m) => (
                    <div key={m.label}>
                      <dt>{m.label}</dt>
                      <dd>{m.value}</dd>
                    </div>
                  ))}
              </dl>
            )}

            <div className="output-body">
              <pre className={status === "error" ? "is-error" : !output ? "is-muted" : ""}>{outputText}</pre>
            </div>
          </section>
        </Split>
      </main>

      {/* ───── About / Contact / Privacy ───── */}
      {info && (
        <div className="modal-backdrop" onClick={() => setInfo(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="info-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="info-title">{INFO[info].title}</h2>
            {INFO[info].body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <button type="button" className="action-btn modal-close" onClick={() => setInfo(null)} autoFocus>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;