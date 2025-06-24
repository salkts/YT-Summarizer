document.addEventListener('DOMContentLoaded', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        if (currentTab && currentTab.url.includes("youtube.com/watch")) {
            // It's a YouTube video page, so we tell the background script to open the sidebar
            // and then we close the popup immediately.
            chrome.runtime.sendMessage({ action: 'toggleSidebar' });
            window.close();
        } else {
            // It's not a YouTube video page, so we show the message.
            document.getElementById('message').style.display = 'block';
        }
    });
});
