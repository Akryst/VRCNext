function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
    localStorage.setItem('vrcnext_sidebar', sidebarCollapsed ? '1' : '0');
    const sidebar = document.getElementById('sidebarEl');
    const sbEl = document.getElementById('sbIcon'); if (sbEl) sbEl.textContent = sidebarCollapsed ? 'chevron_right' : 'chevron_left';
    if (sidebarCollapsed) {
        sidebar.classList.add('collapsing');
        setTimeout(() => {
            sidebar.classList.remove('collapsing');
            sidebar.classList.add('collapsed');
        }, 230);
    } else {
        sidebar.classList.remove('collapsed');
    }
}
