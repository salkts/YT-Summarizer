// background.js

const defaultSystemPrompt = `You are an expert AI assistant specializing in analyzing YouTube video content and distilling it into actionable insights. You have direct access to the video's audio and visual content, allowing you to provide accurate timestamps and comprehensive analysis.

**CRITICAL: You are processing the actual video content. Provide ONLY accurate timestamps that correspond to real moments in the video where concepts are discussed. Do not guess or estimate timestamps.**

**Output Format:**
Respond strictly in JSON format. The JSON object must contain three keys:
1.  'summary': A string.
2.  'action_steps': An array of strings.
3.  'timestamped_concepts': An array of objects, where each object has a 'concept' (string) and 'timestamp' (string in "MM:SS" or "HH:MM:SS" format) key.

**Summary Requirements ('summary' field):**
-   **Core Focus:** Directly answer "What is the main point of this video?" and "Why is this main point important for me, the viewer, considering why I likely clicked on this specific video?"
-   **Style & Opening:**
    *   Begin immediately with the video's core message or the primary problem it aims to solve. **Do not use introductory phrases** like "This video is about..." or "The video argues that..."
    *   Use specific examples and details from the actual video content to clarify the main point and teach the concepts as presented.
    *   Reference actual moments, demonstrations, case studies, or examples shown in the video.
-   **Readability & Formatting:**
    *   Structure the summary into **2-4 concise paragraphs**. Explicitly use two newline characters ('\n\n') to separate these paragraphs for clear visual breaks.
    *   Use Markdown to **bold** 3-5 of the most important key terms or phrases within the summary that encapsulate core ideas. These bolded terms will be used for timestamping.
-   **Accuracy:** Base your summary on what you actually observe in the video content, not assumptions or general knowledge.
-   **Tone:** Insightful and concise, focusing on practical value for the viewer.

**Action Steps Requirements ('action_steps' field):**
-   **Tone**: Direct and imperative (command-oriented). Use short sentences.
-   **Quantity & Selection**: Identify and return **2-4 of the most important, actionable steps** a viewer can take based on what's actually demonstrated or explained in the video.
-   **Specificity**: Include specific methods, techniques, or details that are actually shown or explained in the video content.
-   **Filtering**: Exclude marketing calls-to-action or promotional content. Focus on educational value.
-   If no genuinely actionable steps are present, return an empty array [].

**Timestamped Concepts Requirements ('timestamped_concepts' field):**
-   **ACCURACY IS CRITICAL**: Every timestamp MUST correspond to an actual moment in the video where that concept is discussed or demonstrated.
-   **Primary Timestamps:** For **each of the phrases you bolded** in the 'summary' field:
    *   Create an object: { "concept": "The exact bolded phrase from summary", "timestamp": "MM:SS" }
    *   The 'timestamp' should point to the precise moment in the video where this concept is introduced or best explained.
-   **Additional Key Timestamps:** Include 3-5 additional important concepts, methods, or insights from throughout the video with their accurate timestamps.
-   **Distribution for Long Videos:** 
    *   For videos longer than 20 minutes, ensure at least 30% of timestamps come from the second half.
    *   For videos longer than 40 minutes, distribute timestamps across beginning, middle, and end.
-   **Timestamp Format:** Use "MM:SS" format for videos under 1 hour, or "HH:MM:SS" format for longer videos.
-   **Quality over Quantity:** Only include timestamps you can accurately identify from the video content. If you cannot determine an accurate timestamp for a concept, omit it.

**Remember: You are analyzing the actual video content. Your timestamps must be precise and correspond to real moments in the video.**`;

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

