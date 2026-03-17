// ===== ML Factor Analysis Engine =====
// Computes 50+ derived features from trade data and scores them by predictive power

/**
 * Compute derived factors for each trade
 */
export function computeFactors(trades) {
  if (!trades.length) return []

  const enriched = trades.map((trade, i) => {
    const factors = {}

    // ===== Time-based factors =====
    factors['Day of Week'] = trade.date.getDay()
    factors['Hour of Day'] = trade.date.getHours()
    factors['Is Monday'] = trade.date.getDay() === 1 ? 1 : 0
    factors['Is Friday'] = trade.date.getDay() === 5 ? 1 : 0
    factors['Is Morning (before noon)'] = trade.date.getHours() < 12 ? 1 : 0
    factors['Is First Hour'] = trade.date.getHours() <= 10 ? 1 : 0
    factors['Is Last Hour'] = trade.date.getHours() >= 15 ? 1 : 0
    factors['Day of Month'] = trade.date.getDate()
    factors['Is Month Start'] = trade.date.getDate() <= 5 ? 1 : 0
    factors['Is Month End'] = trade.date.getDate() >= 25 ? 1 : 0
    factors['Week of Year'] = Math.ceil((trade.date.getDate() + new Date(trade.date.getFullYear(), trade.date.getMonth(), 1).getDay()) / 7)
    factors['Quarter'] = Math.floor(trade.date.getMonth() / 3) + 1

    // ===== Trade characteristics =====
    factors['Position Size'] = trade.quantity
    factors['Trade Price'] = trade.price
    factors['Is Long'] = trade.type === 'BUY' || trade.type === 'LONG' ? 1 : 0
    factors['Is Short'] = trade.type === 'SELL' || trade.type === 'SHORT' ? 1 : 0

    if (trade.volume != null) {
      factors['Volume'] = trade.volume
    }
    if (trade.duration != null) {
      factors['Duration'] = trade.duration
    }

    // ===== Sequence-based factors =====
    if (i > 0) {
      factors['Previous Trade PnL'] = trades[i - 1].pnl
      factors['Previous Trade Was Win'] = trades[i - 1].pnl > 0 ? 1 : 0
      factors['Time Since Last Trade (hrs)'] = (trade.date - trades[i - 1].date) / (1000 * 60 * 60)
      factors['PnL Change from Previous'] = trade.pnl - trades[i - 1].pnl
    }

    // ===== Rolling window factors =====
    const lookbacks = [5, 10, 20]
    for (const lb of lookbacks) {
      if (i >= lb) {
        const window = trades.slice(i - lb, i)
        const windowPnls = window.map(t => t.pnl)
        const wins = window.filter(t => t.pnl > 0).length

        factors[`Win Rate (last ${lb})`] = (wins / lb) * 100
        factors[`Avg PnL (last ${lb})`] = windowPnls.reduce((s, v) => s + v, 0) / lb
        factors[`PnL StdDev (last ${lb})`] = Math.sqrt(
          windowPnls.reduce((s, v) => s + (v - windowPnls.reduce((a, b) => a + b, 0) / lb) ** 2, 0) / lb
        )
        factors[`Cumulative PnL (last ${lb})`] = windowPnls.reduce((s, v) => s + v, 0)
        factors[`Max PnL (last ${lb})`] = Math.max(...windowPnls)
        factors[`Min PnL (last ${lb})`] = Math.min(...windowPnls)
      }
    }

    // ===== Streak factors =====
    let streak = 0
    for (let j = i - 1; j >= 0; j--) {
      if ((trades[j].pnl > 0) === (trades[i > 0 ? i - 1 : 0].pnl > 0)) {
        streak++
      } else break
    }
    factors['Current Streak Length'] = streak
    factors['On Winning Streak'] = i > 0 && trades[i - 1].pnl > 0 ? streak : 0
    factors['On Losing Streak'] = i > 0 && trades[i - 1].pnl <= 0 ? streak : 0

    // ===== Relative factors =====
    if (i >= 5) {
      const recentAvgSize = trades.slice(i - 5, i).reduce((s, t) => s + t.quantity, 0) / 5
      factors['Size vs Recent Avg'] = recentAvgSize > 0 ? trade.quantity / recentAvgSize : 1
    }

    // ===== Position in series =====
    factors['Trade Number'] = i + 1
    factors['Trade Number (normalized)'] = (i + 1) / trades.length

    return { ...trade, factors, isWin: trade.pnl > 0 ? 1 : 0 }
  })

  return enriched
}

/**
 * Point-biserial correlation between a continuous factor and binary outcome (win/loss)
 */
