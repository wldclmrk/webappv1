/**
 * Weldclass dealer portal RESTlet: renders invoice, credit memo, sales order and statement PDFs
 * with your standard NetSuite print templates.
 *
 * The website checks that the signed-in dealer owns the record before calling this, so the
 * RESTlet only renders. Deploy it with the website's integration role as the only audience.
 *
 * GET ?kind=transaction&id=<transaction internal id>
 * GET ?kind=statement&customer=<customer internal id>
 * Returns { name, pdf } where pdf is base64.
 *
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */
define(['N/render'], (render) => {
  const toId = (v) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) throw new Error('Bad id');
    return n;
  };

  const get = (params) => {
    let file;
    if (params.kind === 'transaction') {
      file = render.transaction({ entityId: toId(params.id), printMode: render.PrintMode.PDF });
    } else if (params.kind === 'statement') {
      file = render.statement({ entityId: toId(params.customer), printMode: render.PrintMode.PDF, openTransactionsOnly: true });
    } else {
      return { error: 'Unknown kind' };
    }
    return { name: file.name, pdf: file.getContents() };
  };

  return { get };
});
