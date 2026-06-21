(function() {
  // Find the script tag that loaded this widget
  const scripts = document.getElementsByTagName('script');
  let currentScript = null;
  for (let i = 0; i < scripts.length; i++) {
    if (scripts[i].src.includes('widget.js')) {
      currentScript = scripts[i];
      break;
    }
  }

  if (!currentScript) return;

  // Extract config
  const token = currentScript.getAttribute('data-token') || '';
  const frontendUrl = currentScript.getAttribute('data-frontend-url') || 'http://localhost:3001';

  // Create the widget container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.bottom = '20px';
  container.style.right = '20px';
  container.style.width = '400px';
  container.style.height = '600px';
  container.style.maxWidth = 'calc(100% - 40px)';
  container.style.maxHeight = 'calc(100% - 100px)';
  container.style.backgroundColor = 'transparent';
  container.style.zIndex = '999999';
  container.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
  container.style.borderRadius = '24px';
  container.style.overflow = 'hidden';
  container.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease';
  container.style.transform = 'translateY(20px) scale(0.95)';
  container.style.opacity = '0';
  container.style.pointerEvents = 'none'; // Initially closed

  // Create the iframe
  const iframe = document.createElement('iframe');
  iframe.src = `${frontendUrl}/widget?token=${encodeURIComponent(token)}`;
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.backgroundColor = 'transparent';
  
  container.appendChild(iframe);
  document.body.appendChild(container);

  // Create toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block; margin: auto;">
      <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"></path>
    </svg>
  `;
  toggleBtn.style.position = 'fixed';
  toggleBtn.style.bottom = '20px';
  toggleBtn.style.right = '20px';
  toggleBtn.style.width = '56px';
  toggleBtn.style.height = '56px';
  toggleBtn.style.borderRadius = '28px';
  toggleBtn.style.backgroundColor = '#115e59'; // Library Green
  toggleBtn.style.color = 'white';
  toggleBtn.style.border = 'none';
  toggleBtn.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
  toggleBtn.style.cursor = 'pointer';
  toggleBtn.style.zIndex = '1000000';
  toggleBtn.style.transition = 'transform 0.2s ease, background-color 0.2s ease';
  
  let isOpen = false;
  
  toggleBtn.onclick = () => {
    isOpen = !isOpen;
    if (isOpen) {
      container.style.transform = 'translateY(-80px) scale(1)';
      container.style.opacity = '1';
      container.style.pointerEvents = 'auto';
      toggleBtn.style.transform = 'scale(0.9)';
      setTimeout(() => toggleBtn.style.transform = 'scale(1)', 150);
      toggleBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block; margin: auto;">
          <path d="M18 6 6 18"></path>
          <path d="m6 6 12 12"></path>
        </svg>
      `;
    } else {
      container.style.transform = 'translateY(20px) scale(0.95)';
      container.style.opacity = '0';
      container.style.pointerEvents = 'none';
      toggleBtn.style.transform = 'scale(0.9)';
      setTimeout(() => toggleBtn.style.transform = 'scale(1)', 150);
      toggleBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block; margin: auto;">
          <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"></path>
        </svg>
      `;
    }
  };

  document.body.appendChild(toggleBtn);
})();
