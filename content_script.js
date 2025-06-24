// content_script.js

(() => {
  let sidebarIframe;

  const createSidebar = () => {
    sidebarIframe = document.createElement('iframe');
    sidebarIframe.id = 'yt-summarizer-sidebar-iframe';
    sidebarIframe.src = chrome.runtime.getURL('sidebar/sidebar.html');
    document.body.appendChild(sidebarIframe);
  };

  const toggleSidebar = () => {
    if (!sidebarIframe) {
      createSidebar();
    }

    const isVisible = sidebarIframe.classList.contains('visible');
    if (isVisible) {
        sidebarIframe.classList.remove('visible');
        document.body.classList.remove('yt-summarizer-sidebar-open');
    } else {
        sidebarIframe.classList.add('visible');
        document.body.classList.add('yt-summarizer-sidebar-open');
    }
  };

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "ping") {
      sendResponse({ status: "ready" });
    } else if (request.action === "toggleSidebar") {
      toggleSidebar();
      sendResponse({ status: "done" });
    } else if (request.action === 'getVideoDetails') {
        const videoId = new URLSearchParams(window.location.search).get('v');
        const videoUrl = window.location.href;
        const videoTitle = document.title;
        sendResponse({ videoId, videoUrl, videoTitle });
        return true; 
    }
  });

  // Listen for YouTube's custom navigation event to reset the sidebar on new video pages.
  document.addEventListener('yt-navigate-finish', () => {
    // Check if the sidebar exists before trying to send a message
    if (document.getElementById('youtube-summarizer-sidebar')) {
        chrome.runtime.sendMessage({ action: 'resetState' });
    }
  });
})();
