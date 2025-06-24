// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleSidebar') {
        // Message from popup doesn't have sender.tab. Get the active tab instead.
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                handleToggleSidebar(tabs[0]);
            } else {
                console.error("Could not find active tab to toggle sidebar.");
            }
        });
    } else if (request.action === 'getInitialState') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                handleGetInitialState(tabs[0]);
            } else {
                console.error("Could not find active tab for getInitialState.");
            }
        });
    } else if (request.action === 'getSummary') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                handleGetSummary(tabs[0]);
            } else {
                chrome.runtime.sendMessage({ action: 'summaryResponse', error: 'Could not find active YouTube tab.' });
            }
        });
    } else if (request.action === 'saveSettings') {
        chrome.storage.local.set(request.settings, () => {
            sendResponse({ status: 'success' });
        });
    } else if (request.action === 'getSettings') {
        chrome.storage.local.get(['apiKey', 'systemPrompt'], (settings) => {
            sendResponse({ settings });
        });
    }
    return true; // Keep the message channel open for asynchronous responses
});

function handleToggleSidebar(tab) {
    // Check if the content script is already injected and ready.
    chrome.tabs.sendMessage(tab.id, { action: "ping" }, (response) => {
        if (chrome.runtime.lastError) {
            // Content script is not injected yet.
            // Inject CSS first, then the script.
            chrome.scripting.insertCSS({
                target: { tabId: tab.id },
                files: ["content_style.css"]
            }).then(() => {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ["content_script.js"]
                }).then(() => {
                    // After injection, send the toggle command.
                    setTimeout(() => {
                        chrome.tabs.sendMessage(tab.id, { action: "toggleSidebar" });
                    }, 100);
                });
            });
        } else {
            // Content script is already there, just send the toggle command.
            chrome.tabs.sendMessage(tab.id, { action: "toggleSidebar" });
        }
    });
}

async function handleGetInitialState(tab) {
    try {
        const settings = await chrome.storage.local.get(['apiKey']);
        if (!settings.apiKey) {
            chrome.runtime.sendMessage({ action: 'initialStateResponse', apiKeyMissing: true });
            return;
        }

        const videoDetails = await getVideoDetails(tab.id);
        if (!videoDetails || !videoDetails.videoId) {
            // Not a video page or details not found, send default state
            chrome.runtime.sendMessage({ action: 'initialStateResponse', apiKeyMissing: false, cachedData: null });
            return;
        }

        const result = await chrome.storage.local.get([videoDetails.videoId]);
        const cachedEntry = result[videoDetails.videoId] || null;

        chrome.runtime.sendMessage({ 
            action: 'initialStateResponse', 
            apiKeyMissing: false, 
            cachedData: cachedEntry 
        });

    } catch (error) {
        // This can happen if the content script isn't ready, which is normal on non-YouTube pages.
        // Send a default state back.
        chrome.runtime.sendMessage({ action: 'initialStateResponse', apiKeyMissing: false, cachedData: null });
    }
}

async function handleGetSummary(tab) {
    try {
        const settings = await chrome.storage.local.get(['apiKey', 'systemPrompt']);
        if (!settings.apiKey) {
            throw new Error('API Key not found. Please set it in the settings.');
        }

        const videoDetails = await getVideoDetails(tab.id);
        if (videoDetails.error) throw new Error(videoDetails.error);
        if (!videoDetails.videoUrl) throw new Error('Could not get video URL.');

        const summaryData = await generateSummary(videoDetails.videoUrl, settings.apiKey, settings.systemPrompt);

        await chrome.storage.local.set({ [videoDetails.videoId]: { summaryData, videoTitle: videoDetails.videoTitle } });

        chrome.runtime.sendMessage({ 
            action: 'summaryResponse', 
            data: summaryData, 
            videoId: videoDetails.videoId, 
            videoTitle: videoDetails.videoTitle 
        });

    } catch (error) {
        chrome.runtime.sendMessage({ action: 'summaryResponse', error: error.message });
    }
}

function getVideoDetails(tabId) {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, { action: 'getVideoDetails' }, (response) => {
            if (chrome.runtime.lastError) {
                return reject(new Error('Could not connect to the YouTube page. Please refresh the page and try again.'));
            }
            if (response) {
                resolve(response);
            } else {
                reject(new Error('Did not receive a response from the content script.'));
            }
        });
    });
}

async function generateSummary(videoUrl, apiKey, systemPrompt) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const requestBody = {
        contents: [
            {
                parts: [
                    {
                        file_data: {
                            file_uri: videoUrl,
                            mime_type: 'video/youtube'
                        }
                    },
                    { text: systemPrompt }
                ]
            }
        ],
        generationConfig: {
            responseMimeType: "application/json",
        }
    };

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(`API Error: ${errorBody.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const jsonString = data.candidates[0].content.parts[0].text;
    return JSON.parse(jsonString);
}
