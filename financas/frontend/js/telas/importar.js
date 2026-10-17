import { api } from '../api.js';
import { icon } from '../icons.js';
import { catIcon, categoriaPorId, ocupado, toast } from '../ui.js';
import { brl, ddmm, esc, money } from '../utils.js';

const MAX_ARQUIVOS = 12;
const MAX_BYTES = 8 * 1024 * 1024;
const ACEITOS = /\.(pdf|csv|ofx|txt)$/i;

const lerBase64 = (arquivo) => new Promise((resolve, reject) => {
  const leitor = new FileReader();
  leitor.onload = () => resolve(String(leitor.result).split(',')[1] || '');
  leitor.onerror = () => reject(new Error(`Não foi possível abrir ${arquivo.name}.`));
  leitor.readAsDataURL(arquivo);
});

const chaveDesc = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

export async function render(el, ctx) {
  const [cats, cartoes] = await Promise.all([api.categorias(), api.cartoes().catch(() => [])]);
  if (!ctx.atual()) return;
  const catDespesa = cats.filter((c) => c.tipo === 'despesa');
  const catReceita = cats.filter((c) => c.tipo === 'receita');
  const cat = categoriaPorId(cats);

  let arquivos = [];

  el.innerHTML = `
    <header class="page-head">
      <div>
        <a href="#/lancamentos" class="muted small strong voltar">${icon('esquerda', 14, 2.4)}Lançamentos</a>
        <h1 class="page-title">Importar fatura</h1>
      </div>
    </header>

    <section class="card form-col" id="im-envio">
      <p class="muted">Envie a fatura do cartão em <strong>PDF, CSV ou OFX</strong>. Pode mandar várias de uma vez para montar o seu histórico.
        Antes de salvar, você revisa tudo.</p>

      <label class="soltar" id="im-soltar">
        <input type="file" id="im-arquivos" accept=".pdf,.csv,.ofx,.txt,application/pdf,text/csv" multiple hidden>
        <span class="cat-icon grande" style="background:#60A5FA22;color:#60A5FA">${icon('importar', 24, 2.2)}</span>
        <span class="strong">Escolher arquivos</span>
        <span class="muted small">ou arraste aqui · até ${MAX_ARQUIVOS} arquivos de 8 MB</span>
      </label>
      <div id="im-lista"></div>

      ${cartoes.length ? `
        <label class="field"><span class="field-label">De qual cartão é a fatura?</span>
          <select class="input" id="im-cartao">
            <option value="">Nenhum (só registrar os gastos)</option>
            ${cartoes.map((c) => `<option value="${c.id}">${esc(c.nome)}${c.final ? ` •••• ${esc(c.final)}` : ''}</option>`).join('')}
          </select></label>` : ''}

      <p class="muted small">${icon('cadeado', 14, 2.2)} Os arquivos são lidos e descartados na hora; não ficam guardados.</p>
      <div class="form-error" role="alert"></div>
      <button class="btn btn-primary btn-block" type="button" id="im-ler" disabled>${icon('arquivo', 18, 2.2)}Ler faturas</button>
    </section>

    <div id="im-revisao"></div>`;

  const $ = (q) => el.querySelector(q);
  const erro = $('#im-envio .form-error');

  function adicionar(lista) {
    erro.textContent = '';
    for (const f of lista) {
      if (!ACEITOS.test(f.name)) { erro.textContent = `"${f.name}" não é PDF, CSV ou OFX.`; continue; }
      if (f.size > MAX_BYTES) { erro.textContent = `"${f.name}" passa de 8 MB.`; continue; }
      if (arquivos.some((a) => a.name === f.name && a.size === f.size)) continue;
      if (arquivos.length >= MAX_ARQUIVOS) { erro.textContent = `Envie no máximo ${MAX_ARQUIVOS} arquivos por vez.`; break; }
      arquivos.push(f);
    }
    desenharArquivos();
  }

  function desenharArquivos() {
    $('#im-lista').innerHTML = arquivos.map((f, i) => `
      <div class="arquivo-linha">
        ${icon('arquivo', 16, 2)}<span class="trunca">${esc(f.name)}</span>
        <span class="muted small">${(f.size / 1024).toFixed(0)} KB</span>
        <button type="button" class="icon-btn" data-tirar="${i}" aria-label="Remover ${esc(f.name)}">${icon('fechar', 16, 2.2)}</button>
      </div>`).join('');
    $('#im-ler').disabled = !arquivos.length;
  }

  $('#im-arquivos').addEventListener('change', (e) => { adicionar([...e.target.files]); e.target.value = ''; });
  $('#im-lista').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tirar]');
    if (b) { arquivos.splice(Number(b.dataset.tirar), 1); desenharArquivos(); }
  });
  const soltar = $('#im-soltar');
  soltar.addEventListener('dragover', (e) => { e.preventDefault(); soltar.classList.add('ativo'); });
  soltar.addEventListener('dragleave', () => soltar.classList.remove('ativo'));
  soltar.addEventListener('drop', (e) => { e.preventDefault(); soltar.classList.remove('ativo'); adicionar([...e.dataTransfer.files]); });

  $('#im-ler').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    erro.textContent = '';
    ocupado(btn, true, 'Lendo faturas…');
    try {
      const enviados = await Promise.all(arquivos.map(async (f) => ({ nome: f.name, conteudo: await lerBase64(f) })));
      const r = await api.analisarFaturas(enviados);
      if (!ctx.atual()) return;
      ocupado(btn, false);
      revisar(r);
    } catch (ex) {
      erro.textContent = ex.message;
      ocupado(btn, false);
    }
  });

  // ── Revisão ──────────────────────────────────────────────────────────────
  function revisar({ arquivos: lidos, itens }) {
    const box = $('#im-revisao');
    const problemas = lidos.filter((a) => a.erro);
    // Estado por item: incluir (duplicados começam desmarcados) e categoria escolhida
    const estado = new Map(itens.map((i) => [i.id, { incluir: !i.duplicado, categoria_id: i.categoria_id, mexeu: false }]));

    if (!itens.length) {
      box.innerHTML = `
        <section class="card form-col">
          <h2 class="card-title">Nenhum lançamento encontrado</h2>
          ${problemas.map((a) => `<div class="aviso"><strong>${esc(a.nome)}:</strong> ${esc(a.erro)}</div>`).join('')}
        </section>`;
      return;
    }

    $('#im-envio').hidden = true;
    const noApp = itens.filter((i) => i.motivo_duplicado === 'no_app').length;
    const repetidos = itens.filter((i) => i.motivo_duplicado === 'repetido').length;
    const plural = (n, um, varios) => (n === 1 ? um : varios);
    const futuras = itens.reduce((s, i) => s + (i.parcelas_futuras || 0), 0);

    box.innerHTML = `
      <section class="card form-col">
        <div class="card-head">
          <h2 class="card-title">Revise antes de salvar</h2>
          <button type="button" class="btn btn-ghost btn-compacto" id="rv-voltar">${icon('esquerda', 16, 2.2)}Outros arquivos</button>
        </div>
        <p class="muted small">${itens.length} lançamento${itens.length > 1 ? 's' : ''} em ${lidos.length - problemas.length} arquivo${lidos.length - problemas.length > 1 ? 's' : ''}.
          Confira as categorias e desmarque o que não quer importar.
          ${futuras ? `As compras parceladas também vão gerar ${futuras} parcela${futuras > 1 ? 's' : ''} futura${futuras > 1 ? 's' : ''}.` : ''}</p>
        ${noApp ? `<div class="aviso">${noApp} ${plural(noApp, 'lançamento já está', 'lançamentos já estão')} no app (mesma data, valor e descrição) e ${plural(noApp, 'veio desmarcado', 'vieram desmarcados')}.</div>` : ''}
        ${repetidos ? `<div class="aviso">${repetidos} ${plural(repetidos, 'lançamento aparece', 'lançamentos aparecem')} em mais de um arquivo e ${plural(repetidos, 'a cópia veio desmarcada', 'as cópias vieram desmarcadas')}.</div>` : ''}
        ${problemas.map((a) => `<div class="aviso"><strong>${esc(a.nome)}:</strong> ${esc(a.erro)}</div>`).join('')}
        <label class="switch-linha"><span class="small strong">Selecionar todos</span><input type="checkbox" class="switch" id="rv-todos"></label>
      </section>

      <section class="card lista-card" id="rv-lista">
        ${itens.map((i) => {
          const opcoes = i.tipo === 'receita' ? catReceita : catDespesa;
          return `
          <div class="rv-item" data-id="${i.id}">
            <input type="checkbox" class="rv-check" aria-label="Importar ${esc(i.descricao)}">
            <span class="rv-icone">${catIcon(cat(i.categoria_id), 17)}</span>
            <span class="tx-main">
              <span class="tx-desc">${esc(i.descricao)}</span>
              <span class="tx-meta">${ddmm(i.data)}/${i.data.slice(2, 4)}${i.total_parcelas ? ` · parcela ${i.parcela_atual}/${i.total_parcelas}${i.parcelas_futuras ? ` (+${i.parcelas_futuras} futura${i.parcelas_futuras > 1 ? 's' : ''})` : ''}` : ''}${i.tipo === 'receita' ? ' · estorno/crédito' : ''}</span>
              ${i.duplicado ? `<span class="badge">${i.motivo_duplicado === 'repetido' ? 'Repetido em outro arquivo' : 'Já está no app'}</span>` : ''}
            </span>
            <span class="tx-val ${i.tipo === 'receita' ? 'pos' : ''}">${i.tipo === 'receita' ? '+' : '−'} R$ ${brl(i.valor)}</span>
            <select class="input rv-cat" aria-label="Categoria de ${esc(i.descricao)}">
              <option value="">Sem categoria</option>
              ${opcoes.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}
            </select>
          </div>`;
        }).join('')}
      </section>

      <div class="rv-rodape card">
        <span><span class="muted small" id="rv-qtd"></span><strong id="rv-total"></strong></span>
        <button type="button" class="btn btn-primary" id="rv-salvar">${icon('check', 18, 2.6)}Importar</button>
      </div>`;

    const linhas = new Map([...box.querySelectorAll('.rv-item')].map((l) => [Number(l.dataset.id), l]));

    function sincronizar() {
      let qtd = 0, total = 0;
      for (const i of itens) {
        const s = estado.get(i.id);
        const l = linhas.get(i.id);
        l.querySelector('.rv-check').checked = s.incluir;
        l.querySelector('.rv-cat').value = s.categoria_id || '';
        l.querySelector('.rv-icone').innerHTML = catIcon(cat(s.categoria_id), 17);
        l.classList.toggle('fora', !s.incluir);
        if (s.incluir) { qtd += 1; total += i.tipo === 'receita' ? -i.valor : i.valor; }
      }
      $('#rv-qtd').textContent = `${qtd} selecionado${qtd === 1 ? '' : 's'} · `;
      $('#rv-total').textContent = money(total);
      $('#rv-todos').checked = qtd === itens.length;
      $('#rv-salvar').disabled = !qtd;
      $('#rv-salvar').lastChild.textContent = qtd ? `Importar ${qtd}` : 'Importar';
    }

    $('#rv-lista').addEventListener('change', (e) => {
      const linha = e.target.closest('.rv-item');
      if (!linha) return;
      const id = Number(linha.dataset.id);
      const s = estado.get(id);
      if (e.target.classList.contains('rv-check')) s.incluir = e.target.checked;
      if (e.target.classList.contains('rv-cat')) {
        s.categoria_id = e.target.value || null;
        s.mexeu = true;
        // Mesma loja na revisão: leva a correção junto, se a pessoa ainda não mexeu nela
        const desc = chaveDesc(itens.find((i) => i.id === id).descricao);
        for (const i of itens) {
          const o = estado.get(i.id);
          if (i.id !== id && !o.mexeu && i.tipo !== 'receita' && chaveDesc(i.descricao) === desc) o.categoria_id = s.categoria_id;
        }
      }
      sincronizar();
    });
    $('#rv-todos').addEventListener('change', (e) => {
      for (const s of estado.values()) s.incluir = e.target.checked;
      sincronizar();
    });
    $('#rv-voltar').addEventListener('click', () => { box.innerHTML = ''; $('#im-envio').hidden = false; });

    $('#rv-salvar').addEventListener('click', async (e) => {
      const escolhidos = itens.filter((i) => estado.get(i.id).incluir).map((i) => ({
        data: i.data, descricao: i.descricao, valor: i.valor, tipo: i.tipo,
        categoria_id: estado.get(i.id).categoria_id, categoria_sugerida: i.categoria_sugerida,
        parcela_atual: i.parcela_atual, total_parcelas: i.total_parcelas,
      }));
      const btn = e.currentTarget;
      ocupado(btn, true, 'Importando…');
      try {
        const r = await api.confirmarImportacao({ cartao_id: $('#im-cartao')?.value || null, itens: escolhidos });
        toast(`${r.importados} lançamento${r.importados === 1 ? '' : 's'} importado${r.importados === 1 ? '' : 's'}`
          + (r.duplicados ? ` · ${r.duplicados} repetido${r.duplicados === 1 ? '' : 's'} ignorado${r.duplicados === 1 ? '' : 's'}` : ''));
        const maisRecente = escolhidos.map((i) => i.data).sort().at(-1);
        ctx.ir(`#/lancamentos?mes=${maisRecente.slice(0, 7)}`);
      } catch (ex) {
        toast(ex.message, 'erro');
        ocupado(btn, false);
      }
    });

    sincronizar();
    window.scrollTo(0, 0);
  }
}
