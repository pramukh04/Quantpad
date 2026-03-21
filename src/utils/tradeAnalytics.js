// ===== Trade Analytics Utility Functions =====

/**
 * Clean and fuzzy-match trade types (handles OCR hallucinations like 'SELEE' -> 'SELL')
 */
function cleanTradeType(raw) {
  if (!raw) return 'UNKNOWN'
  const t = String(raw).toUpperCase().trim()
  if (t === 'B' || t.includes('BUY') || t.includes('LONG')) return 'BUY'
  if (t === 'S' || t.includes('SELL') || t.includes('SHORT')) return 'SELL'

  // OCR fuzzy match fallbacks
  if (/^S[EI][LREI]+/.test(t)) return 'SELL'
  if (/^[8B]U[YV]/.test(t)) return 'BUY'

  return t
}

/**
 * Parse CSV trade data into structured objects
 * Expected columns: date, type, price, quantity, pnl
 * Also supports: symbol, volume, duration
 */
export function parseTrades(rows) {
  const baseDate = new Date()
  baseDate.setHours(9, 30, 0, 0) // Fallback start time

  return rows
    .filter(row => row.pnl !== undefined && row.pnl !== '' && row.pnl !== null)
    .map((row, i) => {
      const rawDate = row.date || row.Date || row.DATE
      let d = rawDate ? new Date(rawDate) : new Date(NaN)

      // Auto-generate a valid sequential date if missing/invalid
      if (isNaN(d.getTime())) {
        d = new Date(baseDate.getTime() + i * 60000) // Increment by 1 minute per trade
      }

      return {
        id: i,
        date: d,
        type: cleanTradeType(row.type || row.Type || row.TYPE || row.side || row.Side),
        price: parseFloat(row.price || row.Price || row.PRICE || 0),
        quantity: parseFloat(row.quantity || row.Quantity || row.qty || row.Qty || row.size || row.Size || 1),
        pnl: parseFloat(row.pnl || row.PnL || row.PNL || row.profit || row.Profit || 0),
        symbol: row.symbol || row.Symbol || row.ticker || row.Ticker || 'N/A',
        volume: parseFloat(row.volume || row.Volume || 0) || null,
        duration: parseFloat(row.duration || row.Duration || row.holding_time || 0) || null,
      }
    })
    .filter(t => !isNaN(t.pnl))
    .sort((a, b) => a.date - b.date)
}

/**
 * Calculate win rate
 */
export function calcWinRate(trades) {
  if (!trades.length) return 0
  const wins = trades.filter(t => t.pnl > 0).length
  return (wins / trades.length) * 100
}

/**
 * Calculate cumulative PnL curve
 */
export function calcPnLCurve(trades) {
  let cumulative = 0
  return trades.map(t => {
    cumulative += t.pnl
    return { date: t.date, value: cumulative }
  })
}

/**
 * Calculate max drawdown
 */
export function calcMaxDrawdown(trades) {
  const curve = calcPnLCurve(trades)
  if (!curve.length) return { maxDrawdown: 0, maxDrawdownPct: 0 }

  let peak = -Infinity
  let maxDD = 0

  for (const point of curve) {
    if (point.value > peak) peak = point.value
    const dd = peak - point.value
    if (dd > maxDD) maxDD = dd
  }

  return {
    maxDrawdown: maxDD,
    maxDrawdownPct: peak > 0 ? (maxDD / peak) * 100 : 0,
  }
}

/**
 * Calculate Sharpe ratio (annualized, assuming 252 trading days)
 */
export function calcSharpeRatio(trades, riskFreeRate = 0) {
  if (trades.length < 2) return 0
  const returns = trades.map(t => t.pnl)
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1)
  const stdDev = Math.sqrt(variance)
  if (stdDev === 0) return 0
  return ((mean - riskFreeRate) / stdDev) * Math.sqrt(252)
}

/**
 * Calculate profit factor
 */
export function calcProfitFactor(trades) {
  const grossProfit = trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0)
  const grossLoss = Math.abs(trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0))
  if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0
  return grossProfit / grossLoss
}

/**
 * Calculate average win and average loss
 */
export function calcAvgWinLoss(trades) {
  const wins = trades.filter(t => t.pnl > 0)
  const losses = trades.filter(t => t.pnl < 0)
  return {
    avgWin: wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0,
    avgLoss: losses.length ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0,
    winCount: wins.length,
    lossCount: losses.length,
  }
}

/**
 * Calculate total PnL
 */
export function calcTotalPnL(trades) {
  return trades.reduce((sum, t) => sum + t.pnl, 0)
}

/**
 * Run Monte Carlo simulation
 * Shuffles trade PnL values and re-simulates equity curves
 */
