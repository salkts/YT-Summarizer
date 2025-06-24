document.addEventListener('DOMContentLoaded', () => {
    // --- Element Cache ---
    const views = {
        main: document.getElementById('main-view'),
        settings: document.getElementById('settings-view'),
        history: document.getElementById('history-view'),
    };
    const buttons = {
        settings: document.getElementById('settings-btn'),
        close: document.getElementById('close-btn'),
        back: document.getElementById('back-btn'),
        history: document.getElementById('history-btn'),
        backFromHistory: document.getElementById('back-from-history-btn'),
        saveSettings: document.getElementById('save-settings-btn'),
        summarize: document.getElementById('summarize-btn'),
    };
    const inputs = {
        apiKey: document.getElementById('api-key'),
        systemPrompt: document.getElementById('system-prompt'),
    };
    const displays = {
        saveConfirm: document.getElementById('save-confirm'),
        message: document.getElementById('message'),
        summaryText: document.getElementById('summary-text'),
        actionStepsList: document.getElementById('action-steps-list'),
        errorMessage: document.getElementById('error-message'),
        historyList: document.getElementById('history-list'),
    };
    const containers = {
        message: document.getElementById('message-container'),
        loading: document.getElementById('loading-container'),
        error: document.getElementById('error-container'),
        summary: document.getElementById('summary-container'),
    };

    const defaultSystemPrompt = `You are an expert YouTube video summarizer. You will be given a YouTube video URL. Your goal is to provide a concise, easy-to-read summary and a list of actionable steps from the video's content. The output should be in JSON format with two keys: 'summary' and 'action_steps'. The 'summary' should be a string of well-written paragraphs. The 'action_steps' should be an array of strings, where each string is a clear, actionable item. If there are no specific action steps, provide an empty array.`;

    // --- View Management ---
    const showView = (viewName) => {
        for (const key in views) {
            views[key].classList.toggle('hidden', key !== viewName);
        }
        if (viewName === 'history') {
            renderHistory();
        }
    };

    const showContentState = (containerName) => {
        for (const key in containers) {
            containers[key].classList.toggle('hidden', key !== containerName);
        }
    };

    // --- Event Listeners ---
    buttons.settings.addEventListener('click', () => showView('settings'));
    buttons.close.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'toggleSidebar' }));
    buttons.history.addEventListener('click', () => showView('history'));
    buttons.back.addEventListener('click', () => showView('main'));
    buttons.backFromHistory.addEventListener('click', () => showView('main'));
    buttons.summarize.addEventListener('click', () => {
        showContentState('loading');
        chrome.runtime.sendMessage({ action: 'getSummary' });
    });
    buttons.saveSettings.addEventListener('click', () => {
        const apiKey = inputs.apiKey.value.trim();
        const systemPrompt = inputs.systemPrompt.value.trim();
        chrome.runtime.sendMessage({ action: 'saveSettings', settings: { apiKey, systemPrompt } }, (response) => {
            if (response.status === 'success') {
                displays.saveConfirm.classList.remove('hidden');
                setTimeout(() => displays.saveConfirm.classList.add('hidden'), 2000);
            }
        });
    });

    // --- Message Handling ---
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        switch (request.action) {
            case 'initialStateResponse':
                handleInitialState(request);
                break;
            case 'summaryResponse':
                handleSummaryResponse(request);
                break;
            case 'resetState':
                initialize();
                break;
        }
    });

    // --- Logic Functions ---
    function handleInitialState(response) {
        if (response.apiKeyMissing) {
            showContentState('message');
            displays.message.textContent = 'Welcome! Please set your Gemini API key in the settings.';
        } else if (response.cachedData) {
            renderSummary(response.cachedData.summaryData);
            showContentState('summary');
        } else {
            showContentState('message');
            displays.message.textContent = 'Ready to summarize!';
        }
    }

    function handleSummaryResponse(response) {
        showContentState(response.error ? 'error' : 'summary');
        if (response.error) {
            displays.errorMessage.textContent = response.error;
        } else {
            renderSummary(response.data);
            addToHistory({
                videoId: response.videoId,
                videoTitle: response.videoTitle,
                summary: response.data.summary,
                action_steps: response.data.action_steps,
                timestamp: new Date().toISOString(),
            });
        }
    }

    function renderSummary(data) {
        displays.summaryText.innerHTML = data.summary.replace(/\n/g, '<br>');
        displays.actionStepsList.innerHTML = '';
        if (data.action_steps && data.action_steps.length > 0) {
            data.action_steps.forEach(step => {
                const li = document.createElement('li');
                li.textContent = step;
                displays.actionStepsList.appendChild(li);
            });
        } else {
            displays.actionStepsList.innerHTML = '<li>No action steps identified.</li>';
        }
    }

    async function addToHistory(item) {
        if (!item.videoId || !item.videoTitle) return;
        const { summaryHistory = [] } = await chrome.storage.local.get('summaryHistory');
        const newHistory = summaryHistory.filter(h => h.videoId !== item.videoId);
        newHistory.unshift(item);
        if (newHistory.length > 50) newHistory.pop(); // Limit history size
        await chrome.storage.local.set({ summaryHistory: newHistory });
    }

    async function renderHistory() {
        displays.historyList.innerHTML = '';
        const { summaryHistory = [] } = await chrome.storage.local.get('summaryHistory');

        if (summaryHistory.length === 0) {
            displays.historyList.innerHTML = '<p style="text-align: center; color: #555;">No summaries in history.</p>';
            return;
        }

        summaryHistory.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `<p class="history-item-title">${item.videoTitle}</p>`;
            div.addEventListener('click', () => {
                renderSummary(item);
                showContentState('summary');
                showView('main');
            });
            displays.historyList.appendChild(div);
        });
    }

    // --- Initialization ---
    function initialize() {
        showView('main');
        // All content states are hidden by default. We wait for the 'initialStateResponse'
        // to decide what to show, preventing a misleading "loading" flash on open.
        chrome.runtime.sendMessage({ action: 'getInitialState' });
        chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
            if (response.settings) {
                inputs.apiKey.value = response.settings.apiKey || '';
                inputs.systemPrompt.value = response.settings.systemPrompt || defaultSystemPrompt;
            }
        });
    }

    initialize();
});
