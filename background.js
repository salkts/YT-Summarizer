// background.js

const defaultSystemPrompt = `You are an expert AI assistant specializing in distilling YouTube video content into actionable insights for a viewer seeking specific solutions or understanding. Your output style is that of a high-value, concise newsletter: direct, factual, and focused on utility.

**Output Format:**
Respond strictly in JSON format. The JSON object must contain three keys:
1.  'summary': A string.
2.  'action_steps': An array of strings.
3.  'timestamped_concepts': An array of objects, where each object has a 'concept' (string) and 'timestamp' (string in "MM:SS" or "HH:MM:SS" format) key.

**Summary Requirements ('summary' field):**
-   **Core Focus:** Directly answer "What is the main point of this video?" and "Why is this main point important for me, the viewer, considering why I likely clicked on this specific video?"
-   **Style & Opening:**
    *   Begin immediately with the video's core message or the primary problem it aims to solve. **Do not use introductory phrases** like "This video is about..." or "The video argues that..."
    *   Use illustrative examples from the video (e.g., referencing a case study like "Dom Dolla" and specific strategies shown) to clarify the main point and teach the concepts directly as the video presents them.
    *   Example phrasing for introducing content: "The core insight is that [main point], crucial for viewers wanting to [achieve X]. For instance, the video highlights how [Case Study subject like Dom Dolla] leverages [specific strategy] by..."
-   **Readability & Formatting:**
    *   Structure the summary into **2-4 concise paragraphs**. Explicitly use two newline characters ('\n\n') to separate these paragraphs for clear visual breaks.
    *   Use Markdown to **bold** 3-5 of the most important key terms or phrases within the summary that encapsulate core ideas. These bolded terms will be used for timestamping.
-   **Referencing Video Content:** When illustrating, use active phrasing (e.g., "the video demonstrates," "it shows how [X achieves Y]," or simply state the observation directly). Avoid "the speaker said."
-   **Tone:** Illustrative and insightful, yet concise overall.

**Action Steps Requirements ('action_steps' field):**
-   **Tone**: Spartan, very direct, and imperative (command-oriented). Use short sentences.
-   **Quantity & Selection**: Identify and return **2-4 of the absolute most important, foundational, and impactful action steps** a viewer can take to implement the video's core teachings.
    *   **Prioritization Criteria:** If many potential steps exist, select them based on:
        a)  Being foundational (prerequisites or first key actions).
        b)  Being explicitly emphasized or repeated in the video.
        c)  Offering the most direct path for the viewer to achieve the video's core promised outcome.
-   **Instructional Nature ("How-To"):**
    *   Frame as direct commands.
    *   **Crucially, if the video provides specific methods, techniques, or 'how-to' details for a step, concisely include them.** Example: "Define your core identity: [Briefly state video's method, e.g., 'Analyze your top 3 influences and unique life experiences to identify your brand archetype']."
    *   If the video is more conceptual without explicit 'how-to' for a given point, formulate the step as a clear directive to apply that principle.
-   **Filtering Marketing CTAs**: **Strictly exclude** any steps that are primarily marketing calls to action from the video creator (e.g., instructions to subscribe, like, comment on *their* video for a download, visit *their* specific sales page, or buy *their* exclusive product/service unless it's a generic tool that is central to the educational content and anyone can acquire/use). Focus on general principles and self-executable tasks derived from the video's educational content.
-   **No Search Links**: Do not append search suggestions or links to action steps.
-   If no genuinely actionable, non-promotional steps are present, return an empty array [].

**Timestamped Concepts Requirements ('timestamped_concepts' field):**
-   For **each of the phrases you bolded** in the 'summary' field:
    *   Create an object: { "concept": "The exact bolded phrase from summary", "timestamp": "MM:SS" } (or "HH:MM:SS" if the video is long).
    *   The 'timestamp' should point to the primary moment in the video where this concept is discussed or best illustrated.
    *   If a precise timestamp for a bolded concept cannot be confidently determined from the video, omit that specific concept from this array. Aim for accuracy.
-   This array should contain objects only for the concepts you bolded in the summary.`;

// Function to get data from storage
function getStorageData(keys) {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, (result) => {
            resolve(result);
        });
    });
}

// Function to set data in storage
function setStorageData(data) {
    return new Promise((resolve) => {
        chrome.storage.local.set(data, () => {
            resolve();
        });
    });
}

