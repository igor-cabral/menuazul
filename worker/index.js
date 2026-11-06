// Com "not_found_handling: single-page-application", o Cloudflare serve o index.html para NAVEGAÇÕES (barra de endereço, QR Code, links)
// que não são arquivos. Qualquer outro pedido sem arquivo correspondente (script, imagem, json, favicon...) chega aqui e
// recebe 404 de verdade, em vez de um index.html disfarçado de 200.
export default {
  fetch() {
    return new Response('Não encontrado', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
};
