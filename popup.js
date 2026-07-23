document.addEventListener('DOMContentLoaded', () => {
    const scrapeBtn = document.getElementById('scrape-btn');
    const clearBtn = document.getElementById('clear-btn');
    const statusLabel = document.getElementById('status');
    const matrixContainer = document.getElementById('chunk-matrix-container');
    const gridWrapper = document.getElementById('grid-wrapper');

    // CONFIGURATION TARGET: Set this to 'http://127.0.0.1:8005/api/chat' for local 
    // or 'http://YOUR_PUBLIC_IP:8005/api/chat' for OCI cloud.
    const TARGET_ENDPOINT = 'http://127.0.0.1:8005/api/chat'; 
    const LOCAL_CHUNK_SIZE = 3500; 

    chrome.storage.local.get(['llmChunks', 'currentIndex', 'copiedIndices'], (res) => {
        if (res.llmChunks && res.llmChunks.length > 0) {
            renderMatrixGrid(res.llmChunks, res.currentIndex || 0, res.copiedIndices || []);
        }
    });

    scrapeBtn.addEventListener('click', async () => {
        statusLabel.innerText = "Targeting...";
        statusLabel.style.color = "#f9e2af";

        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab) {
            statusLabel.innerText = "No Active Tab";
            return;
        }

        chrome.tabs.sendMessage(activeTab.id, { action: "TRIGGER_SCRAPE" }, async (response) => {
            if (!response || response.status === "failed") {
                statusLabel.innerText = "No Text Found";
                statusLabel.style.color = "#f38ba8";
                return;
            }

            statusLabel.innerText = "Compressing...";
            
            let rawTextPool = response.data.trim();
            let segments = [];

            // Safe client-side breakdown loop
            while (rawTextPool.length > 0) {
                if (rawTextPool.length <= LOCAL_CHUNK_SIZE) {
                    segments.push(rawTextPool);
                    break;
                }
                let sliceZone = rawTextPool.substring(0, LOCAL_CHUNK_SIZE);
                let splitIndex = sliceZone.lastIndexOf('\n');
                if (splitIndex <= 0) {
                    splitIndex = LOCAL_CHUNK_SIZE;
                }
                segments.push(rawTextPool.substring(0, splitIndex).trim());
                rawTextPool = rawTextPool.substring(splitIndex).trim();
            }

            // Force a 5-second network abort timeout guard
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            try {
                const apiCall = await fetch(TARGET_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ segments: segments }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                const data = await apiCall.json();
                
                if (data.chunks && data.chunks.length > 0) {
                    chrome.storage.local.set({ 
                        llmChunks: data.chunks, 
                        currentIndex: 0,
                        copiedIndices: [] 
                    }, () => {
                        statusLabel.innerText = "Ready";
                        statusLabel.style.color = "#a6e3a1";
                        renderMatrixGrid(data.chunks, 0, []);
                    });
                } else {
                    statusLabel.innerText = "Empty Server Data";
                    statusLabel.style.color = "#f38ba8";
                }
            } catch (err) {
                clearTimeout(timeoutId);
                if (err.name === 'AbortError') {
                    statusLabel.innerText = "Timeout (5s)";
                } else {
                    statusLabel.innerText = "Net Conn Error";
                }
                statusLabel.style.color = "#f38ba8";
                console.error("LLM Bridge Flight Error:", err);
            }
        });
    });

    function renderMatrixGrid(chunks, nextIndex, copiedIndices) {
        gridWrapper.innerHTML = "";
        matrixContainer.style.display = "block";
        chunks.forEach((chunk, idx) => {
            const chip = document.createElement('div');
            chip.className = 'chunk-chip';
            chip.innerText = `Part ${idx + 1}`;
            if (copiedIndices.includes(idx)) chip.classList.add('copied');

            chip.addEventListener('click', () => {
                navigator.clipboard.writeText(chunk).then(() => {
                    if (!copiedIndices.includes(idx)) copiedIndices.push(idx);
                    let targetNext = idx + 1;
                    chrome.storage.local.set({ currentIndex: targetNext, copiedIndices: copiedIndices }, () => {
                        renderMatrixGrid(chunks, targetNext, copiedIndices);
                        chrome.tabs.sendMessage(activeTab.id, { 
                            action: "CLIPBOARD_WRITE", 
                            text: "", 
                            info: `📋 Copied Part ${idx + 1} of ${chunks.length}` 
                        });
                    });
                });
            });
            gridWrapper.appendChild(chip);
        });
    }

    clearBtn.addEventListener('click', () => {
        chrome.storage.local.clear(() => {
            matrixContainer.style.display = "none";
            gridWrapper.innerHTML = "";
            statusLabel.innerText = "Cleared";
            statusLabel.style.color = "#cdd6f4";
        });
    });
});