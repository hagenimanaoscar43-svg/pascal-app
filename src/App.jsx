import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

const COLORS = ['#7c5cfc', '#fc5c7d', '#5cf8c8', '#fcd75c', '#fc955c', '#5cc8fc', '#c85cfc'];
const API_BASE = "https://pascal-backend-v2.onrender.com";  // ✅ Fixed: Use API_BASE consistently

// Remove this test fetch - it's causing errors
// fetch(`${API_BASE}/questions`)  // This endpoint doesn't exist!

const escHtml = (s) => {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

const HISTORY_STORAGE_KEY = 'pascal_binomial_history';

function App() {
  const [activeTab, setActiveTab] = useState('pascal');
  const [pascalInput, setPascalInput] = useState('');
  const [expandInput, setExpandInput] = useState('');
  const [answerContent, setAnswerContent] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const backendAvailable = useRef(true);

  const saveToLocalHistory = useCallback((type, input, result) => {
    const newEntry = {
      id: Date.now(),
      type,
      input,
      output: result,
      created_at: new Date().toISOString(),
    };
    setHistory(prev => {
      const updated = [newEntry, ...prev].slice(0, 50);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const loadHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data) ? data : []);
        backendAvailable.current = true;
      } else {
        throw new Error('Backend unavailable');
      }
    } catch (error) {
      console.log('Using local storage fallback');
      backendAvailable.current = false;
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      } else {
        setHistory([]);
      }
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  const addToHistory = useCallback(async (type, input, resultData) => {
    if (backendAvailable.current) {
      try {
        await fetch(`${API_BASE}/api/history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, input, result: resultData }),
        });
        loadHistory();
      } catch (error) {
        backendAvailable.current = false;
        saveToLocalHistory(type, input, resultData);
      }
    } else {
      saveToLocalHistory(type, input, resultData);
    }
  }, [loadHistory, saveToLocalHistory]);

  const clearHistory = useCallback(async () => {
    if (!window.confirm('Delete all history? This cannot be undone.')) return;

    if (backendAvailable.current) {
      try {
        await fetch(`${API_BASE}/api/history`, { method: 'DELETE' });
        loadHistory();
      } catch (error) {
        backendAvailable.current = false;
        localStorage.removeItem(HISTORY_STORAGE_KEY);
        setHistory([]);
      }
    } else {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
      setHistory([]);
    }
    setAnswerContent(<div className="answer-placeholder">→ Results will appear here</div>);
  }, [loadHistory]);

  const reloadHistoryItem = useCallback(async (id) => {
    try {
      let item;
      if (backendAvailable.current) {
        const res = await fetch(`${API_BASE}/api/history/${id}`);
        if (!res.ok) throw new Error('Failed to fetch');
        item = await res.json();
      } else {
        item = history.find(h => h.id === id);
      }
      
      if (item) {
        if (item.type === 'pascal') {
          setActiveTab('pascal');
          // Extract just the number from "n = 5" format
          const n = item.input.replace('n = ', '');
          setPascalInput(n);
          setTimeout(() => computePascalWithValue(n), 100);
        } else if (item.type === 'expand') {
          setActiveTab('expand');
          setExpandInput(item.input);
          setTimeout(() => computeExpansionWithValue(item.input), 100);
        }
      }
    } catch (e) {
      console.error('Failed to reload history item', e);
    }
  }, [history]);

  const computePascalWithValue = useCallback(async (nValue) => {
    if (!nValue || nValue === '') {
      setAnswerContent(<div className="error">⚠ Please enter a value.</div>);
      return;
    }

    setIsLoading(true);
    setAnswerContent(<div className="loading">Computing...</div>);

    try {
      const res = await fetch(`${API_BASE}/api/pascal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n: parseInt(nValue) }),
      });
      const data = await res.json();

      if (!res.ok) {
        setAnswerContent(<div className="error">⚠ {escHtml(data.error)}</div>);
        return;
      }

      let html = '<div class="pascal-display">';
      if (data.rows && Array.isArray(data.rows)) {
        data.rows.forEach((row, i) => {
          const col = COLORS[i % COLORS.length];
          html += '<div class="pascal-row">';
          row.forEach(v => {
            html += `<div class="pascal-cell" style="background:${col}22;color:${col};border:1px solid ${col}55">${v}</div>`;
          });
          html += '</div>';
        });
      }
      html += '</div>';
      setAnswerContent(<div dangerouslySetInnerHTML={{ __html: html }} />);
      await addToHistory('pascal', `n = ${nValue}`, data);
    } catch (err) {
      console.error(err);
      setAnswerContent(<div className="error">⚠ Server error. Please check backend connection.</div>);
    } finally {
      setIsLoading(false);
    }
  }, [addToHistory]);

  const computePascal = useCallback(() => {
    computePascalWithValue(pascalInput.trim());
  }, [pascalInput, computePascalWithValue]);

  const computeExpansionWithValue = useCallback(async (exprValue) => {
    if (!exprValue || exprValue === '') {
      setAnswerContent(<div className="error">⚠ Please enter an expression.</div>);
      return;
    }

    setIsLoading(true);
    setAnswerContent(<div className="loading">Computing...</div>);

    try {
      const res = await fetch(`${API_BASE}/api/expand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression: exprValue }),
      });
      const data = await res.json();

      if (!res.ok) {
        setAnswerContent(<div className="error">⚠ {escHtml(data.error)}</div>);
        return;
      }

      let html = '<div class="expansion-result">';
      html += '<div class="expansion-title">' + escHtml(data.expression) + ' = </div>';
      html += '<div class="expansion-terms">';
      
      if (data.expanded) {
        let expanded = data.expanded;
        expanded = expanded.replace(/(\d+)/g, '<span class="coeff">$1</span>');
        expanded = expanded.replace(/([a-zA-Z])/g, '<span class="var">$1</span>');
        expanded = expanded.replace(/\^(\d+)/g, '<sup>$1</sup>');
        html += expanded;
      } else if (data.terms && Array.isArray(data.terms)) {
        data.terms.forEach((term, i) => {
          const absCoeff = Math.abs(term.coeff);
          const showCoeff = !(absCoeff === 1 && (term.powA > 0 || term.powB > 0));
          
          if (i > 0) {
            html += `<span class="operator">${term.coeff > 0 ? ' + ' : ' - '}</span>`;
          } else if (term.coeff < 0) {
            html += `<span class="operator">-</span>`;
          }
          
          if (showCoeff && absCoeff !== 1) {
            html += `<span class="coeff">${absCoeff}</span>`;
          }
          
          if (term.powA > 0) {
            html += `<span class="var">${term.varA}</span>`;
            if (term.powA > 1) html += `<sup>${term.powA}</sup>`;
          }
          
          if (term.powB > 0) {
            html += `<span class="var">${term.varB}</span>`;
            if (term.powB > 1) html += `<sup>${term.powB}</sup>`;
          }
        });
      }
      
      html += '</div></div>';
      setAnswerContent(<div dangerouslySetInnerHTML={{ __html: html }} />);
      
      await addToHistory('expand', exprValue, data);
    } catch (err) {
      setAnswerContent(
        <div className="error">
          ⚠ Server error. Please check backend connection.
        </div>
      );
    } finally {
      setIsLoading(false);
    }
  }, [addToHistory]);

  const computeExpansion = useCallback(() => {
    computeExpansionWithValue(expandInput.trim());
  }, [expandInput, computeExpansionWithValue]);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    if (tab === 'history') {
      loadHistory();
    }
  }, [loadHistory]);

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

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const formatHistoryDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString();
    } catch {
      return '';
    }
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

        <div className={`panel pascal-panel ${activeTab === 'pascal' ? 'active' : ''}`}>
          <div className="panel-title">Pascal Triangle</div>
          <div className="input-row">
            <input
              type="number"
              id="pascal-input"
              min="0"
              max="100"
              placeholder="Enter degree n (e.g. 5)"
              autoComplete="off"
              value={pascalInput}
              onChange={(e) => setPascalInput(e.target.value)}
            />
            <button className="calc-btn pascal" onClick={computePascal} disabled={isLoading}>
              {isLoading ? '...' : 'Generate'}
            </button>
          </div>
          <div className="hint">Enter a non-negative integer (0-100) and press Generate.</div>
        </div>

        <div className={`panel expand-panel ${activeTab === 'expand' ? 'active' : ''}`}>
          <div className="panel-title">Expansion Equation</div>
          <div className="input-row">
            <input
              type="text"
              id="expand-input"
              placeholder="e.g. (2x^2+3y^3)^4 or (x+y)^3"
              autoComplete="off"
              value={expandInput}
              onChange={(e) => setExpandInput(e.target.value)}
            />
            <button className="calc-btn expand" onClick={computeExpansion} disabled={isLoading}>
              {isLoading ? '...' : 'Expand'}
            </button>
          </div>
          <div className="hint">Format: (ax^n + by^m)^p | Supports coefficients and exponents</div>
        </div>

        <div className={`panel history-panel ${activeTab === 'history' ? 'active' : ''}`}>
          <div className="panel-title">History</div>
          <button className="clear-btn" onClick={clearHistory}>✕ Clear All</button>
          <div className="history-list">
            {isHistoryLoading ? (
              <div className="loading">Loading from database...</div>
            ) : history.length === 0 ? (
              <div className="history-empty">No calculations yet.</div>
            ) : (
              history.map((item) => (
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
                    <div className="h-input">{escHtml(item.input)}</div>
                  </div>
                  <div className="h-time">{formatHistoryDate(item.created_at)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="answer-box">
          <div className="answer-label">Result:</div>
          <div id="answer-area">
            {answerContent || <div className="answer-placeholder">→ Results will appear here</div>}
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