export function runMonteCarlo(trades, numSims = 1000) {
  const pnls = trades.map(t => t.pnl)
  const results = []

  for (let sim = 0; sim < numSims; sim++) {
    // Random sampling WITH replacement
    const shuffled = []
    for (let i = 0; i < pnls.length; i++) {
      const randomIndex = Math.floor(Math.random() * pnls.length)
      shuffled.push(pnls[randomIndex])
    }

    // Build equity curve
    let equity = 0
    let peak = 0
    let maxDD = 0
    const curve = []

    for (const pnl of shuffled) {
      equity += pnl
      if (equity > peak) peak = equity
      const dd = peak - equity
      if (dd > maxDD) maxDD = dd
      curve.push(equity)
    }

    results.push({
      finalEquity: equity,
      maxDrawdown: maxDD,
      curve,
    })
  }

  // Calculate percentiles
  const finals = results.map(r => r.finalEquity).sort((a, b) => a - b)
  const drawdowns = results.map(r => r.maxDrawdown).sort((a, b) => a - b)

  const pct = (arr, p) => arr[Math.floor(arr.length * p / 100)]

  return {
    simulations: results.slice(0, 50), // keep 50 sample paths for plotting
    percentiles: {
      p5: pct(finals, 5),
      p25: pct(finals, 25),
      p50: pct(finals, 50),
      p75: pct(finals, 75),
      p95: pct(finals, 95),
    },
    drawdownPercentiles: {
      p50: pct(drawdowns, 50),
      p75: pct(drawdowns, 75),
      p95: pct(drawdowns, 95),
    },
    profitablePct: (finals.filter(f => f > 0).length / finals.length) * 100,
  }
}

/**
 * Analyze market conditions
 */
export function analyzeMarketConditions(trades) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  // By day of week
  const byDay = {}
  for (const t of trades) {
    const day = dayNames[t.date.getDay()]
    if (!byDay[day]) byDay[day] = { trades: 0, wins: 0, totalPnl: 0 }
    byDay[day].trades++
    if (t.pnl > 0) byDay[day].wins++
    byDay[day].totalPnl += t.pnl
  }

  // By hour
  const byHour = {}
  for (const t of trades) {
    const hour = t.date.getHours()
    const label = `${hour.toString().padStart(2, '0')}:00`
    if (!byHour[label]) byHour[label] = { trades: 0, wins: 0, totalPnl: 0 }
    byHour[label].trades++
    if (t.pnl > 0) byHour[label].wins++
    byHour[label].totalPnl += t.pnl
  }

  // By type (LONG/SHORT)
  const byType = {}
  for (const t of trades) {
    const type = t.type === 'BUY' ? 'LONG' : t.type === 'SELL' ? 'SHORT' : t.type || 'UNKNOWN'
    if (!byType[type]) byType[type] = { trades: 0, wins: 0, totalPnl: 0 }
    byType[type].trades++
    if (t.pnl > 0) byType[type].wins++
    byType[type].totalPnl += t.pnl
  }

  // By trade size (small, medium, large)
  const quantities = trades.map(t => t.quantity).filter(q => q > 0)
  const medianQty = quantities.sort((a, b) => a - b)[Math.floor(quantities.length / 2)] || 1
  const bySize = { Small: { trades: 0, wins: 0, totalPnl: 0 }, Medium: { trades: 0, wins: 0, totalPnl: 0 }, Large: { trades: 0, wins: 0, totalPnl: 0 } }

  for (const t of trades) {
    const cat = t.quantity <= medianQty * 0.5 ? 'Small' : t.quantity <= medianQty * 1.5 ? 'Medium' : 'Large'
    bySize[cat].trades++
    if (t.pnl > 0) bySize[cat].wins++
    bySize[cat].totalPnl += t.pnl
  }

  // Streak analysis
  let currentStreak = 0
  let maxWinStreak = 0
  let maxLossStreak = 0

  for (const t of trades) {
    if (t.pnl > 0) {
      currentStreak = currentStreak > 0 ? currentStreak + 1 : 1
      maxWinStreak = Math.max(maxWinStreak, currentStreak)
    } else {
      currentStreak = currentStreak < 0 ? currentStreak - 1 : -1
      maxLossStreak = Math.max(maxLossStreak, Math.abs(currentStreak))
    }
  }

  return { byDay, byHour, byType, bySize, maxWinStreak, maxLossStreak }
}

/**
 * Get full analysis summary from trades
 */
export function getFullAnalysis(trades) {
  return {
    totalTrades: trades.length,
    winRate: calcWinRate(trades),
    totalPnL: calcTotalPnL(trades),
    pnlCurve: calcPnLCurve(trades),
    ...calcMaxDrawdown(trades),
    sharpeRatio: calcSharpeRatio(trades),
    profitFactor: calcProfitFactor(trades),
    ...calcAvgWinLoss(trades),
    monteCarlo: runMonteCarlo(trades),
    conditions: analyzeMarketConditions(trades),
  }
}