function pointBiserialCorr(values, outcomes) {
  const n = values.length
  if (n < 5) return { r: 0, significance: 'insufficient' }

  const group1 = values.filter((_, i) => outcomes[i] === 1)
  const group0 = values.filter((_, i) => outcomes[i] === 0)

  if (group1.length < 2 || group0.length < 2) return { r: 0, significance: 'insufficient' }

  const mean1 = group1.reduce((s, v) => s + v, 0) / group1.length
  const mean0 = group0.reduce((s, v) => s + v, 0) / group0.length
  const meanAll = values.reduce((s, v) => s + v, 0) / n
  const stdAll = Math.sqrt(values.reduce((s, v) => s + (v - meanAll) ** 2, 0) / n)

  if (stdAll === 0) return { r: 0, significance: 'no_variance' }

  const p = group1.length / n
  const q = 1 - p
  const r = ((mean1 - mean0) / stdAll) * Math.sqrt(p * q)

  // Significance
  let significance
  const absR = Math.abs(r)
  if (absR >= 0.3) significance = 'strong'
  else if (absR >= 0.15) significance = 'moderate'
  else if (absR >= 0.05) significance = 'weak'
  else significance = 'negligible'

  return { r, significance }
}

/**
 * Score all factors and return ranked results
 */
export function analyzeFactors(trades) {
  const enriched = computeFactors(trades)
  if (enriched.length < 10) return { error: 'Need at least 10 trades for factor analysis' }

  // Get all factor names
  const allFactors = new Set()
  for (const t of enriched) {
    for (const key of Object.keys(t.factors)) {
      allFactors.add(key)
    }
  }

  const outcomes = enriched.map(t => t.isWin)
  const results = []

  for (const factorName of allFactors) {
    const values = enriched.map(t => t.factors[factorName])
    const validIndices = values.map((v, i) => v !== undefined && v !== null && !isNaN(v) ? i : -1).filter(i => i >= 0)

    if (validIndices.length < 10) continue

    const validValues = validIndices.map(i => values[i])
    const validOutcomes = validIndices.map(i => outcomes[i])

    const { r, significance } = pointBiserialCorr(validValues, validOutcomes)

    if (significance === 'insufficient' || significance === 'no_variance') continue

    // Calculate group stats
    const winValues = validIndices.filter(i => outcomes[i] === 1).map(i => values[i])
    const lossValues = validIndices.filter(i => outcomes[i] === 0).map(i => values[i])

    results.push({
      name: factorName,
      correlation: r,
      absCorrelation: Math.abs(r),
      significance,
      direction: r > 0 ? 'positive' : 'negative',
      sampleSize: validIndices.length,
      winAvg: winValues.reduce((s, v) => s + v, 0) / winValues.length,
      lossAvg: lossValues.reduce((s, v) => s + v, 0) / lossValues.length,
    })
  }

  // Sort by absolute correlation
  results.sort((a, b) => b.absCorrelation - a.absCorrelation)

  // Generate insights
  const insights = generateInsights(results, enriched)

  return { factors: results, insights, totalTrades: enriched.length }
}

/**
 * Generate actionable insights from factor analysis
 */
function generateInsights(factors, enriched) {
  const insights = []
  const strong = factors.filter(f => f.significance === 'strong' || f.significance === 'moderate')

  for (const factor of strong.slice(0, 8)) {
    let insight = ''
    const dir = factor.direction === 'positive' ? 'higher' : 'lower'

    if (factor.name.includes('Day') || factor.name.includes('Monday') || factor.name.includes('Friday')) {
      insight = `Your trades perform differently by ${factor.name.toLowerCase()}. Win average: ${factor.winAvg.toFixed(1)}, Loss average: ${factor.lossAvg.toFixed(1)}.`
    } else if (factor.name.includes('Streak')) {
      insight = `Streak patterns matter: ${factor.name} has a ${factor.significance} correlation (${factor.correlation.toFixed(3)}) with outcomes. Consider ${factor.direction === 'positive' ? 'riding' : 'breaking'} streaks.`
    } else if (factor.name.includes('Size') || factor.name.includes('Position')) {
      insight = `Position sizing affects results: ${dir} ${factor.name.toLowerCase()} tends to produce more wins (correlation: ${factor.correlation.toFixed(3)}).`
    } else if (factor.name.includes('Win Rate') || factor.name.includes('Avg PnL')) {
      insight = `Recent performance momentum: ${factor.name} is a ${factor.significance} predictor. Your wins tend to follow periods with ${dir} values.`
    } else if (factor.name.includes('Hour') || factor.name.includes('Morning') || factor.name.includes('Last')) {
      insight = `Time-of-day matters: ${factor.name} shows a ${factor.significance} relationship with outcomes (r=${factor.correlation.toFixed(3)}).`
    } else {
      insight = `${factor.name} shows a ${factor.significance} ${factor.direction} correlation (${factor.correlation.toFixed(3)}) with trade outcomes. Winners average ${factor.winAvg.toFixed(2)} vs losers at ${factor.lossAvg.toFixed(2)}.`
    }

    insights.push({
      factor: factor.name,
      text: insight,
      importance: factor.absCorrelation,
      significance: factor.significance,
      actionable: factor.significance === 'strong',
    })
  }

  return insights
}
