// Add CSS to hide desktop nav and always show hamburger menu

const hideDesktopNav = () => {  
    const desktopNav = document.querySelector('.tc-header-nav');  
    const hamburgerMenu = document.querySelector('.tc-mnav-btn');  

    if (desktopNav) {  
        desktopNav.style.display = 'none'; // Hides the desktop navigation links  
    }  
    if (hamburgerMenu) {  
        hamburgerMenu.style.display = 'block'; // Ensures the hamburger menu is always visible  
    }  
};  

hideDesktopNav(); 
