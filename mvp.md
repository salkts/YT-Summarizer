# Minimum Viable Product (MVP): YouTube Video Summarizer Extension

## Core Goal of MVP

To deliver a functional browser extension that provides users with quick, AI-generated summaries and actionable steps from YouTube videos, demonstrating the core value proposition of saving time and improving content comprehension.

## Key Features for MVP

1.  **Extension Activation & YouTube Page Detection:**
    *   Activates via a browser toolbar icon.
    *   Detects if the current browser tab is a YouTube video page.
    *   Displays a "Not on a YouTube video page" message in a small popup if activated on a non-YouTube URL.
2.  **Basic Sidebar UI:**
    *   A simple, non-intrusive sidebar that slides out (e.g., from the right).
    *   Resizable by the user.
    *   Pushes main page content (does not overlay obstructively).
    *   Single scrollable view for displaying content.
3.  **Loading Animation:**
    *   Simple visual indicator (e.g., spinner, pulsing dots) displayed while the summary is being generated.
4.  **Video Processing Logic:**
    *   Retrieves the current YouTube video URL/ID.
    *   **Video Length Check:** If video duration is > 1 hour, proceed directly to transcript-based summarization.
    *   **Primary Method (Direct URL):** Attempt to summarize using Gemini 2.5 Pro with the direct YouTube video URL.
    *   **Fallback Method (Transcript):** If direct URL processing fails (API error, private video, etc.) or if video is >1 hour, attempt to extract a transcript and send that to Gemini for summarization. (MVP transcript extraction might be basic, relying on available YouTube captions).
5.  **Local Caching of Summaries:**
    *   On activation, checks `chrome.storage.local` for a previously generated summary linked to the current video ID.
    *   If found, displays the cached summary instantly.
    *   If not found, generates a new summary and then saves it to `chrome.storage.local`.
6.  **Gemini API Integration:**
    *   Utilizes the user-provided Gemini API key for all API calls.
    *   Constructs and sends the request to the Gemini API (using the defined system prompt and video content).
    *   Parses the expected JSON response containing `summary` and `action_steps`.
7.  **Display of Summary & Action Steps:**
    *   Clear presentation of the summary text.
    *   Clear presentation of the action steps list (if any).
    *   Basic formatting (headings, paragraphs, bullet points/numbered list for actions).
8.  **Settings Page/Section:**
    *   Accessible from the sidebar.
    *   Input field for the user to enter and save their Gemini API Key.
    *   Text area for users to view and customize the system prompt sent to Gemini.
    *   Buttons for pre-defined prompt "personas" (e.g., "Concise Analyst," "Action-Oriented Coach") that populate the system prompt text area.
    *   "Save" button to store API key and custom prompt in `chrome.storage.local`.
9.  **Basic Error Handling & Messaging:**
    *   Display clear, user-friendly messages for common errors:
        *   API key not set or invalid.
        *   Gemini API call failure.
        *   Video not public / inaccessible.
        *   No transcript available (if transcript method fails).
        *   Summary generation failed for other reasons.

## Out of Scope for MVP

*   **Chat with Video Functionality:** Full interactive chat is deferred to V2.
*   **Advanced Summary Management:** No UI for deleting individual summaries or setting auto-clear policies. Summaries persist in local storage.
*   **Complex UI Animations or Themes:** Focus on functional, clean UI.
*   **Multi-language Support for Prompts/Summaries:** Assume English as the primary language.
*   **User Accounts / Cloud Sync:** All data (API key, summaries) is stored locally.
*   **Detailed Usage Analytics:** No tracking of user behavior within the extension.
*   **Sophisticated Transcript Extraction:** Initial transcript reliance will be on easily accessible YouTube captions. Complex workarounds for videos without captions are out of scope.