window.FM = window.FM || {};

(function () {
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function finish(loader) {
    loader.classList.add('done');
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-revealed');
  }

  window.FM.runLoader = function () {
    const loader = document.getElementById('loader');
    if (!loader) return;

    if (REDUCED) {
      finish(loader);
      return;
    }

    const numEl = loader.querySelector('.loader__num');
    const fillEl = loader.querySelector('.loader__fill');
    let count = 0;
    const id = setInterval(() => {
      count += 1;
      numEl.textContent = count;
      fillEl.style.width = count + '%';
      if (count >= 100) {
        clearInterval(id);
        setTimeout(() => finish(loader), 280);
      }
    }, 13);
  };
})();
