// sidebar.js

// Caching DOM elements
const elements = {
    sidebar: document.getElementById('sidebar-container'),
    mainView: document.getElementById('main-view'),
    historyView: document.getElementById('history-view'),  
    settingsView: document.getElementById('settings-view'),
    messageContainer: document.getElementById('message-container'),
    loadingContainer: document.getElementById('loading-container'),
    summaryContainer: document.getElementById('summary-container'),
    errorContainer: document.getElementById('error-container'),
    historyBanner: document.getElementById('history-banner'),
    confirmationModal: document.getElementById('confirmation-modal'),
    
    message: document.getElementById('message'),
    summaryText: document.getElementById('summary-text'),
    videoDuration: document.getElementById('video-duration'),
    actionStepsList: document.getElementById('action-steps-list'),
    conceptsList: document.getElementById('concepts-list'),
    conceptsContainer: document.getElementById('concepts-container'),
    errorMessage: document.getElementById('error-message'),
    historyList: document.getElementById('history-list'),
    
    apiKeyInput: document.getElementById('api-key'),
    systemPromptInput: document.getElementById('system-prompt'),
    saveConfirm: document.getElementById('save-confirm'),
    timeSavedText: document.getElementById('time-saved-text'),
    statsTimeSaved: document.getElementById('stats-time-saved'),
    statsVideosCount: document.getElementById('stats-videos-count')
};

const buttons = {
    summarize: document.getElementById('summarize-btn'),
    summarizeCurrent: document.getElementById('summarize-current-btn'),
    regenerate: document.getElementById('regenerate-btn'),
    retry: document.getElementById('retry-btn'),
    history: document.getElementById('history-btn'),
    settings: document.getElementById('settings-btn'),
    close: document.getElementById('close-btn'),
    back: document.getElementById('back-btn'),
    backFromHistory: document.getElementById('back-from-history-btn'),
    saveSettings: document.getElementById('save-settings-btn'),
    themeToggle: document.getElementById('theme-toggle-btn'),
    clearHistory: document.getElementById('clear-history-btn'),
    cancelClear: document.getElementById('cancel-clear-btn'),
    confirmClear: document.getElementById('confirm-clear-btn')
};

// Track both the actual current video and the displayed video (for history viewing)
let actualCurrentVideoId = null;
let actualCurrentVideoTitle = null;
let displayedVideoId = null;
let displayedVideoTitle = null;
let currentTheme = 'dark'; // Default theme is dark
let isViewingHistory = false;

// --- View Management ---
function showView(view) {
    elements.mainView.classList.add('hidden');
    elements.settingsView.classList.add('hidden');
    elements.historyView.classList.add('hidden');
    view.classList.remove('hidden');
}

// --- Theme Management ---
function applyTheme(theme) {
    const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
    const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        if (buttons.themeToggle) buttons.themeToggle.innerHTML = sunIcon;
    } else {
        document.body.classList.remove('dark-theme');
        if (buttons.themeToggle) buttons.themeToggle.innerHTML = moonIcon;
    }
    currentTheme = theme;
}

async function toggleTheme() {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    const settings = await getSettings();
    chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings: { ...settings, theme: newTheme },
    });
}

// --- Time Saved Management ---
async function updateTimeSavedDisplay() {
    const response = await chrome.runtime.sendMessage({ action: 'getTimeSaved' });
    if (response) {
        const formattedTime = formatDuration(response.timeSaved);
        elements.timeSavedText.textContent = `Time saved: ${formattedTime}`;
        
        if (elements.statsTimeSaved) {
            elements.statsTimeSaved.textContent = formattedTime;
        }
        if (elements.statsVideosCount) {
            elements.statsVideosCount.textContent = response.videosSummarized.toString();
        }
    }
}

