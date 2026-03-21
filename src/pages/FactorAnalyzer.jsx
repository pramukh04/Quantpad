import { useState, useCallback, useMemo } from 'react'
import Papa from 'papaparse'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend
} from 'chart.js'
import { parseTrades } from '../utils/tradeAnalytics'
import { analyzeFactors } from '../utils/factorEngine'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

export default function FactorAnalyzer() {
  const [trades, setTrades] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleFile = useCallback((file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = parseTrades(results.data)
        if (parsed.length < 10) {
          setError('Need at least 10 trades for factor analysis')
          return
        }
        setTrades(parsed)
        setError(null)
        runAnalysis(parsed)
      }
    })
  }, [])

  const loadSample = useCallback(() => {
    const sampleTrades = []
    const startDate = new Date('2024-01-02')
    for (let i = 0; i < 300; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + Math.floor(i / 4))
      date.setHours(9 + Math.floor(Math.random() * 7), Math.floor(Math.random() * 60))
      const isMorning = date.getHours() < 12
      const isMonday = date.getDay() === 1
      const qty = 1 + Math.floor(Math.random() * 20)
      const bigPosition = qty > 10
      const winBias = (isMorning ? 0.08 : 0) + (isMonday ? 0.06 : 0) + (bigPosition ? -0.05 : 0.03) + 0.48
      const isWin = Math.random() < winBias
      sampleTrades.push({
        date: date.toISOString(),
        type: Math.random() > 0.5 ? 'BUY' : 'SELL',
        price: (100 + Math.random() * 50).toFixed(2),
        quantity: qty.toString(),
        pnl: (isWin ? 50 + Math.random() * 300 : -(30 + Math.random() * 250)).toFixed(2),
        volume: (50000 + Math.random() * 500000).toFixed(0),
        duration: (5 + Math.random() * 120).toFixed(0),
      })
    }
    const parsed = parseTrades(sampleTrades)
    setTrades(parsed)
    setError(null)
    runAnalysis(parsed)
  }, [])

  const runAnalysis = useCallback((tradeData) => {
    setLoading(true)
    setTimeout(() => {
      const result = analyzeFactors(tradeData)
      setAnalysis(result)
      setLoading(false)
    }, 800)
  }, [])

  const chartData = useMemo(() => {
    if (!analysis || !analysis.factors) return null
    const top20 = analysis.factors.slice(0, 20)
    return {
      labels: top20.map(f => f.name.length > 25 ? f.name.slice(0, 25) + '...' : f.name),
      datasets: [{
        label: 'Correlation with Win/Loss',
        data: top20.map(f => f.correlation),
        backgroundColor: top20.map(f =>
          f.correlation > 0
            ? `rgba(16, 185, 129, ${0.3 + f.absCorrelation})`
            : `rgba(239, 68, 68, ${0.3 + f.absCorrelation})`
        ),
        borderRadius: 6,
      }]
    }
  }, [analysis])

  const chartOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        borderColor: 'rgba(99,102,241,0.3)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        callbacks: {
          label: (ctx) => `Correlation: ${ctx.parsed.x.toFixed(4)}`
        }
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.03)' },
        ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
        title: { display: true, text: 'Correlation with Win/Loss', color: '#64748b' },
      },
      y: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } },
      },
    }
  }

  const sigBadge = (sig) => {
    const map = {
      strong: { class: 'badge-green', label: 'STRONG' },
      moderate: { class: 'badge-yellow', label: 'MODERATE' },
      weak: { class: 'badge-accent', label: 'WEAK' },
      negligible: { class: 'badge-red', label: 'NEGLIGIBLE' },
    }
    const m = map[sig] || map.negligible
    return <span className={`badge ${m.class}`}>{m.label}</span>
  }

  if (!trades) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-3xl md:text-4xl font-serif tracking-tight mb-2">
            <span className="gradient-text">ML Factor Analyzer</span>
          </h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Machine learning finds hidden patterns in your trades that humans miss
          </p>
        </div>

        <div className="glass-card-static p-8 text-center animate-fade-in-up stagger-1">
          <div className="text-4xl mb-4">🧠</div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Upload Trade Data
          </h3>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
            We'll automatically test 50+ factors against your trade outcomes
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <label className="glow-btn cursor-pointer" id="factor-upload-btn">
              Upload CSV
              <input type="file" accept=".csv" onChange={e => handleFile(e.target.files[0])} className="hidden" />
            </label>
            <button onClick={loadSample}
              className="px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-105"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
              id="factor-sample-btn">
              Use Sample Data (300 trades)
            </button>
          </div>
          {error && <p className="text-sm mt-4" style={{ color: 'var(--color-red)' }}>⚠️ {error}</p>}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto text-center py-24">
        <div className="spinner mx-auto mb-4" />
        <p className="text-lg font-semibold gradient-text mb-2">Analyzing 50+ factors...</p>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Computing correlations, ranking importance, generating insights</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8 animate-fade-in-up">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif tracking-tight mb-1"><span className="gradient-text">Factor Analysis Results</span></h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            {analysis.factors.length} factors tested across {analysis.totalTrades} trades
          </p>
        </div>
        <button onClick={() => { setTrades(null); setAnalysis(null) }}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
          New Analysis
        </button>
      </div>

      {/* Actionable Insights */}
      {analysis.insights && analysis.insights.length > 0 && (
        <div className="mb-8 animate-fade-in-up stagger-1">
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>💡 Actionable Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis.insights.map((insight, i) => (
              <div key={i} className="glass-card-static p-5"
                style={{ borderLeft: `3px solid ${insight.actionable ? 'var(--color-green)' : 'var(--color-yellow)'}` }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{insight.factor}</span>
                  {sigBadge(insight.significance)}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  {insight.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature Importance Chart */}
      {chartData && (
        <div className="glass-card-static p-6 mb-8 animate-fade-in-up stagger-2">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            📊 Feature Importance (Top 20)
          </h2>
          <div style={{ height: `${Math.max(400, chartData.labels.length * 30)}px` }}>
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* Factor Table */}
      <div className="glass-card-static overflow-hidden animate-fade-in-up stagger-3">
        <div className="p-6 pb-3">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>All Factors Ranked</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th className="px-6 py-3 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Rank</th>
                <th className="px-6 py-3 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Factor</th>
                <th className="px-6 py-3 text-right font-semibold" style={{ color: 'var(--color-text-muted)' }}>Correlation</th>
                <th className="px-6 py-3 text-center font-semibold" style={{ color: 'var(--color-text-muted)' }}>Significance</th>
                <th className="px-6 py-3 text-right font-semibold" style={{ color: 'var(--color-text-muted)' }}>Win Avg</th>
                <th className="px-6 py-3 text-right font-semibold" style={{ color: 'var(--color-text-muted)' }}>Loss Avg</th>
              </tr>
            </thead>
            <tbody>
              {analysis.factors.slice(0, 30).map((factor, i) => (
                <tr key={factor.name} className="transition-colors hover:bg-white/[0.02]"
                  style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="px-6 py-3 font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>#{i + 1}</td>
                  <td className="px-6 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>{factor.name}</td>
                  <td className="px-6 py-3 text-right font-mono font-semibold"
                    style={{ color: factor.correlation > 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                    {factor.correlation > 0 ? '+' : ''}{factor.correlation.toFixed(4)}
                  </td>
                  <td className="px-6 py-3 text-center">{sigBadge(factor.significance)}</td>
                  <td className="px-6 py-3 text-right font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                    {factor.winAvg.toFixed(2)}
                  </td>
                  <td className="px-6 py-3 text-right font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                    {factor.lossAvg.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
