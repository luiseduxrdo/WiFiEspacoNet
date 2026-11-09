'use strict';
window.addEventListener('load', () => {
  const button = document.getElementById('print');
  if (button) {
    button.addEventListener('click', () => window.print());
  } else {
    window.focus();
    window.print();
    setTimeout(() => window.close(), 500);
  }
});
