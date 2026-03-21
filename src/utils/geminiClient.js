// ===== Gemini API Client for Signal Analysis =====
// Sends trade data + user query to Gemini for intelligent analysis

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

/**
 * Summarize trade data for the LLM (avoid sending raw data)
 */
function buildTradeContext(trades) {
  const totalTrades = trades.length
  const wins = trades.filter(t => t.pnl > 0)
  const losses = trades.filter(t => t.pnl < 0)
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0)
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0

  // Day-of-week breakdown
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const byDay = {}
  for (const t of trades) {
    const day = dayNames[t.date.getDay()]
    if (!byDay[day]) byDay[day] = { trades: 0, wins: 0, totalPnl: 0 }
    byDay[day].trades++
    if (t.pnl > 0) byDay[day].wins++
    byDay[day].totalPnl += t.pnl
  }

  // Hour breakdown
  const byHour = {}
  for (const t of trades) {
    const h = t.date.getHours()
    const label = `${h}:00-${h + 1}:00`
    if (!byHour[label]) byHour[label] = { trades: 0, wins: 0, totalPnl: 0 }
    byHour[label].trades++
    if (t.pnl > 0) byHour[label].wins++
    byHour[label].totalPnl += t.pnl
  }

  // Direction breakdown
  const byType = {}
  for (const t of trades) {
    const type = t.type || 'UNKNOWN'
    if (!byType[type]) byType[type] = { trades: 0, wins: 0, totalPnl: 0 }
    byType[type].trades++
    if (t.pnl > 0) byType[type].wins++
    byType[type].totalPnl += t.pnl
  }

  // Streak analysis
  let maxWinStreak = 0, maxLossStreak = 0, currentStreak = 0
  for (const t of trades) {
    if (t.pnl > 0) {
      currentStreak = currentStreak > 0 ? currentStreak + 1 : 1
      maxWinStreak = Math.max(maxWinStreak, currentStreak)
    } else {
      currentStreak = currentStreak < 0 ? currentStreak - 1 : -1
      maxLossStreak = Math.max(maxLossStreak, Math.abs(currentStreak))
    }
  }

  // After-win/after-loss performance
  let afterWinWins = 0, afterWinTotal = 0, afterLossWins = 0, afterLossTotal = 0
  for (let i = 1; i < trades.length; i++) {
    if (trades[i - 1].pnl > 0) {
      afterWinTotal++
      if (trades[i].pnl > 0) afterWinWins++
    } else {
      afterLossTotal++
      if (trades[i].pnl > 0) afterLossWins++
    }
  }

  // Sample trades (first 10 and last 10)
  const sampleStartTrades = trades.slice(0, 10).map(t => ({
    date: t.date.toISOString().split('T')[0],
    type: t.type,
    price: t.price,
    qty: t.quantity,
    pnl: t.pnl.toFixed(2),
  }))
  const sampleEndTrades = trades.slice(-10).map(t => ({
    date: t.date.toISOString().split('T')[0],
    type: t.type,
    price: t.price,
    qty: t.quantity,
    pnl: t.pnl.toFixed(2),
  }))

  // PnL distribution
  const pnls = trades.map(t => t.pnl).sort((a, b) => a - b)
  const p10 = pnls[Math.floor(pnls.length * 0.1)]
  const p50 = pnls[Math.floor(pnls.length * 0.5)]
  const p90 = pnls[Math.floor(pnls.length * 0.9)]
  const biggestWin = Math.max(...trades.map(t => t.pnl))
  const biggestLoss = Math.min(...trades.map(t => t.pnl))

  return `
TRADING DATA SUMMARY:
- Total Trades: ${totalTrades}
- Winners: ${wins.length} (${(wins.length / totalTrades * 100).toFixed(1)}%)
- Losers: ${losses.length} (${(losses.length / totalTrades * 100).toFixed(1)}%)
- Total PnL: ₹${totalPnl.toFixed(2)}
- Average Win: ₹${avgWin.toFixed(2)}
- Average Loss: ₹${avgLoss.toFixed(2)}
- Biggest Win: ₹${biggestWin.toFixed(2)}
- Biggest Loss: ₹${biggestLoss.toFixed(2)}
- Risk/Reward Ratio: ${avgLoss !== 0 ? Math.abs(avgWin / avgLoss).toFixed(2) : 'N/A'}:1
- Max Win Streak: ${maxWinStreak}
- Max Loss Streak: ${maxLossStreak}
- After Win → Win Rate: ${afterWinTotal > 0 ? (afterWinWins / afterWinTotal * 100).toFixed(1) : 'N/A'}%
- After Loss → Win Rate: ${afterLossTotal > 0 ? (afterLossWins / afterLossTotal * 100).toFixed(1) : 'N/A'}%

PNL DISTRIBUTION:
- 10th percentile: ₹${p10.toFixed(2)}
- Median (50th): ₹${p50.toFixed(2)}
- 90th percentile: ₹${p90.toFixed(2)}

PERFORMANCE BY DAY OF WEEK: ${Object.entries(byDay).map(([day, d]) => `- ${day}: ${d.trades} trades, ${(d.wins / d.trades * 100).toFixed(1)}% win rate, ₹${d.totalPnl.toFixed(2)} total PnL`).join('\n')}

PERFORMANCE BY HOUR: ${Object.entries(byHour).sort().map(([h, d]) => `- ${h}: ${d.trades} trades, ${(d.wins / d.trades * 100).toFixed(1)}% win rate, ₹${d.totalPnl.toFixed(2)} total PnL`).join('\n')}

PERFORMANCE BY DIRECTION: ${Object.entries(byType).map(([type, d]) => `- ${type}: ${d.trades} trades, ${(d.wins / d.trades * 100).toFixed(1)}% win rate, ₹${d.totalPnl.toFixed(2)} total PnL`).join('\n')}

SAMPLE TRADES (first 10): ${JSON.stringify(sampleStartTrades, null, 2)}

SAMPLE TRADES (last 10): ${JSON.stringify(sampleEndTrades, null, 2)}
`.trim()
}

