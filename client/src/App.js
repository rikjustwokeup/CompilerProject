import axios from 'axios';
import './App.css';
import React, { useState, useEffect } from "react"
import stubs from './defaultStubs';
import moment from 'moment';
import Editor from '@monaco-editor/react';
import Split from "react-split"

function App() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("cpp");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("");
  const [jobId, setJobId] = useState("");
  const [jobDetails, setJobDetails] = useState(null);

  // ── Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState('');

  // ── Existing effects (unchanged) ───────────────────────────────────
  useEffect(() => {
    const savedLanguage = localStorage.getItem("default-language");
    if (savedLanguage) setLanguage(savedLanguage);
  }, []);

  useEffect(() => {
    setCode(stubs[language]);
  }, [language]);

  //Existing lang handler
  const setDefaultLanguage = () => {
    localStorage.setItem("default-language", language);
    console.log(`${language} set a default language.`);
  };

  const renderTimeDetails = () => {
    if (!jobDetails) return "";
    let result = '';
    let { submittedAt, completedAt, startedAt } = jobDetails;
    submittedAt = moment(submittedAt).toString();
    result += `Submitted At: ${submittedAt}`;
    if (!completedAt || !startedAt) return result;
    const start = moment(startedAt);
    const end = moment(completedAt);
    const executionTime = end.diff(start, 'seconds', true);
    result += ` | Execution Time: ${executionTime}s`;
    return result;
  };

  const handleSubmit = async () => {
    const payload = { language, code };
    try {
      setJobId("");
      setStatus("");
      setOutput("");
      setJobDetails(null);
      const { data } = await axios.post("http://localhost:5000/run", payload);
      console.log(data);
      setJobId(data.jobId);
      let intervalId;
      intervalId = setInterval(async () => {
        const { data: dataRes } = await axios.get(
          "http://localhost:5000/status",
          { params: { id: data.jobId } }
        );
        const { success, job, error } = dataRes;
        console.log(dataRes);
        if (success === true) {
          const { status: jobStatus, output: jobOutput } = job;
          setStatus(jobStatus);
          setJobDetails(job);
          if (jobStatus === "pending") return;
          setOutput(jobOutput);
          clearInterval(intervalId);
        } else {
          setStatus("Error: Please retry..");
          console.error(error);
          clearInterval(intervalId);
          setOutput(error);
        }
      }, 1000);
    } catch (err) {
      if (err.response) {
        const errMsg = err.response.data?.err?.stderr;
        setOutput(errMsg || "unknown server error");
      } else {
        setOutput("Error connecting to server");
      }
    }
  };

  // New: upload handler 
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      setUploadError('');
      setUploadResult(null);
      const { data } = await axios.post('http://localhost:5000/upload', formData);
      setUploadResult(data);
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = ''; // reset input so same file can be re-uploaded
    }
  };

  return (
    <div className="App">
      <div className="main-container">
        <h1>Online Code Compiler</h1>

        {/* Language selector */}
        <div>
          <label>Select the language:  </label>
          <select
            value={language}
            onChange={(e) => {
              let response = window.confirm(
                "WARNING! SWITCHING THE LANGUAGE WILL REMOVE THE CODE WRITTEN"
              );
              if (response) setLanguage(e.target.value);
            }}
          >
            <option value="cpp">C++</option>
            <option value="c">C</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
          </select>
        </div>
        <br />
        <div>
          <button onClick={setDefaultLanguage}>Set default</button>
        </div>
        <br />
      
        {/* compiler layout */}
        <Split
          className="compiler-layout"
          sizes={[50, 50]}
          minSize={350}
          gutterSize={8}
          cursor="col-resize"
        >

          {/* editor section */}
          <div className = "editor-section">
            <Editor
              height="100%"
              width="100%"
              language={language === "cpp" || language === "c" ? "cpp" : language}
              value={code}
              onChange={(value) => setCode(value || "")}
              theme="hc-black"
              options={{ fontSize: 16, minimap: { enabled: false }, automaticLayout: true }}
            />
            <br />
          </div>

          {/* Output section */}
        
          <div className="output-section">
            <div className="output-header">
              <span className="output-title">Output</span>
              {status && (
                <span className={`output-badge ${
                  status === "success"
                    ? "badge-success"
                    : status === "pending"
                    ? "badge-pending"
                    : "badge-error"
                  }`}
                >
                  {status}
                </span>
              )}
            </div>

            {jobId && (
              <div className="output-meta">
                <span className="meta-label">Job ID</span>
                <span className="meta-value">{jobId}</span>
              </div>
            )}

            {jobDetails && (
              <div className="output-meta">
                <span className="meta-label">Time</span>
                <span className="meta-value">{renderTimeDetails()}</span>
              </div>
            )}

            <div className="output-body">
              <pre>{output ? output.trim() : "No output yet..."}</pre>
            </div>
          </div>
        </Split>
        <br />
        <button onClick={handleSubmit}>Submit</button>

        {/* upload section below*/} 
        <div className="upload-section">
          <div className="upload-header">
            <span className="upload-title">Upload File to Drive</span>
          </div>
          <div className="upload-body">
            <label className="upload-label">
              Choose a file
              <input
                type="file"
                accept=".js,.py,.cpp,.c,.java,.ts,.txt,.json,.html,.css"
                onChange={handleFileUpload}
                className="upload-input"
              />
            </label>
            <span className="upload-hint">.js .py .cpp .c .java .ts .html .css .json .txt</span>
          </div>
          {uploading && <p className="upload-status">Uploading...</p>}
          {uploadResult && (
            <div className="upload-result success">
              Uploaded: <a href={uploadResult.link} target="_blank" rel="noreferrer">{uploadResult.fileName}</a>
              <span className="upload-id">ID: {uploadResult.fileId}</span>
            </div>
          )}
          {uploadError && (
            <div className="upload-result error"> {uploadError}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;