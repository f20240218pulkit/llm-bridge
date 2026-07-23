chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "TRIGGER_SCRAPE") {
        console.log("LLM Bridge: Scrape vector triggered.");
        
        let scrapedText = "";
        
        // 1. Target typical LLM message elements (ChatGPT, Claude, Gemini deep structures)
        const chatNodes = document.querySelectorAll('main, article, .font-claude, .message, [role="presentation"]');
        
        if (chatNodes.length > 0) {
            chatNodes.forEach(node => {
                scrapedText += node.innerText + "\n\n";
            });
        }
        
        // 2. NUCLEAR FALLBACK: If specific selectors fail, grab everything visible on screen
        if (!scrapedText.trim()) {
            console.log("LLM Bridge: Specific selectors empty. Engaging body innerText fallback.");
            scrapedText = document.body.innerText || "";
        }
        
        // Return structured packet response to popup.js
        if (scrapedText.trim()) {
            sendResponse({ status: "success", data: scrapedText.trim() });
        } else {
            sendResponse({ status: "failed", data: "" });
        }
    }
    return true; // Keep asynchronous message channel alive
});