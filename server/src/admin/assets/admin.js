// Asks before a form with data-confirm is sent (delete buttons, score resets).
document.addEventListener('submit', (event) => {
  const form = event.target;
  const question = form instanceof HTMLFormElement ? form.dataset.confirm : undefined;
  if (question && !window.confirm(question)) event.preventDefault();
});
