// ===== Pre-built Strategy Library =====
export const strategies = [
    {
        id: 1,
        name: 'RSI Mean Reversion',
        category: 'Mean Reversion',
        difficulty: 'Beginner',
        description: 'Buys when RSI is oversold (<30) and sells when overbought (>70). Classic mean reversion setup for ranging markets.',
        indicators: ['RSI'],
        entryRules: 'Enter long when RSI(14) crosses below 30',
        exitRules: 'Exit when RSI(14) crosses above 70 or stop loss at 2x ATR',
        stats: { winRate: 58, profitFactor: 1.4, sharpe: 1.1, maxDrawdown: 15 },
        votes: 342,
        pineScript: `//@version=5
strategy("RSI Mean Reversion", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

rsiLength = input.int(14, "RSI Length")
rsiOversold = input.int(30, "Oversold Level")
rsiOverbought = input.int(70, "Overbought Level")
atrLength = input.int(14, "ATR Length")
atrMultiplier = input.float(2.0, "ATR Stop Multiplier")

rsiValue = ta.rsi(close, rsiLength)
atrValue = ta.atr(atrLength)

longCondition = ta.crossunder(rsiValue, rsiOversold)
exitCondition = ta.crossover(rsiValue, rsiOverbought)

if (longCondition)
    strategy.entry("Long", strategy.long)
    strategy.exit("SL", "Long", stop=close - atrValue * atrMultiplier)

if (exitCondition)
    strategy.close("Long")

plot(rsiValue, "RSI", color=color.purple, display=display.pane)
hline(rsiOversold, "Oversold", color=color.green)
hline(rsiOverbought, "Overbought", color=color.red)`,
        analysis: 'Works best in sideways/ranging markets. Tends to get caught in trending markets. Consider adding trend filter (e.g., price above 200 SMA for longs only).'
    },
    {
        id: 2,
        name: 'MACD Crossover',
        category: 'Trend Following',
        difficulty: 'Beginner',
        description: 'Enters when MACD line crosses signal line. Simple trend-following with momentum confirmation.',
        indicators: ['MACD'],
        entryRules: 'Enter long when MACD line crosses above signal line',
        exitRules: 'Exit when MACD line crosses below signal line',
        stats: { winRate: 45, profitFactor: 1.6, sharpe: 0.9, maxDrawdown: 22 },
        votes: 289,
        pineScript: `//@version=5
strategy("MACD Crossover", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

fast = input.int(12, "Fast Length")
slow = input.int(26, "Slow Length")
signal = input.int(9, "Signal Length")

[macdLine, signalLine, hist] = ta.macd(close, fast, slow, signal)

longCondition = ta.crossover(macdLine, signalLine)
shortCondition = ta.crossunder(macdLine, signalLine)

if (longCondition)
    strategy.entry("Long", strategy.long)
if (shortCondition)
    strategy.close("Long")

plot(macdLine, "MACD", color=color.blue, display=display.pane)
plot(signalLine, "Signal", color=color.orange, display=display.pane)`,
        analysis: 'Lower win rate but captures large trends. Add ADX filter (>25) to avoid choppy markets. Works on higher timeframes (4H, Daily).'
    },
    {
        id: 3,
        name: 'EMA Ribbon Trend',
        category: 'Trend Following',
        difficulty: 'Beginner',
        description: 'Uses 3 EMAs (9, 21, 55) to identify and follow trends. Enters on alignment, exits on breakdown.',
        indicators: ['EMA'],
        entryRules: 'Enter long when EMA 9 > EMA 21 > EMA 55',
        exitRules: 'Exit when EMA 9 crosses below EMA 21',
        stats: { winRate: 42, profitFactor: 1.8, sharpe: 1.0, maxDrawdown: 18 },
        votes: 256,
        pineScript: `//@version=5
strategy("EMA Ribbon Trend", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

ema9 = ta.ema(close, 9)
ema21 = ta.ema(close, 21)
ema55 = ta.ema(close, 55)

longCondition = ema9 > ema21 and ema21 > ema55 and ema9[1] <= ema21[1]
exitCondition = ta.crossunder(ema9, ema21)

if (longCondition)
    strategy.entry("Long", strategy.long)
if (exitCondition)
    strategy.close("Long")

plot(ema9, "EMA 9", color=color.green, linewidth=2)
plot(ema21, "EMA 21", color=color.yellow, linewidth=2)
plot(ema55, "EMA 55", color=color.red, linewidth=2)`,
        analysis: 'Strong in trending markets. The triple EMA filter reduces false signals compared to single crossovers. Best on 1H-4H timeframes.'
    },
    {
        id: 4,
        name: 'Bollinger Band Squeeze',
        category: 'Volatility',
        difficulty: 'Intermediate',
        description: 'Identifies low volatility periods (squeeze) and trades the breakout. Combines BB width with momentum.',
        indicators: ['Bollinger Bands', 'RSI'],
        entryRules: 'Enter when BB width contracts below 20-period average and price breaks above upper band',
        exitRules: 'Exit at opposite BB band or RSI overbought',
        stats: { winRate: 52, profitFactor: 1.7, sharpe: 1.3, maxDrawdown: 12 },
        votes: 312,
        pineScript: `//@version=5
strategy("BB Squeeze Breakout", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

bbLength = input.int(20, "BB Length")
bbMult = input.float(2.0, "BB Multiplier")
rsiLength = input.int(14, "RSI Length")

[basis, upper, lower] = ta.bb(close, bbLength, bbMult)
bbWidth = (upper - lower) / basis
avgWidth = ta.sma(bbWidth, 20)
isSqueeze = bbWidth < avgWidth
rsiValue = ta.rsi(close, rsiLength)

longCondition = isSqueeze[1] and close > upper and rsiValue > 50
exitCondition = close < lower or rsiValue > 75

if (longCondition)
    strategy.entry("Long", strategy.long)
if (exitCondition)
    strategy.close("Long")

plot(basis, "Basis", color=color.blue)
plot(upper, "Upper", color=color.gray)
plot(lower, "Lower", color=color.gray)
bgcolor(isSqueeze ? color.new(color.yellow, 90) : na)`,
        analysis: 'Excellent for catching breakouts after consolidation. The squeeze filter dramatically improves signal quality. Works across all timeframes.'
    },
    {
        id: 5,
        name: 'Supertrend Follower',
        category: 'Trend Following',
        difficulty: 'Beginner',
        description: 'Uses Supertrend indicator to follow trends with clear entry/exit signals. Simple but effective.',
        indicators: ['Supertrend'],
        entryRules: 'Enter long when Supertrend flips bullish',
        exitRules: 'Exit when Supertrend flips bearish',
        stats: { winRate: 40, profitFactor: 1.9, sharpe: 0.85, maxDrawdown: 25 },
        votes: 198,
        pineScript: `//@version=5
strategy("Supertrend Follower", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

atrLength = input.int(10, "ATR Length")
factor = input.float(3.0, "Factor")

[supertrend, direction] = ta.supertrend(factor, atrLength)

longCondition = direction < 0 and direction[1] > 0
exitCondition = direction > 0 and direction[1] < 0

if (longCondition)
    strategy.entry("Long", strategy.long)
if (exitCondition)
    strategy.close("Long")

plot(supertrend, "Supertrend", color=direction < 0 ? color.green : color.red, linewidth=2)`,
        analysis: 'Very easy to follow — clear visual signals. Low win rate but large winners in trends. Increase factor for fewer but higher-quality signals.'
    },
    {
        id: 6,
        name: 'VWAP + RSI Scalper',
        category: 'Scalping',
        difficulty: 'Intermediate',
        description: 'Scalps reversals from VWAP with RSI confirmation. Designed for intraday trading.',
        indicators: ['VWAP', 'RSI'],
        entryRules: 'Enter long when price pulls back to VWAP and RSI < 40',
        exitRules: 'Exit at 1R profit or RSI > 65',
        stats: { winRate: 62, profitFactor: 1.3, sharpe: 1.5, maxDrawdown: 8 },
        votes: 275,
        pineScript: `//@version=5
strategy("VWAP + RSI Scalper", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=5)

rsiLength = input.int(14, "RSI Length")
atrLength = input.int(14, "ATR Length")

vwapValue = ta.vwap(hlc3)
rsiValue = ta.rsi(close, rsiLength)
atrValue = ta.atr(atrLength)

nearVWAP = math.abs(close - vwapValue) < atrValue * 0.5
longCondition = nearVWAP and rsiValue < 40 and close > vwapValue
exitCondition = rsiValue > 65 or close > strategy.position_avg_price + atrValue

if (longCondition)
    strategy.entry("Long", strategy.long)
if (exitCondition)
    strategy.close("Long")

plot(vwapValue, "VWAP", color=color.purple, linewidth=2)`,
        analysis: 'High win rate scalping strategy. Best on 5m-15m charts for liquid instruments. Keep position sizes small. VWAP resets daily.'
    },
    {
        id: 7,
        name: 'ADX Trend Filter',
        category: 'Trend Following',
        difficulty: 'Intermediate',
        description: 'Only trades when ADX confirms a strong trend (>25). Uses DI+/DI- crossovers for direction.',
        indicators: ['ADX'],
        entryRules: 'Enter long when DI+ crosses above DI- and ADX > 25',
        exitRules: 'Exit when DI+ crosses below DI- or ADX drops below 20',
        stats: { winRate: 48, profitFactor: 1.5, sharpe: 1.0, maxDrawdown: 16 },
        votes: 187,
        pineScript: `//@version=5
strategy("ADX Trend Filter", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

adxLength = input.int(14, "ADX Length")
adxThreshold = input.int(25, "ADX Threshold")

[diPlus, diMinus, adxValue] = ta.dmi(adxLength, adxLength)

longCondition = ta.crossover(diPlus, diMinus) and adxValue > adxThreshold
exitCondition = ta.crossunder(diPlus, diMinus) or adxValue < 20

if (longCondition)
    strategy.entry("Long", strategy.long)
if (exitCondition)
    strategy.close("Long")

plot(adxValue, "ADX", color=color.yellow, display=display.pane)
plot(diPlus, "DI+", color=color.green, display=display.pane)
plot(diMinus, "DI-", color=color.red, display=display.pane)
hline(adxThreshold, "Threshold", color=color.gray)`,
        analysis: 'ADX filter removes a lot of noise from ranging markets. Best used as an overlay filter with other entry signals.'
    },
    {
        id: 8,
        name: 'Stochastic Divergence',
        category: 'Mean Reversion',
        difficulty: 'Advanced',
        description: 'Detects divergence between price and Stochastic oscillator for reversal entries.',
        indicators: ['Stochastic'],
        entryRules: 'Enter long on bullish divergence (price lower low, stochastic higher low) in oversold zone',
        exitRules: 'Exit when stochastic enters overbought zone (>80)',
        stats: { winRate: 55, profitFactor: 1.6, sharpe: 1.2, maxDrawdown: 14 },
        votes: 163,
        pineScript: `//@version=5
strategy("Stochastic Divergence", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

kLength = input.int(14, "K Length")
dLength = input.int(3, "D Length")
smooth = input.int(3, "Smooth")

stochK = ta.sma(ta.stoch(close, high, low, kLength), smooth)
stochD = ta.sma(stochK, dLength)

// Simplified divergence detection
priceLow = ta.lowest(low, 10)
stochLow = ta.lowest(stochK, 10)
bullishDiv = close <= priceLow * 1.01 and stochK > stochLow + 5 and stochK < 25

longCondition = bullishDiv
exitCondition = stochK > 80

if (longCondition)
    strategy.entry("Long", strategy.long)
if (exitCondition)
    strategy.close("Long")

plot(stochK, "K", color=color.blue, display=display.pane)
plot(stochD, "D", color=color.orange, display=display.pane)
hline(20, "Oversold")
hline(80, "Overbought")`,
        analysis: 'Divergence signals are powerful but less frequent. Requires patience. Most effective on 1H+ timeframes. Combine with support levels.'
    },
    {
        id: 9,
        name: 'Dual EMA + ATR Trailing',
        category: 'Trend Following',
        difficulty: 'Intermediate',
        description: 'EMA crossover entry with ATR-based trailing stop. Lets winners run while cutting losers quickly.',
        indicators: ['EMA', 'ATR'],
        entryRules: 'Enter long when EMA 9 crosses above EMA 21',
        exitRules: 'Trailing stop at 2x ATR below highest high since entry',
        stats: { winRate: 38, profitFactor: 2.1, sharpe: 1.1, maxDrawdown: 20 },
        votes: 234,
        pineScript: `//@version=5
strategy("Dual EMA + ATR Trailing", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

fastLen = input.int(9, "Fast EMA")
slowLen = input.int(21, "Slow EMA")
atrLen = input.int(14, "ATR Length")
atrMult = input.float(2.0, "ATR Multiplier")

emaFast = ta.ema(close, fastLen)
emaSlow = ta.ema(close, slowLen)
atrValue = ta.atr(atrLen)

longCondition = ta.crossover(emaFast, emaSlow)

if (longCondition)
    strategy.entry("Long", strategy.long)
    strategy.exit("Trail", "Long", trail_points=atrValue * atrMult / syminfo.mintick, trail_offset=atrValue * atrMult / syminfo.mintick)

plot(emaFast, "Fast EMA", color=color.green, linewidth=2)
plot(emaSlow, "Slow EMA", color=color.red, linewidth=2)`,
        analysis: 'ATR trailing stop adapts to volatility. Low win rate compensated by outsized winners. Excellent for trending crypto and forex pairs.'
    },
    {
        id: 10,
        name: 'Opening Range Breakout',
        category: 'Breakout',
        difficulty: 'Intermediate',
        description: 'Trades breakouts from the first 30-minute range of the trading session.',
        indicators: ['Custom Range'],
        entryRules: 'Enter long/short on break of first 30-min high/low',
        exitRules: 'Exit at session close or 2x range profit target',
        stats: { winRate: 50, profitFactor: 1.5, sharpe: 1.2, maxDrawdown: 10 },
        votes: 298,
        pineScript: `//@version=5
strategy("Opening Range Breakout", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

sessionStart = input.session("0930-1000", "Opening Range Session")
isORSession = not na(time(timeframe.period, sessionStart))

var float orHigh = na
var float orLow = na
var bool orDefined = false

if isORSession
    if na(orHigh) or not isORSession[1]
        orHigh := high
        orLow := low
        orDefined := false
    else
        orHigh := math.max(orHigh, high)
        orLow := math.min(orLow, low)
else if not orDefined and not na(orHigh)
    orDefined := true

longCondition = orDefined and ta.crossover(close, orHigh)
shortCondition = orDefined and ta.crossunder(close, orLow)

if (longCondition)
    strategy.entry("Long", strategy.long)
if (shortCondition)
    strategy.entry("Short", strategy.short)

plot(orDefined ? orHigh : na, "OR High", color=color.green, style=plot.style_linebr)
plot(orDefined ? orLow : na, "OR Low", color=color.red, style=plot.style_linebr)`,
        analysis: 'Classic intraday strategy used by professional day traders. Works best on indices (ES, NQ) and large-cap stocks. Morning volatility provides fuel.'
    },
    {
        id: 11,
        name: 'RSI + MACD Confluence',
        category: 'Momentum',
        difficulty: 'Intermediate',
        description: 'Requires both RSI and MACD to confirm before entry. Double confirmation reduces false signals.',
        indicators: ['RSI', 'MACD'],
        entryRules: 'Enter long when RSI > 50 and MACD crosses above signal line',
        exitRules: 'Exit when RSI < 40 or MACD crosses below signal',
        stats: { winRate: 54, profitFactor: 1.5, sharpe: 1.15, maxDrawdown: 13 },
        votes: 245,
        pineScript: `//@version=5
strategy("RSI + MACD Confluence", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

rsiValue = ta.rsi(close, 14)
[macdLine, signalLine, hist] = ta.macd(close, 12, 26, 9)

longCondition = rsiValue > 50 and ta.crossover(macdLine, signalLine)
exitCondition = rsiValue < 40 or ta.crossunder(macdLine, signalLine)

if (longCondition)
    strategy.entry("Long", strategy.long)
if (exitCondition)
    strategy.close("Long")

bgcolor(longCondition ? color.new(color.green, 90) : na)`,
        analysis: 'Double confirmation significantly reduces whipsaws. Slightly lower signal frequency but higher conviction entries.'
    },
    {
        id: 12,
        name: 'Keltner Channel Breakout',
        category: 'Volatility',
        difficulty: 'Intermediate',
        description: 'Trades breakouts from Keltner Channels, which adapt to volatility using ATR.',
        indicators: ['EMA', 'ATR'],
        entryRules: 'Enter long when close breaks above upper Keltner Channel',
        exitRules: 'Exit at middle band (EMA 20) or lower band',
        stats: { winRate: 43, profitFactor: 1.7, sharpe: 0.95, maxDrawdown: 19 },
        votes: 156,
        pineScript: `//@version=5
strategy("Keltner Channel Breakout", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

kcLength = input.int(20, "KC Length")
kcMult = input.float(2.0, "KC Multiplier")
atrLen = input.int(14, "ATR Length")

basis = ta.ema(close, kcLength)
atrVal = ta.atr(atrLen)
upper = basis + kcMult * atrVal
lower = basis - kcMult * atrVal

longCondition = ta.crossover(close, upper)
exitCondition = close < basis

if (longCondition)
    strategy.entry("Long", strategy.long)
if (exitCondition)
    strategy.close("Long")

plot(basis, "Basis", color=color.blue)
plot(upper, "Upper", color=color.green)
plot(lower, "Lower", color=color.red)`,
        analysis: 'Similar to Bollinger Bands but uses ATR instead of standard deviation. More consistent in trending markets.'
    },
    {
        id: 13,
        name: 'Inside Bar Breakout',
        category: 'Breakout',
        difficulty: 'Beginner',
        description: 'Identifies inside bars (bars contained within the previous bar) and trades the breakout direction.',
        indicators: ['Price Action'],
        entryRules: 'Enter in direction of break from inside bar',
        exitRules: 'Stop at opposite end of mother bar, target at 2R',
        stats: { winRate: 48, profitFactor: 1.5, sharpe: 0.9, maxDrawdown: 15 },
        votes: 201,
        pineScript: `//@version=5
strategy("Inside Bar Breakout", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

isInsideBar = high < high[1] and low > low[1]
motherHigh = high[1]
motherLow = low[1]

var float entryHigh = na
var float entryLow = na

if isInsideBar
    entryHigh := motherHigh
    entryLow := motherLow

longCondition = not isInsideBar and isInsideBar[1] and close > entryHigh
shortCondition = not isInsideBar and isInsideBar[1] and close < entryLow

if (longCondition)
    strategy.entry("Long", strategy.long)
    strategy.exit("SL", "Long", stop=entryLow, limit=close + 2 * (close - entryLow))
if (shortCondition)
    strategy.entry("Short", strategy.short)
    strategy.exit("SL", "Short", stop=entryHigh, limit=close - 2 * (entryHigh - close))

bgcolor(isInsideBar ? color.new(color.yellow, 85) : na)`,
        analysis: 'Pure price action strategy — no indicators needed. Very versatile across timeframes and instruments. Works best with volume confirmation.'
    },
    {
        id: 14,
        name: 'Momentum Squeeze',
        category: 'Momentum',
        difficulty: 'Advanced',
        description: 'Combines Bollinger Band squeeze detection with momentum direction for explosive breakout entries.',
        indicators: ['Bollinger Bands', 'Keltner Channels'],
        entryRules: 'Enter when BB inside KC (squeeze) releases with positive momentum',
        exitRules: 'Exit when momentum reverses',
        stats: { winRate: 51, profitFactor: 1.8, sharpe: 1.3, maxDrawdown: 14 },
        votes: 267,
        pineScript: `//@version=5
strategy("Momentum Squeeze", overlay=false, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

bbLen = input.int(20, "BB Length")
bbMult = input.float(2.0, "BB Multiplier")
kcLen = input.int(20, "KC Length")
kcMult = input.float(1.5, "KC Multiplier")

[bbBasis, bbUp, bbLow] = ta.bb(close, bbLen, bbMult)
kcBasis = ta.ema(close, kcLen)
kcRange = ta.atr(kcLen) * kcMult
kcUp = kcBasis + kcRange
kcLow = kcBasis - kcRange

sqzOn = bbLow > kcLow and bbUp < kcUp
sqzOff = not sqzOn
noSqz = not sqzOn and not sqzOff

mom = ta.linreg(close - ta.sma(close, bbLen), bbLen, 0)

longCondition = sqzOff and sqzOn[1] and mom > 0
exitCondition = mom < 0 and mom[1] > 0

if (longCondition)
    strategy.entry("Long", strategy.long)
if (exitCondition)
    strategy.close("Long")

plot(mom, "Momentum", color=mom > 0 ? (mom > mom[1] ? color.lime : color.green) : (mom < mom[1] ? color.red : color.maroon), style=plot.style_histogram)
bgcolor(sqzOn ? color.new(color.black, 80) : na)`,
        analysis: 'The "TTM Squeeze" concept by John Carter. One of the most popular institutional setups. Best on 15m-1H for day trading.'
    },
    {
        id: 15,
        name: 'Pivot Point Reversal',
        category: 'Mean Reversion',
        difficulty: 'Intermediate',
        description: 'Uses daily pivot points (S1, S2, R1, R2) as support/resistance for mean reversion trades.',
        indicators: ['Pivot Points'],
        entryRules: 'Enter long at S1 support, short at R1 resistance',
        exitRules: 'Exit at pivot point (center) for profit target',
        stats: { winRate: 56, profitFactor: 1.4, sharpe: 1.1, maxDrawdown: 11 },
        votes: 178,
        pineScript: `//@version=5
strategy("Pivot Point Reversal", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

pivotHigh = request.security(syminfo.tickerid, "D", high[1])
pivotLow = request.security(syminfo.tickerid, "D", low[1])
pivotClose = request.security(syminfo.tickerid, "D", close[1])

pp = (pivotHigh + pivotLow + pivotClose) / 3
s1 = 2 * pp - pivotHigh
r1 = 2 * pp - pivotLow

longCondition = ta.crossover(close, s1) and close < pp
shortCondition = ta.crossunder(close, r1) and close > pp

if (longCondition)
    strategy.entry("Long", strategy.long)
    strategy.exit("TP", "Long", limit=pp)
if (shortCondition)
    strategy.entry("Short", strategy.short)
    strategy.exit("TP", "Short", limit=pp)

plot(pp, "PP", color=color.yellow, linewidth=2)
plot(s1, "S1", color=color.green)
plot(r1, "R1", color=color.red)`,
        analysis: 'Used by floor traders for decades. Pivot points are self-fulfilling — many traders watch them. Best for intraday forex trading.'
    },
    {
        id: 16,
        name: 'Volume-Weighted Momentum',
        category: 'Momentum',
        difficulty: 'Advanced',
        description: 'Weights momentum signals by volume to filter out low-conviction moves.',
        indicators: ['Volume', 'EMA'],
        entryRules: 'Enter long when price momentum is positive AND volume is above average',
        exitRules: 'Exit when momentum turns negative or volume dries up',
        stats: { winRate: 50, profitFactor: 1.6, sharpe: 1.2, maxDrawdown: 16 },
        votes: 145,
        pineScript: `//@version=5
strategy("Volume-Weighted Momentum", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

momLen = input.int(10, "Momentum Length")
volLen = input.int(20, "Volume MA Length")
volThreshold = input.float(1.5, "Volume Threshold")

mom = close - close[momLen]
volMA = ta.sma(volume, volLen)
highVol = volume > volMA * volThreshold

longCondition = mom > 0 and mom[1] <= 0 and highVol
exitCondition = mom < 0

if (longCondition)
    strategy.entry("Long", strategy.long)
if (exitCondition)
    strategy.close("Long")

bgcolor(highVol ? color.new(color.blue, 90) : na)`,
        analysis: 'Volume confirmation is crucial — it separates real moves from noise. Works exceptionally well for stocks and crypto.'
    },
    {
        id: 17,
        name: 'Multi-Timeframe RSI',
        category: 'Multi-Timeframe',
        difficulty: 'Advanced',
        description: 'Aligns RSI readings from multiple timeframes for high-probability entries.',
        indicators: ['RSI'],
        entryRules: 'Enter long when RSI is oversold on daily AND 4H shows bullish divergence',
        exitRules: 'Exit when daily RSI reaches 60 or 4H RSI reaches 70',
        stats: { winRate: 60, profitFactor: 1.7, sharpe: 1.4, maxDrawdown: 12 },
        votes: 223,
        pineScript: `//@version=5
strategy("Multi-TF RSI", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

rsiCurrent = ta.rsi(close, 14)
rsiHTF = request.security(syminfo.tickerid, "240", ta.rsi(close, 14))

longCondition = rsiCurrent < 35 and rsiHTF < 45 and rsiCurrent > rsiCurrent[1]
exitCondition = rsiCurrent > 65 or rsiHTF > 70

if (longCondition)
    strategy.entry("Long", strategy.long)
if (exitCondition)
    strategy.close("Long")

plot(rsiCurrent, "RSI Current", color=color.blue, display=display.pane)
plot(rsiHTF, "RSI HTF", color=color.orange, display=display.pane)
hline(30)
hline(70)`,
        analysis: 'Multi-timeframe alignment dramatically improves win rate. Higher timeframe acts as trend filter. Best for swing trading.'
    },
    {
        id: 18,
        name: 'Ichimoku Cloud Strategy',
        category: 'Trend Following',
        difficulty: 'Advanced',
        description: 'Full Ichimoku trading system — cloud breakout with Tenkan/Kijun cross confirmation.',
        indicators: ['Ichimoku Cloud'],
        entryRules: 'Enter long when price above cloud, Tenkan crosses above Kijun, and Chikou above price',
        exitRules: 'Exit when Tenkan crosses below Kijun',
        stats: { winRate: 44, profitFactor: 1.9, sharpe: 1.0, maxDrawdown: 22 },
        votes: 189,
        pineScript: `//@version=5
strategy("Ichimoku Cloud Strategy", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

tenkan = ta.ema(hl2, 9)
kijun = ta.ema(hl2, 26)
senkouA = (tenkan + kijun) / 2
senkouB = ta.ema(hl2, 52)
chikou = close

aboveCloud = close > math.max(senkouA[26], senkouB[26])
tkCross = ta.crossover(tenkan, kijun)

longCondition = aboveCloud and tkCross
exitCondition = ta.crossunder(tenkan, kijun)

if (longCondition)
    strategy.entry("Long", strategy.long)
if (exitCondition)
    strategy.close("Long")

plot(tenkan, "Tenkan", color=color.blue)
plot(kijun, "Kijun", color=color.red)
p1 = plot(senkouA, "Senkou A", color=color.green, offset=26)
p2 = plot(senkouB, "Senkou B", color=color.red, offset=26)
fill(p1, p2, color=senkouA > senkouB ? color.new(color.green, 90) : color.new(color.red, 90))`,
        analysis: 'Complete trading system in one indicator. The cloud provides dynamic support/resistance. Best on daily charts for positions lasting weeks.'
    },
    {
        id: 19,
        name: 'Mean Reversion Pairs',
        category: 'Mean Reversion',
        difficulty: 'Advanced',
        description: 'Trades the spread between correlated instruments when it deviates from the mean.',
        indicators: ['Z-Score'],
        entryRules: 'Enter when z-score of spread exceeds ±2 standard deviations',
        exitRules: 'Exit when z-score returns to 0',
        stats: { winRate: 65, profitFactor: 1.3, sharpe: 1.5, maxDrawdown: 9 },
        votes: 134,
        pineScript: `//@version=5
strategy("Mean Reversion Z-Score", overlay=false, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

// Uses single instrument z-score as proxy for pair trading concept
length = input.int(50, "Z-Score Length")
threshold = input.float(2.0, "Entry Threshold")

basis = ta.sma(close, length)
dev = ta.stdev(close, length)
zScore = (close - basis) / dev

longCondition = zScore < -threshold
shortCondition = zScore > threshold
exitLong = zScore > -0.5 and strategy.position_size > 0
exitShort = zScore < 0.5 and strategy.position_size < 0

if (longCondition)
    strategy.entry("Long", strategy.long)
if (shortCondition)
    strategy.entry("Short", strategy.short)
if (exitLong)
    strategy.close("Long")
if (exitShort)
    strategy.close("Short")

plot(zScore, "Z-Score", color=color.blue)
hline(threshold, "Upper", color=color.red)
hline(-threshold, "Lower", color=color.green)
hline(0, "Zero", color=color.gray)`,
        analysis: 'Statistical arbitrage approach. High win rate but tail risk exists. Z-Score of 2.0 provides good balance between frequency and quality.'
    },
    {
        id: 20,
        name: 'Engulfing Pattern Scanner',
        category: 'Price Action',
        difficulty: 'Beginner',
        description: 'Detects bullish and bearish engulfing candlestick patterns for reversal entries.',
        indicators: ['Candlestick Patterns'],
        entryRules: 'Enter long on bullish engulfing at support, short on bearish engulfing at resistance',
        exitRules: 'Exit at 2R target or stop below engulfing candle',
        stats: { winRate: 52, profitFactor: 1.4, sharpe: 0.85, maxDrawdown: 18 },
        votes: 267,
        pineScript: `//@version=5
strategy("Engulfing Pattern Scanner", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

atrValue = ta.atr(14)

bullish = close > open and close[1] < open[1] and close > open[1] and open < close[1]
bearish = close < open and close[1] > open[1] and close < open[1] and open > close[1]

if (bullish)
    strategy.entry("Long", strategy.long)
    strategy.exit("SL/TP", "Long", stop=low - atrValue * 0.5, limit=close + atrValue * 2)

if (bearish)
    strategy.entry("Short", strategy.short)
    strategy.exit("SL/TP", "Short", stop=high + atrValue * 0.5, limit=close - atrValue * 2)

plotshape(bullish, title="Bullish Engulfing", location=location.belowbar, color=color.green, style=shape.triangleup, size=size.small)
plotshape(bearish, title="Bearish Engulfing", location=location.abovebar, color=color.red, style=shape.triangledown, size=size.small)`,
        analysis: 'One of the most reliable candlestick patterns. Add volume and location context (near S/R levels) for much higher accuracy.'
    },
    {
        id: 21,
        name: 'Heikin Ashi Trend',
        category: 'Trend Following',
        difficulty: 'Beginner',
        description: 'Uses Heikin Ashi candles to smooth out noise and identify clean trends.',
        indicators: ['Heikin Ashi'],
        entryRules: 'Enter long when 3 consecutive bullish HA candles with no lower wick',
        exitRules: 'Exit on first bearish HA candle',
        stats: { winRate: 39, profitFactor: 2.0, sharpe: 0.95, maxDrawdown: 24 },
        votes: 176,
        pineScript: `//@version=5
strategy("Heikin Ashi Trend", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

haClose = (open + high + low + close) / 4
var float haOpen = na
haOpen := na(haOpen[1]) ? (open + close) / 2 : (haOpen[1] + haClose[1]) / 2
haHigh = math.max(high, math.max(haOpen, haClose))
haLow = math.min(low, math.min(haOpen, haClose))

bullish = haClose > haOpen
noLowerWick = haLow == math.min(haOpen, haClose)
strongBullish = bullish and bullish[1] and bullish[2]

longCondition = strongBullish and not strongBullish[1]
exitCondition = not bullish and bullish[1]

if (longCondition)
    strategy.entry("Long", strategy.long)
if (exitCondition)
    strategy.close("Long")

barcolor(bullish ? color.green : color.red)`,
        analysis: 'Heikin Ashi smooths out noise beautifully. Low win rate but exceptional at catching big moves. Pair with volume for best results.'
    },
    {
        id: 22,
        name: 'Triple Screen System',
        category: 'Multi-Timeframe',
        difficulty: 'Advanced',
        description: 'Alexander Elder\'s triple screen: weekly trend, daily momentum, intraday entry.',
        indicators: ['EMA', 'MACD', 'Stochastic'],
        entryRules: 'Weekly EMA trending up → Daily MACD pullback → Intraday stochastic oversold entry',
        exitRules: 'Trail stop using daily ATR',
        stats: { winRate: 55, profitFactor: 1.7, sharpe: 1.3, maxDrawdown: 15 },
        votes: 198,
        pineScript: `//@version=5
strategy("Triple Screen System", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

// Screen 1: Trend (higher TF)
emaHTF = request.security(syminfo.tickerid, "W", ta.ema(close, 13))
trendUp = close > emaHTF

// Screen 2: Momentum (current TF)
[macdLine, signalLine, hist] = ta.macd(close, 12, 26, 9)
momentumPullback = hist < 0 and hist > hist[1]

// Screen 3: Entry (lower TF precision using stochastic)
stochK = ta.sma(ta.stoch(close, high, low, 14), 3)
entrySignal = stochK < 30 and stochK > stochK[1]

longCondition = trendUp and momentumPullback and entrySignal
exitCondition = not trendUp or stochK > 80

if (longCondition)
    strategy.entry("Long", strategy.long)
if (exitCondition)
    strategy.close("Long")

bgcolor(trendUp ? color.new(color.green, 95) : color.new(color.red, 95))`,
        analysis: 'One of the most respected systematic approaches in trading literature. Multiple timeframe confirmation provides high-quality setups.'
    },
]

export const categories = [...new Set(strategies.map(s => s.category))]
export const difficulties = ['Beginner', 'Intermediate', 'Advanced']
