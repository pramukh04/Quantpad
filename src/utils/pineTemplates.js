// ===== Pine Script Template Engine =====
// Parses natural language strategy descriptions and generates Pine Script v5

const INDICATORS = {
  rsi: {
    name: 'RSI',
    declaration: (period = 14, src = 'close') => `rsiValue = ta.rsi(${src}, ${period})`,
    conditions: {
      'crosses above': (level = 30) => `ta.crossover(rsiValue, ${level})`,
      'crosses below': (level = 70) => `ta.crossunder(rsiValue, ${level})`,
      'above': (level = 50) => `rsiValue > ${level}`,
      'below': (level = 50) => `rsiValue < ${level}`,
      'oversold': () => `rsiValue < 30`,
      'overbought': () => `rsiValue > 70`,
    },
    plot: `plot(rsiValue, "RSI", color=color.purple, linewidth=2)`,
  },
  macd: {
    name: 'MACD',
    declaration: (fast = 12, slow = 26, signal = 9) =>
      `[macdLine, signalLine, histLine] = ta.macd(close, ${fast}, ${slow}, ${signal})`,
    conditions: {
      'crosses above': () => `ta.crossover(macdLine, signalLine)`,
      'crosses below': () => `ta.crossunder(macdLine, signalLine)`,
      'above zero': () => `macdLine > 0`,
      'below zero': () => `macdLine < 0`,
      'histogram positive': () => `histLine > 0`,
      'histogram negative': () => `histLine < 0`,
      'bullish': () => `ta.crossover(macdLine, signalLine)`,
      'bearish': () => `ta.crossunder(macdLine, signalLine)`,
    },
    plot: `plot(macdLine, "MACD", color=color.blue)\nplot(signalLine, "Signal", color=color.orange)`,
  },
  ema: {
    name: 'EMA',
    declaration: (period = 20, src = 'close') => `emaValue${period} = ta.ema(${src}, ${period})`,
    conditions: {
      'crosses above': (period = 20) => `ta.crossover(close, emaValue${period})`,
      'crosses below': (period = 20) => `ta.crossunder(close, emaValue${period})`,
      'above': (period = 20) => `close > emaValue${period}`,
      'below': (period = 20) => `close < emaValue${period}`,
      'rising': (period = 20) => `emaValue${period} > emaValue${period}[1]`,
    },
    plot: (period = 20) => `plot(emaValue${period}, "EMA ${period}", color=color.yellow, linewidth=2)`,
  },
  sma: {
    name: 'SMA',
    declaration: (period = 50, src = 'close') => `smaValue${period} = ta.sma(${src}, ${period})`,
    conditions: {
      'crosses above': (period = 50) => `ta.crossover(close, smaValue${period})`,
      'crosses below': (period = 50) => `ta.crossunder(close, smaValue${period})`,
      'above': (period = 50) => `close > smaValue${period}`,
      'below': (period = 50) => `close < smaValue${period}`,
    },
    plot: (period = 50) => `plot(smaValue${period}, "SMA ${period}", color=color.blue, linewidth=2)`,
  },
  atr: {
    name: 'ATR',
    declaration: (period = 14) => `atrValue = ta.atr(${period})`,
    conditions: {
      'rising': () => `atrValue > atrValue[1]`,
      'falling': () => `atrValue < atrValue[1]`,
      'high': () => `atrValue > ta.sma(atrValue, 20)`,
      'low': () => `atrValue < ta.sma(atrValue, 20)`,
    },
    plot: `plot(atrValue, "ATR", color=color.orange)`,
  },
  bb: {
    name: 'Bollinger Bands',
    declaration: (period = 20, mult = 2) =>
      `[bbMiddle, bbUpper, bbLower] = ta.bb(close, ${period}, ${mult})`,
    conditions: {
      'crosses above upper': () => `ta.crossover(close, bbUpper)`,
      'crosses below lower': () => `ta.crossunder(close, bbLower)`,
      'above upper': () => `close > bbUpper`,
      'below lower': () => `close < bbLower`,
      'squeeze': () => `(bbUpper - bbLower) < ta.sma(bbUpper - bbLower, 20)`,
    },
    plot: `plot(bbMiddle, "BB Mid", color=color.blue)\nplot(bbUpper, "BB Upper", color=color.gray)\nplot(bbLower, "BB Lower", color=color.gray)`,
  },
  stochastic: {
    name: 'Stochastic',
    declaration: (k = 14, d = 3, smooth = 3) =>
      `stochK = ta.sma(ta.stoch(close, high, low, ${k}), ${smooth})\nstochD = ta.sma(stochK, ${d})`,
    conditions: {
      'oversold': () => `stochK < 20`,
      'overbought': () => `stochK > 80`,
      'crosses above': () => `ta.crossover(stochK, stochD)`,
      'crosses below': () => `ta.crossunder(stochK, stochD)`,
      'bullish': () => `ta.crossover(stochK, stochD) and stochK < 20`,
    },
    plot: `plot(stochK, "Stoch K", color=color.blue)\nplot(stochD, "Stoch D", color=color.orange)`,
  },
  adx: {
    name: 'ADX',
    declaration: (period = 14) =>
      `[diPlus, diMinus, adxValue] = ta.dmi(${period}, ${period})`,
    conditions: {
      'strong trend': () => `adxValue > 25`,
      'weak trend': () => `adxValue < 20`,
      'above': (level = 25) => `adxValue > ${level}`,
      'rising': () => `adxValue > adxValue[1]`,
    },
    plot: `plot(adxValue, "ADX", color=color.yellow)`,
  },
  vwap: {
    name: 'VWAP',
    declaration: () => `vwapValue = ta.vwap(hlc3)`,
    conditions: {
      'above': () => `close > vwapValue`,
      'below': () => `close < vwapValue`,
      'crosses above': () => `ta.crossover(close, vwapValue)`,
      'crosses below': () => `ta.crossunder(close, vwapValue)`,
    },
    plot: `plot(vwapValue, "VWAP", color=color.purple)`,
  },
  supertrend: {
    name: 'Supertrend',
    declaration: (period = 10, factor = 3) =>
      `[supertrend, direction] = ta.supertrend(${factor}, ${period})`,
    conditions: {
      'bullish': () => `direction < 0`,
      'bearish': () => `direction > 0`,
      'flips bullish': () => `direction < 0 and direction[1] > 0`,
      'flips bearish': () => `direction > 0 and direction[1] < 0`,
    },
    plot: `plot(supertrend, "Supertrend", color=direction < 0 ? color.green : color.red)`,
  },
}

