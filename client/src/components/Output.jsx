import React, { useState } from 'react';
import toast from 'react-hot-toast';

const Output = ({ editorRef, language }) => {
  const [output, setOutput] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  const runCode = async () => {
    const sourceCode = editorRef.current.getValue();
    if (!sourceCode) return;
    try {
      setIsLoading(true);
      const response = await executeCode(language || 'javascript', sourceCode);
      
      if (response && response.run) {
        const result = response.run;
        setOutput(result.output.split('\n'));
        result.stderr ? setIsError(true) : setIsError(false);
      } else {
        throw new Error(response.message || "Unexpected response from execution service");
      }
    } catch (error) {
      console.error("Execution Error:", error);
      toast.error(error.message || "Unable to run code");
    } finally {
      setIsLoading(false);
    }
  };

  const clearOutput = () => {
    setOutput(null);
    setIsError(false);
  };

  return (
    <div className="outputParams">
      <div className="outputHeader">
        <h3 className="outputTitle">Output</h3>
        <div className="outputControls">
            <button 
                className="btn clearBtn" 
                onClick={clearOutput}
                disabled={!output}
            >
            Clear
            </button>
            <button 
                className={`btn runBtn ${isLoading ? 'loading' : ''}`} 
                disabled={isLoading} 
                onClick={runCode}
            >
            {isLoading ? 'Running...' : 'Run Code'}
            </button>
        </div>
      </div>
      <div 
        className={`outputBox ${isError ? 'error' : ''}`}
      >
        {output
          ? output.map((line, i) => <p key={i}>{line}</p>)
          : 'Click "Run Code" to see the output here'}
      </div>
    </div>
  );
};

// Piston API helper
export const executeCode = async (language, sourceCode) => {
    // Map moniker to Piston language
    const LANGUAGE_VERSIONS = {
        javascript: "18.15.0",
        typescript: "5.0.3",
        python: "3.10.0",
        java: "15.0.2",
        csharp: "6.12.0",
        php: "8.2.3", 
    };

    const BACKEND_URL = (window._env_ && window._env_.VITE_BACKEND_URL) || import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
    const PISTON_URL = `${BACKEND_URL}/api/execute`;
    const PISTON_API_KEY = (window._env_ && window._env_.VITE_PISTON_API_KEY) || import.meta.env.VITE_PISTON_API_KEY;

    const headers = {
        "Content-Type": "application/json", 
    };

    if (PISTON_API_KEY) {
        headers["Authorization"] = PISTON_API_KEY;
    }

    const response = await fetch(PISTON_URL, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
            language: language,
            version: LANGUAGE_VERSIONS[language] || "*", 
            files: [
                {
                    content: sourceCode, 
                },
            ],
        }),
    });

    if (response.status === 401) {
        throw new Error("Piston API access is restricted. You need an API key or a self-hosted instance.");
    }

    return await response.json();
};

export default Output;