function formatDuration(seconds) {
    if (!seconds || seconds === 0) return '0m';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

// --- Video Management ---
function updateMessageForCurrentVideo() {
    if (isViewingHistory && actualCurrentVideoId !== displayedVideoId) {
        elements.message.textContent = `Viewing history. Click to summarize current video.`;
    } else {
        elements.message.textContent = `Ready to summarize the video!`;
    }
}

function resetToCurrentVideo() {
    isViewingHistory = false;
    displayedVideoId = actualCurrentVideoId;
    displayedVideoTitle = actualCurrentVideoTitle;
    updateMessageForCurrentVideo();
}

// --- UI Rendering ---
function renderSummary(data, isFromHistory = false) {
    const formatText = (text) => {
        const escapedText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return escapedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    };

    elements.summaryText.innerHTML = formatText(data.summary);

    // Display video duration if available
    if (data.formattedDuration) {
        elements.videoDuration.textContent = data.formattedDuration;
        elements.videoDuration.style.display = 'inline';
    } else {
        elements.videoDuration.style.display = 'none';
    }

    elements.actionStepsList.innerHTML = '';
    if (data.action_steps && data.action_steps.length > 0) {
        data.action_steps.forEach(step => {
            const li = document.createElement('li');
            li.innerHTML = formatText(step);
            elements.actionStepsList.appendChild(li);
        });
    }

    elements.conceptsList.innerHTML = '';
    if (data.concepts && data.concepts.length > 0) {
        data.concepts.forEach(concept => {
            if (typeof concept === 'object' && concept.title && concept.timestamp) {
                const li = document.createElement('li');
                li.classList.add('concept-item');

                const titleSpan = document.createElement('span');
                titleSpan.textContent = concept.title;
                titleSpan.classList.add('concept-title');

                const timeSpan = document.createElement('span');
                timeSpan.textContent = concept.timestamp;
                timeSpan.classList.add('concept-timestamp');

                li.appendChild(titleSpan);
                li.appendChild(timeSpan);

                li.addEventListener('click', () => {
                    const timeInSeconds = parseTimestamp(concept.timestamp);
                    chrome.runtime.sendMessage({ action: 'seekVideo', time: timeInSeconds });
                });
                elements.conceptsList.appendChild(li);
            } else if (typeof concept === 'string') {
                const li = document.createElement('li');
                li.innerHTML = formatText(concept);
                elements.conceptsList.appendChild(li);
            }
        });
        elements.conceptsContainer.classList.remove('hidden');
    } else {
        elements.conceptsContainer.classList.add('hidden');
    }

    // Show/hide history banner
    if (isViewingHistory && actualCurrentVideoId !== displayedVideoId) {
        elements.historyBanner.classList.remove('hidden');
    } else {
        elements.historyBanner.classList.add('hidden');
    }

    elements.messageContainer.classList.add('hidden');
    elements.loadingContainer.classList.add('hidden');
    elements.summaryContainer.classList.remove('hidden');
    elements.errorContainer.classList.add('hidden');

    // Update time saved display after successful summary (only if not from history)
    if (!isFromHistory) {
        updateTimeSavedDisplay();
    }
}

function renderHistory(history) {
    elements.historyList.innerHTML = '';
    if (history && history.length > 0) {
        history.forEach(item => {
            const div = document.createElement('div');
            const isCurrentVideo = item.videoId === actualCurrentVideoId;
            div.className = isCurrentVideo ? 'history-item current-video' : 'history-item';
            
            div.innerHTML = `<p class="history-item-title">${item.title}</p>`;
            
            div.addEventListener('click', () => {
                // Set the displayed video to the history item but keep track of actual current video
                displayedVideoId = item.videoId;
                displayedVideoTitle = item.title;
                isViewingHistory = actualCurrentVideoId !== item.videoId;
                
                renderSummary(item.summary, true);
                showView(elements.mainView);
                updateMessageForCurrentVideo();
            });
            elements.historyList.appendChild(div);
        });
    } else {
        elements.historyList.innerHTML = '<p>No history yet.</p>';
    }
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorContainer.classList.remove('hidden');
    elements.loadingContainer.classList.add('hidden');
    elements.summaryContainer.classList.add('hidden');
    elements.messageContainer.classList.add('hidden');
}

function showLoading() {
    elements.messageContainer.classList.add('hidden');
    elements.summaryContainer.classList.add('hidden');
    elements.errorContainer.classList.add('hidden');
    elements.loadingContainer.classList.remove('hidden');
}

function resetToMessage() {
    elements.summaryContainer.classList.add('hidden');
    elements.errorContainer.classList.add('hidden');
    elements.loadingContainer.classList.add('hidden');  
    elements.messageContainer.classList.remove('hidden');
    updateMessageForCurrentVideo();
}

// --- Event Handlers ---
async function handleSummarize() {
    // Always use the actual current video for generating new summaries
    resetToCurrentVideo();
    
    showLoading();

    // Disable buttons during processing
    buttons.summarize.disabled = true;
    buttons.summarizeCurrent.disabled = true;
    buttons.regenerate.disabled = true;

    try {
        const settings = await getSettings();
        if (!settings.apiKey) {
            showError('API Key not set. Please set it in the settings.');
            return;
        }

        const videoDetails = {
            videoId: actualCurrentVideoId,
            title: actualCurrentVideoTitle,
        };

        const response = await chrome.runtime.sendMessage({
            action: 'getSummary',
            videoDetails,
            systemPrompt: settings.systemPrompt,
        });

        if (response.error) {
            showError(response.error);
        } else {
            renderSummary(response, false);
            // Save to history
            chrome.runtime.sendMessage({
                action: 'saveToHistory',
                videoId: actualCurrentVideoId,
                title: actualCurrentVideoTitle,
                data: response
            }, () => {
                // Refresh history list after saving so it appears immediately in history tab
                chrome.runtime.sendMessage({ action: 'getHistory' }, (historyResponse) => {
                    renderHistory(historyResponse || []);
                });
            });
        }
    } catch (e) {
        showError('An unexpected error occurred. Please try again.');
        console.error(e);
    } finally {
        // Re-enable buttons
        buttons.summarize.disabled = false;
        buttons.summarizeCurrent.disabled = false;
        buttons.regenerate.disabled = false;
    }
}

async function handleSaveSettings() {
    const settings = {
        apiKey: elements.apiKeyInput.value.trim(),
        systemPrompt: elements.systemPromptInput.value.trim(),
        theme: currentTheme
    };
    await chrome.runtime.sendMessage({ action: 'saveSettings', settings });
    elements.saveConfirm.classList.remove('hidden');
    setTimeout(() => elements.saveConfirm.classList.add('hidden'), 2000);
    
    // Update statistics display
    updateTimeSavedDisplay();
}

async function handleClearHistory() {
    // Show confirmation modal
    elements.confirmationModal.classList.remove('hidden');
}

async function confirmClearHistory() {
    try {
        buttons.confirmClear.disabled = true;
        buttons.confirmClear.textContent = 'Clearing...';
        
        const response = await chrome.runtime.sendMessage({ action: 'clearHistory' });
        
        if (response.success) {
            // Hide modal
            elements.confirmationModal.classList.add('hidden');
            
            // Clear the history list display
            renderHistory([]);
            
            // Clear any currently displayed summary and reset to current video
            resetToCurrentVideo();
            resetToMessage();
            
            // Update time saved display
            updateTimeSavedDisplay();
            
            // Show success feedback
            buttons.clearHistory.textContent = 'Cleared!';
            
            setTimeout(() => {
                buttons.clearHistory.textContent = 'Clear History';
            }, 2000);
        }
    } catch (error) {
        console.error('Error clearing history:', error);
        buttons.confirmClear.textContent = 'Error clearing';
        setTimeout(() => {
            buttons.confirmClear.textContent = 'Clear All';
        }, 2000);
    } finally {
        buttons.confirmClear.disabled = false;
    }
}

function cancelClearHistory() {
    elements.confirmationModal.classList.add('hidden');
}

// --- Helper Functions ---

function getSettings() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
            resolve(response);
        });
    });
}

