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

  // Function to get video duration in seconds
  const getVideoDuration = () => {
    const videoPlayer = document.querySelector('video');
    if (videoPlayer && videoPlayer.duration) {
      return Math.floor(videoPlayer.duration);
    }
    
    // Fallback: try to get duration from the page elements
    const durationElements = [
      '.ytp-time-duration',
      '.ytd-thumbnail-overlay-time-status-renderer',
      '.ytd-video-primary-info-renderer .ytd-video-view-count-renderer'
    ];
    
    for (const selector of durationElements) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        const durationText = element.textContent.trim();
        const match = durationText.match(/(\d{1,2}:)?(\d{1,2}):(\d{2})/);
        if (match) {
          const hours = match[1] ? parseInt(match[1].replace(':', '')) : 0;
          const minutes = parseInt(match[2]);
          const seconds = parseInt(match[3]);
          return hours * 3600 + minutes * 60 + seconds;
        }
      }
    }
    
    return null;
  };

  // Function to format duration as human readable string
  const formatDuration = (seconds) => {
    if (!seconds) return null;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  };

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "ping") {
      sendResponse({ status: "ready" });
    } else if (request.action === "toggleSidebar") {
      toggleSidebar();
      sendResponse({ status: "done" });
    } else if (request.action === 'closeSidebar') {
        if (sidebarIframe) {
            sidebarIframe.classList.remove('visible');
            document.body.classList.remove('yt-summarizer-sidebar-open');
        }
        sendResponse({ status: 'done' });
    } else if (request.action === 'getVideoDetails') {
        const videoId = new URLSearchParams(window.location.search).get('v');
        const videoUrl = window.location.href;
        const videoTitle = document.title;
        const duration = getVideoDuration();
        const formattedDuration = formatDuration(duration);
        
        sendResponse({ 
          videoId, 
          videoUrl, 
          videoTitle, 
          duration, 
          formattedDuration 
        });
        return true; 
    } else if (request.action === 'seekVideo') {
        const videoPlayer = document.querySelector('video');
        if (videoPlayer) {
            videoPlayer.currentTime = request.time;
        }
        sendResponse({ status: 'done' });
    }
  });

  // Listen for YouTube's custom navigation event to reset the sidebar on new video pages.
  document.addEventListener('yt-navigate-finish', () => {
    // Check if the sidebar exists before trying to send a message
    if (sidebarIframe) {
        chrome.runtime.sendMessage({ action: 'resetState' });
    }
  });
})();