// Function to get video details including duration
async function getVideoDetails(tabId) {
    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { action: 'getVideoDetails' }, (response) => {
            resolve(response);
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

    // Check if video is longer than 1 hour (3600 seconds)
    const isLongVideo = videoDetails.duration && videoDetails.duration > 3600;
    const durationInfo = videoDetails.formattedDuration ? `\n**Video Duration:** ${videoDetails.formattedDuration}` : '';
    
    let additionalInstructions = '';
    if (isLongVideo) {
        additionalInstructions = '\n\n**LONG VIDEO NOTICE:** This video is longer than 1 hour. Please ensure your timestamps are distributed throughout the entire duration, with special attention to key concepts from the middle and end portions of the video. Include timestamps from at least the final third of the video.';
    }

    const textPrompt = `
        **Video Title:** ${videoDetails.title}${durationInfo}

        ${finalSystemPrompt}${additionalInstructions}

        Process the video content and return the JSON output as specified. Pay special attention to providing accurate timestamps that correspond to the actual moments in the video where concepts are discussed.
    `.trim();

    const youtubeUrl = `https://www.youtube.com/watch?v=${videoDetails.videoId}`;

    try {
        // Use the newer Gemini 2.5 Flash model with proper video input format
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        {
                            file_data: {
                                file_uri: youtubeUrl
                            }
                        },
                        {
                            text: textPrompt
                        }
                    ]
                }],
                generationConfig: {
                    response_mime_type: "application/json",
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('API Error:', errorData);
            return { error: `API Error: ${errorData.error?.message || 'Unknown error'}` };
        }

        const data = await response.json();
        if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
            console.error('Invalid API response structure:', data);
            return { error: 'Invalid response structure from API.' };
        }

        const summaryText = data.candidates[0].content.parts[0].text;
        const parsed = parseSummary(summaryText);
        
        // Add video duration info to the response for time tracking
        if (parsed && !parsed.error && videoDetails.duration) {
            parsed.videoDuration = videoDetails.duration;
            parsed.formattedDuration = videoDetails.formattedDuration;
        }
        
        return parsed;

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

// Function to update time saved statistics
async function updateTimeSaved(videoDuration) {
    if (!videoDuration) return;
    
    const { timeSaved = 0, videosSummarized = 0 } = await getStorageData(['timeSaved', 'videosSummarized']);
    
    await setStorageData({
        timeSaved: timeSaved + videoDuration,
        videosSummarized: videosSummarized + 1
    });
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
        } else if (request.action === 'getCurrentVideo') {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.url && tab.url.includes('youtube.com/watch')) {
                const url = new URL(tab.url);
                const videoId = url.searchParams.get('v');
                const title = tab.title.replace(' - YouTube', '');
                sendResponse({ videoId, title });
            } else {
                sendResponse({ error: 'Not on a YouTube video page' });
            }
        } else if (request.action === 'getCachedSummary') {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.url && tab.url.includes('youtube.com/watch')) {
                const url = new URL(tab.url);
                const videoId = url.searchParams.get('v');
                const { summaryCache } = await getStorageData(['summaryCache']);
                const cachedSummary = summaryCache && summaryCache[videoId] ? summaryCache[videoId] : null;
                sendResponse({ data: cachedSummary });
            } else {
                sendResponse({ data: null });
            }
        } else if (request.action === 'getHistory') {
            const { history } = await getStorageData(['history']);
            sendResponse(history || []);
        } else if (request.action === 'getSummary') {
            // Get video details including duration from the content script
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const videoDetailsWithDuration = await getVideoDetails(tab.id);
            
            // Merge with the provided video details
            const fullVideoDetails = { ...request.videoDetails, ...videoDetailsWithDuration };
            
            const summary = await generateSummary(fullVideoDetails, request.systemPrompt);
            
            // Update time saved statistics if successful
            if (summary && !summary.error && fullVideoDetails.duration) {
                await updateTimeSaved(fullVideoDetails.duration);
            }
            
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
        } else if (request.action === 'getTimeSaved') {
            const { timeSaved = 0, videosSummarized = 0 } = await getStorageData(['timeSaved', 'videosSummarized']);
            sendResponse({ timeSaved, videosSummarized });
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
        } else if (request.action === 'clearHistory') {
            // Clear all history data and reset statistics
            await setStorageData({
                summaryCache: {},
                history: [],
                timeSaved: 0,
                videosSummarized: 0
            });
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