/**
 * Parse a strategy description and extract indicator mentions + conditions
 */
function parseStrategy(description) {
  const lower = description.toLowerCase()
  const found = []

  // Extract numbers from the description
  const numbers = [...lower.matchAll(/\b(\d+(?:\.\d+)?)\b/g)].map(m => parseFloat(m[1]))

  for (const [key, indicator] of Object.entries(INDICATORS)) {
    const aliases = [key, indicator.name.toLowerCase()]
    if (key === 'bb') aliases.push('bollinger', 'bband')
    if (key === 'ema') aliases.push('exponential moving average')
    if (key === 'sma') aliases.push('simple moving average', 'moving average')
    if (key === 'atr') aliases.push('average true range')
    if (key === 'adx') aliases.push('average directional')

    for (const alias of aliases) {
      if (lower.includes(alias)) {
        // Find the condition
        let conditionKey = null
        for (const cond of Object.keys(indicator.conditions)) {
          if (lower.includes(cond)) {
            conditionKey = cond
            break
          }
        }

        found.push({
          key,
          indicator,
          conditionKey,
          numbers: [...numbers],
        })
        break
      }
    }
  }

  // Determine entry type
  const isBuy = lower.includes('buy') || lower.includes('long') || lower.includes('enter')
  const isSell = lower.includes('sell') || lower.includes('short')

  return { indicators: found, isBuy, isSell, description }
}

/**
 * Generate Pine Script v5 from parsed strategy
 */
export function generatePineScript(description) {
  const parsed = parseStrategy(description)

  if (parsed.indicators.length === 0) {
    return {
      error: true,
      code: `// Could not parse any indicators from your description.
// 
// Try describing your strategy like:
// "Buy when RSI crosses above 30 and MACD is bullish"
// "Sell when price crosses below EMA 200"
// "Enter long when Bollinger Bands squeeze and RSI is oversold"
//
// Supported indicators: RSI, MACD, EMA, SMA, ATR, Bollinger Bands,
// Stochastic, ADX, VWAP, Supertrend`,
      suggestions: [
        'Buy when RSI crosses above 30 and MACD is bullish',
        'Sell when price crosses below EMA 200 and ADX shows strong trend',
        'Enter long when Bollinger Bands squeeze and Stochastic is oversold',
        'Buy when EMA 9 crosses above EMA 21 and ATR is rising',
        'Short when RSI is overbought and Supertrend flips bearish',
      ],
    }
  }

  // Build declarations
  const declarations = []
  const conditions = []
  const plots = []
  const usedIndicators = new Set()

  for (const item of parsed.indicators) {
    if (usedIndicators.has(item.key)) continue
    usedIndicators.add(item.key)

    const ind = item.indicator
    const period = item.numbers.find(n => n > 1 && n < 500)

    // Generate declaration
    if (typeof ind.declaration === 'function') {
      declarations.push(ind.declaration(period))
    } else {
      declarations.push(ind.declaration)
    }

    // Generate condition
    if (item.conditionKey && ind.conditions[item.conditionKey]) {
      const condFn = ind.conditions[item.conditionKey]
      const level = item.numbers.find(n => n > 0 && n <= 100)
      conditions.push(typeof condFn === 'function' ? condFn(level || period) : condFn)
    } else {
      // Use first condition as default
      const first = Object.values(ind.conditions)[0]
      conditions.push(typeof first === 'function' ? first(period) : first)
    }

    // Generate plot
    if (typeof ind.plot === 'function') {
      plots.push(ind.plot(period))
    } else if (ind.plot) {
      plots.push(ind.plot)
    }
  }

  const entryCondition = conditions.join(' and\n     ')
  const exitCondition = conditions.length > 1
    ? `not (${conditions[0]})`
    : conditions.length === 1
    ? `not (${conditions[0]})`
    : 'false'

  const strategyName = `QuantPad Strategy`

  const code = `//@version=5
strategy("${strategyName}", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

// ===== Indicator Declarations =====
${declarations.join('\n')}

// ===== Entry Conditions =====
longCondition = ${entryCondition}
shortCondition = ${exitCondition}

// ===== Strategy Logic =====
if (longCondition)
    strategy.entry("Long", strategy.long)

if (shortCondition)
    strategy.close("Long")

// ===== Plots =====
${plots.join('\n')}

// ===== Background Color =====
bgcolor(longCondition ? color.new(color.green, 90) : na)
bgcolor(shortCondition ? color.new(color.red, 90) : na)

// ===== Alerts =====
alertcondition(longCondition, title="Long Signal", message="QuantPad: Long entry signal triggered")
alertcondition(shortCondition, title="Exit Signal", message="QuantPad: Exit signal triggered")
`

  return {
    error: false,
    code,
    indicators: [...usedIndicators],
    description,
  }
}
