migrate(
  (app) => {
    const estadosList = [
      { uf: 'AC', nome: 'Acre' },
      { uf: 'AL', nome: 'Alagoas' },
      { uf: 'AP', nome: 'Amapá' },
      { uf: 'AM', nome: 'Amazonas' },
      { uf: 'BA', nome: 'Bahia' },
      { uf: 'CE', nome: 'Ceará' },
      { uf: 'DF', nome: 'Distrito Federal' },
      { uf: 'ES', nome: 'Espírito Santo' },
      { uf: 'GO', nome: 'Goiás' },
      { uf: 'MA', nome: 'Maranhão' },
      { uf: 'MT', nome: 'Mato Grosso' },
      { uf: 'MS', nome: 'Mato Grosso do Sul' },
      { uf: 'MG', nome: 'Minas Gerais' },
      { uf: 'PA', nome: 'Pará' },
      { uf: 'PB', nome: 'Paraíba' },
      { uf: 'PR', nome: 'Paraná' },
      { uf: 'PE', nome: 'Pernambuco' },
      { uf: 'PI', nome: 'Piauí' },
      { uf: 'RJ', nome: 'Rio de Janeiro' },
      { uf: 'RN', nome: 'Rio Grande do Norte' },
      { uf: 'RS', nome: 'Rio Grande do Sul' },
      { uf: 'RO', nome: 'Rondônia' },
      { uf: 'RR', nome: 'Roraima' },
      { uf: 'SC', nome: 'Santa Catarina' },
      { uf: 'SP', nome: 'São Paulo' },
      { uf: 'SE', nome: 'Sergipe' },
      { uf: 'TO', nome: 'Tocantins' },
    ]

    const colEstados = app.findCollectionByNameOrId('estados')

    // Corrigir UFs que foram gravadas incorretamente no passado (ex: RI -> RS, SA -> SC, SÃ -> SP)
    try {
      app
        .db()
        .newQuery("UPDATE estados SET uf = 'RS' WHERE uf = 'RI' OR nome = 'Rio Grande do Sul'")
        .execute()
      app
        .db()
        .newQuery("UPDATE estados SET uf = 'SP' WHERE uf = 'SÃ' OR nome = 'São Paulo'")
        .execute()
      app
        .db()
        .newQuery("UPDATE estados SET uf = 'SC' WHERE uf = 'SA' OR nome = 'Santa Catarina'")
        .execute()
    } catch (_) {}

    // Inserir ou atualizar cada um dos 27 estados
    for (let i = 0; i < estadosList.length; i++) {
      const item = estadosList[i]
      let record = null

      // Tentar localizar por UF primeiro
      try {
        record = app.findFirstRecordByData('estados', 'uf', item.uf)
      } catch (_) {
        // Se não achar por UF, tentar por nome
        try {
          record = app.findFirstRecordByData('estados', 'nome', item.nome)
        } catch (_) {}
      }

      if (record) {
        record.set('nome', item.nome)
        record.set('uf', item.uf)
        app.save(record)
      } else {
        const novo = new Record(colEstados)
        novo.set('nome', item.nome)
        novo.set('uf', item.uf)
        app.save(novo)
      }
    }

    // Seed de remetente padrão se vazio
    const remetentesCol = app.findCollectionByNameOrId('remetentes')
    const totalRemetentes = app.countRecords('remetentes')
    if (totalRemetentes === 0) {
      const remRecord = new Record(remetentesCol)
      remRecord.set('nome', 'Roland DG Brasil - Comunicações')
      remRecord.set('email', 'comunicados@rolanddg.com.br')
      app.save(remRecord)
    }
  },
  (app) => {
    // down: não remove estados para preservar integridade relacional
  },
)
