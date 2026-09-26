const form = document.querySelector('#download-form');
const input = document.querySelector('#instagram-url');
const statusBox = document.querySelector('#status');
const resultsBox = document.querySelector('#media-results');
const submit = form.querySelector('[type="submit"]');

function showStatus(message, kind = 'loading') {
  statusBox.hidden = false;
  statusBox.className = `status ${kind}`;
  statusBox.textContent = message;
}
function clearResults() {
  resultsBox.hidden = true;
  resultsBox.replaceChildren();
}
function renderResults(media) {
  clearResults();
  for (const [index, item] of media.entries()) {
    const card = document.createElement('article');
    card.className = 'media-result';
    const details = document.createElement('div');
    const type = item.type === 'video' ? 'Vídeo' : 'Imagem';
    const dimensions = item.width && item.height ? ` • ${item.width} × ${item.height}` : '';
    details.innerHTML = `<strong>${type} ${index + 1}</strong><span>${item.format?.toUpperCase() || 'Arquivo'}${dimensions}</span>`;
    const download = document.createElement('a');
    download.className = 'media-download';
    download.href = item.url;
    download.download = item.filename || '';
    download.textContent = '↓ Baixar arquivo';
    card.append(details, download);
    resultsBox.append(card);
  }
  resultsBox.hidden = false;
}
document.querySelector('#paste-button').addEventListener('click', async () => {
  try { input.value = await navigator.clipboard.readText(); input.focus(); }
  catch { showStatus('Permita o acesso à área de transferência ou cole o link manualmente.', 'error'); }
});
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const url = input.value.trim();
  clearResults();
  if (!url) { showStatus('Insira um link válido do Instagram.', 'error'); input.focus(); return; }
  submit.disabled = true;
  showStatus('Analisando link…');
  try {
    const response = await fetch('/api/resolve', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({url}) });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Não foi possível processar o link.');
    showStatus(`${data.media.length} mídia(s) encontrada(s). Escolha o arquivo abaixo para baixar.`, 'success');
    renderResults(data.media);
  } catch (error) { showStatus(error.message, 'error'); clearResults(); }
  finally { submit.disabled = false; }
});
document.querySelector('#year').textContent = new Date().getFullYear();
