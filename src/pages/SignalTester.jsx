import { useState, useCallback, useRef } from 'react'
import Papa from 'papaparse'
import { parseTrades } from '../utils/tradeAnalytics'
import { testSignal } from '../utils/signalEngine'
import { queryGemini } from '../utils/geminiClient'
import { extractTradesFromImage } from '../utils/ocrParser'
import { extractTradesFromExcel } from '../utils/excelParser'

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif']
const EXCEL_EXTENSIONS = ['xlsx', 'xls']

function isImageFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  return IMAGE_EXTENSIONS.includes(ext)
}

function isExcelFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  return EXCEL_EXTENSIONS.includes(ext)
}

const thStyle = {
  padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)',
  color: 'var(--color-text-muted)', fontWeight: 600, whiteSpace: 'nowrap', position: 'sticky',
  top: 0, background: 'var(--color-bg-card)',
}

const tdStyle = { padding: '6px 12px', whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }

export default function SignalTester() {
  const [trades, setTrades] = useState(null)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [aiResponse, setAiResponse] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [chatHistory, setChatHistory] = useState([])
  const [dataStats, setDataStats] = useState(null)
  const chatEndRef = useRef(null)

  // OCR-specific state
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrPreview, setOcrPreview] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null)

  const handleCsvFile = useCallback((file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = parseTrades(results.data)
        if (parsed.length < 10) {
          setError('Need at least 10 trades for signal testing')
          return
        }
        setTrades(parsed)
        const hasVol = parsed.some(t => t.volume != null && t.volume > 0)
        const hasDur = parsed.some(t => t.duration != null && t.duration > 0)
        setDataStats({ hasVolume: hasVol, hasDuration: hasDur })
        setError(null)
      }
    })
  }, [])

  const handleImageFile = useCallback(async (file) => {
    setOcrLoading(true)
    setOcrProgress(0)
    setError(null)
    setImagePreviewUrl(URL.createObjectURL(file))

    try {
      const result = await extractTradesFromImage(file, (progress) => {
        setOcrProgress(progress)
      })

      if (result.dataRowsExtracted < 1) {
        setError('No trade data could be extracted from the image. Try a clearer screenshot.')
        setOcrLoading(false)
        setImagePreviewUrl(null)
        return
      }

      setOcrPreview(result)
    } catch (e) {
      setError('OCR failed: ' + e.message)
      setImagePreviewUrl(null)
    } finally {
      setOcrLoading(false)
    }
  }, [])

  const handleExcelFile = useCallback(async (file) => {
    setOcrLoading(true)
    setOcrProgress(100)
    setError(null)
    setImagePreviewUrl(null)

    try {
      const result = await extractTradesFromExcel(file)

      if (result.dataRowsExtracted < 1) {
        setError('No trade data could be extracted from the Excel file.')
        setOcrLoading(false)
        return
      }

      setOcrPreview(result)
    } catch (e) {
      setError('Excel processing failed: ' + e.message)
    } finally {
      setOcrLoading(false)
    }
  }, [])

  const handleFile = useCallback((file) => {
    if (!file) return
    setError(null)
    setOcrPreview(null)
    setImagePreviewUrl(null)

    if (isImageFile(file)) {
      handleImageFile(file)
    } else if (isExcelFile(file)) {
      handleExcelFile(file)
    } else {
      handleCsvFile(file)
    }
  }, [handleCsvFile, handleImageFile, handleExcelFile])

  const confirmOcrData = useCallback(() => {
    if (!ocrPreview) return
    try {
      const parsed = parseTrades(ocrPreview.rows)
      if (parsed.length < 10) {
        setError('Only ' + parsed.length + ' valid trades extracted. Need at least 10.')
        return
      }
      setTrades(parsed)
      const hasVol = parsed.some(t => t.volume != null && t.volume > 0)
      const hasDur = parsed.some(t => t.duration != null && t.duration > 0)
      setDataStats({ hasVolume: hasVol, hasDuration: hasDur })
      setOcrPreview(null)
      setImagePreviewUrl(null)
    } catch (e) {
      setError('Failed to process extracted data: ' + e.message)
    }
  }, [ocrPreview])

  const resetOcr = useCallback(() => {
    setOcrPreview(null)
    setOcrLoading(false)
    setOcrProgress(0)
    setImagePreviewUrl(null)
    setError(null)
  }, [])

  const handleOcrCellEdit = useCallback((rowIndex, header, value) => {
    setOcrPreview(prev => {
      if (!prev) return prev
      const newRows = [...prev.rows]
      newRows[rowIndex] = { ...newRows[rowIndex], [header]: value }
      return { ...prev, rows: newRows }
    })
  }, [])

  const handleOcrRowDelete = useCallback((rowIndex) => {
    setOcrPreview(prev => {
      if (!prev) return prev
      const newRows = [...prev.rows]
      newRows.splice(rowIndex, 1)
      return { ...prev, rows: newRows, dataRowsExtracted: newRows.length }
    })
  }, [])

  const handleOcrRowAdd = useCallback(() => {
    setOcrPreview(prev => {
      if (!prev) return prev
      const emptyRow = {}
      prev.headers.forEach(h => emptyRow[h] = '')
      const newRows = [...prev.rows, emptyRow]
      return { ...prev, rows: newRows, dataRowsExtracted: newRows.length }
    })
  }, [])

  const loadSample = useCallback(() => {
    const sampleTrades = []
    const startDate = new Date('2024-01-02')
    for (let i = 0; i < 200; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + Math.floor(i / 3))
      date.setHours(9 + Math.floor(Math.random() * 7), Math.floor(Math.random() * 60))
      const isMonday = date.getDay() === 1
      const isMorning = date.getHours() < 12
      const winBias = isMonday ? 0.65 : isMorning ? 0.60 : 0.50
      const isWin = Math.random() < winBias
      sampleTrades.push({
        date: date.toISOString(),
        type: Math.random() > 0.5 ? 'BUY' : 'SELL',
        price: (100 + Math.random() * 50).toFixed(2),
        quantity: (1 + Math.floor(Math.random() * 10)).toString(),
        pnl: (isWin ? 50 + Math.random() * 300 : -(30 + Math.random() * 200)).toFixed(2),
        volume: (100000 + Math.random() * 500000).toFixed(0),
      })
    }
    setTrades(parseTrades(sampleTrades))
    setDataStats({ hasVolume: true, hasDuration: false })
    setError(null)
  }, [])

  const runTest = useCallback(async () => {
    if (!query.trim() || !trades) return
    setLoading(true)
    setResult(null)
    setAiResponse(null)
    setError(null)

    // First try keyword-based signal engine
    const signalResult = testSignal(query, trades)

    if (!signalResult.error) {
      // Keyword match found — show structured result
      setResult(signalResult)
      setChatHistory(prev => [...prev, {
        type: 'signal',
        query: query,
        result: signalResult,
        timestamp: new Date(),
      }])
      setLoading(false)
    } else {
      // No keyword match — use Gemini AI
      try {
        const geminiResult = await queryGemini(query, trades, chatHistory)
        setAiResponse(geminiResult.answer)
        setChatHistory(prev => [...prev, {
          type: 'ai',
          query: query,
          answer: geminiResult.answer,
          timestamp: new Date(),
        }])
        setQuery('') // Clear input for next prompt
      } catch (e) {
        setError('AI analysis failed: ' + e.message)
      } finally {
        setLoading(false)
      }
    }

    // Scroll to bottom of chat
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 200)
  }, [query, trades, chatHistory])

  const confidenceColors = {
    'Very High': 'var(--color-green)',
    'High': 'var(--color-green-light)',
    'Moderate': 'var(--color-yellow)',
    'Low': 'var(--color-red)',
  }

  // Simple markdown renderer for AI responses
  const renderMarkdown = (text) => {
    if (!text) return null
    const lines = text.split('\n')
    const elements = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Headers
      if (line.startsWith('### ')) {
        elements.push(<h4 key={i} className="text-base font-bold mt-4 mb-2" style={{ color: 'var(--color-text-primary)' }}>{line.slice(4)}</h4>)
      } else if (line.startsWith('## ')) {
        elements.push(<h3 key={i} className="text-lg font-bold mt-4 mb-2" style={{ color: 'var(--color-text-primary)' }}>{line.slice(3)}</h3>)
      } else if (line.startsWith('# ')) {
        elements.push(<h2 key={i} className="text-xl font-bold mt-4 mb-2" style={{ color: 'var(--color-text-primary)' }}>{line.slice(2)}</h2>)
      }
      // Bullet points
      else if (line.match(/^[-*]\s/)) {
        elements.push(
          <div key={i} className="flex gap-2 ml-2 mb-1">
            <span style={{ color: 'var(--color-accent-light)' }}>•</span>
            <span style={{ color: 'var(--color-text-secondary)' }}
              dangerouslySetInnerHTML={{ __html: formatInline(line.slice(2)) }} />
          </div>
        )
      }
      // Empty line
      else if (line.trim() === '') {
        elements.push(<div key={i} className="h-2" />)
      }
      // Regular paragraph
      else {
        elements.push(
          <p key={i} className="mb-2 text-sm leading-relaxed"
            style={{ color: 'var(--color-text-secondary)' }}
            dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
        )
      }
    }
    return elements
  }

  // Format inline markdown (bold, code)
  const formatInline = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--color-text-primary)">$1</strong>')
      .replace(/`(.*?)`/g, '<code style="background:rgba(99,102,241,0.15);padding:1px 6px;border-radius:4px;font-size:0.85em;color:var(--color-accent-light)">$1</code>')
  }

  // === OCR Loading Screen ===
  if (ocrLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-3xl md:text-4xl font-serif tracking-tight mb-2">
            <span className="gradient-text">Processing Image</span>
          </h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Extracting trade data from your screenshot...
          </p>
        </div>

        <div className="glass-card-static p-8 text-center animate-fade-in-up stagger-1">
          {imagePreviewUrl && (
            <div className="mb-6 mx-auto" style={{ maxWidth: '400px' }}>
              <img
                src={imagePreviewUrl}
                alt="Uploaded trade table"
                className="rounded-xl w-full"
                style={{ border: '1px solid var(--color-border)', opacity: 0.6 }}
              />
            </div>
          )}

          <div className="text-5xl mb-4 animate-pulse">🔍</div>
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Running OCR Analysis
          </h3>

          <div className="mx-auto mb-3" style={{ maxWidth: '300px' }}>
            <div className="progress-bar" style={{ height: '8px' }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${ocrProgress}%`,
                  background: 'linear-gradient(90deg, var(--color-accent), var(--color-accent-light))',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {ocrProgress < 30 ? 'Loading OCR engine...' :
              ocrProgress < 90 ? `Recognizing text... ${ocrProgress}%` :
                'Finishing up...'}
          </p>
        </div>
      </div>
    )
  }

  // === OCR Preview Screen ===
  if (ocrPreview) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-3xl md:text-4xl font-serif tracking-tight mb-2">
            <span className="gradient-text">Review Extracted Data</span>
          </h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            {ocrPreview.dataRowsExtracted} trade rows extracted • Fix any mistakes below
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 animate-fade-in-up stagger-1">
          {imagePreviewUrl && (
            <div className="glass-card-static p-4">
              <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-muted)' }}>Source Image</h4>
              <img
                src={imagePreviewUrl}
                alt="Source trade table"
                className="rounded-lg w-full"
                style={{ border: '1px solid var(--color-border)' }}
              />
            </div>
          )}
          <div className={`glass-card-static p-4 ${imagePreviewUrl ? 'md:col-span-2' : 'md:col-span-3'}`}>
            <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-muted)' }}>
              Extracted Trades ({ocrPreview.dataRowsExtracted} rows)
            </h4>
            <div id="ocr-preview-container" style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>#</th>
                    {ocrPreview.headers.map((h, i) => (
                      <th key={i} style={{
                        ...thStyle,
                        color: ['date', 'type', 'price', 'quantity', 'pnl'].includes(h)
                          ? 'var(--color-accent-light)' : 'var(--color-text-muted)'
                      }}>
                        {h} {['date', 'type', 'price', 'quantity', 'pnl'].includes(h) && '✓'}
                      </th>
                    ))}
                    <th style={{ ...thStyle, width: '32px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {ocrPreview.rows.slice(0, 50).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={tdStyle}>{i + 1}</td>
                      {ocrPreview.headers.map((h, j) => (
                        <td key={j} style={{ ...tdStyle, padding: '4px 8px' }}>
                          <input
                            type="text"
                            value={row[h] !== undefined && row[h] !== null ? row[h] : ''}
                            onChange={(e) => handleOcrCellEdit(i, h, e.target.value)}
                            style={{
                              background: 'transparent',
                              border: '1px solid transparent',
                              color: h === 'pnl' ? (parseFloat(row[h]) >= 0 ? 'var(--color-green)' : 'var(--color-red)') : 'var(--color-text-secondary)',
                              width: '100%', minWidth: '60px', outline: 'none', padding: '4px', borderRadius: '4px', transition: 'all 0.2s',
                            }}
                            onFocus={e => { e.target.style.background = 'rgba(255,255,255,0.05)'; e.target.style.border = '1px solid var(--color-border)' }}
                            onBlur={e => { e.target.style.background = 'transparent'; e.target.style.border = '1px solid transparent' }}
                          />
                        </td>
                      ))}
                      <td style={{ ...tdStyle, textAlign: 'center', padding: '4px' }}>
                        <button onClick={() => handleOcrRowDelete(i)} title="Delete Row"
                          className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-red-500/20"
                          style={{ color: 'var(--color-text-muted)' }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 mb-2 flex justify-center">
                <button onClick={handleOcrRowAdd} className="px-4 py-1.5 text-xs font-medium rounded hover:bg-white/5 transition-colors"
                  style={{ border: '1px dashed var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  + Add Row
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl animate-fade-in" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <p className="text-sm" style={{ color: 'var(--color-red-light)' }}>⚠️ {error}</p>
          </div>
        )}

        <div className="flex gap-4 justify-center animate-fade-in-up stagger-2">
          <button onClick={resetOcr}
            className="px-6 py-3 rounded-xl text-sm font-medium transition-all hover:scale-105"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
            ← Try Another Image
          </button>
          <button onClick={confirmOcrData} className="glow-btn">
            ✓ Looks Good — Start AI Analysis
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-3xl md:text-4xl font-serif tracking-tight mb-2">
          <span className="gradient-text">AI Signal Tester</span>
        </h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Ask anything about your trades — powered by Gemini AI
        </p>
      </div>

      {/* Data upload */}
      {!trades ? (
        <div className="glass-card-static p-8 text-center animate-fade-in-up stagger-1">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>Upload Trade Data First</h3>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
            We need your trade history to analyze
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <label className="glow-btn cursor-pointer" id="signal-upload-btn">
              Upload CSV, Excel, or Image
              <input type="file" accept=".csv,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.bmp,.gif" onChange={e => handleFile(e.target.files[0])} className="hidden" />
            </label>
            <button onClick={loadSample} className="px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-105"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
              id="signal-sample-btn">
              Use Sample Data
            </button>
          </div>
          {error && <p className="text-sm mt-4" style={{ color: 'var(--color-red)' }}>⚠️ {error}</p>}
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center gap-2">
            <span className="badge badge-green">✓ {trades.length} trades loaded</span>
            {dataStats && (!dataStats.hasVolume || !dataStats.hasDuration) && (
              <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--color-yellow)' }}>
                ⚠️ Missing {[!dataStats.hasVolume && 'Volume', !dataStats.hasDuration && 'Duration'].filter(Boolean).join(' & ')}
              </span>
            )}
            <button onClick={() => { setTrades(null); setResult(null); setAiResponse(null); setChatHistory([]); setDataStats(null); resetOcr() }}
              className="text-xs underline" style={{ color: 'var(--color-text-muted)' }}>
              Change data
            </button>
          </div>

          {/* Query input */}
          <div className="glass-card-static p-6 mb-6 animate-fade-in-up stagger-1">
            <label className="text-sm font-semibold block mb-3" style={{ color: 'var(--color-text-primary)' }}>
              Ask anything about your trading data
            </label>
            <div className="flex gap-3">
              <input
                id="signal-query-input"
                type="text"
                className="input-field flex-1"
                placeholder="e.g., What are my biggest weaknesses? How can I improve my win rate?"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runTest()}
              />
              <button onClick={runTest} disabled={loading || !query.trim()} className="glow-btn whitespace-nowrap" id="signal-test-btn">
                {loading ? '⏳ Analyzing...' : '🤖 Ask AI'}
              </button>
            </div>

            {/* Example queries */}
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                'Do I win more on Mondays?',
                'What time of day should I trade?',
                'What are my biggest weaknesses?',
                'How can I improve my strategy?',
                ...(dataStats?.hasVolume ? ['Does high volume affect my win rate?'] : []),
                ...(dataStats?.hasDuration ? ['Do quick trades perform better?'] : []),
                'Am I overtrading?',
                'What\'s my risk management like?',
              ].map(example => (
                <button
                  key={example}
                  onClick={() => { setQuery(example) }}
                  className="text-xs px-3 py-1.5 rounded-full transition-all hover:scale-105"
                  style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--color-accent-light)', border: '1px solid rgba(99,102,241,0.2)' }}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* Chat History */}
          {chatHistory.length > 0 && (
            <div className="space-y-4 mb-6">
              {chatHistory.map((entry, idx) => (
                <div key={idx} className="animate-fade-in">
                  {/* User query */}
                  <div className="flex justify-end mb-3">
                    <div className="px-4 py-2.5 rounded-2xl rounded-br-sm text-sm max-w-[80%]"
                      style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--color-accent-light)', border: '1px solid rgba(99,102,241,0.2)' }}>
                      {entry.query}
                    </div>
                  </div>

                  {/* AI/Signal response */}
                  <div className="flex justify-start">
                    <div className="glass-card-static p-5 max-w-[95%]" style={{ borderLeft: '3px solid var(--color-accent)' }}>
                      {entry.type === 'ai' ? (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--color-accent-light)' }}>
                              🤖 Gemini AI
                            </span>
                            <button onClick={() => navigator.clipboard.writeText(entry.answer)}
                              className="text-xs opacity-50 hover:opacity-100 transition-opacity"
                              style={{ color: 'var(--color-text-primary)' }} title="Copy analysis">📋 Copy</button>
                          </div>
                          <div className="text-sm">{renderMarkdown(entry.answer)}</div>
                        </div>
                      ) : entry.type === 'signal' && entry.result.type === 'comparison' ? (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--color-green)' }}>
                              🔬 Signal Analysis
                            </span>
                            <button onClick={() => navigator.clipboard.writeText(`Signal Result: ${entry.result.verdict}\nConfidence: ${entry.result.confidence}\n${entry.result.groupA.label}: ${entry.result.groupA.winRate.toFixed(1)}% Win Rate\n${entry.result.groupB.label}: ${entry.result.groupB.winRate.toFixed(1)}% Win Rate`)}
                              className="text-xs opacity-50 hover:opacity-100 transition-opacity"
                              style={{ color: 'var(--color-text-primary)' }} title="Copy result">📋 Copy</button>
                          </div>
                          <div className="flex items-start gap-3 mb-3">
                            <span className="text-2xl">
                              {entry.result.verdict.startsWith('YES') ? '✅' : entry.result.verdict.startsWith('MAYBE') ? '🤔' : '❌'}
                            </span>
                            <div>
                              <h3 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                {entry.result.verdict}
                              </h3>
                              <span className="text-sm" style={{ color: confidenceColors[entry.result.confidence] }}>
                                Confidence: {entry.result.confidence}
                              </span>
                              <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>
                                (p-value: {entry.result.pValue.toFixed(4)})
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {[entry.result.groupA, entry.result.groupB].map((group, i) => (
                              <div key={i} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>{group.label}</p>
                                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                  {group.trades} trades •
                                  <span className="font-bold" style={{ color: group.winRate >= 50 ? 'var(--color-green)' : 'var(--color-red)' }}>
                                    {' '}{group.winRate.toFixed(1)}% WR
                                  </span>
                                  {' '}•
                                  <span style={{ color: group.avgPnl >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                                    {' '}${group.avgPnl.toFixed(2)}/trade
                                  </span>
                                </p>
                                <div className="mt-2 h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                  <div className="h-full rounded-full transition-all duration-1000" style={{
                                    width: `${Math.min(100, Math.max(0, group.winRate))}%`,
                                    background: group.winRate >= 50 ? 'var(--color-green)' : 'var(--color-red)'
                                  }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : entry.type === 'signal' && entry.result.type === 'categorical' ? (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--color-green)' }}>
                              🔬 Signal Analysis
                            </span>
                            <button onClick={() => navigator.clipboard.writeText(`${entry.result.label} Breakdown: \n${Object.entries(entry.result.results).map(([k, v]) => `${k}: ${v.winRate.toFixed(1)}% WR`).join('\n')}`)}
                              className="text-xs opacity-50 hover:opacity-100 transition-opacity"
                              style={{ color: 'var(--color-text-primary)' }} title="Copy result">📋 Copy</button>
                          </div>
                          <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>{entry.result.label} Breakdown</h4>
                          <div className="space-y-2">
                            {Object.entries(entry.result.results).map(([key, data]) => (
                              <div key={key} className="flex justify-between text-sm p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <span style={{ color: 'var(--color-text-primary)' }}>{key} <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>({data.trades})</span></span>
                                <span>
                                  <span className="font-bold" style={{ color: data.winRate >= 50 ? 'var(--color-green)' : 'var(--color-red)' }}>
                                    {data.winRate.toFixed(1)}%
                                  </span>
                                  <span className="ml-2 text-xs" style={{ color: data.avgPnl >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                                    ${data.avgPnl.toFixed(2)}
                                  </span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="glass-card-static p-6 text-center mb-6 animate-fade-in">
              <div className="flex items-center justify-center gap-3">
                <div className="spinner" />
                <p style={{ color: 'var(--color-text-muted)' }}>
                  🤖 AI is analyzing your trade data...
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 rounded-xl mb-6 animate-fade-in"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <p className="text-sm" style={{ color: 'var(--color-red-light)' }}>⚠️ {error}</p>
            </div>
          )}

          <div ref={chatEndRef} />
        </>
      )}
    </div>
  )
}
