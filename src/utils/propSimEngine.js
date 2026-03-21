// ===== Prop Firm Simulation Engine =====
// Monte Carlo simulation for funded account challenge pass/fail probability

/**
 * Run prop firm challenge simulation
 * @param {Object} params
 * @param {number} params.winRate - Win rate as decimal (e.g., 0.55)
 * @param {number} params.avgWin - Average winning trade in ₹ or %
 * @param {number} params.avgLoss - Average losing trade in ₹ or % (positive number)
 * @param {number} params.tradesPerDay - Average trades per day
 * @param {number} params.accountSize - Starting account balance
 * @param {number} params.profitTarget - Profit target as % (e.g., 10 for 10%)
 * @param {number} params.maxDrawdown - Max drawdown as % (e.g., 10 for 10%)
 * @param {number} params.dailyDrawdown - Daily drawdown limit as % (e.g., 5 for 5%)
 * @param {number} params.challengeDays - Number of trading days
 * @param {number} params.numSims - Number of simulations (default 10000)
 */
export function runPropFirmSim({
  winRate = 0.55,
  avgWin = 200,
  avgLoss = 150,
  tradesPerDay = 3,
  accountSize = 100000,
  profitTarget = 10,
  maxDrawdown = 10,
  dailyDrawdown = 5,
  challengeDays = 30,
  numSims = 10000,
}) {
  const targetAmount = accountSize * (profitTarget / 100)
  const maxDDAmount = accountSize * (maxDrawdown / 100)
  const dailyDDAmount = accountSize * (dailyDrawdown / 100)

  let passed = 0
  let failedDrawdown = 0
  let failedDailyDD = 0
  let failedTarget = 0

  const finalBalances = []
  const maxDrawdowns = []
  const daysToPass = []
  const samplePaths = []

  for (let sim = 0; sim < numSims; sim++) {
    let balance = accountSize
    let peakBalance = accountSize
    let maxDD = 0
    let daysPassed = false
    let busted = false
    let bustReason = null
    const path = sim < 30 ? [accountSize] : null // Keep 30 sample paths

    for (let day = 0; day < challengeDays; day++) {
      const dayStart = balance
      const numTrades = Math.max(1, Math.round(tradesPerDay + (Math.random() - 0.5) * 2))

      for (let t = 0; t < numTrades; t++) {
        const isWin = Math.random() < winRate
        const variance = 0.7 + Math.random() * 0.6 // 70%-130% of average
        const pnl = isWin ? avgWin * variance : -avgLoss * variance

        balance += pnl

        if (balance > peakBalance) peakBalance = balance
        const dd = peakBalance - balance
        if (dd > maxDD) maxDD = dd

        // Check max drawdown
        if (dd >= maxDDAmount) {
          busted = true
          bustReason = 'maxDD'
          break
        }

        // Check daily drawdown
        if (dayStart - balance >= dailyDDAmount) {
          busted = true
          bustReason = 'dailyDD'
          break
        }
      }

      if (path) path.push(balance)

      if (busted) break

      // Check if target reached
      if (balance >= accountSize + targetAmount) {
        daysPassed = true
        daysToPass.push(day + 1)
        break
      }
    }

    if (path) samplePaths.push(path)

    if (busted) {
      if (bustReason === 'maxDD') failedDrawdown++
      else failedDailyDD++
    } else if (!daysPassed) {
      // Ran out of time
      if (balance >= accountSize + targetAmount) {
        passed++
        daysPassed = true
      } else {
        failedTarget++
      }
    } else {
      passed++
    }

    finalBalances.push(balance)
    maxDrawdowns.push(maxDD)
  }

  finalBalances.sort((a, b) => a - b)
  maxDrawdowns.sort((a, b) => a - b)

  const pct = (arr, p) => arr[Math.floor(arr.length * p / 100)]

  // Calculate expected value
  const expectedPnlPerTrade = winRate * avgWin - (1 - winRate) * avgLoss
  const expectedDailyPnl = expectedPnlPerTrade * tradesPerDay
  const expectedTotalPnl = expectedDailyPnl * challengeDays

  // Generate suggestions
  const suggestions = generateSuggestions({
    passRate: (passed / numSims) * 100,
    winRate,
    avgWin,
    avgLoss,
    failedDrawdown,
    failedDailyDD,
    failedTarget,
    numSims,
    expectedPnlPerTrade,
  })

  return {
    passRate: (passed / numSims) * 100,
    passed,
    total: numSims,
    failedDrawdown,
    failedDailyDD,
    failedTarget,

    balancePercentiles: {
      p5: pct(finalBalances, 5),
      p25: pct(finalBalances, 25),
      p50: pct(finalBalances, 50),
      p75: pct(finalBalances, 75),
      p95: pct(finalBalances, 95),
    },

    drawdownPercentiles: {
      p50: pct(maxDrawdowns, 50),
      p75: pct(maxDrawdowns, 75),
      p95: pct(maxDrawdowns, 95),
    },

    avgDaysToPass: daysToPass.length
      ? (daysToPass.reduce((s, d) => s + d, 0) / daysToPass.length).toFixed(1)
      : 'N/A',

    expectedPnlPerTrade,
    expectedDailyPnl,
    expectedTotalPnl,

    samplePaths,
    suggestions,
  }
}

