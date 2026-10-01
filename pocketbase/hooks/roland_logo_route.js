// Rota pública para servir a imagem do logo oficial Roland DG Brasil
// Servido com cabeçalhos de cache públicos e tipo MIME correto de imagem PNG
routerAdd('GET', '/backend/v1/roland-logo.png', (e) => {
  e.response.header().set('Cache-Control', 'public, max-age=86400')
  e.response.header().set('Content-Type', 'image/png')
  // Redireciona para o storage do logo oficial enviado pelo usuário
  return e.redirect(
    302,
    'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/102ae3de-2235-4a75-a5de-ef8efd4ea0cc/image-b62c4.png',
  )
})
