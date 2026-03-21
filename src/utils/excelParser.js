import * as XLSX from 'xlsx'

const COLUMN_ALIASES = {
  date: ['date', 'datetime', 'time', 'timestamp', 'trade_date', 'entry_date', 'exit_date'],
  type: ['type', 'side', 'direction', 'action', 'buy/sell', 'buy_sell', 'b/s'],
  price: ['price', 'entry_price', 'exit_price', 'avg_price', 'fill_price', 'avg'],
  quantity: ['quantity', 'qty', 'size', 'lots', 'shares', 'units', 'volume', 'vol'],
  pnl: ['pnl', 'p&l', 'p/l', 'profit', 'profit/loss', 'profit_loss', 'net_pnl', 'realized_pnl', 'realised_pnl', 'gain', 'return', 'result', 'net', 'p8l', 'pbl', 'pel', 'pal'],
  symbol: ['symbol', 'ticker', 'instrument', 'stock', 'scrip', 'name', 'asset'],
}

function cleanNumber(str) {
  if (!str && str !== 0) return str
  let cleaned = String(str).trim()
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1)
  }

  cleaned = cleaned.replace(/[—–~_]/g, '-')

  const firstDigitIdx = cleaned.search(/\d/)
  const prefix = firstDigitIdx >= 0 ? cleaned.substring(0, firstDigitIdx) : cleaned
  const isNegative = prefix.includes('-')

  cleaned = cleaned.replace(/[^0-9.]/g, '')

  const parts = cleaned.split('.')
  if (parts.length > 2) {
    const integerPart = parts.slice(0, -1).join('')
    const decimalPart = parts[parts.length - 1]
    cleaned = integerPart + '.' + decimalPart
  }

  if (isNegative && cleaned.length > 0) {
    cleaned = '-' + cleaned
  }

  return cleaned
}

function identifyColumn(headerName) {
  const normalized = String(headerName).toLowerCase().trim().replace(/[^a-z0-9/&]/g, '_')
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      if (normalized === alias || normalized.includes(alias)) {
        return canonical
      }
    }
  }
  return null
}

function isHeaderRow(columns) {
  const foundSet = new Set()
  for (const col of columns) {
    if (!col) continue
    const canonical = identifyColumn(col)
    if (canonical) {
      foundSet.add(canonical)
    }
  }
  return foundSet.size >= 3
}

export function extractTradesFromExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheet]

        // Parse as a 2D array of formatted strings
        const allRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" })

        // Find header row intelligently (scan up to 100 rows just in case)
        let headerIdx = -1
        for (let i = 0; i < Math.min(allRows.length, 100); i++) {
          if (isHeaderRow(allRows[i])) {
            headerIdx = i
            break
          }
        }

        let headers, dataRows

        if (headerIdx >= 0) {
          // Map header aliases
          headers = allRows[headerIdx].map(h => h ? (identifyColumn(h) || String(h).toLowerCase()) : '')
          dataRows = allRows.slice(headerIdx + 1)
        } else {
          throw new Error('Could not automatically detect the table headers. Ensure your Excel file has a header row with Date, Price, PnL, etc.')
        }

        // Convert data rows to objects
        const rows = dataRows
          .filter(row => row.length > 0 && row.some(cell => cell !== "")) // Skip entirely empty rows
          .map(row => {
            const obj = {}
            headers.forEach((h, i) => {
              if (!h) return
              const val = row[i]
              if (val !== undefined && val !== null && val !== "") {
                if (['price', 'quantity', 'pnl', 'volume'].includes(h)) {
                  obj[h] = cleanNumber(val)
                } else {
                  obj[h] = String(val)
                }
              }
            })
            return obj
          })
          .filter(row => row.pnl !== undefined && row.pnl !== '') // Require PnL at minimum

        resolve({
          rows,
          headers: headers.filter(Boolean),
          rawText: `Processed Excel File: ${file.name}\nTotal Rows: ${allRows.length}`,
          totalLinesDetected: allRows.length,
          dataRowsExtracted: rows.length,
        })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Failed to read Excel file.'))
    reader.readAsArrayBuffer(file)
  })
}
