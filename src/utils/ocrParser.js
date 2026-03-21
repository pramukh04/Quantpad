// ===== OCR Parser Utility =====
// Extracts trade data from screenshot images using Tesseract.js

import { createWorker } from 'tesseract.js'

// Known column name mappings (matching what parseTrades supports)
const COLUMN_ALIASES = {
  date: ['date', 'datetime', 'time', 'timestamp', 'trade_date', 'entry_date', 'exit_date'],
  type: ['type', 'side', 'direction', 'action', 'buy/sell', 'buy_sell', 'b/s'],
  price: ['price', 'entry_price', 'exit_price', 'avg_price', 'fill_price', 'avg'],
  quantity: ['quantity', 'qty', 'size', 'lots', 'shares', 'units', 'volume', 'vol'],
  pnl: ['pnl', 'p&l', 'p/l', 'profit', 'profit/loss', 'profit_loss', 'net_pnl', 'realized_pnl', 'realised_pnl', 'gain', 'return', 'result', 'net', 'p8l', 'pbl', 'pel', 'pal'],
  symbol: ['symbol', 'ticker', 'instrument', 'stock', 'scrip', 'name', 'asset'],
}

/**
 * Clean a numeric string by removing currency symbols, commas, spaces etc.
 * Uses aggressive stripping to handle OCR misreads of symbols like ₹
 */
function cleanNumber(str) {
  if (!str || typeof str !== 'string') return str

  let cleaned = str.trim()
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1)
  }

  // Normalize OCR misreads of minus sign (em-dash, en-dash, tilde, underscore)
  cleaned = cleaned.replace(/[—–~_]/g, '-')

  // Extract the sign by checking if a minus occurs before the first digit
  const firstDigitIdx = cleaned.search(/\d/)
  const prefix = firstDigitIdx >= 0 ? cleaned.substring(0, firstDigitIdx) : cleaned
  const isNegative = prefix.includes('-')

  // Remove everything except digits and decimal point
  cleaned = cleaned.replace(/[^0-9.]/g, '')

  // Keep only the LAST decimal point if multiple exist (fixes "1,290.50" misread as "1.290.50")
  const parts = cleaned.split('.')
  if (parts.length > 2) {
    const integerPart = parts.slice(0, -1).join('')
    const decimalPart = parts[parts.length - 1]
    cleaned = integerPart + '.' + decimalPart
  }

  // Re-apply negative sign
  if (isNegative && cleaned.length > 0) {
    cleaned = '-' + cleaned
  }

  return cleaned
}

/**
 * Identify which known column a header name maps to
 */
function identifyColumn(headerName) {
  const normalized = headerName.toLowerCase().trim().replace(/[^a-z0-9/&]/g, '_')
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      if (normalized === alias || normalized.includes(alias)) {
        return canonical
      }
    }
  }
  return null
}

/**
 * Try to split OCR text lines into table rows
 * Uses multiple strategies: tab-separated, multi-space-separated, pipe-separated
 */
function splitIntoColumns(line) {
  // Safe pre-processing to fix common OCR spacing issues without altering actual data layout
  let processed = line
    // Remove spaces between sign and currency/number (e.g. "- ₹9,200" -> "-₹9,200")
    .replace(/([—–~_=\-+])\s+([₹$€£¥\d])/g, '$1$2')
    // Remove spaces around hyphens in dates (e.g. "01 - Apr - 2021" -> "01-Apr-2021")
    .replace(/(\d{1,2})\s*[-/]\s*([A-Za-z]{3})\s*[-/]\s*(\d{2,4})/g, '$1-$2-$3')

  // Strategy 1: Tab-separated
  if (processed.includes('\t')) {
    return processed.split('\t').map(s => s.trim()).filter(Boolean)
  }

  // Strategy 2: Pipe-separated
  if (processed.includes('|')) {
    return processed.split('|').map(s => s.trim()).filter(Boolean)
  }

  // Strategy 3: Multiple spaces (2+) as delimiter
  const parts = processed.split(/\s{2,}/).map(s => s.trim()).filter(Boolean)
  if (parts.length >= 3) return parts

  // Strategy 4: Single-space split but try to keep date tokens together
  const tokens = processed.split(/\s+/).map(s => s.trim()).filter(Boolean)
  return tokens
}

/**
 * Detect if a row looks like a header row
 */
function isHeaderRow(columns) {
  const foundSet = new Set()
  for (const col of columns) {
    const canonical = identifyColumn(col)
    if (canonical) {
      foundSet.add(canonical)
    }
  }
  // Require at least 3 DISTINCT known headers to avoid false positives on summary rows
  return foundSet.size >= 3
}

/**
 * Detect if a value looks like a date
 */
function looksLikeDate(val) {
  if (!val) return false
  // Matches common date patterns
  return /\d{1,4}[-/\.]\d{1,2}[-/\.]\d{1,4}/.test(val) ||
    /\d{1,2}[\s\-/]+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(val) ||
    /^\d{4}-\d{2}-\d{2}/.test(val)
}

/**
 * Detect if a value looks like a number (including negative/currency)
 */
function looksLikeNumber(val) {
  if (!val) return false
  const cleaned = cleanNumber(val)
  return !isNaN(parseFloat(cleaned)) && isFinite(cleaned)
}

/**
 * Run OCR on an image file and extract trade data
 * @param {File} imageFile - The image file to process
 * @param {Function} onProgress - Progress callback (0-100)
 * @returns {Promise<{rows: Array, headers: Array, rawText: string}>}
 */