function parseTimestamp(timestamp) {
    const parts = timestamp.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
}

async function loadSettings() {
    const settings = await getSettings();
    elements.apiKeyInput.value = settings.apiKey || '';
    elements.systemPromptInput.value = settings.systemPrompt || '';
}

// --- Initialization ---
async function initialize() {
    buttons.summarize.addEventListener('click', handleSummarize);
    buttons.summarizeCurrent.addEventListener('click', handleSummarize);
    buttons.regenerate.addEventListener('click', handleSummarize);
    buttons.retry.addEventListener('click', handleSummarize);
    buttons.close.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'closeSidebar' });
    });
    buttons.themeToggle.addEventListener('click', toggleTheme);
    buttons.settings.addEventListener('click', () => {
        showView(elements.settingsView);
        loadSettings(); // Load current settings when opening
        updateTimeSavedDisplay(); // Update stats when opening settings
    });
    buttons.back.addEventListener('click', () => showView(elements.mainView));
    buttons.saveSettings.addEventListener('click', handleSaveSettings);
    buttons.history.addEventListener('click', () => {
        // Refresh history list when opening history view to ensure it's up to date
        chrome.runtime.sendMessage({ action: 'getHistory' }, (response) => {
            renderHistory(response || []);
            showView(elements.historyView);
        });
    });
    buttons.backFromHistory.addEventListener('click', () => showView(elements.mainView));
    buttons.clearHistory.addEventListener('click', handleClearHistory);
    buttons.confirmClear.addEventListener('click', confirmClearHistory);
    buttons.cancelClear.addEventListener('click', cancelClearHistory);

    // Close modal when clicking overlay
    elements.confirmationModal.addEventListener('click', (e) => {
        if (e.target === elements.confirmationModal || e.target.classList.contains('modal-overlay')) {
            cancelClearHistory();
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !elements.confirmationModal.classList.contains('hidden')) {
            cancelClearHistory();
        }
    });

    // Initialize current video tracking
    chrome.runtime.sendMessage({ action: 'getCurrentVideo' }, (response) => {
        if (response && response.videoId) {
            actualCurrentVideoId = response.videoId;
            actualCurrentVideoTitle = response.title || 'Unknown Title';
            displayedVideoId = response.videoId;
            displayedVideoTitle = response.title || 'Unknown Title';
            isViewingHistory = false;
        }
    });
    
    // Load settings and apply theme
    const settings = await getSettings();
    applyTheme(settings.theme || 'light');
    updateTimeSavedDisplay();

    // Check for cached summary
    chrome.runtime.sendMessage({ action: 'getCachedSummary' }, (response) => {
        if (response && response.data) {
            renderSummary(response.data, false);
        } else {
            resetToMessage();
        }
    });

    // Load history for display
    chrome.runtime.sendMessage({ action: 'getHistory' }, (response) => {
        renderHistory(response || []);
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'newVideoLoaded') {
        actualCurrentVideoId = request.videoId;
        actualCurrentVideoTitle = null; // Will be updated when summary is generated
        displayedVideoId = actualCurrentVideoId;
        displayedVideoTitle = actualCurrentVideoTitle;
        isViewingHistory = false;
        
        resetToMessage();
        // Update time saved display when navigating to new video
        updateTimeSavedDisplay();
    }
    return true; // Keep message channel open for async responses
});

// Initialize the sidebar
initialize();