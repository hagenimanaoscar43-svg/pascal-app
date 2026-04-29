import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

const COLORS = ['#7c5cfc', '#fc5c7d', '#5cf8c8', '#fcd75c', '#fc955c', '#5cc8fc', '#c85cfc'];
const API_BASE = import.meta.env.VITE_API_BASE || "https://pascal-backend-v2.onrender.com";
const HISTORY_STORAGE_KEY = 'pascal_binomial_history';

// Pascal Triangle Component
const PascalTriangle = ({ rows, n }) => {
  if (n > 20) {
    return (
      <div className="pascal-display">
        <div className="info-message">
          📊 Showing first 20 rows of {n + 1} total rows:
        </div>
        {rows.slice(0, 20).map((row, i) => (
          <div key={i} className="pascal-row">
            {row.slice(0, 15).map((value, j) => {
              const col = COLORS[i % COLORS.length];
              const displayValue = value.length > 8 ? value.slice(0, 8) + '…' : value;
              return (
                <div
                  key={j}
                  className="pascal-cell"
                  style={{
                    background: `${col}22`,
                    color: col,
                    border: `1px solid ${col}55`
                  }}
                  title={value}
                >
                  {displayValue}
                </div>
              );
            })}
            {row.length > 15 && (
              <div className="pascal-cell more">+{row.length - 15}</div>
            )}
          </div>
        ))}
        <div className="info-message">
          ✨ ... and {n - 19} more rows (total {n + 1} rows)
        </div>
      </div>
    );
  }

  return (
    <div className="pascal-display">
      {rows.map((row, i) => (
        <div key={i} className="pascal-row">
          {row.map((value, j) => {
            const col = COLORS[i % COLORS.length];
            return (
              <div
                key={j}
                className="pascal-cell"
                style={{
                  background: `${col}22`,
                  color: col,
                  border: `1px solid ${col}55`
                }}
              >
                {value}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// Binomial Expansion Component
const BinomialExpansion = ({ expression, terms }) => {
  const formatTerm = (term, index) => {
    const absCoeff = Math.abs(term.coeff);
    const showCoeff = !(absCoeff === 1 && (term.powA > 0 || term.powB > 0));
    
    const hasVarA = term.powA > 0;
    const hasVarB = term.powB > 0;
    
    let sign = '';
    if (index === 0) {
      sign = term.coeff < 0 ? '−' : '';
    } else {
      sign = term.coeff > 0 ? ' + ' : ' − ';
    }
    
    return (
      <React.Fragment key={index}>
        <span className="term">
          {sign}
          
          {showCoeff && absCoeff !== 1 && (
            <span className="coeff">{absCoeff}</span>
          )}
          {!showCoeff && !hasVarA && !hasVarB && absCoeff === 1 && (
            <span className="coeff">1</span>
          )}
          
          {hasVarA && (
            <>
              <span className="var">{term.varA}</span>
              {term.powA > 1 && <sup>{term.powA}</sup>}
            </>
          )}
          
          {hasVarB && (
            <>
              <span className="var">{term.varB}</span>
              {term.powB > 1 && <sup>{term.powB}</sup>}
            </>
          )}
        </span>
      </React.Fragment>
    );
  };
  
  if (terms.length === 1 && terms[0].coeff === 1 && terms[0].powA === 0 && terms[0].powB === 0) {
    return (
      <div className="expansion-result">
        <div className="expansion-title">{expression} =</div>
        <div className="expansion-terms">
          <span className="coeff">1</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="expansion-result">
      <div className="expansion-title">{expression} =</div>
      <div className="expansion-terms">
        {terms.map((term, index) => formatTerm(term, index))}
      </div>
    </div>
  );
};

function App() {
  const [activeTab, setActiveTab] = useState('pascal');
  const [pascalInput, setPascalInput] = useState('');
  const [expandInput, setExpandInput] = useState('');
  const [answerContent, setAnswerContent] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');
  const backendAvailable = useRef(true);
  const timeoutRef = useRef(null);
  const isMounted = useRef(true);

  // Cleanup timeouts on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Save to local storage
  const saveToLocalHistory = useCallback((type, input, result) => {
    const newEntry = {
      id: Date.now(),
      type,
      input,
      result: result,
      created_at: new Date().toISOString(),
    };
    setHistory(prev => {
      const updated = [newEntry, ...prev].slice(0, 50);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Load history from backend or local storage
  const loadHistory = useCallback(async () => {
    if (!isMounted.current) return;
    
    setIsHistoryLoading(true);
    setBackendStatus('loading');
    
    try {
      console.log('Fetching history from:', `${API_BASE}/api/history`);
      const res = await fetch(`${API_BASE}/api/history`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log('History data received:', data);
        if (isMounted.current) {
          setHistory(Array.isArray(data) ? data : []);
          backendAvailable.current = true;
          setBackendStatus('connected');
        }
      } else {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
    } catch (error) {
      console.error('Backend error:', error);
      backendAvailable.current = false;
      setBackendStatus('fallback');
      
      // Try to load from local storage
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      console.log('Local storage data:', stored);
      if (isMounted.current) {
        if (stored) {
          const parsedHistory = JSON.parse(stored);
          setHistory(parsedHistory);
          console.log('Loaded from local storage:', parsedHistory.length, 'items');
        } else {
          setHistory([]);
          console.log('No local storage data found');
        }
      }
    } finally {
      if (isMounted.current) {
        setIsHistoryLoading(false);
      }
    }
  }, []);

  // Add to history
  const addToHistory = useCallback(async (type, input, resultData) => {
    console.log('Adding to history:', { type, input });
    
    if (backendAvailable.current) {
      try {
        const response = await fetch(`${API_BASE}/api/history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, input, result: resultData }),
        });
        
        if (response.ok) {
          console.log('Successfully saved to backend');
          loadHistory();
        } else {
          throw new Error('Failed to save to backend');
        }
      } catch (error) {
        console.error('Failed to save to backend:', error);
        backendAvailable.current = false;
        setBackendStatus('fallback');
        saveToLocalHistory(type, input, resultData);
      }
    } else {
      console.log('Saving to local storage instead');
      saveToLocalHistory(type, input, resultData);
    }
  }, [loadHistory, saveToLocalHistory]);

  // Clear all history
  const clearHistory = useCallback(async () => {
    if (!window.confirm('Delete all history? This cannot be undone.')) return;

    if (backendAvailable.current) {
      try {
        await fetch(`${API_BASE}/api/history`, { method: 'DELETE' });
        await loadHistory();
      } catch (error) {
        console.error('Failed to clear backend history:', error);
        backendAvailable.current = false;
        localStorage.removeItem(HISTORY_STORAGE_KEY);
        if (isMounted.current) {
          setHistory([]);
        }
      }
    } else {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
      if (isMounted.current) {
        setHistory([]);
      }
    }
    if (isMounted.current) {
      setAnswerContent(<div className="answer-placeholder">→ Results will appear here</div>);
    }
  }, [loadHistory]);

  // Compute Pascal triangle
  const computePascalWithValue = useCallback(async (nValue) => {
    if (!nValue || nValue === '') {
      if (isMounted.current) {
        setAnswerContent(<div className="error">⚠ Please enter a value.</div>);
      }
      return;
    }

    const n = parseInt(nValue);
    if (isNaN(n) || n < 0 || n > 100000) {
      if (isMounted.current) {
        setAnswerContent(<div className="error">⚠ n must be between 0 and 100,000</div>);
      }
      return;
    }

    if (isMounted.current) {
      setIsLoading(true);
      setAnswerContent(<div className="loading">Computing Pascal triangle for n={n}...</div>);
    }

    try {
      const res = await fetch(`${API_BASE}/api/pascal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n: n }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (isMounted.current) {
          setAnswerContent(<div className="error">⚠ {data.error}</div>);
        }
        return;
      }

      if (isMounted.current) {
        setAnswerContent(<PascalTriangle rows={data.rows} n={n} />);
      }
      await addToHistory('pascal', `n = ${nValue}`, data);
    } catch (err) {
      console.error(err);
      if (isMounted.current) {
        setAnswerContent(<div className="error">⚠ Server error. Please check backend connection.</div>);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [addToHistory]);

  const computePascal = useCallback(() => {
    computePascalWithValue(pascalInput.trim());
  }, [pascalInput, computePascalWithValue]);

  // Compute binomial expansion
  const computeExpansionWithValue = useCallback(async (exprValue) => {
    if (!exprValue || exprValue === '') {
      if (isMounted.current) {
        setAnswerContent(<div className="error">⚠ Please enter an expression.</div>);
      }
      return;
    }

    if (isMounted.current) {
      setIsLoading(true);
      setAnswerContent(<div className="loading">Expanding {exprValue}...</div>);
    }

    try {
      const res = await fetch(`${API_BASE}/api/expand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression: exprValue }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (isMounted.current) {
          setAnswerContent(<div className="error">⚠ {data.error}</div>);
        }
        return;
      }

      if (isMounted.current) {
        setAnswerContent(<BinomialExpansion expression={exprValue} terms={data.terms} />);
      }
      await addToHistory('expand', exprValue, data);
    } catch (err) {
      console.error(err);
      if (isMounted.current) {
        setAnswerContent(
          <div className="error">
            ⚠ Server error. Please check backend connection.
          </div>
        );
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [addToHistory]);

  const computeExpansion = useCallback(() => {
    computeExpansionWithValue(expandInput.trim());
  }, [expandInput, computeExpansionWithValue]);

  // Reload history item
  const reloadHistoryItem = useCallback((id) => {
    const loadItem = async () => {
      try {
        let item;
        if (backendAvailable.current) {
          const res = await fetch(`${API_BASE}/api/history/${id}`);
          if (!res.ok) throw new Error('Failed to fetch');
          item = await res.json();
        } else {
          item = history.find(h => h.id === id);
        }
        
        if (item && isMounted.current) {
          if (item.type === 'pascal') {
            setActiveTab('pascal');
            const n = item.input.replace('n = ', '');
            setPascalInput(n);
            setTimeout(() => {
              if (isMounted.current) {
                computePascalWithValue(n);
              }
            }, 100);
          } else if (item.type === 'expand') {
            setActiveTab('expand');
            setExpandInput(item.input);
            setTimeout(() => {
              if (isMounted.current) {
                computeExpansionWithValue(item.input);
              }
            }, 100);
          }
        }
      } catch (e) {
        console.error('Failed to reload history item', e);
      }
    };
    
    loadItem();
  }, [history, computePascalWithValue, computeExpansionWithValue]);

  // Handle tab change
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    if (tab === 'history') {
      loadHistory();
    }
  }, [loadHistory]);

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== 'Enter') return;
      if (activeTab === 'pascal' && document.activeElement?.id === 'pascal-input') {
        computePascal();
      }
      if (activeTab === 'expand' && document.activeElement?.id === 'expand-input') {
        computeExpansion();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, computePascal, computeExpansion]);

  // Load history on mount
  useEffect(() => {
    loadHistory();
    
    // Also check if there's any data in localStorage on mount
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      console.log('Found existing localStorage data:', parsed.length, 'items');
    }
  }, [loadHistory]);

  // Format date for display
  const formatHistoryDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString();
    } catch {
      return '';
    }
  };

  // Simple HTML escaping
  const escapeHtmlSimple = (str) => {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  };

  return (
    <>
      <div className="noise" aria-hidden="true"></div>
      <div className="container">
        <header>
          <h1><b>Pascal & Binomial</b></h1>
          <div className="db-badge">
            <span className="db-dot"></span>
            TecTeam 7 CSE Year Two 2026
          </div>
        </header>

        <div className="btn-row">
          <button
            className={`tab-btn pascal ${activeTab === 'pascal' ? 'active' : ''}`}
            onClick={() => handleTabChange('pascal')}
          >
            ▲ Pascal Triangle
          </button>
          <button
            className={`tab-btn expand ${activeTab === 'expand' ? 'active' : ''}`}
            onClick={() => handleTabChange('expand')}
          >
            ∑ Expansion Equation
          </button>
          <button
            className={`tab-btn history ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => handleTabChange('history')}
          >
            ◎ History
          </button>
        </div>

        {/* Backend Status Indicator */}
        <div className={`backend-status ${backendStatus}`}>
          {backendStatus === 'connected' && '✅ Connected to server'}
          {backendStatus === 'fallback' && '💾 Using local storage (offline mode)'}
          {backendStatus === 'loading' && '🔄 Connecting...'}
          {backendStatus === 'checking' && '🔍 Checking connection...'}
        </div>

        <div className={`panel pascal-panel ${activeTab === 'pascal' ? 'active' : ''}`}>
          <div className="panel-title">Pascal Triangle</div>
          <div className="input-row">
            <input
              type="number"
              id="pascal-input"
              min="0"
              max="100000"
              placeholder="Enter degree n (e.g. 5)"
              autoComplete="off"
              value={pascalInput}
              onChange={(e) => setPascalInput(e.target.value)}
            />
            <button className="calc-btn pascal" onClick={computePascal} disabled={isLoading}>
              {isLoading ? '...' : 'Generate'}
            </button>
          </div>
          <div className="hint">✨ Enter a non-negative integer (0-100,000) and press Generate</div>
        </div>

        <div className={`panel expand-panel ${activeTab === 'expand' ? 'active' : ''}`}>
          <div className="panel-title">Expansion Equation</div>
          <div className="input-row">
            <input
              type="text"
              id="expand-input"
              placeholder="e.g. (2x^2+3y^3)^4 or (x+y)^1000"
              autoComplete="off"
              value={expandInput}
              onChange={(e) => setExpandInput(e.target.value)}
            />
            <button className="calc-btn expand" onClick={computeExpansion} disabled={isLoading}>
              {isLoading ? '...' : 'Expand'}
            </button>
          </div>
          <div className="hint">📐 Format: (axⁿ + byᵐ)ᵖ | Supports coefficients and exponents, p up to 1000</div>
        </div>

        <div className={`panel history-panel ${activeTab === 'history' ? 'active' : ''}`}>
          <div className="panel-title">History</div>
          <button className="clear-btn" onClick={clearHistory}>✕ Clear All</button>
          <div className="history-list">
            {isHistoryLoading ? (
              <div className="loading">📡 Loading from database...</div>
            ) : history.length === 0 ? (
              <div className="history-empty">
                📭 No calculations yet. 
                <br />
                <small>Generate a Pascal triangle or expand an expression to see it here!</small>
                <br />
                <small style={{color: '#666'}}>Backend status: {backendStatus}</small>
              </div>
            ) : (
              <>
                <div className="history-count">📊 {history.length} item(s) in history</div>
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="history-item"
                    onClick={() => reloadHistoryItem(item.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && reloadHistoryItem(item.id)}
                  >
                    <div className="h-left">
                      <div className={`h-type ${item.type}`}>
                        {item.type === 'pascal' ? '▲ Pascal Triangle' : '∑ Binomial Expansion'}
                      </div>
                      <div className="h-input">{escapeHtmlSimple(item.input)}</div>
                    </div>
                    <div className="h-time">{formatHistoryDate(item.created_at)}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="answer-box">
          <div className="answer-label">Result:</div>
          <div id="answer-area">
            {answerContent || <div className="answer-placeholder">✨ Results will appear here ✨</div>}
          </div>
        </div>
      </div>
      <footer>
        &copy; <b>Developed by TecTeam 7 CSE Two — All rights reserved 2026</b>
      </footer>
    </>
  );
}

export default App;
