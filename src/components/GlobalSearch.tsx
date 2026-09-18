import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Loader2, Store, User, Mail, Phone, Hash, X } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import type { Revenda, Contato } from '@/types'

interface GroupedResults {
  revendasCodigo: Revenda[]
  revendasNome: Revenda[]
  contatosNome: Contato[]
  contatosEmail: Contato[]
  contatosTelefone: Contato[]
}

export const GlobalSearch: React.FC = () => {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<GroupedResults>({
    revendasCodigo: [],
    revendasNome: [],
    contatosNome: [],
    contatosEmail: [],
    contatosTelefone: [],
  })

  const navigate = useNavigate()
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults({
        revendasCodigo: [],
        revendasNome: [],
        contatosNome: [],
        contatosEmail: [],
        contatosTelefone: [],
      })
      setIsLoading(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const safeQuery = trimmed.replace(/'/g, "\\'")

        // Buscar revendas por código e por nome
        const [revendas, contatos] = await Promise.all([
          pb.collection('revendas').getList<Revenda>(1, 20, {
            filter: `codigo ~ '${safeQuery}' || nome ~ '${safeQuery}'`,
            sort: 'nome',
          }),
          pb.collection('contatos').getList<Contato>(1, 30, {
            filter: `nome ~ '${safeQuery}' || email ~ '${safeQuery}' || email_secundario ~ '${safeQuery}' || telefone ~ '${safeQuery}' || celular ~ '${safeQuery}' || whatsapp ~ '${safeQuery}'`,
            sort: 'nome',
            expand: 'revenda',
          }),
        ])

        const queryLower = trimmed.toLowerCase()

        // Agrupamento
        const rCod: Revenda[] = []
        const rNome: Revenda[] = []
        for (const r of revendas.items) {
          if (r.codigo && r.codigo.toLowerCase().includes(queryLower)) {
            if (rCod.length < 8) rCod.push(r)
          } else if (r.nome.toLowerCase().includes(queryLower)) {
            if (rNome.length < 8) rNome.push(r)
          }
        }

        const cNome: Contato[] = []
        const cEmail: Contato[] = []
        const cTel: Contato[] = []
        for (const c of contatos.items) {
          if (c.nome.toLowerCase().includes(queryLower)) {
            if (cNome.length < 8) cNome.push(c)
          } else if (
            (c.email && c.email.toLowerCase().includes(queryLower)) ||
            (c.email_secundario && c.email_secundario.toLowerCase().includes(queryLower))
          ) {
            if (cEmail.length < 8) cEmail.push(c)
          } else {
            if (cTel.length < 8) cTel.push(c)
          }
        }

        setResults({
          revendasCodigo: rCod,
          revendasNome: rNome,
          contatosNome: cNome,
          contatosEmail: cEmail,
          contatosTelefone: cTel,
        })
        setIsOpen(true)
      } catch (err) {
        console.error('Erro na pesquisa global:', err)
      } finally {
        setIsLoading(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [query])

  const handleSelectRevenda = (id: string) => {
    setIsOpen(false)
    setQuery('')
    navigate(`/revendas/${id}`)
  }

  const handleSelectContato = (contato: Contato) => {
    setIsOpen(false)
    setQuery('')
    if (contato.revenda) {
      navigate(`/revendas/${contato.revenda}`)
    } else {
      navigate(`/contatos?search=${encodeURIComponent(contato.nome)}`)
    }
  }

  const totalResults =
    results.revendasCodigo.length +
    results.revendasNome.length +
    results.contatosNome.length +
    results.contatosEmail.length +
    results.contatosTelefone.length

  return (
    <div ref={searchContainerRef} className="relative w-full max-w-md">
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim().length >= 2) setIsOpen(true)
          }}
          placeholder="Buscar código, revenda, pessoa, e-mail, telefone..."
          className="w-full pl-10 pr-9 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setIsOpen(false)
            }}
            className="absolute right-3 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdown de resultados agrupados */}
      {isOpen && query.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 max-h-[460px] overflow-y-auto z-50 divide-y divide-slate-100 animate-in fade-in slide-in-from-top-1 duration-150">
          {isLoading && (
            <div className="flex items-center justify-center p-6 text-slate-500 text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span>Pesquisando canais e contatos...</span>
            </div>
          )}

          {!isLoading && totalResults === 0 && (
            <div className="p-6 text-center text-sm text-slate-500">
              Nenhum registro encontrado para <strong className="text-slate-700">"{query}"</strong>.
            </div>
          )}

          {/* Grupo: Código de Revenda */}
          {!isLoading && results.revendasCodigo.length > 0 && (
            <div className="p-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <Hash className="h-3 w-3 text-blue-500" />
                <span>Código da Revenda ({results.revendasCodigo.length})</span>
              </div>
              {results.revendasCodigo.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleSelectRevenda(r.id)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between text-sm transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                      {r.codigo}
                    </span>
                    <span className="font-medium text-slate-800 group-hover:text-blue-600">
                      {r.nome}
                    </span>
                  </div>
                  {r.cidade && <span className="text-xs text-slate-400">{r.cidade}</span>}
                </button>
              ))}
            </div>
          )}

          {/* Grupo: Nome da Revenda */}
          {!isLoading && results.revendasNome.length > 0 && (
            <div className="p-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <Store className="h-3 w-3 text-blue-600" />
                <span>Revendas ({results.revendasNome.length})</span>
              </div>
              {results.revendasNome.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleSelectRevenda(r.id)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between text-sm transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800 group-hover:text-blue-600">
                      {r.nome}
                    </span>
                    {r.codigo && (
                      <span className="text-xs text-slate-400 font-mono">({r.codigo})</span>
                    )}
                  </div>
                  {r.cidade && <span className="text-xs text-slate-400">{r.cidade}</span>}
                </button>
              ))}
            </div>
          )}

          {/* Grupo: Pessoa / Nome Contato */}
          {!isLoading && results.contatosNome.length > 0 && (
            <div className="p-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <User className="h-3 w-3 text-emerald-600" />
                <span>Pessoas / Contatos ({results.contatosNome.length})</span>
              </div>
              {results.contatosNome.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelectContato(c)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between text-sm transition-colors group"
                >
                  <div>
                    <span className="font-medium text-slate-800 group-hover:text-blue-600 block">
                      {c.nome}
                    </span>
                    <span className="text-xs text-slate-400">
                      {c.expand?.revenda
                        ? `Revenda: ${c.expand.revenda.nome}`
                        : c.email || 'Sem e-mail'}
                    </span>
                  </div>
                  {c.contato_principal && (
                    <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                      Principal
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Grupo: E-mail */}
          {!isLoading && results.contatosEmail.length > 0 && (
            <div className="p-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <Mail className="h-3 w-3 text-indigo-500" />
                <span>Por E-mail ({results.contatosEmail.length})</span>
              </div>
              {results.contatosEmail.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelectContato(c)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between text-sm transition-colors group"
                >
                  <div>
                    <span className="font-medium text-slate-800 block text-xs">
                      {c.email || c.email_secundario}
                    </span>
                    <span className="text-xs text-slate-500 group-hover:text-blue-600">
                      {c.nome}
                    </span>
                  </div>
                  {c.expand?.revenda && (
                    <span className="text-xs text-slate-400 truncate max-w-[120px]">
                      {c.expand.revenda.nome}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Grupo: Telefone */}
          {!isLoading && results.contatosTelefone.length > 0 && (
            <div className="p-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <Phone className="h-3 w-3 text-teal-600" />
                <span>Por Telefone ({results.contatosTelefone.length})</span>
              </div>
              {results.contatosTelefone.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelectContato(c)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between text-sm transition-colors group"
                >
                  <div>
                    <span className="font-medium text-slate-800 block text-xs">
                      {c.telefone || c.celular || c.whatsapp}
                    </span>
                    <span className="text-xs text-slate-500 group-hover:text-blue-600">
                      {c.nome}
                    </span>
                  </div>
                  {c.expand?.revenda && (
                    <span className="text-xs text-slate-400 truncate max-w-[120px]">
                      {c.expand.revenda.nome}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
