/**
 * Utilitário seguro para download de arquivo CSV gerado no navegador
 */
export function exportToCSV(
  filename: string,
  rows: Record<string, unknown>[],
  headers: { key: string; label: string }[],
) {
  if (!rows || !rows.length) {
    alert('Nenhum registro para exportar.')
    return
  }

  // Linha de cabeçalho
  const headerLine = headers.map((h) => `"${h.label.replace(/"/g, '""')}"`).join(';')

  // Linhas de dados
  const dataLines = rows.map((row) => {
    return headers
      .map((h) => {
        const val = row[h.key]
        if (val === null || val === undefined) return '""'
        return `"${String(val).replace(/"/g, '""')}"`
      })
      .join(';')
  })

  const csvContent = '\uFEFF' + [headerLine, ...dataLines].join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
