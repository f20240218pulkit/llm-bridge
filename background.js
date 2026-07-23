chrome.commands.onCommand.addListener((command) => {
    if (command === "copy_next_part") {
        chrome.storage.local.get(['llmChunks', 'currentIndex', 'copiedIndices'], (storage) => {
            if (!storage.llmChunks || storage.llmChunks.length === 0) return;
            
            let index = storage.currentIndex || 0;
            let total = storage.llmChunks.length;
            let copied = storage.copiedIndices || [];
            
            if (index >= total) {
                chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
                    if (tab) chrome.tabs.sendMessage(tab.id, { action: "CLIPBOARD_WRITE", text: "", info: "⚠️ End of transmission stream reached!" });
                });
                return;
            }

            const chunkText = storage.llmChunks[index];
            const trackingMessage = `📋 Copied Part ${index + 1} of ${total}`;
            
            if (!copied.includes(index)) {
                copied.push(index);
            }

            chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
                if (tab) {
                    chrome.tabs.sendMessage(tab.id, { 
                        action: "CLIPBOARD_WRITE", 
                        text: chunkText,
                        info: trackingMessage 
                    }, () => {
                        chrome.storage.local.set({ 
                            currentIndex: index + 1,
                            copiedIndices: copied
                        });
                    });
                }
            });
        });
    }
});