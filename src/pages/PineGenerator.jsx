import { useState, useCallback, useMemo } from 'react'
import { generatePineScriptWithGemini, optimizePineScriptWithGemini } from '../utils/geminiClient'
import { parseStrategy } from '../utils/pineTemplates'

// --- Visualization Components ---

const IndicatorCard = ({ indicator }) => (
  <div className="glass-card-static p-4 flex flex-col h-full border border-white/5 transition-all hover:border-accent/30">
    <div className="flex justify-between items-start mb-2">
      <span className="text-xs font-bold uppercase tracking-wider text-accent-light bg-accent/10 px-2 py-0.5 rounded">
        {indicator.indicator.category}
      </span>
      <span className="text-[10px] text-text-muted font-mono">
        {indicator.numbers[0] ? `P:${indicator.numbers[0]}` : 'Default'}
      </span>
    </div>
    <h4 className="text-sm font-bold mb-1 text-text-primary">{indicator.indicator.name}</h4>
    <p className="text-[11px] text-text-muted mb-3 italic">{indicator.indicator.role}</p>
    <p className="text-xs text-text-secondary leading-relaxed flex-grow">
      {indicator.indicator.description}
    </p>
  </div>
)

const ConditionTree = ({ parsed }) => {
  if (!parsed || parsed.indicators.length === 0) return null

  return (
    <div className="glass-card-static p-6 mt-6">
      <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        Strategy Logic Flow
      </h4>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="badge badge-green">LONG ENTRY</span>
            <span className="text-xs text-text-muted">when ALL conditions met</span>
          </div>
          <div className="pl-4 border-l-2 border-green-500/30 space-y-3">
            {parsed.indicators.map((ind, i) => (
              <div key={i} className="relative flex items-center gap-3">
                <div className="absolute -left-4 w-4 h-[2px] bg-green-500/30" />
                <div className="p-2 rounded bg-green-500/5 border border-green-500/10 text-xs">
                  <span className="font-bold text-green-400 mr-2">{ind.indicator.name}</span>
                  <span className="text-text-secondary">
                    {ind.conditionKey || 'default signal'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
           <div className="flex items-center gap-2 mb-3">
            <span className="badge badge-red">SHORT / EXIT</span>
            <span className="text-xs text-text-muted">logic reversal</span>
          </div>
          <div className="pl-4 border-l-2 border-red-500/30">
            <div className="relative flex items-center gap-3">
              <div className="absolute -left-4 w-4 h-[2px] bg-red-500/30" />
              <div className="p-2 rounded bg-red-500/5 border border-red-500/10 text-xs text-text-secondary italic">
                Reverses the primary entry condition for exit/short
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const StrategySnapshot = ({ parsed }) => {
  const complexity = useMemo(() => {
    const count = parsed.indicators.length
    if (count <= 1) return { label: 'Basic', color: 'var(--color-green-light)', stars: '⭐' }
    if (count <= 3) return { label: 'Moderate', color: 'var(--color-yellow)', stars: '⭐⭐' }
    return { label: 'Complex', color: 'var(--color-accent-light)', stars: '⭐⭐⭐' }
  }, [parsed])

  const type = useMemo(() => {
    const cats = parsed.indicators.map(i => i.indicator.category)
    if (cats.some(c => c.includes('SMC'))) return 'Smart Money Concept'
    if (cats.some(c => c.includes('Trend')) && cats.some(c => c.includes('Momentum'))) return 'Momentum Trend'
    if (cats.some(c => c.includes('Trend'))) return 'Trend Following'
    if (cats.some(c => c.includes('Volatility'))) return 'Volatility Mean Reversion'
    return 'Technical Indicator'
  }, [parsed])

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {[
        { label: 'Complexity', value: complexity.label, sub: complexity.stars, color: complexity.color },
        { label: 'Total Indicators', value: parsed.indicators.length, sub: 'Active nodes', color: 'var(--color-accent-light)' },
        { label: 'Primary Style', value: type, sub: 'Execution logical base', color: 'var(--color-cyan)', full: true },
        { label: 'Timeframe', value: 'Any', sub: 'Optimized for current', color: 'var(--color-purple)' },
      ].map((stat, i) => (
        <div key={i} className={`glass-card-static p-4 border border-white/5 ${stat.full ? 'col-span-2' : ''}`}>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">{stat.label}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-lg font-bold" style={{ color: stat.color }}>{stat.value}</p>
            <p className="text-[10px] text-text-muted">{stat.sub}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

const VolatilityGauge = ({ parsed }) => {
  const score = useMemo(() => {
    let s = 20 // base
    parsed.indicators.forEach(ind => {
      const cat = ind.indicator.category.toLowerCase()
      if (cat.includes('volatility')) s += 30
      if (cat.includes(' momentum')) s += 10
      if (cat.includes('smc')) s += 15
    })
    return Math.min(s, 100)
  }, [parsed])

  const getLabel = (s) => {
    if (s < 40) return { text: 'Low Volatility Sensitivity', color: 'var(--color-green-light)', tip: 'Stable markets prefered' }
    if (s < 70) return { text: 'Moderate Range', color: 'var(--color-yellow)', tip: 'Standard market conditions' }
    return { text: 'High Volatility Dependency', color: 'var(--color-accent-light)', tip: 'Requires high volume & move' }
  }

  const label = getLabel(score)

  return (
    <div className="glass-card-static p-6 mt-6">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-sm font-bold">Volatility Exposure</h4>
        <span className="text-xs font-mono" style={{ color: label.color }}>{score}%</span>
      </div>
      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden mb-3">
        <div 
          className="h-full transition-all duration-1000 ease-out rounded-full"
          style={{ 
            width: `${score}%`, 
            background: `linear-gradient(90, var(--color-green-light), ${label.color})`,
            backgroundColor: label.color 
          }}
        />
      </div>
      <div className="flex justify-between items-start">
        <p className="text-[11px] font-bold" style={{ color: label.color }}>{label.text}</p>
        <p className="text-[10px] text-text-muted max-w-[200px] text-right">💡 {label.tip}</p>
      </div>
    </div>
  )
}

const CategoryDistribution = ({ parsed }) => {
  const distribution = useMemo(() => {
    const counts = {}
    parsed.indicators.forEach(ind => {
      const cat = ind.indicator.category.split('/')[0] // Take first category if multiple
      counts[cat] = (counts[cat] || 0) + 1
    })
    
    const total = parsed.indicators.length
    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
      percent: Math.round((count / total) * 100)
    })).sort((a, b) => b.count - a.count)
  }, [parsed])

  const colors = {
    'Trend': 'var(--color-cyan)',
    'Momentum': 'var(--color-purple)',
    'Volatility': 'var(--color-yellow)',
    'SMC': 'var(--color-green-light)',
    'Volume': 'var(--color-blue)',
    'Trend Strength': 'var(--color-accent-light)'
  }

  return (
    <div className="glass-card-static p-6 mt-6">
      <h4 className="text-sm font-bold mb-4">Indicator Distribution</h4>
      <div className="space-y-4">
        {distribution.map((item, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider">
              <span style={{ color: colors[item.name] || 'var(--color-text-secondary)' }}>{item.name}</span>
              <span className="text-text-muted">{item.percent}% ({item.count})</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{ 
                  width: `${item.percent}%`, 
                  backgroundColor: colors[item.name] || 'var(--color-accent-light)',
                  boxShadow: `0 0 10px ${colors[item.name] || 'var(--color-accent-light)'}40`
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PineGenerator() {
  const [activeTab, setActiveTab] = useState('create') // 'create' | 'optimize'
  const [description, setDescription] = useState('')
  const [optimizeCode, setOptimizeCode] = useState('')
  const [optimizeGoals, setOptimizeGoals] = useState('')
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [isFixing, setIsFixing] = useState(false)

  // Derived metadata from manual parsing for visualizations (only applies to generated, not optimized)
  const visualMeta = useMemo(() => {
    if (activeTab === 'optimize') return null
    if (!description || !result || result.error) return null
    try {
      return parseStrategy(description)
    } catch {
      return null
    }
  }, [activeTab, description, result])

  const generate = useCallback(async () => {
    if (!description.trim()) return
    setIsGenerating(true)
    setResult(null)
    setCopied(false)
    setErrorText('')
    try {
      const r = await generatePineScriptWithGemini(description)
      setResult({ ...r, error: false })
    } catch (err) {
      setResult({ error: true, code: `// Error generating script:\n// ${err.message}` })
    } finally {
      setIsGenerating(false)
    }
  }, [description])

  const optimize = useCallback(async () => {
    if (!optimizeCode.trim()) return
    setIsGenerating(true) // Reusing loading state
    setResult(null)
    setCopied(false)
    setErrorText('')
    try {
      const r = await optimizePineScriptWithGemini(optimizeCode, optimizeGoals)
      setResult({ ...r, error: false })
    } catch (err) {
      setResult({ error: true, code: `// Error optimizing script:\n// ${err.message}` })
    } finally {
      setIsGenerating(false)
    }
  }, [optimizeCode, optimizeGoals])

  const fixErrors = useCallback(async () => {
    if (!errorText.trim() || !result?.code) return
    setIsFixing(true)
    try {
      const fixPrompt = `The following Pine Script v6 strategy has errors. Fix ALL of the errors listed below and return the complete corrected script.\n\nERRORS FROM TRADINGVIEW:\n${errorText}\n\nCURRENT BROKEN CODE:\n${result.code}`
      const r = await generatePineScriptWithGemini(fixPrompt)
      setResult({ ...r, error: false })
      setErrorText('')
      setCopied(false)
    } catch (err) {
      setResult(prev => ({ ...prev, fixError: err.message }))
    } finally {
      setIsFixing(false)
    }
  }, [errorText, result])

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
    <div className="max-w-4xl mx-auto pb-20">
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-3xl md:text-4xl font-serif tracking-tight mb-2">
          <span className="gradient-text">Pine Script Generator</span>
        </h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Describe your strategy in plain English — get working TradingView code instantly
        </p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-4 mb-8 animate-fade-in-up">
        {['create', 'optimize'].map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setResult(null); }}
            className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
              activeTab === tab 
                ? 'bg-accent/20 text-accent-light border border-accent/40 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-text-secondary border border-transparent'
            }`}
          >
            {tab === 'create' ? '✨ Create Strategy' : '🔧 Optimize Existing'}
          </button>
        ))}
      </div>

      {activeTab === 'create' ? (
        <>
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
              'Buy on bullish liquidity sweep and RSI oversold',
              'Enter when bullish FVG is created and MACD crosses above',
              'Long when bullish Order Block is formed and ChoCh is bullish',
              'Buy when RSI crosses above 30 and MACD is bullish',
              'Sell when price crosses below EMA 200 and ADX shows strong trend',
              'Short when bearish liquidity sweep happens and Supertrend flips bearish',
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
            <button onClick={generate} disabled={!description.trim() || isGenerating} className="glow-btn" id="pine-generate-btn">
              {isGenerating ? '⏳ Generating AI Strategy...' : '🌲 Generate Pine Script'}
            </button>
          </div>
        </div>
        </>
      ) : (
        <>
        {/* Optimize Script input */}
        <div className="glass-card-static p-6 mb-6 animate-fade-in-up stagger-1">
          <label className="text-sm font-semibold block mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Paste existing Pine Script
          </label>
          <p className="text-xs text-text-muted mb-3">The AI will rewrite it to improve robustness and metrics.</p>
          <textarea
            className="input-field font-mono text-[11px] mb-4"
            placeholder='//@version=6&#10;strategy("My Strategy")...'
            value={optimizeCode}
            onChange={e => setOptimizeCode(e.target.value)}
            rows={8}
            style={{ minHeight: '150px' }}
          />
          
          <label className="text-sm font-semibold block mb-2" style={{ color: 'var(--color-accent-light)' }}>
            Optimization Goals (Optional)
          </label>
          <input
            type="text"
            className="input-field mb-5"
            placeholder='e.g., "Add ATR trailing stop and reduce drawdown"'
            value={optimizeGoals}
            onChange={e => setOptimizeGoals(e.target.value)}
          />

          <button onClick={optimize} disabled={!optimizeCode.trim() || isGenerating} className="glow-btn w-full justify-center">
            {isGenerating ? '⏳ Optimizing Strategy...' : '⚡ Optimize Script Performance'}
          </button>
        </div>
        </>
      )}

      {/* Generated code */}
      {result && (
        <div className="animate-fade-in-up">
          {result.error ? (
            <div className="glass-card-static p-6">
              <div className="code-block">
                <div className="code-block-header">
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Pine Script v6</span>
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
              {/* Insight Dashboard */}
              {visualMeta && visualMeta.indicators.length > 0 && (
                <div className="mb-10 animate-fade-in-up">
                  <h3 className="text-lg font-serif mb-4 gradient-text">Strategy Insights</h3>
                  
                  <StrategySnapshot parsed={visualMeta} />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {visualMeta.indicators.map((ind, i) => (
                      <IndicatorCard key={i} indicator={ind} />
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                      <ConditionTree parsed={visualMeta} />
                    </div>
                    <div className="space-y-6">
                      <VolatilityGauge parsed={visualMeta} />
                      <CategoryDistribution parsed={visualMeta} />
                    </div>
                  </div>
                </div>
              )}

              {/* Code block */}
              <div className="code-block">
                <div className="code-block-header">
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Pine Script v6</span>
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
                          : line.includes('strategy.') || line.includes('ta.') || line.includes('math.')
                            ? 'var(--color-cyan)'
                            : line.includes('plot') || line.includes('bgcolor') || line.includes('alert') || line.includes('hlines')
                              ? 'var(--color-purple)'
                              : line.includes('if ') || line.includes('else')
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
                    'Clear any default code and paste your generated script',
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

              {/* Error Fixer Panel */}
              <div className="glass-card-static p-6 mt-6" style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
                <h4 className="text-sm font-bold mb-1" style={{ color: 'var(--color-red-light)' }}>🔧 Got errors from TradingView?</h4>
                <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>Paste the error messages below and the AI will fix the script automatically.</p>
                <textarea
                  id="pine-error-input"
                  className="input-field"
                  placeholder={`e.g., "Undeclared identifier 'input'\nLine 7: strategy.entry() expected"`}
                  value={errorText}
                  onChange={e => setErrorText(e.target.value)}
                  rows={3}
                  style={{ minHeight: '80px', borderColor: errorText ? 'rgba(239,68,68,0.4)' : undefined }}
                />
                {result?.fixError && (
                  <p className="text-xs mt-2" style={{ color: 'var(--color-red-light)' }}>⚠ {result.fixError}</p>
                )}
                <div className="mt-3">
                  <button
                    onClick={fixErrors}
                    disabled={!errorText.trim() || isFixing}
                    id="pine-fix-btn"
                    className="text-sm px-4 py-2 rounded-lg font-semibold transition-all hover:scale-105 disabled:opacity-40"
                    style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--color-red-light)', border: '1px solid rgba(239,68,68,0.3)' }}
                  >
                    {isFixing ? '⏳ Fixing...' : '🔧 Fix Errors with AI'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
