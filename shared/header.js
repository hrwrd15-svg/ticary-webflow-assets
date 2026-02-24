// Original content of header.js

// Modifications to hide desktop navigation
const tcHeaderNav = document.querySelector('.tc-header-nav');
tcHeaderNav.style.display = 'none';

// Always show the hamburger menu button
const hamburgerMenuButton = document.querySelector('.hamburger-menu-button');
hamburgerMenuButton.style.display = 'block';

// Keep Favourites, Home, and Theme toggle visible
const favouritesButton = document.querySelector('.favourites-button');
favouritesButton.style.display = 'block';

const homeButton = document.querySelector('.home-button');
homeButton.style.display = 'block';

const themeToggle = document.querySelector('.theme-toggle');
themeToggle.style.display = 'block';