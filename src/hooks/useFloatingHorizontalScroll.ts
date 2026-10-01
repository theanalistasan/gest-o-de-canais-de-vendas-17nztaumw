import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

export interface UseFloatingHorizontalScrollOptions {
  /**
   * Ref para o elemento contenedor da tabela com `overflow-x-auto`.
   */
  tableContainerRef: RefObject<HTMLDivElement | null>
  /**
   * Dependências opcionais que provocam recálculo de medidas quando mudam
   * (ex: dados, ordenação, paginação, modo agrupado, colapsos, etc.)
   */
  deps?: unknown[]
  /**
   * Seletor do elemento principal de scroll da aplicação (default: 'main').
   */
  mainScrollSelector?: string
  /**
   * Seletor do elemento de rodapé para não sobrepor (default: 'footer').
   */
  footerSelector?: string
}

export interface UseFloatingHorizontalScrollReturn {
  stickyScrollRef: RefObject<HTMLDivElement | null>
  hasHorizontalOverflow: boolean
  scrollWidth: number
  stickyVisible: boolean
  stickyBottom: number
  stickyLeft: number
  stickyWidth: number
  handleTableScroll: () => void
  handleStickyScroll: () => void
  updateScrollMetrics: () => void
}

/**
 * Hook reutilizável para barra de rolagem horizontal flutuante/espelhada (Sticky Scrollbar).
 * Sincroniza bidirecionalmente o scrollLeft de uma tabela que tenha overflow horizontal
 * com uma barra flutuante ancorada no rodapé da área útil visível da tela.
 */
export function useFloatingHorizontalScroll({
  tableContainerRef,
  deps = [],
  mainScrollSelector = 'main',
  footerSelector = 'footer',
}: UseFloatingHorizontalScrollOptions): UseFloatingHorizontalScrollReturn {
  const stickyScrollRef = useRef<HTMLDivElement>(null)
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false)
  const [scrollWidth, setScrollWidth] = useState(0)
  const [stickyVisible, setStickyVisible] = useState(false)
  const [stickyBottom, setStickyBottom] = useState(36) // 36px padrão do footer global (h-9)
  const [stickyLeft, setStickyLeft] = useState(0)
  const [stickyWidth, setStickyWidth] = useState(0)
  const isSyncingScroll = useRef(false)

  // Mede as dimensões de overflow horizontal e posição do contêiner da tabela
  const updateScrollMetrics = useCallback(() => {
    const container = tableContainerRef.current
    if (!container) return

    const { clientWidth, scrollWidth: totalScrollWidth } = container
    const overflow = totalScrollWidth > clientWidth + 2 // margem para arredondamento
    setHasHorizontalOverflow(overflow)
    setScrollWidth(totalScrollWidth)

    if (!overflow) {
      setStickyVisible(false)
      return
    }

    // Calcula visibilidade flutuante relativa à viewport
    const rect = container.getBoundingClientRect()
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight

    // Procura o footer do layout para não sobrepor (footer global tem ~36px de altura)
    const footerElem = footerSelector ? document.querySelector(footerSelector) : null
    const footerRect = footerElem ? footerElem.getBoundingClientRect() : null
    let bottomOffset = 0
    if (footerRect && footerRect.top < viewportHeight) {
      bottomOffset = Math.max(0, viewportHeight - footerRect.top)
    }

    // A barra sticky deve permanecer visível sempre que houver overflow horizontal ativo
    // e o container estiver visível na janela (interseção vertical com a área útil),
    // sem exigir que o rodapé da tabela esteja abaixo da âncora (o que ocultava a barra
    // indevidamente em tabelas curtas/paginadas com 10-25 linhas).
    const stickyAnchorY = viewportHeight - bottomOffset
    const tableTopVisible = rect.top < stickyAnchorY
    const tableInView = rect.bottom > 0 && tableTopVisible

    const isVisible = tableInView
    setStickyVisible(isVisible)
    setStickyBottom(bottomOffset)
    setStickyLeft(rect.left)
    setStickyWidth(rect.width)
  }, [tableContainerRef, footerSelector])

  // Sincronização bidirecional de scrollLeft
  const handleTableScroll = useCallback(() => {
    if (isSyncingScroll.current) return
    isSyncingScroll.current = true
    if (stickyScrollRef.current && tableContainerRef.current) {
      stickyScrollRef.current.scrollLeft = tableContainerRef.current.scrollLeft
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false
    })
  }, [tableContainerRef])

  const handleStickyScroll = useCallback(() => {
    if (isSyncingScroll.current) return
    isSyncingScroll.current = true
    if (tableContainerRef.current && stickyScrollRef.current) {
      tableContainerRef.current.scrollLeft = stickyScrollRef.current.scrollLeft
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false
    })
  }, [tableContainerRef])

  // Escuta scrolls do container principal, window resize, e redimensionamentos da tabela
  useEffect(() => {
    updateScrollMetrics()

    const mainScrollElem = mainScrollSelector ? document.querySelector(mainScrollSelector) : null

    const handleScrollOrResize = () => {
      updateScrollMetrics()
    }

    window.addEventListener('resize', handleScrollOrResize, { passive: true })
    window.addEventListener('scroll', handleScrollOrResize, { passive: true })
    if (mainScrollElem) {
      mainScrollElem.addEventListener('scroll', handleScrollOrResize, { passive: true })
    }

    let resizeObserver: ResizeObserver | null = null
    const currentContainer = tableContainerRef.current
    if (currentContainer && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateScrollMetrics()
      })
      resizeObserver.observe(currentContainer)
      if (currentContainer.firstElementChild) {
        resizeObserver.observe(currentContainer.firstElementChild)
      }
    }

    return () => {
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('scroll', handleScrollOrResize)
      if (mainScrollElem) {
        mainScrollElem.removeEventListener('scroll', handleScrollOrResize)
      }
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
    }
  }, [updateScrollMetrics, mainScrollSelector, tableContainerRef])

  // Recalcula dimensões ao alterar dados, modo de exibição, filtros ou paginação
  useEffect(() => {
    const timer = setTimeout(() => {
      updateScrollMetrics()
    }, 100)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateScrollMetrics, ...deps])

  return {
    stickyScrollRef,
    hasHorizontalOverflow,
    scrollWidth,
    stickyVisible,
    stickyBottom,
    stickyLeft,
    stickyWidth,
    handleTableScroll,
    handleStickyScroll,
    updateScrollMetrics,
  }
}
