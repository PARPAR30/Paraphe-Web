(() => {
  const KEY = 'droit_sombre';
  if (localStorage.getItem(KEY) === '1') document.body.classList.add('sombre');

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const sync = () => {
      const on = document.body.classList.contains('sombre');
      btn.textContent = on ? 'Jour' : 'Nuit';
      btn.setAttribute('aria-pressed', String(on));
    };
    sync();
    btn.addEventListener('click', () => {
      document.body.classList.toggle('sombre');
      localStorage.setItem(KEY, document.body.classList.contains('sombre') ? '1' : '0');
      sync();
    });
  });
})();
