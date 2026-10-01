// Rota pública para servir ou redirecionar para o logo oficial Roland
routerAdd(
  'GET',
  '/backend/v1/roland-logo.png',
  (e) => {
    // Redireciona para o storage público da imagem oficial Roland
    return e.redirect(
      302,
      'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/102ae3de-2235-4a75-a5de-ef8efd4ea0cc/image-e4ae9.png',
    )
  },
)
