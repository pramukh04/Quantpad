// ===== Signal Testing Engine =====
// NLP-lite parser that maps plain English queries to testable hypotheses

const SIGNAL_PATTERNS = [
  {
    keywords: ['volume', 'high volume', 'low volume'],
    field: 'volume',
    testType: 'split',
    label: 'Volume Level',
    getGroups: (trades) => {
      const withVol = trades.filter(t => t.volume != null && t.volume > 0)
      if (withVol.length < 10) return null
      const median = withVol.map(t => t.volume).sort((a, b) => a - b)[Math.floor(withVol.length / 2)]
      return {
        groupA: { label: 'High Volume', data: withVol.filter(t => t.volume >= median) },
        groupB: { label: 'Low Volume', data: withVol.filter(t => t.volume < median) },
      }
    }
  },
  {
    keywords: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'weekend', 'day of week', 'day'],
    field: 'dayOfWeek',
    testType: 'categorical',
    label: 'Day of Week',
    getGroups: (trades, query) => {
      const dayMap = { 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5 }
      const q = query.toLowerCase()
      const targetDay = Object.keys(dayMap).find(d => q.includes(d))
      if (targetDay) {
        return {
          groupA: { label: targetDay.charAt(0).toUpperCase() + targetDay.slice(1), data: trades.filter(t => t.date.getDay() === dayMap[targetDay]) },
          groupB: { label: `Not ${targetDay.charAt(0).toUpperCase() + targetDay.slice(1)}`, data: trades.filter(t => t.date.getDay() !== dayMap[targetDay]) },
        }
      }
      const groups = {}
      for (const t of trades) {
        const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][t.date.getDay()]
        if (!groups[day]) groups[day] = []
        groups[day].push(t)
      }
      return { categorical: groups }
    }
  },
  {
    keywords: ['morning', 'afternoon', 'evening', 'time', 'hour', 'session', 'open', 'close'],
    field: 'timeOfDay',
    testType: 'split',
    label: 'Trading Session',
    getGroups: (trades, query) => {
      const q = query.toLowerCase()
      let filterFn
      let labelA, labelB

      if (q.includes('morning')) {
        filterFn = t => t.date.getHours() < 12
        labelA = 'Morning (before 12pm)'; labelB = 'Afternoon/Evening'
      } else if (q.includes('afternoon')) {
        filterFn = t => t.date.getHours() >= 12 && t.date.getHours() < 17
        labelA = 'Afternoon (12pm-5pm)'; labelB = 'Other Times'
      } else {
        filterFn = t => t.date.getHours() < 12
        labelA = 'First Half of Day'; labelB = 'Second Half of Day'
      }

      return {
        groupA: { label: labelA, data: trades.filter(filterFn) },
        groupB: { label: labelB, data: trades.filter(t => !filterFn(t)) },
      }
    }
  },
  {
    keywords: ['streak', 'consecutive', 'winning streak', 'losing streak', 'after win', 'after loss'],
    field: 'streak',
    testType: 'split',
    label: 'After Win/Loss Streak',
    getGroups: (trades) => {
      const afterWin = []
      const afterLoss = []
      for (let i = 1; i < trades.length; i++) {
        if (trades[i - 1].pnl > 0) afterWin.push(trades[i])
        else afterLoss.push(trades[i])
      }
      return {
        groupA: { label: 'After a Win', data: afterWin },
        groupB: { label: 'After a Loss', data: afterLoss },
      }
    }
  },
  {
    keywords: ['long', 'short', 'buy', 'sell', 'direction'],
    field: 'direction',
    testType: 'split',
    label: 'Trade Direction',
    getGroups: (trades) => {
      const longs = trades.filter(t => t.type === 'BUY' || t.type === 'LONG')
      const shorts = trades.filter(t => t.type === 'SELL' || t.type === 'SHORT')
      if (longs.length < 3 || shorts.length < 3) return null
      return {
        groupA: { label: 'Long Trades', data: longs },
        groupB: { label: 'Short Trades', data: shorts },
      }
    }
  },
  {
    keywords: ['size', 'position size', 'large position', 'small position', 'quantity'],
    field: 'positionSize',
    testType: 'split',
    label: 'Position Size',
    getGroups: (trades) => {
      const sorted = [...trades].sort((a, b) => a.quantity - b.quantity)
      const mid = Math.floor(sorted.length / 2)
      return {
        groupA: { label: 'Larger Positions', data: sorted.slice(mid) },
        groupB: { label: 'Smaller Positions', data: sorted.slice(0, mid) },
      }
    }
  },
  {
    keywords: ['duration', 'holding time', 'hold', 'quick', 'fast', 'slow'],
    field: 'duration',
    testType: 'split',
    label: 'Trade Duration',
    getGroups: (trades) => {
      const withDur = trades.filter(t => t.duration != null && t.duration > 0)
      if (withDur.length < 10) return null
      const median = withDur.map(t => t.duration).sort((a, b) => a - b)[Math.floor(withDur.length / 2)]
      return {
        groupA: { label: 'Longer Duration', data: withDur.filter(t => t.duration >= median) },
        groupB: { label: 'Shorter Duration', data: withDur.filter(t => t.duration < median) },
      }
    }
  },
]

