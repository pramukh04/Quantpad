import { useState, useCallback, useMemo } from 'react'
import Papa from 'papaparse'
import { Line, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { parseTrades, getFullAnalysis } from '../utils/tradeAnalytics'
import { extractTradesFromImage } from '../utils/ocrParser'
import { extractTradesFromExcel } from '../utils/excelParser'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler)

const fmt = (n, decimals = 2) => {
  if (n === Infinity) return '∞'
  if (typeof n !== 'number' || isNaN(n)) return '—'
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

const fmtCurrency = (n) => {
  if (typeof n !== 'number' || isNaN(n)) return '—'
  return (n >= 0 ? '+₹' : '-₹') + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

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

export default function BacktestAnalyzer() {
  const [trades, setTrades] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  // OCR-specific state
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrPreview, setOcrPreview] = useState(null) // { rows, headers, rawText, ... }
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null)

  const handleCsvFile = useCallback((file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsed = parseTrades(results.data)
          if (parsed.length < 3) {
            setError('Need at least 3 valid trades. Make sure your CSV has columns: date, type, price, quantity, pnl')
            return
          }
          setTrades(parsed)
          setAnalysis(getFullAnalysis(parsed))
        } catch (e) {
          setError('Failed to parse CSV: ' + e.message)
        }
      },
      error: (err) => setError('CSV parsing error: ' + err.message),
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
        setError('No trade data could be extracted from the image. Try a clearer screenshot of a table with columns: date, type, price, quantity, pnl')
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
      if (parsed.length < 3) {
        setError('Only ' + parsed.length + ' valid trades extracted. Need at least 3. Try a clearer image.')
        return
      }
      setTrades(parsed)
      setAnalysis(getFullAnalysis(parsed))
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
      // Try to auto-scroll down to see new row
      setTimeout(() => {
        const tableContainer = document.getElementById('ocr-preview-container')
        if (tableContainer) tableContainer.scrollTop = tableContainer.scrollHeight
      }, 50)
      return { ...prev, rows: newRows, dataRowsExtracted: newRows.length }
    })
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }, [handleFile])

  const handleFileInput = useCallback((e) => {
    handleFile(e.target.files[0])
  }, [handleFile])

  const loadSampleData = useCallback(() => {
    const sampleTrades = []
    const startDate = new Date('2024-01-02')
    const types = ['BUY', 'SELL']

    for (let i = 0; i < 200; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + Math.floor(i / 3))
      date.setHours(9 + Math.floor(Math.random() * 7), Math.floor(Math.random() * 60))

      const isWin = Math.random() < 0.55
      const pnl = isWin
        ? 50 + Math.random() * 300
        : -(30 + Math.random() * 200)

      sampleTrades.push({
        date: date.toISOString(),
        type: types[Math.floor(Math.random() * 2)],
        price: (100 + Math.random() * 50).toFixed(2),
        quantity: (1 + Math.floor(Math.random() * 10)).toString(),
        pnl: pnl.toFixed(2),
        volume: (100000 + Math.random() * 500000).toFixed(0),
      })
    }

    const parsed = parseTrades(sampleTrades)
    setTrades(parsed)
    setAnalysis(getFullAnalysis(parsed))
    setError(null)
  }, [])

  // Chart configs
  const pnlChartData = useMemo(() => {
    if (!analysis) return null
    return {
      labels: analysis.pnlCurve.map((_, i) => i + 1),
      datasets: [{
        label: 'Cumulative PnL',
        data: analysis.pnlCurve.map(p => p.value),
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      }]
    }
  }, [analysis])

  const monteCarloData = useMemo(() => {
    if (!analysis) return null
    const mc = analysis.monteCarlo
    return {
      labels: Array.from({ length: trades.length }, (_, i) => i + 1),
      datasets: mc.simulations.slice(0, 20).map((sim, i) => ({
        label: i === 0 ? 'Simulated Paths' : '',
        data: sim.curve,
        borderColor: `hsla(${220 + i * 7}, 70%, 60%, 0.2)`,
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.1,
      })).concat([{
        label: 'Actual',
        data: analysis.pnlCurve.map(p => p.value),
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 3,
        pointRadius: 0,
        tension: 0.3,
      }])
    }
  }, [analysis, trades])

  const conditionsBarData = useMemo(() => {
    if (!analysis) return null
    const byDay = analysis.conditions.byDay
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    const validDays = days.filter(d => byDay[d])
    return {
      labels: validDays,
      datasets: [{
        label: 'Win Rate %',
        data: validDays.map(d => ((byDay[d].wins / byDay[d].trades) * 100)),
        backgroundColor: validDays.map(d =>
          (byDay[d].wins / byDay[d].trades) >= 0.5
            ? 'rgba(16, 185, 129, 0.6)'
            : 'rgba(239, 68, 68, 0.6)'
        ),
        borderRadius: 8,
      }]
    }
  }, [analysis])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        borderColor: 'rgba(99,102,241,0.3)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
      },
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#64748b', font: { family: 'Inter' } } },
      y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#64748b', font: { family: 'Inter' } } },
    }
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

          {/* Progress bar */}
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
            {ocrPreview.dataRowsExtracted} trade rows extracted from image • Review and confirm
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
                        {h}
                        {['date', 'type', 'price', 'quantity', 'pnl'].includes(h) && ' ✓'}
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
                            title="Click to edit"
                            style={{
                              background: 'transparent',
                              border: '1px solid transparent',
                              color: h === 'pnl'
                                ? (parseFloat(row[h]) >= 0 ? 'var(--color-green)' : 'var(--color-red)')
                                : 'var(--color-text-secondary)',
                              width: '100%',
                              minWidth: '60px',
                              outline: 'none',
                              padding: '4px',
                              borderRadius: '4px',
                              transition: 'all 0.2s',
                            }}
                            onFocus={(e) => {
                              e.target.style.background = 'rgba(255,255,255,0.05)'
                              e.target.style.border = '1px solid var(--color-border)'
                            }}
                            onBlur={(e) => {
                              e.target.style.background = 'transparent'
                              e.target.style.border = '1px solid transparent'
                            }}
                          />
                        </td>
                      ))}
                      <td style={{ ...tdStyle, textAlign: 'center', padding: '4px' }}>
                        <button
                          onClick={() => handleOcrRowDelete(i)}
                          title="Delete Row"
                          className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-red-500/20"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 mb-2 flex justify-center">
                <button
                  onClick={handleOcrRowAdd}
                  className="px-4 py-1.5 text-xs font-medium rounded hover:bg-white/5 transition-colors"
                  style={{ border: '1px dashed var(--color-border)', color: 'var(--color-text-secondary)' }}
                >
                  + Add Row
                </button>
              </div>

              {ocrPreview.rows.length > 50 && (
                <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                  Showing first 50 of {ocrPreview.rows.length} rows
                </p>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl animate-fade-in"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <p className="text-sm" style={{ color: 'var(--color-red-light)' }}>⚠️ {error}</p>
          </div>
        )}

        <div className="flex gap-4 justify-center animate-fade-in-up stagger-2">
          <button onClick={resetOcr}
            className="px-6 py-3 rounded-xl text-sm font-medium transition-all hover:scale-105"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
            ← Try Another Image
          </button>
          <button onClick={confirmOcrData} className="glow-btn" id="confirm-ocr-btn">
            ✓ Looks Good — Analyze {ocrPreview.dataRowsExtracted} Trades
          </button>
        </div>

        <div className="mt-6 glass-card-static p-4 animate-fade-in-up stagger-3">
          <details>
            <summary className="text-sm font-medium cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
              🔍 View Raw OCR Text
            </summary>
            <pre className="mt-3 text-xs p-4 rounded-lg overflow-auto"
              style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--color-text-secondary)', maxHeight: '200px', whiteSpace: 'pre-wrap' }}>
              {ocrPreview.rawText}
            </pre>
          </details>
        </div>
      </div>
    )
  }

  // === Upload Screen ===
  if (!analysis) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-3xl md:text-4xl font-serif tracking-tight mb-2">
            <span className="gradient-text">Backtest Analyzer</span>
          </h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Upload your trade history and get instant deep analysis
          </p>
        </div>

        <div
          className={`upload-zone animate-fade-in-up stagger-1 ${dragOver ? 'drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('csv-input').click()}
          id="upload-zone"
        >
          <div className="text-5xl mb-4">📁</div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Drop your trade file here
          </h3>
          <p className="text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>
            or click to browse
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--color-accent-light)', border: '1px solid rgba(99,102,241,0.2)' }}>
              📄 CSV / Excel File
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--color-green)', border: '1px solid rgba(16,185,129,0.2)' }}>
              🖼️ Screenshot (OCR)
            </span>
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>
            CSV/Excel: columns date, type, price, quantity, pnl • Image: screenshot of a trade results table
          </p>
          <input
            id="csv-input"
            type="file"
            accept=".csv,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.bmp,.gif"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>

        {error && (
          <div className="mt-4 p-4 rounded-xl animate-fade-in"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <p className="text-sm" style={{ color: 'var(--color-red-light)' }}>⚠️ {error}</p>
          </div>
        )}

        <div className="mt-6 text-center animate-fade-in-up stagger-2">
          <button onClick={loadSampleData} className="glow-btn" id="load-sample-btn">
            Load Sample Data (200 trades)
          </button>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'pnl', label: '📈 PnL Curve' },
    { id: 'montecarlo', label: '🎲 Monte Carlo' },
    { id: 'conditions', label: '⏰ Conditions' },
  ]

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8 animate-fade-in-up">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif tracking-tight mb-1">
            <span className="gradient-text">Backtest Results</span>
          </h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            {analysis.totalTrades} trades analyzed
          </p>
        </div>
        <button
          onClick={() => { setTrades(null); setAnalysis(null); resetOcr() }}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          Upload New
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {[
          { label: 'Win Rate', value: `${fmt(analysis.winRate, 1)}%`, color: analysis.winRate >= 50 ? 'var(--color-green)' : 'var(--color-red)' },
          { label: 'Total PnL', value: fmtCurrency(analysis.totalPnL), color: analysis.totalPnL >= 0 ? 'var(--color-green)' : 'var(--color-red)' },
          { label: 'Profit Factor', value: fmt(analysis.profitFactor), color: analysis.profitFactor >= 1.5 ? 'var(--color-green)' : analysis.profitFactor >= 1 ? 'var(--color-yellow)' : 'var(--color-red)' },
          { label: 'Sharpe Ratio', value: fmt(analysis.sharpeRatio), color: analysis.sharpeRatio >= 1 ? 'var(--color-green)' : 'var(--color-yellow)' },
          { label: 'Max Drawdown', value: `₹${fmt(analysis.maxDrawdown, 0)}`, color: 'var(--color-red)' },
          { label: 'Avg Win/Loss', value: `${fmt(analysis.avgWin, 0)} / ${fmt(analysis.avgLoss, 0)}`, color: 'var(--color-text-secondary)' },
        ].map((stat, i) => (
          <div key={stat.label} className={`stat-card animate-fade-in-up stagger-${i + 1}`}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>{stat.label}</p>
            <p className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all"
            style={{
              background: activeTab === tab.id ? 'rgba(99,102,241,0.15)' : 'transparent',
              border: activeTab === tab.id ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
              color: activeTab === tab.id ? 'var(--color-accent-light)' : 'var(--color-text-muted)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="animate-fade-in">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card-static p-6">
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Trade Distribution</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: 'var(--color-green)' }}>Winners ({analysis.winCount})</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>{fmt(analysis.winRate, 1)}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${analysis.winRate}%`, background: 'var(--color-green)' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: 'var(--color-red)' }}>Losers ({analysis.lossCount})</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>{fmt(100 - analysis.winRate, 1)}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${100 - analysis.winRate}%`, background: 'var(--color-red)' }} />
                  </div>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p style={{ color: 'var(--color-text-muted)' }}>Avg Win</p>
                  <p className="font-bold" style={{ color: 'var(--color-green)' }}>{fmtCurrency(analysis.avgWin)}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--color-text-muted)' }}>Avg Loss</p>
                  <p className="font-bold" style={{ color: 'var(--color-red)' }}>{fmtCurrency(analysis.avgLoss)}</p>
                </div>
              </div>
            </div>
            <div className="glass-card-static p-6">
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Risk Metrics</h3>
              <div className="space-y-3 text-sm">
                {[
                  { label: 'Sharpe Ratio', value: fmt(analysis.sharpeRatio), good: analysis.sharpeRatio >= 1 },
                  { label: 'Profit Factor', value: fmt(analysis.profitFactor), good: analysis.profitFactor >= 1.5 },
                  { label: 'Max Drawdown', value: `₹${fmt(analysis.maxDrawdown, 0)} (${fmt(analysis.maxDrawdownPct, 1)}%)`, good: false },
                  { label: 'Max Win Streak', value: analysis.conditions.maxWinStreak, good: true },
                  { label: 'Max Loss Streak', value: analysis.conditions.maxLossStreak, good: false },
                  { label: 'Risk:Reward', value: analysis.avgLoss !== 0 ? fmt(Math.abs(analysis.avgWin / analysis.avgLoss)) + ':1' : '—', good: Math.abs(analysis.avgWin / analysis.avgLoss) >= 1.5 },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center">
                    <span style={{ color: 'var(--color-text-secondary)' }}>{item.label}</span>
                    <span className="font-semibold" style={{ color: item.good ? 'var(--color-green)' : 'var(--color-text-primary)' }}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pnl' && pnlChartData && (
          <div className="glass-card-static p-6">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Cumulative PnL Curve</h3>
            <div className="chart-container">
              <Line data={pnlChartData} options={chartOptions} />
            </div>
          </div>
        )}

        {activeTab === 'montecarlo' && monteCarloData && (
          <div>
            <div className="glass-card-static p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Monte Carlo Simulation (1,000 paths)</h3>
              <div className="chart-container" style={{ height: '400px' }}>
                <Line data={monteCarloData} options={{
                  ...chartOptions,
                  plugins: { ...chartOptions.plugins, legend: { display: false } }
                }} />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Profitable Paths', value: `${fmt(analysis.monteCarlo.profitablePct, 1)}%`, color: analysis.monteCarlo.profitablePct >= 50 ? 'var(--color-green)' : 'var(--color-red)' },
                { label: 'Median Outcome', value: fmtCurrency(analysis.monteCarlo.percentiles.p50), color: analysis.monteCarlo.percentiles.p50 >= 0 ? 'var(--color-green)' : 'var(--color-red)' },
                { label: 'Worst 5%', value: fmtCurrency(analysis.monteCarlo.percentiles.p5), color: 'var(--color-red)' },
                { label: 'Best 5%', value: fmtCurrency(analysis.monteCarlo.percentiles.p95), color: 'var(--color-green)' },
              ].map(stat => (
                <div key={stat.label} className="stat-card">
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>{stat.label}</p>
                  <p className="text-lg font-bold" style={{ color: stat.color }}>{stat.value}</p>
                </div>
              ))}
            </div>
            <div className="glass-card-static p-6 mt-6">
              <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>What does this mean?</h4>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                {analysis.monteCarlo.profitablePct >= 70
                  ? '✅ Your strategy shows a robust edge. Over 70% of randomized simulations are profitable, suggesting your results aren\'t due to luck.'
                  : analysis.monteCarlo.profitablePct >= 50
                    ? '⚠️ Your strategy shows a slight edge, but there\'s meaningful variance. Consider a larger sample size or tighter risk management.'
                    : '❌ The Monte Carlo results suggest your profits may be largely due to lucky ordering of trades. Exercise caution.'}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'conditions' && conditionsBarData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card-static p-6">
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Win Rate by Day</h3>
              <div className="chart-container" style={{ height: '300px' }}>
                <Bar data={conditionsBarData} options={{
                  ...chartOptions,
                  plugins: { ...chartOptions.plugins, legend: { display: false } }
                }} />
              </div>
            </div>
            <div className="glass-card-static p-6">
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Performance by Direction</h3>
              <div className="space-y-4">
                {Object.entries(analysis.conditions.byType).map(([type, data]) => (
                  <div key={type} className="flex items-center justify-between p-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div>
                      <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{type}</span>
                      <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>({data.trades} trades)</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold" style={{ color: (data.wins / data.trades) >= 0.5 ? 'var(--color-green)' : 'var(--color-red)' }}>
                        {fmt((data.wins / data.trades) * 100, 1)}%
                      </span>
                      <span className="text-xs ml-2" style={{ color: data.totalPnl >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                        {fmtCurrency(data.totalPnl)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card-static p-6 md:col-span-2">
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Performance by Size</h3>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(analysis.conditions.bySize).map(([size, data]) => (
                  <div key={size} className="text-center p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <p className="font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>{size}</p>
                    <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>{data.trades} trades</p>
                    <p className="text-lg font-bold" style={{ color: (data.wins / Math.max(data.trades, 1)) >= 0.5 ? 'var(--color-green)' : 'var(--color-red)' }}>
                      {data.trades > 0 ? fmt((data.wins / data.trades) * 100, 1) : 0}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Table styles for OCR preview
const thStyle = {
  padding: '8px 12px',
  textAlign: 'left',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  color: 'var(--color-text-muted)',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  background: 'var(--color-bg-card)',
}

const tdStyle = {
  padding: '6px 12px',
  whiteSpace: 'nowrap',
  color: 'var(--color-text-secondary)',
}
