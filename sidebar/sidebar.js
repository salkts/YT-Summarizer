// sidebar.js

// Caching DOM elements
const elements = {
    // Views
    mainView: document.getElementById('main-view'),
    settingsView: document.getElementById('settings-view'),
    historyView: document.getElementById('history-view'),
    // Main view elements
    content: document.getElementById('content'),
    messageContainer: document.getElementById('message-container'),
    loadingContainer: document.getElementById('loading-container'),
    summaryContainer: document.getElementById('summary-container'),
    errorContainer: document.getElementById('error-container'),
    message: document.getElementById('message'),
    summaryText: document.getElementById('summary-text'),
    actionStepsList: document.getElementById('action-steps-list'),
    conceptsContainer: document.getElementById('concepts-container'),
    conceptsList: document.getElementById('concepts-list'),
    errorMessage: document.getElementById('error-message'),
    // Settings elements
    apiKeyInput: document.getElementById('api-key'),
    systemPromptInput: document.getElementById('system-prompt'),
    saveConfirm: document.getElementById('save-confirm'),
    // History elements
    historyList: document.getElementById('history-list'),
};

const buttons = {
    summarize: document.getElementById('summarize-btn'),
    regenerate: document.getElementById('regenerate-btn'),
    settings: document.getElementById('settings-btn'),
    backFromSettings: document.getElementById('back-btn'),
    saveSettings: document.getElementById('save-settings-btn'),
    history: document.getElementById('history-btn'),
    backFromHistory: document.getElementById('back-from-history-btn'),
    close: document.getElementById('close-btn'),
    themeSwitcher: document.getElementById('theme-switcher'),
    themeToggle: document.getElementById('theme-toggle-btn'),
};

let currentVideoId = null;
let currentVideoTitle = null;
let currentTheme = 'dark'; // Default theme is dark

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

// --- UI Rendering ---
function renderSummary(data) {
    if (!data || !data.summary) {
        showError('Received empty or invalid summary data.');
        return;
    }

    const formatText = (text) => {
        const escapedText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return escapedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    };

    elements.summaryText.innerHTML = formatText(data.summary);

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

    elements.messageContainer.classList.add('hidden');
    elements.loadingContainer.classList.add('hidden');
    elements.summaryContainer.classList.remove('hidden');
    elements.errorContainer.classList.add('hidden');

}

function renderHistory(history) {
    elements.historyList.innerHTML = '';
    if (history && history.length > 0) {
        history.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `<p class="history-item-title">${item.title}</p>`;
            div.addEventListener('click', () => {
                currentVideoId = item.videoId;
                currentVideoTitle = item.title;
                renderSummary(item.summary);
                showView(elements.mainView);
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

// --- Event Handlers ---
async function handleSummarize() {
    elements.messageContainer.classList.add('hidden');
    elements.summaryContainer.classList.add('hidden');
    elements.errorContainer.classList.add('hidden');
    elements.loadingContainer.classList.remove('hidden');

    try {
        const settings = await getSettings();
        if (!settings.apiKey) {
            showError('API Key not set. Please set it in the settings.');
            return;
        }

        const videoDetails = {
            videoId: currentVideoId,
            title: currentVideoTitle,
        };

        const response = await chrome.runtime.sendMessage({
            action: 'getSummary',
            videoDetails,
            systemPrompt: settings.systemPrompt,
        });

        if (response.error) {
            showError(response.error);
        } else {
            renderSummary(response);
            // Save to history
            chrome.runtime.sendMessage({
                action: 'saveToHistory',
                videoId: currentVideoId,
                title: currentVideoTitle,
                data: response
            });
        }
    } catch (e) {
        showError('An unexpected error occurred.');
        console.error(e);
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

// --- Initialization ---
async function initialize() {
    buttons.summarize.addEventListener('click', handleSummarize);
    buttons.regenerate.addEventListener('click', handleSummarize);
    buttons.settings.addEventListener('click', () => showView(elements.settingsView));
    buttons.backFromSettings.addEventListener('click', () => showView(elements.mainView));
    buttons.saveSettings.addEventListener('click', handleSaveSettings);
    buttons.history.addEventListener('click', () => showView(elements.historyView));
    buttons.backFromHistory.addEventListener('click', () => showView(elements.mainView));
    buttons.close.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'closeSidebar' });
    });
    buttons.themeSwitcher.addEventListener('click', toggleTheme);
    buttons.themeToggle.addEventListener('click', toggleTheme);

    const settings = await getSettings();
    elements.apiKeyInput.value = settings.apiKey || '';
    elements.systemPromptInput.value = settings.systemPrompt || '';
    applyTheme(settings.theme || 'dark');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url && tabs[0].url.includes("youtube.com/watch")) {
            const url = new URL(tabs[0].url);
            currentVideoId = url.searchParams.get('v');
            currentVideoTitle = tabs[0].title.replace(' - YouTube', '');

            chrome.runtime.sendMessage({ action: 'getInitialState', videoId: currentVideoId }, (response) => {
                if (response) {
                    if (response.summary) renderSummary(response.summary);
                    renderHistory(response.history);
                }
            });
        } else {
            showError("Not a YouTube video page.");
        }
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'newVideoLoaded') {
        currentVideoId = request.videoId;
        elements.summaryContainer.classList.add('hidden');
        elements.errorContainer.classList.add('hidden');
        elements.loadingContainer.classList.add('hidden');
        elements.messageContainer.classList.remove('hidden');
        initialize();
    }
    return true; // Keep message channel open for async responses
});

initialize();