function generateSuggestions({ passRate, winRate, avgWin, avgLoss, failedDrawdown, failedDailyDD, failedTarget, numSims, expectedPnlPerTrade }) {
  const suggestions = []

  if (passRate < 50) {
    if (expectedPnlPerTrade <= 0) {
      suggestions.push({
        priority: 'critical',
        text: 'Your expected value per trade is negative. You need either a higher win rate or better risk-reward ratio.',
      })
    }

    if (failedDrawdown / numSims > 0.3) {
      suggestions.push({
        priority: 'high',
        text: 'High drawdown failure rate. Consider reducing position sizes or tightening stop losses.',
      })
    }

    if (failedDailyDD / numSims > 0.2) {
      suggestions.push({
        priority: 'high',
        text: 'Daily drawdown limit is frequently hit. Consider limiting to fewer trades per day or using a max daily loss rule.',
      })
    }

    if (failedTarget / numSims > 0.3) {
      suggestions.push({
        priority: 'medium',
        text: 'Not reaching profit target in time. Consider more aggressive targets or more trades per day.',
      })
    }
  }

  const rrRatio = avgWin / avgLoss
  if (rrRatio < 1.5) {
    suggestions.push({
      priority: 'medium',
      text: `Your risk-reward ratio is ${rrRatio.toFixed(2)}:1. Aim for at least 1.5:1 to improve pass probability.`,
    })
  }

  if (winRate < 0.45) {
    suggestions.push({
      priority: 'medium',
      text: 'Win rate below 45% requires exceptional risk-reward. Consider tightening entry criteria.',
    })
  }

  if (passRate >= 70) {
    suggestions.push({
      priority: 'positive',
      text: `Strong pass probability (${passRate.toFixed(1)}%). Your edge is solid for this challenge configuration.`,
    })
  } else if (passRate >= 50) {
    suggestions.push({
      priority: 'info',
      text: `Moderate pass probability (${passRate.toFixed(1)}%). Small improvements in win rate or R:R could significantly boost your odds.`,
    })
  }

  return suggestions
}

/**
 * Common prop firm challenge presets
 */
export const CHALLENGE_PRESETS = [
  {
    name: 'FTMO Challenge',
    accountSize: 100000,
    profitTarget: 10,
    maxDrawdown: 10,
    dailyDrawdown: 5,
    challengeDays: 30,
  },
  {
    name: 'FTMO Verification',
    accountSize: 100000,
    profitTarget: 5,
    maxDrawdown: 10,
    dailyDrawdown: 5,
    challengeDays: 60,
  },
  {
    name: 'MyForexFunds Rapid',
    accountSize: 50000,
    profitTarget: 8,
    maxDrawdown: 12,
    dailyDrawdown: 5,
    challengeDays: 30,
  },
  {
    name: 'The Funded Trader',
    accountSize: 100000,
    profitTarget: 10,
    maxDrawdown: 10,
    dailyDrawdown: 5,
    challengeDays: 35,
  },
  {
    name: 'True Forex Funds',
    accountSize: 100000,
    profitTarget: 8,
    maxDrawdown: 10,
    dailyDrawdown: 5,
    challengeDays: 30,
  },
  {
    name: 'Topstep (Futures)',
    accountSize: 150000,
    profitTarget: 6,
    maxDrawdown: 3,
    dailyDrawdown: 2,
    challengeDays: 30,
  },
]