export async function extractTradesFromImage(imageFile, onProgress = () => { }) {
  // Create Tesseract worker
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && m.progress) {
        onProgress(Math.round(m.progress * 100))
      }
    }
  })

  try {
    // Run OCR
    const { data: { text } } = await worker.recognize(imageFile)
    await worker.terminate()

    // Split into lines and filter empties
    const lines = text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)

    if (lines.length < 2) {
      throw new Error('Could not detect enough text in the image. Try a clearer screenshot of a trade table.')
    }

    // Split each line into columns
    const allRows = lines.map(line => splitIntoColumns(line))

    // Find header row
    let headerIdx = -1
    for (let i = 0; i < Math.min(allRows.length, 5); i++) {
      if (isHeaderRow(allRows[i])) {
        headerIdx = i
        break
      }
    }

    let headers, dataRows

    if (headerIdx >= 0) {
      // We found a header row — map columns
      headers = allRows[headerIdx].map(h => identifyColumn(h) || h.toLowerCase())
      dataRows = allRows.slice(headerIdx + 1)
    } else {
      // No header detected — try to auto-detect column positions by content
      headers = autoDetectHeaders(allRows)
      dataRows = allRows
    }

    // Convert data rows to objects
    const rows = dataRows
      .filter(row => row.length >= 2) // need at least 2 values
      .map(row => {
        const obj = {}

        // Find if we have a text column that usually contains spaces to absorb extra tokens
        let absorbIdx = headers.indexOf('symbol')
        if (absorbIdx === -1) absorbIdx = headers.indexOf('pnl') // Fallback to last column
        if (absorbIdx === -1) absorbIdx = headers.length - 1

        const diff = row.length - headers.length

        headers.forEach((h, i) => {
          let val = ''

          if (diff > 0) {
            // Row has MORE tokens than headers. We must absorb the extra tokens.
            if (i < absorbIdx) {
              // Left of the absorbing column
              val = row[i]
            } else if (i === absorbIdx) {
              // The absorbing column takes its standard token PLUS all the extra tokens
              val = row.slice(i, i + 1 + diff).join(' ')
            } else {
              // Right of the absorbing column, shifted by the diff
              val = row[i + diff]
            }
          } else {
            // Normal 1:1 mapping (or row is shorter)
            val = row[i]
            // Fallback for chopped P&L if it's the last element
            if (i === headers.length - 1 && row.length > headers.length && diff <= 0) {
              val = row.slice(i).join('')
            }
          }

          if (val !== undefined && val !== null) {
            // Clean numbers for numeric fields
            if (['price', 'quantity', 'pnl', 'volume'].includes(h)) {
              obj[h] = cleanNumber(val)
            } else {
              obj[h] = val
            }
          }
        })
        return obj
      })
      .filter(row => row.pnl !== undefined && row.pnl !== '')

    return {
      rows,
      headers,
      rawText: text,
      totalLinesDetected: lines.length,
      dataRowsExtracted: rows.length,
    }
  } catch (err) {
    await worker.terminate().catch(() => { })
    throw err
  }
}

/**
 * Auto-detect column types when no header row is found
 * Analyzes the first few data rows to guess column types
 */
function autoDetectHeaders(rows) {
  if (!rows.length) return []

  const numCols = Math.max(...rows.slice(0, 5).map(r => r.length))
  const headers = new Array(numCols).fill(null)
  const used = new Set()

  // Analyze first few rows to detect patterns
  const sampleRows = rows.slice(0, Math.min(5, rows.length))

  for (let col = 0; col < numCols; col++) {
    const values = sampleRows.map(r => r[col]).filter(Boolean)

    // Check if column looks like dates
    if (!used.has('date') && values.filter(v => looksLikeDate(v)).length > values.length * 0.5) {
      headers[col] = 'date'
      used.add('date')
      continue
    }

    // Check if column looks like BUY/SELL type
    if (!used.has('type') && values.some(v => /^(buy|sell|long|short|b|s)$/i.test(v.trim()))) {
      headers[col] = 'type'
      used.add('type')
      continue
    }

    // Check if column looks like symbols (all uppercase letters)
    if (!used.has('symbol') && values.every(v => /^[A-Z]{1,10}$/.test(v.trim()))) {
      headers[col] = 'symbol'
      used.add('symbol')
      continue
    }
  }

  // Remaining numeric columns: try to assign price, quantity, pnl
  const numericCols = []
  for (let col = 0; col < numCols; col++) {
    if (headers[col]) continue
    const values = sampleRows.map(r => r[col]).filter(Boolean)
    if (values.filter(v => looksLikeNumber(v)).length > values.length * 0.5) {
      numericCols.push(col)
    }
  }

  // Heuristic: if there are negative numbers, the last numeric column with negatives is likely pnl
  const numericAssign = ['price', 'quantity', 'pnl']
  const colsWithNegatives = numericCols.filter(col => {
    const values = sampleRows.map(r => r[col]).filter(Boolean)
    return values.some(v => {
      const cleaned = cleanNumber(v)
      return parseFloat(cleaned) < 0
    })
  })

  if (colsWithNegatives.length > 0) {
    // Last column with negatives is likely pnl
    const pnlCol = colsWithNegatives[colsWithNegatives.length - 1]
    headers[pnlCol] = 'pnl'
    const remaining = numericCols.filter(c => c !== pnlCol)
    remaining.forEach((col, i) => {
      if (i < numericAssign.length - 1) {
        headers[col] = numericAssign[i]
      }
    })
  } else {
    // Just assign in order
    numericCols.forEach((col, i) => {
      if (i < numericAssign.length) {
        headers[col] = numericAssign[i]
      }
    })
  }

  // Fill remaining with generic labels
  for (let i = 0; i < numCols; i++) {
    if (!headers[i]) headers[i] = `col_${i}`
  }

  return headers
}
