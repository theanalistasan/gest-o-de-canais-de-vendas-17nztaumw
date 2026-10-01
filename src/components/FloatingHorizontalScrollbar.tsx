import React, { type RefObject } from 'react'

export interface FloatingHorizontalScrollbarProps {
  scrollRef: RefObject<HTMLDivElement | null>
  hasHorizontalOverflow: boolean
  stickyVisible: boolean
  scrollWidth: number
  stickyLeft: number
  stickyWidth: number
  stickyBottom: number
  onScroll: () => void
  /** Rótulo contextual, ex: 'da tabela de contatos' */
  tableLabel?: string
  /** Z-index da barra flutuante (default: 35) */
  zIndex?: number
}

/**
 * Barra de rolagem horizontal flutuante (sticky/espelhada).
 * Renderiza uma barra fixa no rodapé da área útil visível da tela
 * permitindo rolar tabelas largas horizontalmente sem precisar descer até o fim da página.
 */
export const FloatingHorizontalScrollbar: React.FC<FloatingHorizontalScrollbarProps> = ({
  scrollRef,
  hasHorizontalOverflow,
  stickyVisible,
  scrollWidth,
  stickyLeft,
  stickyWidth,
  stickyBottom,
  onScroll,
  tableLabel = 'da tabela',
  zIndex = 35,
}) => {
  if (!hasHorizontalOverflow || !stickyVisible) {
    return null
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: `${stickyLeft}px`,
        width: `${stickyWidth}px`,
        bottom: `${stickyBottom}px`,
        zIndex,
      }}
      className="bg-slate-100/95 backdrop-blur-xs border-t border-slate-300 shadow-md py-1 px-1 transition-all"
      title="Barra de rolagem horizontal rápida (sincronizada)"
    >
      <div className="flex items-center justify-between px-2 pb-1 text-[10px] text-slate-500 font-medium select-none">
        <span className="flex items-center gap-1">
          <span>↔</span> Rolagem horizontal {tableLabel}
        </span>
        <span className="hidden sm:inline text-slate-400">Arraste para ver colunas à direita</span>
      </div>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="overflow-x-auto overflow-y-hidden h-4 cursor-ew-resize"
        tabIndex={0}
        aria-label={`Barra de rolagem horizontal ${tableLabel}`}
      >
        <div
          style={{
            width: `${scrollWidth}px`,
            height: '1px',
          }}
        />
      </div>
    </div>
  )
}
