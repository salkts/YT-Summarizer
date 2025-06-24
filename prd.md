# Product Requirements Document: YouTube Video Summarizer Extension

## 1. Introduction & Vision

The YouTube Video Summarizer Extension is a browser tool designed to enhance video consumption efficiency. It allows users to quickly grasp the core content and actionable takeaways from YouTube videos by leveraging the analytical power of Google's Gemini API. The vision is to make video content more accessible, digestible, and actionable, saving users time and helping them extract value more effectively.

## 2. Goals

*   Provide users with concise summaries of YouTube videos, readable in under 60 seconds.
*   Extract and present clear, actionable steps from instructional or informational videos.
*   Enable users to quickly decide if a video is worth watching in its entirety.
*   Offer a way for users to "chat" with the video content for deeper understanding (Future V2).
*   Improve user productivity and learning efficiency when consuming video content.

## 3. Target Audience

*   Students and lifelong learners using YouTube for educational purposes.
*   Professionals seeking quick information or solutions from video tutorials and talks.
*   Casual users who want to quickly understand the gist of a video before committing time.
*   Content creators or researchers reviewing video material.

## 4. Key Features

### Core (V1):

1.  **AI-Powered Summarization:** Generates a concise summary of the active YouTube video.
2.  **Action Step Extraction:** Identifies and lists actionable steps, advice, or instructions from the video.
3.  **Intuitive Sidebar UI:** Displays summaries and action steps in a non-intrusive sidebar, activated by an extension icon click.
4.  **Local Caching:** Saves previously generated summaries locally, allowing instant recall for already processed videos.
5.  **User-Provided Gemini API Key:** Users provide their own Gemini API key for personalized access.
6.  **Customizable System Prompt:** Allows users to tailor the AI's instructions for summarization, with pre-defined "persona" templates for ease of use.
7.  **Video Processing Strategy:**
    *   Defaults to direct YouTube URL processing via Gemini 2.5 Pro.
    *   Switches to transcript-based processing for videos longer than 1 hour or if direct URL processing fails (e.g., private video, API error).
8.  **Error Handling:** Clear messages for common issues (e.g., not on YouTube, API key missing, summarization failure).

### Future Considerations (Post-MVP/V2):

*   **Chat with Video:** Allow users to ask follow-up questions about the video content.
*   **Advanced Summary Management:** Options to manually delete or manage stored summaries.
*   **Multi-language Support:** Summarize videos and interact in multiple languages.
*   **Timestamp Navigation:** Link summary points or chat responses back to specific video timestamps.
*   **Export Options:** Allow users to export summaries/action steps.

## 5. Success Metrics (High-Level)

*   Number of active daily/monthly users.
*   Number of summaries generated per user/per day.
*   User retention rate (if measurable via web store statistics).
*   Qualitative feedback from user reviews (e.g., perceived usefulness, time saved).
*   Feature adoption (e.g., usage of custom prompts).

## 6. Non-Goals (for MVP)

*   User accounts or cloud-based storage (all data is local).
*   Real-time collaboration features.
*   Summarization of non-YouTube video platforms.