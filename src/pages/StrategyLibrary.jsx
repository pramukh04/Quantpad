import { useState, useMemo } from 'react'
import { strategies, categories, difficulties } from '../data/strategies'

export default function StrategyLibrary() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedDifficulty, setSelectedDifficulty] = useState('All')
  const [selectedStrategy, setSelectedStrategy] = useState(null)
  const [copied, setCopied] = useState(false)
  const [votes, setVotes] = useState(() => {
    const map = {}
    strategies.forEach(s => { map[s.id] = s.votes })
    return map
  })
  const [voted, setVoted] = useState({})

  const filtered = useMemo(() => {
    return strategies.filter(s => {
      if (search && !s.name.toLowerCase().includes(search.toLowerCase()) &&
        !s.description.toLowerCase().includes(search.toLowerCase()) &&
        !s.indicators.some(ind => ind.toLowerCase().includes(search.toLowerCase()))) return false
      if (selectedCategory !== 'All' && s.category !== selectedCategory) return false
      if (selectedDifficulty !== 'All' && s.difficulty !== selectedDifficulty) return false
      return true
    })
  }, [search, selectedCategory, selectedDifficulty])

  const handleVote = (id) => {
    if (voted[id]) return
    setVotes(v => ({ ...v, [id]: (v[id] || 0) + 1 }))
    setVoted(v => ({ ...v, [id]: true }))
  }

  const copyCode = (code) => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const difficultyColors = {
    Beginner: 'var(--color-green)',
    Intermediate: 'var(--color-yellow)',
    Advanced: 'var(--color-red)',
  }

  if (selectedStrategy) {
    const s = selectedStrategy
    return (
      <div className="max-w-4xl mx-auto">
        <button onClick={() => setSelectedStrategy(null)}
          className="mb-6 text-sm flex items-center gap-2 hover:underline animate-fade-in"
          style={{ color: 'var(--color-accent-light)' }}>
          ← Back to Library
        </button>

        <div className="animate-fade-in-up">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl md:text-4xl font-serif tracking-tight" style={{ color: 'var(--color-text-primary)' }}>{s.name}</h1>
                <span className="badge" style={{ background: `${difficultyColors[s.difficulty]}20`, color: difficultyColors[s.difficulty] }}>
                  {s.difficulty}
                </span>
              </div>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{s.description}</p>
            </div>
            <button onClick={() => handleVote(s.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all hover:scale-105"
              style={{
                background: voted[s.id] ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${voted[s.id] ? 'var(--color-accent)' : 'var(--color-border)'}`,
                color: voted[s.id] ? 'var(--color-accent-light)' : 'var(--color-text-secondary)',
              }}>
              <span>{voted[s.id] ? '▲' : '△'}</span>
              <span className="font-semibold">{votes[s.id]}</span>
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Win Rate', value: `${s.stats.winRate}%`, color: s.stats.winRate >= 50 ? 'var(--color-green)' : 'var(--color-red)' },
              { label: 'Profit Factor', value: s.stats.profitFactor.toFixed(1), color: s.stats.profitFactor >= 1.5 ? 'var(--color-green)' : 'var(--color-yellow)' },
              { label: 'Sharpe Ratio', value: s.stats.sharpe.toFixed(2), color: s.stats.sharpe >= 1 ? 'var(--color-green)' : 'var(--color-yellow)' },
              { label: 'Max Drawdown', value: `${s.stats.maxDrawdown}%`, color: 'var(--color-red)' },
            ].map(stat => (
              <div key={stat.label} className="stat-card">
                <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{stat.label}</p>
                <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Entry/Exit Rules */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="glass-card-static p-5" style={{ borderLeft: '3px solid var(--color-green)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-green)' }}>ENTRY RULES</p>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{s.entryRules}</p>
            </div>
            <div className="glass-card-static p-5" style={{ borderLeft: '3px solid var(--color-red)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-red)' }}>EXIT RULES</p>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{s.exitRules}</p>
            </div>
          </div>

          {/* Indicators */}
          <div className="mb-6">
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>INDICATORS USED</p>
            <div className="flex flex-wrap gap-2">
              {s.indicators.map(ind => (
                <span key={ind} className="badge badge-accent">{ind}</span>
              ))}
            </div>
          </div>

          {/* Pine Script */}
          <div className="mb-6">
            <div className="code-block">
              <div className="code-block-header">
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Pine Script v5</span>
                <button onClick={() => copyCode(s.pineScript)}
                  className="text-xs px-3 py-1.5 rounded-lg transition-all hover:scale-105"
                  style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--color-accent-light)' }}>
                  {copied ? '✓ Copied!' : '📋 Copy'}
                </button>
              </div>
              <div className="code-block-content" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {s.pineScript.split('\n').map((line, i) => (
                  <div key={i} className="flex">
                    <span className="select-none w-8 text-right mr-4 shrink-0" style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                      {i + 1}
                    </span>
                    <span style={{
                      color: line.startsWith('//')
                        ? 'var(--color-text-muted)'
                        : line.includes('strategy.') || line.includes('ta.')
                          ? 'var(--color-cyan)'
                          : line.includes('plot') || line.includes('bgcolor') || line.includes('hline')
                            ? 'var(--color-purple)'
                            : line.includes('if ')
                              ? 'var(--color-yellow)'
                              : line.includes('input.')
                                ? 'var(--color-green)'
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
          </div>

          {/* Analysis */}
          <div className="glass-card-static p-6">
            <h3 className="text-sm font-serif mb-3" style={{ color: 'var(--color-text-primary)' }}>📝 Analysis & Notes</h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{s.analysis}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-3xl md:text-4xl font-serif tracking-tight mb-2">
          <span className="gradient-text">Strategy Library</span>
        </h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          {strategies.length} ready-made strategies with backtest stats, Pine Script code, and analysis
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6 animate-fade-in-up stagger-1">
        <input
          id="strategy-search"
          type="text"
          className="input-field flex-1 min-w-[200px]"
          placeholder="Search strategies, indicators..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <select
          id="strategy-category-filter"
          className="input-field w-auto"
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          style={{ minWidth: '160px' }}
        >
          <option value="All">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          id="strategy-difficulty-filter"
          className="input-field w-auto"
          value={selectedDifficulty}
          onChange={e => setSelectedDifficulty(e.target.value)}
          style={{ minWidth: '140px' }}
        >
          <option value="All">All Levels</option>
          {difficulties.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Results count */}
      <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
        Showing {filtered.length} of {strategies.length} strategies
      </p>

      {/* Strategy grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((s, i) => (
          <div
            key={s.id}
            onClick={() => setSelectedStrategy(s)}
            className={`glass-card p-5 cursor-pointer animate-fade-in-up stagger-${(i % 6) + 1}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-Base font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>{s.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="badge badge-accent">{s.category}</span>
                  <span className="badge" style={{ background: `${difficultyColors[s.difficulty]}20`, color: difficultyColors[s.difficulty] }}>
                    {s.difficulty}
                  </span>
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleVote(s.id) }}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                style={{
                  background: voted[s.id] ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color: voted[s.id] ? 'var(--color-accent-light)' : 'var(--color-text-muted)',
                }}>
                {voted[s.id] ? '▲' : '△'} {votes[s.id]}
              </button>
            </div>

            <p className="text-xs mb-4 leading-relaxed line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
              {s.description}
            </p>

            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'WR', value: `${s.stats.winRate}%`, color: s.stats.winRate >= 50 ? 'var(--color-green)' : 'var(--color-red)' },
                { label: 'PF', value: s.stats.profitFactor.toFixed(1), color: s.stats.profitFactor >= 1.5 ? 'var(--color-green)' : 'var(--color-yellow)' },
                { label: 'SR', value: s.stats.sharpe.toFixed(1), color: s.stats.sharpe >= 1 ? 'var(--color-green)' : 'var(--color-yellow)' },
                { label: 'DD', value: `${s.stats.maxDrawdown}%`, color: 'var(--color-red)' },
              ].map(stat => (
                <div key={stat.label}>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{stat.label}</p>
                  <p className="text-sm font-bold" style={{ color: stat.color }}>{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {s.indicators.slice(0, 3).map(ind => (
                <span key={ind} className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--color-text-muted)' }}>
                  {ind}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-3xl mb-3">🔍</p>
          <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>No strategies found</p>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Try adjusting your filters</p>
        </div>
      )}
    </div>
  )
}
