import { useState, useCallback } from 'react'
import Papa from 'papaparse'
import { parseTrades } from '../utils/tradeAnalytics'
import { testSignal } from '../utils/signalEngine'

export default function SignalTester() {
  const [trades, setTrades] = useState(null)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleFile = useCallback((file) => {
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
        setError(null)
      }
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
    setError(null)
  }, [])

  const runTest = useCallback(() => {
    if (!query.trim() || !trades) return
    setLoading(true)
    setTimeout(() => {
      const r = testSignal(query, trades)
      setResult(r)
      setLoading(false)
    }, 500)
  }, [query, trades])

  const confidenceColors = {
    'Very High': 'var(--color-green)',
    'High': 'var(--color-green-light)',
    'Moderate': 'var(--color-yellow)',
    'Low': 'var(--color-red)',
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-3xl md:text-4xl font-serif tracking-tight mb-2">
          <span className="gradient-text">AI Signal Tester</span>
        </h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Describe a trading idea in plain English — AI tests if it actually works
        </p>
      </div>

      {/* Data upload */}
      {!trades ? (
        <div className="glass-card-static p-8 text-center animate-fade-in-up stagger-1">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>Upload Trade Data First</h3>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
            We need your trade history to test signals against
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <label className="glow-btn cursor-pointer" id="signal-upload-btn">
              Upload CSV
              <input type="file" accept=".csv" onChange={e => handleFile(e.target.files[0])} className="hidden" />
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
            <button onClick={() => { setTrades(null); setResult(null) }}
                    className="text-xs underline" style={{ color: 'var(--color-text-muted)' }}>
              Change data
            </button>
          </div>

          {/* Query input */}
          <div className="glass-card-static p-6 mb-6 animate-fade-in-up stagger-1">
            <label className="text-sm font-semibold block mb-3" style={{ color: 'var(--color-text-primary)' }}>
              Ask a question about your trading signals
            </label>
            <div className="flex gap-3">
              <input
                id="signal-query-input"
                type="text"
                className="input-field flex-1"
                placeholder="e.g., Does my strategy win more when volume is high?"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runTest()}
              />
              <button onClick={runTest} disabled={loading || !query.trim()} className="glow-btn whitespace-nowrap" id="signal-test-btn">
                {loading ? '⏳ Testing...' : '🔬 Test Signal'}
              </button>
            </div>

            {/* Example queries */}
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                'Do I win more on Mondays?',
                'Are morning trades more profitable?',
                'Does high volume predict wins?',
                'Do I perform better after a loss?',
                'Are my long trades better than shorts?',
              ].map(example => (
                <button
                  key={example}
                  onClick={() => { setQuery(example); setTimeout(runTest, 100) }}
                  className="text-xs px-3 py-1.5 rounded-full transition-all hover:scale-105"
                  style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--color-accent-light)', border: '1px solid rgba(99,102,241,0.2)' }}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          {loading && (
            <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p style={{ color: 'var(--color-text-muted)' }}>Analyzing signals...</p></div>
          )}

          {result && !loading && (
            <div className="animate-fade-in-up">
              {result.error ? (
                <div className="glass-card-static p-6">
                  <p className="text-sm mb-4" style={{ color: 'var(--color-red-light)' }}>⚠️ {result.error}</p>
                  {result.suggestions && (
                    <div>
                      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>Try these:</p>
                      {result.suggestions.map(s => (
                        <button key={s} onClick={() => setQuery(s)} className="block text-sm mb-1 hover:underline" style={{ color: 'var(--color-accent-light)' }}>
                          → {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : result.type === 'comparison' ? (
                <div>
                  {/* Verdict */}
                  <div className="glass-card-static p-6 mb-6">
                    <div className="flex items-start gap-4">
                      <div className="text-3xl">
                        {result.verdict.startsWith('YES') ? '✅' : result.verdict.startsWith('MAYBE') ? '🤔' : '❌'}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                          {result.verdict}
                        </h3>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Confidence:</span>
                          <span className="font-bold" style={{ color: confidenceColors[result.confidence] }}>
                            {result.confidence}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            (p-value: {result.pValue.toFixed(4)})
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Group comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {[result.groupA, result.groupB].map((group, i) => (
                      <div key={i} className="stat-card">
                        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                          {group.label}
                        </p>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p style={{ color: 'var(--color-text-muted)' }}>Trades</p>
                            <p className="font-bold" style={{ color: 'var(--color-text-primary)' }}>{group.trades}</p>
                          </div>
                          <div>
                            <p style={{ color: 'var(--color-text-muted)' }}>Win Rate</p>
                            <p className="font-bold" style={{ color: group.winRate >= 50 ? 'var(--color-green)' : 'var(--color-red)' }}>
                              {group.winRate.toFixed(1)}%
                            </p>
                          </div>
                          <div className="col-span-2">
                            <p style={{ color: 'var(--color-text-muted)' }}>Avg PnL</p>
                            <p className="font-bold" style={{ color: group.avgPnl >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                              ${group.avgPnl.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Related suggestions */}
                  {result.suggestions && result.suggestions.length > 0 && (
                    <div className="glass-card-static p-6">
                      <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>🔮 Related Patterns to Explore</h4>
                      <div className="flex flex-wrap gap-2">
                        {result.suggestions.map(s => (
                          <button key={s} onClick={() => { setQuery(s); setTimeout(() => { const r = testSignal(s, trades); setResult(r) }, 200) }}
                                  className="text-sm px-4 py-2 rounded-xl transition-all hover:scale-105"
                                  style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--color-accent-light)', border: '1px solid rgba(99,102,241,0.15)' }}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : result.type === 'categorical' ? (
                <div className="glass-card-static p-6">
                  <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                    {result.label} Breakdown
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(result.results).map(([key, data]) => (
                      <div key={key} className="flex items-center justify-between p-3 rounded-xl"
                           style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                          {key} <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>({data.trades} trades)</span>
                        </span>
                        <div className="flex items-center gap-4">
                          <span className="font-bold" style={{ color: data.winRate >= 50 ? 'var(--color-green)' : 'var(--color-red)' }}>
                            {data.winRate.toFixed(1)}% WR
                          </span>
                          <span className="text-sm" style={{ color: data.avgPnl >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                            ${data.avgPnl.toFixed(2)}/trade
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  )
}
