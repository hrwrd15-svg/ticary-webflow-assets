// Updated header.js

function toggleDrawerMenu() {
    const drawerMenu = document.querySelector('.drawer-menu');
    drawerMenu.classList.toggle('visible');
}

// Function to initialize header elements
function initHeader() {
    const hamburgerIcon = document.querySelector('.hamburger');
    hamburgerIcon.addEventListener('click', toggleDrawerMenu);

    // Remove desktop navigation links
    const desktopNavLinks = document.querySelectorAll('.desktop-nav-link');
    desktopNavLinks.forEach(link => link.style.display = 'none');

    // Keep Favourites button and theme toggle visible
    const favouritesButton = document.querySelector('.favourites-button');
    const themeToggle = document.querySelector('.theme-toggle');
    if (favouritesButton) favouritesButton.style.display = 'block';
    if (themeToggle) themeToggle.style.display = 'block';

    // Always show the hamburger menu
    hamburgerIcon.style.display = 'block';
}

// Initialize header on page load
window.onload = initHeader;