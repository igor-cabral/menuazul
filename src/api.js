/* Cliente mínimo das funções (RPC) do Supabase. Sem bibliotecas: só fetch.
   Usado pelo editor e (via toString) pelas páginas geradas: cardápio na mesa, cozinha e caixa. */
function makeApi(url, key, getJwt) {
  var base = String(url || '').replace(/\/+$/, '') + '/rest/v1/rpc/';
  return function rpc(name, args) {
    var headers = { 'Content-Type': 'application/json', apikey: key }, jwt = getJwt && getJwt();
    if (jwt) headers.Authorization = 'Bearer ' + jwt; // sessão do dono (Supabase Auth)
    else if (/^eyJ/.test(key || '')) headers.Authorization = 'Bearer ' + key; // chaves antigas (JWT); as novas "sb_publishable_" só usam apikey
    return fetch(base + name, { method: 'POST', headers: headers, body: JSON.stringify(args || {}) }).then(function (r) {
      return r.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) { /* corpo não-JSON */ }
        if (!r.ok) {
          var err = new Error((j && (j.message || j.error_description || j.msg || j.hint)) || ('Erro ' + r.status));
          err.status = r.status;
          throw err;
        }
        return j;
      });
    });
  };
}
