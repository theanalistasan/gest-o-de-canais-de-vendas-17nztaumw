/**
 * Leitor e analisador de planilhas CSV e texto delimitado executado exclusivamente no navegador
 * Suporta formatos CSV, TSV e valores separados por vírgula ou ponto-e-vírgula com tratamento de aspas
 */

export interface ParsedSheet {
  headers: string[]
  rows: string[][]
}

export function parseCSVString(text: string): ParsedSheet {
  // Detectar delimitador (; ou , ou \t)
  const firstLine = text.split(/\r\n|\n|\r/)[0] || ''
  const countSemicolon = (firstLine.match(/;/g) || []).length
  const countComma = (firstLine.match(/,/g) || []).length
  const countTab = (firstLine.match(/\t/g) || []).length

  let delimiter = ','
  if (countSemicolon >= countComma && countSemicolon >= countTab) {
    delimiter = ';'
  } else if (countTab >= countComma && countTab >= countSemicolon) {
    delimiter = '\t'
  }

  const lines: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let insideQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"'
        i++ // pular quote escapado
      } else {
        insideQuotes = !insideQuotes
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentField.trim())
      currentField = ''
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++
      }
      currentRow.push(currentField.trim())
      currentField = ''
      if (currentRow.some((field) => field !== '')) {
        lines.push(currentRow)
      }
      currentRow = []
    } else {
      currentField += char
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.some((field) => field !== '')) {
      lines.push(currentRow)
    }
  }

  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  // Tentar encontrar a linha que se parece com o cabeçalho real
  // Por exemplo, na planilha pode haver um título "Contato das Revendas..." na linha 1
  let headerIndex = 0
  for (let idx = 0; idx < Math.min(lines.length, 5); idx++) {
    const line = lines[idx]
    const joined = line.join(' ').toLowerCase()
    if (
      joined.includes('segmento') ||
      joined.includes('seguimento') ||
      joined.includes('cod') ||
      joined.includes('revenda') ||
      joined.includes('cargo')
    ) {
      headerIndex = idx
      break
    }
  }

  const headers = lines[headerIndex].map((h, idx) => h || `Coluna_${idx + 1}`)
  const dataRows = lines.slice(headerIndex + 1)

  return { headers, rows: dataRows }
}