// Function to fetch the summary from the Gemini API
async function generateSummary(videoDetails, customSystemPrompt) {
    const { apiKey, systemPrompt: savedSystemPrompt } = await getStorageData(['apiKey', 'systemPrompt']);
    const finalSystemPrompt = customSystemPrompt || savedSystemPrompt || defaultSystemPrompt;

    if (!apiKey) {
        return { error: 'API Key not set. Please set it in the settings.' };
    }

    // The new, detailed prompt is now the default
    const prompt = `
        **Video Title:** ${videoDetails.title}
        **Video URL:** https://www.youtube.com/watch?v=${videoDetails.videoId}

        ${finalSystemPrompt}

        Process the video content and return the JSON output as specified.
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    response_mime_type: "application/json",
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('API Error:', errorData);
            return { error: `API Error: ${errorData.error.message}` };
        }

        const data = await response.json();
        if (!data.candidates || !data.candidates[0].content.parts[0].text) {
            console.error('Invalid API response structure:', data);
            return { error: 'Invalid response structure from API.' };
        }

        const summaryText = data.candidates[0].content.parts[0].text;
        return parseSummary(summaryText);

    } catch (error) {
        console.error('Network or other error:', error);
        return { error: `Network or other error: ${error.message}` };
    }
}

function parseSummary(summaryText) {
    try {
        const parsed = JSON.parse(summaryText);
        // Rename 'timestamped_concepts' to 'concepts' to match the rest of the app
        if (parsed.timestamped_concepts) {
            parsed.concepts = parsed.timestamped_concepts.map(c => ({ title: c.concept, timestamp: c.timestamp }));
            delete parsed.timestamped_concepts;
        }
        return parsed;
    } catch (e) {
        console.error("Failed to parse summary JSON:", e);
        console.error("Raw summary text:", summaryText);
        return { error: "Failed to parse summary. The AI's response was not valid JSON.", summary: summaryText, action_steps: [], concepts: [] };
    }
}

// Listener for messages from content scripts or sidebar
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
        if (request.action === 'toggleSidebar') {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.url && tab.url.includes('youtube.com/watch')) {
                // Check if the content script is already injected by pinging it
                try {
                    await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
                    // If it responds, just toggle the sidebar
                    chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' });
                } catch (e) {
                    // If it fails, the content script isn't there, so inject it
                    console.log('Content script not found, injecting...');
                    await chrome.scripting.insertCSS({
                        target: { tabId: tab.id },
                        files: ['content_style.css'],
                    });
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content_script.js'],
                    });
                    // Add a small delay to ensure the script is ready before sending the message
                    setTimeout(() => {
                        chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' });
                    }, 100);
                }
            }
        } else if (request.action === 'closeSidebar') {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                chrome.tabs.sendMessage(tab.id, { action: 'closeSidebar' });
            }
        } else if (request.action === 'getSummary') {
            const summary = await generateSummary(request.videoDetails, request.systemPrompt);
            sendResponse(summary);
        } else if (request.action === 'saveSettings') {
            await setStorageData({
                apiKey: request.settings.apiKey,
                systemPrompt: request.settings.systemPrompt,
                theme: request.settings.theme
            });
            sendResponse({ success: true });
        } else if (request.action === 'getSettings') {
            const { apiKey, systemPrompt, theme } = await getStorageData(['apiKey', 'systemPrompt', 'theme']);
            sendResponse({
                apiKey: apiKey || '',
                systemPrompt: systemPrompt || defaultSystemPrompt,
                theme: theme || 'dark'
            });
        } else if (request.action === 'seekVideo') {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'seekVideo', time: request.time });
                }
            });
        } else if (request.action === 'getInitialState') {
            const { summaryCache, history } = await getStorageData(['summaryCache', 'history']);
            const videoId = request.videoId;
            const cachedSummary = summaryCache && summaryCache[videoId] ? summaryCache[videoId] : null;
            sendResponse({
                summary: cachedSummary,
                history: history || []
            });
        } else if (request.action === 'saveToHistory') {
            let { summaryCache, history } = await getStorageData(['summaryCache', 'history']);
            summaryCache = summaryCache || {};
            history = history || [];

            summaryCache[request.videoId] = request.data;
            const historyIndex = history.findIndex(item => item.videoId === request.videoId);
            if (historyIndex > -1) {
                history.splice(historyIndex, 1);
            }
            history.unshift({ videoId: request.videoId, title: request.title, summary: request.data, timestamp: new Date().toISOString() });

            if (history.length > 50) history.pop();
            
            await setStorageData({ summaryCache, history });
            sendResponse({ success: true });
        }
    })();
    return true; // Indicates that the response is sent asynchronously
});

// Listener for tab updates to handle YouTube navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes("youtube.com/watch")) {
        const url = new URL(tab.url);
        const videoId = url.searchParams.get('v');
        if (videoId) {
            chrome.tabs.sendMessage(tabId, { action: 'newVideoLoaded', videoId: videoId });
        }
    }
});