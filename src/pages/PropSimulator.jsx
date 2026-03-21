import { useState, useCallback, useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { runPropFirmSim, CHALLENGE_PRESETS } from '../utils/propSimEngine'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const fmt = (n, d = 2) => typeof n === 'number' ? n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }) : n

export default function PropSimulator() {
  const [params, setParams] = useState({
    winRate: 55,
    avgWin: 200,
    avgLoss: 150,
    tradesPerDay: 3,
    accountSize: 100000,
    profitTarget: 10,
    maxDrawdown: 10,
    dailyDrawdown: 5,
    challengeDays: 30,
  })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const update = (key, value) => setParams(p => ({ ...p, [key]: parseFloat(value) || 0 }))

  const loadPreset = (preset) => {
    setParams(p => ({
      ...p,
      accountSize: preset.accountSize,
      profitTarget: preset.profitTarget,
      maxDrawdown: preset.maxDrawdown,
      dailyDrawdown: preset.dailyDrawdown,
      challengeDays: preset.challengeDays,
    }))
    setResult(null)
  }

  const runSim = useCallback(() => {
    setLoading(true)
    setTimeout(() => {
      const r = runPropFirmSim({
        ...params,
        winRate: params.winRate / 100,
      })
      setResult(r)
      setLoading(false)
    }, 500)
  }, [params])

  const pathChartData = useMemo(() => {
    if (!result || !result.samplePaths) return null
    return {
      labels: Array.from({ length: params.challengeDays + 1 }, (_, i) => `Day ${i}`),
      datasets: result.samplePaths.map((path, i) => ({
        label: i === 0 ? 'Sample Equity Paths' : '',
        data: path,
        borderColor: path[path.length - 1] >= params.accountSize + params.accountSize * params.profitTarget / 100
          ? `hsla(145, 65%, 50%, 0.35)`
          : `hsla(0, 65%, 55%, 0.25)`,
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.2,
      })).concat([{
        label: 'Target',
        data: Array(params.challengeDays + 1).fill(params.accountSize + params.accountSize * params.profitTarget / 100),
        borderColor: 'rgba(16, 185, 129, 0.5)',
        borderWidth: 2,
        borderDash: [8, 4],
        pointRadius: 0,
      }, {
        label: 'Max DD Limit',
        data: Array(params.challengeDays + 1).fill(params.accountSize - params.accountSize * params.maxDrawdown / 100),
        borderColor: 'rgba(239, 68, 68, 0.5)',
        borderWidth: 2,
        borderDash: [8, 4],
        pointRadius: 0,
      }])
    }
  }, [result, params])

  const chartOptions = {
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
          label: (ctx) => `₹${ctx.parsed.y.toLocaleString()}`
        }
      },
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#64748b', font: { family: 'Inter' } } },
      y: {
        grid: { color: 'rgba(255,255,255,0.03)' },
        ticks: { color: '#64748b', font: { family: 'Inter' }, callback: v => `₹${(v / 1000).toFixed(0)}K` }
      },
    }
  }

  const fields = [
    { key: 'winRate', label: 'Win Rate (%)', step: 1, min: 1, max: 99 },
    { key: 'avgWin', label: 'Avg Win ($)', step: 10, min: 1 },
    { key: 'avgLoss', label: 'Avg Loss ($)', step: 10, min: 1 },
    { key: 'tradesPerDay', label: 'Trades/Day', step: 1, min: 1, max: 50 },
    { key: 'accountSize', label: 'Account Size ($)', step: 1000, min: 1000 },
    { key: 'profitTarget', label: 'Profit Target (%)', step: 1, min: 1 },
    { key: 'maxDrawdown', label: 'Max Drawdown (%)', step: 1, min: 1 },
    { key: 'dailyDrawdown', label: 'Daily DD Limit (%)', step: 1, min: 1 },
    { key: 'challengeDays', label: 'Challenge Days', step: 1, min: 1 },
  ]

  const priorityStyles = {
    critical: { bg: 'rgba(239,68,68,0.1)', border: 'var(--color-red)', icon: '🚨' },
    high: { bg: 'rgba(245,158,11,0.1)', border: 'var(--color-yellow)', icon: '⚠️' },
    medium: { bg: 'rgba(99,102,241,0.1)', border: 'var(--color-accent)', icon: '💡' },
    info: { bg: 'rgba(6,182,212,0.1)', border: 'var(--color-cyan)', icon: 'ℹ️' },
    positive: { bg: 'rgba(16,185,129,0.1)', border: 'var(--color-green)', icon: '✅' },
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-3xl md:text-4xl font-serif tracking-tight mb-2">
          <span className="gradient-text">Prop Firm Simulator</span>
        </h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Simulate thousands of scenarios to see if your strategy would pass a funded account challenge
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input panel */}
        <div className="animate-fade-in-up stagger-1">
          {/* Presets */}
          <div className="glass-card-static p-4 mb-4">
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-text-muted)' }}>CHALLENGE PRESETS</p>
            <div className="grid grid-cols-2 gap-2">
              {CHALLENGE_PRESETS.map(preset => (
                <button key={preset.name} onClick={() => loadPreset(preset)}
                  className="text-xs p-2 rounded-lg transition-all hover:scale-105 text-left"
                  style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Parameters */}
          <div className="glass-card-static p-4">
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-text-muted)' }}>STRATEGY PARAMETERS</p>
            <div className="space-y-3">
              {fields.map(field => (
                <div key={field.key}>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                    {field.label}
                  </label>
                  <input
                    id={`prop-${field.key}`}
                    type="number"
                    className="input-field text-sm py-2"
                    value={params[field.key]}
                    onChange={e => update(field.key, e.target.value)}
                    step={field.step}
                    min={field.min}
                    max={field.max}
                  />
                </div>
              ))}
            </div>

            <button onClick={runSim} disabled={loading} className="glow-btn w-full mt-4" id="prop-run-btn">
              {loading ? '⏳ Simulating 10,000 paths...' : '🎯 Run Simulation'}
            </button>
          </div>
        </div>

        {/* Results panel */}
        <div className="lg:col-span-2">
          {loading && (
            <div className="text-center py-24">
              <div className="spinner mx-auto mb-4" />
              <p className="gradient-text font-semibold">Running 10,000 simulations...</p>
            </div>
          )}

          {result && !loading && (
            <div className="animate-fade-in-up">
              {/* Pass rate hero */}
              <div className="glass-card-static p-8 text-center mb-6" style={{
                background: result.passRate >= 70
                  ? 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.02))'
                  : result.passRate >= 50
                    ? 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.02))'
                    : 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.02))'
              }}>
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>PASS PROBABILITY</p>
                <p className="text-6xl font-extrabold mb-2" style={{
                  color: result.passRate >= 70 ? 'var(--color-green)' : result.passRate >= 50 ? 'var(--color-yellow)' : 'var(--color-red)'
                }}>
                  {fmt(result.passRate, 1)}%
                </p>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {result.passed.toLocaleString()} of {result.total.toLocaleString()} simulations passed
                </p>
              </div>

              {/* Breakdown stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Failed: Max DD', value: result.failedDrawdown.toLocaleString(), color: 'var(--color-red)' },
                  { label: 'Failed: Daily DD', value: result.failedDailyDD.toLocaleString(), color: 'var(--color-red-light)' },
                  { label: 'Failed: Target', value: result.failedTarget.toLocaleString(), color: 'var(--color-yellow)' },
                  { label: 'Avg Days to Pass', value: result.avgDaysToPass, color: 'var(--color-cyan)' },
                ].map(stat => (
                  <div key={stat.label} className="stat-card">
                    <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{stat.label}</p>
                    <p className="text-lg font-bold" style={{ color: stat.color }}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Equity paths chart */}
              {pathChartData && (
                <div className="glass-card-static p-6 mb-6">
                  <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                    Sample Equity Paths (30 simulations)
                  </h3>
                  <div className="chart-container" style={{ height: '350px' }}>
                    <Line data={pathChartData} options={chartOptions} />
                  </div>
                  <div className="flex gap-4 mt-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    <span><span className="inline-block w-3 h-0.5 mr-1 rounded" style={{ background: 'var(--color-green)' }} /> Target</span>
                    <span><span className="inline-block w-3 h-0.5 mr-1 rounded" style={{ background: 'var(--color-red)' }} /> Max DD Limit</span>
                    <span><span className="inline-block w-3 h-0.5 mr-1 rounded" style={{ background: 'rgba(16,185,129,0.5)' }} /> Passed</span>
                    <span><span className="inline-block w-3 h-0.5 mr-1 rounded" style={{ background: 'rgba(239,68,68,0.4)' }} /> Failed</span>
                  </div>
                </div>
              )}

              {/* Expected values */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="stat-card">
                  <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Expected ₹/Trade</p>
                  <p className="text-lg font-bold" style={{ color: result.expectedPnlPerTrade >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                    ${fmt(result.expectedPnlPerTrade)}
                  </p>
                </div>
                <div className="stat-card">
                  <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Expected ₹/Day</p>
                  <p className="text-lg font-bold" style={{ color: result.expectedDailyPnl >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                    ${fmt(result.expectedDailyPnl)}
                  </p>
                </div>
                <div className="stat-card">
                  <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Expected Total PnL</p>
                  <p className="text-lg font-bold" style={{ color: result.expectedTotalPnl >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                    ${fmt(result.expectedTotalPnl, 0)}
                  </p>
                </div>
              </div>

              {/* Suggestions */}
              {result.suggestions && result.suggestions.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>💡 Recommendations</h3>
                  {result.suggestions.map((s, i) => {
                    const style = priorityStyles[s.priority] || priorityStyles.info
                    return (
                      <div key={i} className="glass-card-static p-4 flex items-start gap-3"
                        style={{ borderLeft: `3px solid ${style.border}` }}>
                        <span className="text-lg">{style.icon}</span>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{s.text}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {!result && !loading && (
            <div className="glass-card-static p-12 text-center">
              <div className="text-5xl mb-4">🎯</div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Configure & Run
              </h3>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Set your strategy parameters and challenge rules, then hit "Run Simulation" to see your odds
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
