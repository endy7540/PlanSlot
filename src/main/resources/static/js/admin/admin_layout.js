document.addEventListener('DOMContentLoaded', function() {
    const toggleBtn = document.getElementById('adminMenuToggle');
    const closeBtn = document.getElementById('adminMenuClose');
    const sidebar = document.getElementById('adminSidebar');
    const overlay = document.getElementById('adminSidebarOverlay');
    
    if(!toggleBtn || !sidebar || !overlay) return;
    
    function openMenu() {
        sidebar.classList.add('is-open');
        overlay.classList.add('is-open');
        toggleBtn.setAttribute('aria-expanded', 'true');
        document.body.classList.add('admin-drawer-open');
    }
    
    function closeMenu() {
        sidebar.classList.remove('is-open');
        overlay.classList.remove('is-open');
        toggleBtn.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('admin-drawer-open');
    }
    
    toggleBtn.addEventListener('click', openMenu);
    if(closeBtn) closeBtn.addEventListener('click', closeMenu);
    overlay.addEventListener('click', closeMenu);
});
