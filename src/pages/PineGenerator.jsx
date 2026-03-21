import { useState, useCallback } from 'react'
import { generatePineScript } from '../utils/pineTemplates'

export default function PineGenerator() {
  const [description, setDescription] = useState('')
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)

  const generate = useCallback(() => {
    if (!description.trim()) return
    const r = generatePineScript(description)
    setResult(r)
    setCopied(false)
  }, [description])

  const copyToClipboard = useCallback(() => {
    if (result?.code) {
      navigator.clipboard.writeText(result.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [result])

  const downloadScript = useCallback(() => {
    if (!result?.code) return
    const blob = new Blob([result.code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'quantpad_strategy.pine'
    a.click()
    URL.revokeObjectURL(url)
  }, [result])

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-3xl md:text-4xl font-serif tracking-tight mb-2">
          <span className="gradient-text">Pine Script Generator</span>
        </h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Describe your strategy in plain English — get working TradingView code instantly
        </p>
      </div>

      {/* Strategy description input */}
      <div className="glass-card-static p-6 mb-6 animate-fade-in-up stagger-1">
        <label className="text-sm font-semibold block mb-3" style={{ color: 'var(--color-text-primary)' }}>
          Describe your strategy
        </label>
        <textarea
          id="pine-description-input"
          className="input-field"
          placeholder='e.g., "Buy when RSI crosses above 30 and MACD is bullish, with ATR trailing stop"'
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={4}
          style={{ minHeight: '100px' }}
        />

        {/* Example buttons */}
        <div className="mt-4 flex flex-wrap gap-2" id="pine-examples">
          {[
            'Buy when RSI crosses above 30 and MACD is bullish',
            'Sell when price crosses below EMA 200 and ADX shows strong trend',
            'Enter long when Bollinger Bands squeeze and Stochastic is oversold',
            'Buy when EMA 9 crosses above EMA 21 and ATR is rising',
            'Short when RSI is overbought and Supertrend flips bearish',
            'Enter when VWAP crosses above and volume is high',
          ].map(example => (
            <button
              key={example}
              onClick={() => setDescription(example)}
              className="text-xs px-3 py-1.5 rounded-full transition-all hover:scale-105"
              style={{ background: 'rgba(16,185,129,0.08)', color: 'var(--color-green-light)', border: '1px solid rgba(16,185,129,0.2)' }}
            >
              {example.length > 40 ? example.slice(0, 40) + '...' : example}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <button onClick={generate} disabled={!description.trim()} className="glow-btn" id="pine-generate-btn">
            🌲 Generate Pine Script
          </button>
        </div>
      </div>

      {/* Generated code */}
      {result && (
        <div className="animate-fade-in-up">
          {result.error ? (
            <div className="glass-card-static p-6">
              <div className="code-block">
                <div className="code-block-header">
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Pine Script v5</span>
                </div>
                <div className="code-block-content" style={{ color: 'var(--color-text-secondary)' }}>
                  {result.code}
                </div>
              </div>
              {result.suggestions && (
                <div className="mt-4">
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>Try these examples:</p>
                  {result.suggestions.map(s => (
                    <button key={s} onClick={() => setDescription(s)} className="block text-sm mb-1.5 hover:underline text-left"
                      style={{ color: 'var(--color-accent-light)' }}>
                      → {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Detected indicators */}
              <div className="mb-4 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Detected:</span>
                {result.indicators.map(ind => (
                  <span key={ind} className="badge badge-green">{ind.toUpperCase()}</span>
                ))}
              </div>

              {/* Code block */}
              <div className="code-block">
                <div className="code-block-header">
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Pine Script v5</span>
                  <div className="flex items-center gap-2">
                    <button onClick={copyToClipboard}
                      className="text-xs px-3 py-1.5 rounded-lg transition-all hover:scale-105"
                      style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--color-accent-light)' }}
                      id="pine-copy-btn">
                      {copied ? '✓ Copied!' : '📋 Copy'}
                    </button>
                    <button onClick={downloadScript}
                      className="text-xs px-3 py-1.5 rounded-lg transition-all hover:scale-105"
                      style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--color-green-light)' }}
                      id="pine-download-btn">
                      ⬇ Download .pine
                    </button>
                  </div>
                </div>
                <div className="code-block-content">
                  {result.code.split('\n').map((line, i) => (
                    <div key={i} className="flex">
                      <span className="select-none w-8 text-right mr-4 shrink-0" style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                        {i + 1}
                      </span>
                      <span style={{
                        color: line.startsWith('//')
                          ? 'var(--color-text-muted)'
                          : line.includes('strategy.') || line.includes('ta.')
                            ? 'var(--color-cyan)'
                            : line.includes('plot') || line.includes('bgcolor') || line.includes('alertcondition')
                              ? 'var(--color-purple)'
                              : line.includes('if ')
                                ? 'var(--color-yellow)'
                                : line.includes('=')
                                  ? 'var(--color-accent-light)'
                                  : 'var(--color-text-primary)'
                      }}>
                        {line}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Instructions */}
              <div className="glass-card-static p-6 mt-6">
                <h4 className="text-sm font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>📌 How to use in TradingView</h4>
                <ol className="space-y-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {[
                    'Open TradingView and go to your chart',
                    'Click "Pine Editor" at the bottom of the screen',
                    'Clear the default code and paste your generated script',
                    'Click "Add to Chart" to apply the strategy',
                    'Open "Strategy Tester" tab to see backtest results',
                  ].map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--color-accent-light)' }}>
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