/**
 * Perform a t-test (Welch's t-test for unequal variances)
 */
function welchTTest(groupA, groupB) {
  const nA = groupA.length
  const nB = groupB.length
  if (nA < 2 || nB < 2) return { tStat: 0, pValue: 1 }

  const meanA = groupA.reduce((s, v) => s + v, 0) / nA
  const meanB = groupB.reduce((s, v) => s + v, 0) / nB
  const varA = groupA.reduce((s, v) => s + (v - meanA) ** 2, 0) / (nA - 1)
  const varB = groupB.reduce((s, v) => s + (v - meanB) ** 2, 0) / (nB - 1)

  const se = Math.sqrt(varA / nA + varB / nB)
  if (se === 0) return { tStat: 0, pValue: 1 }

  const tStat = (meanA - meanB) / se

  // Approximate p-value using normal distribution (for large samples)
  const absT = Math.abs(tStat)
  const pValue = 2 * (1 - normalCDF(absT))

  return { tStat, pValue, meanA, meanB, nA, nB }
}

/**
 * Standard normal CDF approximation
 */
function normalCDF(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x) / Math.sqrt(2)
  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return 0.5 * (1.0 + sign * y)
}

/**
 * Parse a natural language query and test it against trade data
 */
export function testSignal(query, trades) {
  if (!trades || trades.length < 10) {
    return {
      error: 'Need at least 10 trades to run a meaningful signal test.',
    }
  }

  const q = query.toLowerCase()

  // Find matching pattern
  let match = null
  let maxScore = 0

  for (const pattern of SIGNAL_PATTERNS) {
    const score = pattern.keywords.reduce((s, kw) => s + (q.includes(kw) ? 1 : 0), 0)
    if (score > maxScore) {
      maxScore = score
      match = pattern
    }
  }

  if (!match || maxScore === 0) {
    return {
      error: 'Could not understand your query. Try asking about: volume, day of week, time of day, trade direction, position size, duration, or streaks.',
      suggestions: [
        'Does my strategy win more on Mondays?',
        'Do I perform better with larger positions?',
        'Are my morning trades more profitable?',
        'Do I win more after a losing streak?',
        'Is high volume correlated with my winners?',
      ]
    }
  }

  const groups = match.getGroups(trades, query)
  if (!groups) {
    return {
      error: `Not enough data to test "${match.label}". Need more trades with this information.`,
      suggestions: [
        'Try testing a different signal',
        'Upload more trade data',
      ]
    }
  }

  // Handle categorical grouping
  if (groups.categorical) {
    const results = {}
    for (const [key, grp] of Object.entries(groups.categorical)) {
      const pnls = grp.map(t => t.pnl)
      const winRate = (grp.filter(t => t.pnl > 0).length / grp.length) * 100
      const avgPnl = pnls.reduce((s, v) => s + v, 0) / pnls.length
      results[key] = { trades: grp.length, winRate, avgPnl }
    }
    return {
      type: 'categorical',
      label: match.label,
      results,
      query,
    }
  }

  // Perform t-test between group A and group B
  const pnlA = groups.groupA.data.map(t => t.pnl)
  const pnlB = groups.groupB.data.map(t => t.pnl)
  const test = welchTTest(pnlA, pnlB)

  const winRateA = (groups.groupA.data.filter(t => t.pnl > 0).length / groups.groupA.data.length) * 100
  const winRateB = (groups.groupB.data.filter(t => t.pnl > 0).length / groups.groupB.data.length) * 100

  // Confidence interpretation
  let confidence, verdict
  if (test.pValue < 0.01) {
    confidence = 'Very High'
    verdict = test.meanA > test.meanB ? 'YES — Strong statistical evidence' : 'REVERSED — Opposite of expected'
  } else if (test.pValue < 0.05) {
    confidence = 'High'
    verdict = test.meanA > test.meanB ? 'YES — Statistically significant' : 'REVERSED — Opposite effect'
  } else if (test.pValue < 0.1) {
    confidence = 'Moderate'
    verdict = 'MAYBE — Some evidence but not conclusive'
  } else {
    confidence = 'Low'
    verdict = 'NO — No statistically significant difference found'
  }

  // Generate related suggestions
  const relatedPatterns = SIGNAL_PATTERNS
    .filter(p => p !== match)
    .slice(0, 3)
    .map(p => `Does ${p.label.toLowerCase()} affect my win rate?`)

  return {
    type: 'comparison',
    label: match.label,
    query,
    verdict,
    confidence,
    pValue: test.pValue,
    groupA: {
      label: groups.groupA.label,
      trades: groups.groupA.data.length,
      winRate: winRateA,
      avgPnl: test.meanA,
    },
    groupB: {
      label: groups.groupB.label,
      trades: groups.groupB.data.length,
      winRate: winRateB,
      avgPnl: test.meanB,
    },
    suggestions: relatedPatterns,
  }
}
