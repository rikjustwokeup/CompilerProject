import axios from 'axios';
import './App.css';
import React, {useState} from "react"

function App() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("cpp");
  const [output, setOutput] = useState("");

  const handleSubmit = async () => {
    const payload = {
      language, // supports "cpp", "java", "python"
      code,
    };
    try {
      const {data} = await axios.post("http://localhost:5000/run", payload)
      console.log(data);
      setOutput(data.jobId);

      setInterval(async () => {
        const { data: dataRes } = await axios.get(
          "http://localhost:5000/status",
          { params: { id: data.jobId } }
        );

        const {success, job, error} = dataRes;

        if(success){
          const {status: jobStatus, output: jobOutput} = job;
          if (jobStatus === "pending") return;
          setOutput(jobOutput);

        } else{
          console.error(error);
          setOutput(error);

        }

        console.log(dataRes);
      }, 1000);

    } catch(err) {
      if (err.response) {
        const errMsg = err.response.data?.err?.stderr;
        setOutput(errMsg || "unknown server error");
      } else{
        setOutput("Error connecting to server");
      }
    }
  };
  return (
    <div className="App">
      <h1>Online Code Compiler</h1>
      <div>
        <label>Select the language:  </label>
        <select
          value = {language}
          onChange = {(e) => {
              setLanguage(e.target.value);
              console.log(e.target.value)
            }}
        >
          <option value = "cpp">C++</option>
          <option value = "c">C</option>
          <option value = "python">Python</option>
          <option value = "java">Java</option>
        </select>
      </div>
      <br />
      <textarea rows = "20" cols = "75" value = {code} onChange = {(e) => {setCode(e.target.value)}} ></textarea>
      <br />
      <button onClick = {handleSubmit}>Submit</button>
      <pre>{output ? output.trim() : ""}</pre>
    </div>
  );
}

export default App;