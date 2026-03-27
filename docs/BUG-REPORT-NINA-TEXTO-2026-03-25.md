# Bug Report: Texto não renderiza nas artes da Nina

**Data:** 25/03/2026
**Versão atual:** process-nina-request v16
**Status:** NÃO RESOLVIDO

---

## 1. Contexto

A aba "Criar" do Nina Studio foi implementada com sucesso. O fluxo funciona:
- Usuário seleciona foto de evento do grid
- Usuário escreve brief para a Nina
- Nina gera arte com a foto real + overlay de texto + legenda + hashtags
- Botões Agendar/Publicar agora funcionais

**Problema:** O texto que deveria aparecer sobre a foto NÃO RENDERIZA. Apenas uma linha colorida (teal/laranja) aparece onde o texto deveria estar.

---

## 2. O que funciona

| Componente | Status |
|------------|--------|
| Seleção de foto do evento | ✅ OK |
| Passagem de `reference_image_url` para a Edge Function | ✅ OK |
| Download da foto real do Storage | ✅ OK |
| Geração de frase/legenda/hashtags via Gemini | ✅ OK |
| Montagem do SVG com foto + gradiente + linhas | ✅ OK |
| Conversão SVG → PNG via resvg-wasm | ✅ OK |
| Upload do PNG para Storage | ✅ OK |
| Retorno da URL para o frontend | ✅ OK |
| Exibição da prévia no frontend | ✅ OK |

---

## 3. O que NÃO funciona

Os elementos `<text>` do SVG não são renderizados pelo resvg-wasm. O PNG gerado mostra a foto, o gradiente escuro, as linhas coloridas, mas **nenhum texto**.

### Evidência
Na imagem gerada:
- Foto real: ✅ aparece
- Gradiente escuro na base: ✅ aparece
- Linha colorida (teal/laranja): ✅ aparece
- Texto da frase: ❌ NÃO aparece
- Texto "LA MUSIC KIDS" na base: ❌ NÃO aparece

---

## 4. Tentativas de correção (todas falharam)

### v12: Técnica de dupla renderização
```svg
<!-- Stroke preto primeiro -->
<text stroke="black" stroke-width="12" fill="black">Texto</text>
<!-- Fill branco depois -->
<text fill="white">Texto</text>
```
**Resultado:** Texto não aparece. Problema não era o paint-order.

### v13: Desabilitar loadSystemFonts
```js
new Resvg(svg, { font: { loadSystemFonts: false } })
```
**Resultado:** Texto não aparece. Sem fontes disponíveis.

### v14: Carregar fonte via fontBuffers (WOFF)
```js
const fontData = await fetch('...inter-900.woff')
new Resvg(svg, { font: { fontBuffers: [fontData] } })
```
**Resultado:** Texto não aparece. WOFF não é suportado pelo resvg.

### v15: Carregar fonte TTF via fontBuffers
```js
const fontData = await fetch('...Roboto-Bold.ttf')
new Resvg(svg, { font: { fontBuffers: [fontData], defaultFontFamily: 'Roboto' } })
```
**Resultado:** Texto não aparece. fontBuffers parece não funcionar.

### v16: Embutir fonte base64 no SVG via @font-face
```svg
<defs>
  <style type="text/css">
    @font-face {
      font-family: 'NinaFont';
      src: url('data:font/ttf;base64,...') format('truetype');
    }
  </style>
</defs>
<text font-family="NinaFont">Texto</text>
```
**Resultado:** Texto não aparece. @font-face não é suportado pelo resvg-wasm.

---

## 5. Análise técnica

O **resvg-wasm** é uma biblioteca Rust compilada para WebAssembly que renderiza SVG para PNG. Ela tem limitações conhecidas:

1. **Fontes:** Não carrega fontes do sistema em ambientes serverless (Deno Edge)
2. **@font-face:** Não suporta CSS @font-face em SVG
3. **fontBuffers:** Documentação diz que suporta, mas não funciona no Deno Edge
4. **Texto sem fonte:** Se não encontra a fonte, simplesmente não renderiza o texto

### Referências
- https://github.com/nickvdyck/resvg-wasm/issues
- https://github.com/nickvdyck/resvg-wasm#fonts

---

## 6. Soluções alternativas propostas

### Opção A: Usar outra biblioteca de renderização
Substituir resvg-wasm por uma alternativa que funcione melhor com fontes:
- **Sharp** (não funciona em Deno)
- **Satori** (Vercel, funciona em Node, pode funcionar em Deno)
- **Canvas API** via Deno Canvas (experimental)

### Opção B: Usar API externa de edição de imagem
Serviços que suportam overlay de texto em imagens:
- **Cloudinary** - API de transformação de imagem com texto
- **Shotstack** - Já configurado no projeto (SHOTSTACK_API_KEY existe)
- **imgix** - Transformação de imagem via URL

### Opção C: Gerar imagem com texto via IA
Usar Gemini Imagen ou outra API de geração de imagem que já inclua o texto:
- **Gemini 2.0** com Imagen 3 pode editar imagens e adicionar texto
- **GPT-4o** com DALL-E 3

### Opção D: Renderizar no cliente (browser)
Mover a renderização do texto para o frontend usando Canvas API do browser:
1. Edge Function retorna: foto base + texto a sobrepor
2. Frontend usa Canvas para montar a imagem final
3. Frontend faz upload da imagem final

---

## 7. Recomendação

**Opção B (Cloudinary ou Shotstack)** é a mais pragmática:
- Cloudinary é amplamente usado e tem SDK para Deno
- Shotstack já está configurado no projeto
- Não requer mudanças no frontend
- Garante que o texto sempre aparece

### Exemplo com Cloudinary
```js
const imageUrl = cloudinary.url('foto-base.jpg', {
  transformation: [
    { overlay: { text: 'Música transforma vidas' }, gravity: 'south', y: 200 }
  ]
})
```

---

## 8. Código atual da aba Criar (frontend)

Arquivo: `src/app/(dashboard)/studio/page.tsx`

### Estados implementados
```typescript
const [eventPhotosForNina, setEventPhotosForNina] = useState<PhotoAsset[]>([])
const [selectedEventPhotoForNina, setSelectedEventPhotoForNina] = useState<PhotoAsset | null>(null)
const [isScheduling, setIsScheduling] = useState(false)
```

### handleGenerateWithNina (linhas 1357-1401)
```typescript
const { data, error } = await supabase.functions.invoke("process-nina-request", {
  body: {
    mode: "brief",
    brand,
    brief: postBrief,
    post_type: postPlatform,
    event_asset_id: selectedEventPhotoForNina?.id ?? null,
    reference_image_url: selectedEventPhotoForNina?.file_url ?? null,
    event_name: selectedEventPhotoForNina?.event_name ?? null,
  },
})
```

### handleSchedulePost (linhas 1452-1487)
- Cria post com `status: 'scheduled'`
- Cron `studio-publish-scheduled` publica automaticamente

### handlePublishNow (linhas 1403-1450)
- Cria post como draft
- Invoca `publish-scheduled-posts` imediatamente

### UI do seletor de fotos (linhas 1619-1678)
- Grid 3x2 com thumbnails
- Botão "Aleatória"
- Preview da foto selecionada com borda teal

---

## 9. Próximos passos

1. Decidir qual solução usar (A, B, C ou D)
2. Implementar a solução escolhida na Edge Function
3. Testar a renderização do texto
4. Validar que o fluxo completo funciona (gerar → agendar → publicar)

---

**Autor:** Claude (Cascade)
**Destinatário:** Claude (próxima sessão)
