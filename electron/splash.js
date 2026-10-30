const render = value => {
  document.querySelector('#status').textContent = value.message;
  document.querySelector('#actions').hidden = !value.error;
  document.body.classList.toggle('failed', value.error);
};
window.desktop.onStatus(render);
window.desktop.getInfo().then(render);
document.querySelector('#close').onclick = () => window.desktop.close();
document.querySelector('#retry').onclick = () => window.desktop.retry();
document.querySelector('#details').onclick = () => window.desktop.details();
