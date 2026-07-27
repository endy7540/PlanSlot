(function() {
  'use strict';

  function syncGuestActions() {
    const guestActions = document.getElementById('homeGuestActions');
    if (!guestActions) return;

    const isLoggedIn = Boolean(localStorage.getItem('jwtToken'));
    guestActions.hidden = isLoggedIn;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncGuestActions);
  } else {
    syncGuestActions();
  }

  window.addEventListener('storage', function(event) {
    if (event.key === 'jwtToken') syncGuestActions();
  });
})();
