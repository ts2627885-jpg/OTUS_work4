// Подписи колонок для таблиц-карточек на телефоне.
// На узком экране каждая строка таблицы превращается в карточку, а подпись колонки
// выводится из заголовка <th> через атрибут data-label (CSS: td::before { content: attr(data-label) }).
// Метки проставляются автоматически для всех таблиц приложения, поэтому правки шаблонов не нужны.

export function labelTables(root = document) {
  root.querySelectorAll('table').forEach((table) => {
    const headers = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim())
    if (!headers.length) return

    table.querySelectorAll('tr').forEach((row) => {
      // строки шапки пропускаем; пустые строки-заглушки с colspan тоже
      if (row.parentElement?.tagName === 'THEAD') return
      ;[...row.children].forEach((cell, index) => {
        if (cell.tagName !== 'TD' || cell.hasAttribute('colspan')) return
        const label = headers[index] || ''
        if (cell.getAttribute('data-label') !== label) cell.setAttribute('data-label', label)
      })
    })
  })
}

// Следит за изменениями DOM (Vue перерисовывает таблицы при загрузке данных) и проставляет подписи.
// Вызовы сгруппированы через requestAnimationFrame, чтобы не пересчитывать таблицы на каждое изменение.
export function watchTableLabels() {
  let scheduled = false
  const schedule = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      labelTables()
    })
  }
  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })
  schedule()
  return observer
}