/**
 * Query Gemini with trade data context
 * @param {string} query - User's natural language question
 * @param {Array} trades - Parsed trade objects
 * @param {Array} chatHistory - Array of previous chat messages
 * @returns {Promise<{answer: string, error?: string}>}
 */
export async function queryGemini(query, trades, chatHistory = []) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env file.')
  }

  const tradeContext = buildTradeContext(trades)

  const systemPrompt = `You are an expert quantitative trading analyst embedded in a trading analytics platform called QuantPad. You analyze trade data and provide actionable insights.

RULES:
1. Be concise but thorough. Use bullet points and clear formatting.
2. When making claims, reference the specific numbers from the data.
3. If the user asks something you cannot determine from the data, say so clearly.
4. Always provide actionable takeaways when possible.
5. Use trading terminology appropriately.
6. Format your response in markdown. Use **bold** for key metrics and emphasis.
7. Keep responses focused and under 300 words unless a detailed breakdown is explicitly requested.
8. If the data shows a clear pattern, state your confidence level (high/medium/low) based on sample size and statistical significance.

Here is the trader's data context for this conversation: ${tradeContext}`

  // Build multi-turn chat history (only AI messages to maintain role alternation)
  const contents = chatHistory
    .filter(msg => msg.type === 'ai')
    .flatMap(msg => [
      { role: 'user', parts: [{ text: msg.query }] },
      { role: 'model', parts: [{ text: msg.answer }] }
    ])

  // Add the current prompt
  contents.push({
    role: 'user',
    parts: [{ text: query }]
  })

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      }
    })
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `Gemini API error: ${response.status}`)
  }

  const data = await response.json()
  const answer = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!answer) {
    throw new Error('No response generated. Try rephrasing your question.')
  }

  return { answer }
}
