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

/**
 * Generate a complex Pine Script strategy using Gemini
 * @param {string} description - User's strategy description
 * @returns {Promise<{code: string, error?: string}>}
 */
export async function generatePineScriptWithGemini(description) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env file.')
  }

  const systemPrompt = `You are an expert TradingView Pine Script v6 developer. Your ONLY output is raw Pine Script v6 strategy code — no markdown fences, no explanations, no extra text.

=== SYNTAX REFERENCE (Pine Script v6) ===
Here is a COMPLETE, WORKING example of a Pine Script v6 strategy. Follow this exact structure for ALL output:

//@version=6
strategy("Example RSI Strategy", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

// --- Inputs ---
rsiLen = input.int(14, title="RSI Length", minval=1)
rsiOversold = input.int(30, title="Oversold Level", minval=1, maxval=49)
rsiOverbought = input.int(70, title="Overbought Level", minval=51, maxval=99)
atrLen = input.int(14, title="ATR Length", minval=1)
atrMult = input.float(1.5, title="ATR Multiplier", step=0.1)

// --- Calculations ---
rsiVal = ta.rsi(close, rsiLen)
atrVal = ta.atr(atrLen)

// --- Entry Conditions ---
longCond = ta.crossover(rsiVal, rsiOversold)
shortCond = ta.crossunder(rsiVal, rsiOverbought)

// --- Strategy Orders ---
if longCond
    strategy.entry("Long", strategy.long)
    strategy.exit("Long Exit", "Long", stop=close - atrMult * atrVal, limit=close + 2 * atrMult * atrVal)

if shortCond
    strategy.close("Long")

// --- Plots ---
plot(ta.ema(close, 50), "EMA 50", color=color.yellow, linewidth=2)
bgcolor(longCond ? color.new(color.green, 90) : na)
bgcolor(shortCond ? color.new(color.red, 90) : na)
plotshape(longCond, style=shape.arrowup, location=location.belowbar, color=color.green, size=size.small)
plotshape(shortCond, style=shape.arrowdown, location=location.abovebar, color=color.red, size=size.small)

// --- Alerts ---
if longCond
    alert("Long entry triggered", alert.freq_once_per_bar_close)
if shortCond
    alert("Short/Exit signal triggered", alert.freq_once_per_bar_close)

=== RULES ===
1. Start EVERY script with exactly: //@version=6
2. Use strategy() — never indicator(). Include overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10.
3. NEVER use bare 'input' identifier. ALWAYS use: input.int(), input.float(), input.bool(), input.string(), input.timeframe(), input.session().
4. NEVER use alertcondition() — it causes warnings in strategy scripts. Use alert() inside if blocks instead.
5. Every script MUST have at least one strategy.entry() call.
6. Every script MUST have at least one visual output: plot(), plotshape(), bgcolor(), or hline().
7. For multi-timeframe data use: request.security(syminfo.tickerid, "60", close) — specify the timeframe string explicitly.
8. NEVER output TODO comments, stubs, or placeholder functions. Write complete, runnable logic every time.
9. Output ONLY the Pine Script code. No markdown. No code fences. No explanations before or after.`

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        role: 'user',
        parts: [{ text: `Write a complete Pine Script v6 strategy for the following: ${description}` }]
      }],
      generationConfig: {
        temperature: 0.2, // low temp for deterministic coding
        maxOutputTokens: 8192,
      }
    })
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `Gemini API error: ${response.status}`)
  }

  const data = await response.json()
  let raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  let code = ''

  // === Multi-stage code extraction ===
  // Stage 1: Try to extract from a ```pine ... ``` fenced block
  const pineMatch = raw.match(/```pine\s*([\s\S]*?)```/)
  if (pineMatch) {
    code = pineMatch[1].trim()
  }

  // Stage 2: Try to extract from any ``` ... ``` fenced block
  if (!code) {
    const fenceMatch = raw.match(/```\s*([\s\S]*?)```/)
    if (fenceMatch) {
      code = fenceMatch[1].trim()
    }
  }

  // Stage 3: Find //@version= anywhere in the raw response and take everything from there
  if (!code) {
    const versionIdx = raw.indexOf('//@version=')
    if (versionIdx !== -1) {
      code = raw.slice(versionIdx).trim()
    }
  }

  // Stage 4: Fallback to full raw text (last resort)
  if (!code) {
    code = raw.trim()
  }

  // === Normalization ===

  // Force //@version=6
  if (code.includes('//@version=')) {
    code = code.replace(/\/\/@version=\d+/, '//@version=6')
  } else {
    code = `//@version=6\n${code}`
  }

  // Remove alertcondition() calls (cause warnings in strategy scripts)
  code = code.replace(/alertcondition\s*\([^)]*\)\s*/g, '')

  // === Safety nets ===

  // If no strategy order call, append a minimal one
  const hasOrder = /strategy\.(entry|order|exit|close|cancel)\s*\(/.test(code)
  if (!hasOrder) {
    code += `\n\n// Safety fallback: ensure script compiles\nif barstate.islast\n    strategy.entry("Long", strategy.long)`
  }

  // If no visual output, append a minimal bgcolor
  const hasPlot = /\b(plot|plotshape|plotcandle|plotbar|barcolor|bgcolor|hline|line\.new|label\.new|box\.new|table\.new)\s*\(/.test(code)
  if (!hasPlot) {
    code += `\nbgcolor(color.new(color.blue, 97), title="Signal Active")`
  }

  return { code, description }
}

/**
 * Optimize an existing Pine Script strategy using Gemini
 * @param {string} code - User's existing Pine Script code
 * @param {string} goals - User's optimization goals
 * @returns {Promise<{code: string, error?: string}>}
 */
export async function optimizePineScriptWithGemini(code, goals) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env file.')
  }

  const systemPrompt = `You are an expert quantitative developer and TradingView Pine Script v6 optimizer. 
Your task is to take existing Pine Script code and rewrite it to improve its robustness, Profit Factor, and Sharpe Ratio, specifically targeting the user's stated goals.

=== OPTIMIZATION TECHNIQUES ===
Consider adding (if they make sense for the strategy):
1. Volatility/Trend filters (e.g., ADX > 20, price > EMA 200).
2. Advanced risk management (e.g., ATR trailing stops, volatility-adjusted position sizing step=0.1).
3. Session/Time restrictions (e.g., kill zones, avoiding chop).
4. Exit optimizations (e.g., exiting early if momentum diverges).

=== RULES ===
1. Start EVERY script with exactly: //@version=6
2. Keep the core logic intact, but add necessary filters and risk management.
3. Use strategy() — never indicator(). Include overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10.
4. NEVER use bare 'input' identifier. ALWAYS use type-specific inputs like input.int(), input.float(), input.bool().
5. Write complete, runnable Pine Script code. No omissions.
6. **CRITICAL:** Output ONLY the raw Pine Script code. No markdown fences like \`\`\`pine, no explanations outside of the code. Start immediately with //@version=6.

If you want to explain your changes, include a brief multi-line comment block AT THE TOP of the script (after the strategy declaration) starting with:
// --- AI Optimization Notes ---
// 1. Added ATR trailing stop...
// 2. Added EMA 200 trend filter...
`

  const userPrompt = `OPTIMIZATION GOALS: ${goals || 'Maximize Sharpe Ratio, improve Profit Factor, and reduce drawdown.'}\n\n=== EXISTING SCRIPT ===\n${code}`

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        role: 'user',
        parts: [{ text: userPrompt }]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8192,
      }
    })
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `Gemini API error: ${response.status}`)
  }

  const data = await response.json()
  let raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  let finalCode = ''

  // === Multi-stage code extraction ===
  const pineMatch = raw.match(/```pine\s*([\s\S]*?)```/)
  if (pineMatch) finalCode = pineMatch[1].trim()
  
  if (!finalCode) {
    const fenceMatch = raw.match(/```\s*([\s\S]*?)```/)
    if (fenceMatch) finalCode = fenceMatch[1].trim()
  }

  if (!finalCode) {
    const versionIdx = raw.indexOf('//@version=')
    if (versionIdx !== -1) finalCode = raw.slice(versionIdx).trim()
  }

  if (!finalCode) finalCode = raw.trim()

  // === Normalization ===
  if (finalCode.includes('//@version=')) {
    finalCode = finalCode.replace(/\/\/@version=\d+/, '//@version=6')
  } else {
    finalCode = `//@version=6\n${finalCode}`
  }

  finalCode = finalCode.replace(/alertcondition\s*\([^)]*\)\s*/g, '')

  return { code: finalCode, description: 'Optimized Script' }
}
