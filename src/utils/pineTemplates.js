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
    category: 'Momentum',
    role: 'Overbought/Oversold Oscillator',
    description: 'Measures the speed and change of price movements to identify overbought or oversold conditions.',
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
    category: 'Momentum/Trend',
    role: 'Trend Following Momentum',
    description: 'Shows the relationship between two moving averages of a security’s price.',
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
    category: 'Trend',
    role: 'Dynamic Support/Resistance',
    description: 'A type of moving average that places a greater weight and significance on the most recent data points.',
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
    category: 'Trend',
    role: 'Baseline Trend Filter',
    description: 'Calculates the average of a selected range of prices by the number of periods in that range.',
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
    category: 'Volatility',
    role: 'Risk Measurement',
    description: 'Measures market volatility by decomposing the entire range of an asset price for that period.',
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
    category: 'Volatility/Trend',
    role: 'Volatility Bands',
    description: 'Consists of a middle band (SMA) and two outer bands (standard deviations) to identify price clusters.',
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
    category: 'Momentum',
    role: 'Trend Reversal Signal',
    description: 'Compares a particular closing price of a security to a range of its prices over a certain period of time.',
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
    category: 'Trend Strength',
    role: 'Trend Filter',
    description: 'Used to determine the strength of a trend. Values above 25 usually indicate a strong trend.',
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
    category: 'Volume/Trend',
    role: 'Institutional Baseline',
    description: 'The average price a security has traded at throughout the day, based on both volume and price.',
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
    category: 'Trend',
    role: 'Trend Direction Filter',
    description: 'A trend-following indicator based on ATR and Median Price to identify direction and trailing stops.',
  },
  liquidity: {
    name: 'Liquidity Sweep',
    declaration: (length = 20) => `
// Liquidity Sweep Logic
highestHigh${length} = ta.highest(high, ${length})
lowestLow${length} = ta.lowest(low, ${length})
sweepHigh = high > highestHigh${length}[1] and close < highestHigh${length}[1]
sweepLow = low < lowestLow${length}[1] and close > lowestLow${length}[1]`,
    conditions: {
      'bullish': () => `sweepLow`,
      'bearish': () => `sweepHigh`,
      'bullish sweep': () => `sweepLow`,
      'bearish sweep': () => `sweepHigh`,
    },
    plot: `plotshape(sweepHigh, style=shape.triangledown, location=location.abovebar, color=color.red, size=size.small, title="Sweep High")\nplotshape(sweepLow, style=shape.triangleup, location=location.belowbar, color=color.green, size=size.small, title="Sweep Low")`,
    category: 'SMC',
    role: 'Liquidity Hunter',
    description: 'Identifies where "stop hunts" or liquidity grabs occur at previous highs or lows.',
  },
  fvg: {
    name: 'Fair Value Gap',
    declaration: () => `
// FVG Logic
bullishFVG = low > high[2] and close[1] > open[1]
bearishFVG = high < low[2] and close[1] < open[1]`,
    conditions: {
      'bullish': () => `bullishFVG`,
      'bearish': () => `bearishFVG`,
      'created': () => `bullishFVG or bearishFVG`,
    },
    plot: `bgcolor(bullishFVG ? color.new(color.green, 90) : na, title="Bullish FVG")\nbgcolor(bearishFVG ? color.new(color.red, 90) : na, title="Bearish FVG")`,
    category: 'SMC',
    role: 'Imbalance Detector',
    description: 'Spots price inefficiencies where orders were not balanced, often acting as magnetic price zones.',
  },
  ob: {
    name: 'Order Block',
    declaration: () => `
// Order Block Logic
isBullishOB = close > open and close[1] < open[1] and close > high[1]
isBearishOB = close < open and close[1] > open[1] and close < low[1]`,
    conditions: {
      'bullish': () => `isBullishOB`,
      'bearish': () => `isBearishOB`,
      'formed bullish': () => `isBullishOB`,
      'formed bearish': () => `isBearishOB`,
    },
    plot: `plotshape(isBullishOB, style=shape.labelup, location=location.belowbar, color=color.green, text="OB", textcolor=color.white, size=size.tiny)\nplotshape(isBearishOB, style=shape.labeldown, location=location.abovebar, color=color.red, text="OB", textcolor=color.white, size=size.tiny)`,
    category: 'SMC/Supply-Demand',
    role: 'Institutional Order Zone',
    description: 'Marks where large institutional orders were placed, often leading to strong price reactions.',
  },
  choch: {
    name: 'Change of Character',
    declaration: (length = 10) => `
// ChoCh Logic
swingHigh${length} = ta.highest(high, ${length})
swingLow${length} = ta.lowest(low, ${length})
chochBullish = ta.crossover(close, swingHigh${length}[1])
chochBearish = ta.crossunder(close, swingLow${length}[1])`,
    conditions: {
      'bullish': () => `chochBullish`,
      'bearish': () => `chochBearish`
    },
    plot: `plotshape(chochBullish, style=shape.arrowup, location=location.belowbar, color=color.green, size=size.small, title="ChoCh Bullish")\nplotshape(chochBearish, style=shape.arrowdown, location=location.abovebar, color=color.red, size=size.small, title="ChoCh Bearish")`,
    category: 'SMC/Market Structure',
    role: 'Structural Shift',
    description: 'Signals the first sign of a potential trend reversal by breaking the internal market structure.',
  }
}

/**
 * Parse a strategy description and extract indicator mentions + conditions
 */
export function parseStrategy(description) {
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
    if (key === 'fvg') aliases.push('fair value gap', 'imbalance')
    if (key === 'ob') aliases.push('order block', 'orderblock')
    if (key === 'liquidity') aliases.push('liquidity sweep', 'sweep', 'stop hunt')
    if (key === 'choch') aliases.push('change of character', 'market structure shift', 'mss')

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
// Stochastic, ADX, VWAP, Supertrend, Liquidity Sweep, FVG, Order Block, ChoCh`,
      suggestions: [
        'Buy on bullish liquidity sweep and RSI oversold',
        'Enter when bullish FVG is created and MACD crosses above',
        'Long when bullish Order Block is formed and ChoCh is bullish',
        'Buy when RSI crosses above 30 and MACD is bullish',
        'Sell when price crosses below EMA 200 and ADX shows strong trend',
        'Short when bearish liquidity sweep happens and Supertrend flips bearish',
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
if (longCondition)
    alert("QuantPad: Long entry signal triggered", alert.freq_once_per_bar_close)
if (shortCondition)
    alert("QuantPad: Exit signal triggered", alert.freq_once_per_bar_close)
`

  return {
    error: false,
    code,
    indicators: [...usedIndicators],
    description,
  }
}
