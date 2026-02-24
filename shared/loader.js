(function () {
  if (window.__ticaryLoaderInjected) return;
  window.__ticaryLoaderInjected = 1;

  document.write(
    '<div id="ticary-loader" class="ticary-loader">' +
      '<div class="ticary-loader__inner">' +
        '<div class="ticary-loader__logo"><span>TICARY</span></div>' +
        '<div class="ticary-loader__spinner"></div>' +
        '<div class="ticary-loader__text">Loading cars…</div>' +
      '</div>' +
    '</div>'
  );
})();
