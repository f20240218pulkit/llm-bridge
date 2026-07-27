document.addEventListener('DOMContentLoaded', () => {
  const scrapeBtn = document.getElementById('scrapeBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusEl = document.getElementById('status');
  const statsBar = document.getElementById('statsBar');
  const rawCharsEl = document.getElementById('rawChars');
  const cleanCharsEl = document.getElementById('cleanChars');
  const totalChunksEl = document.getElementById('totalChunks');
  const chunkList = document.getElementById('chunkList');

  // Verify scrapeBtn exists before adding listener
  if (!scrapeBtn) {
    console.error("LLM Bridge Error: Could not find element with id='scrapeBtn' in popup.html");
    return;
  }

  // Restore saved chunks across tab switches
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['chunks', 'stats', 'status'], (res) => {
      if (res.chunks && res.chunks.length > 0) {
        renderChunks(res.chunks);
        renderStats(res.stats);
        if (statusEl) statusEl.textContent = res.status || 'Active session restored';
        if (clearBtn) clearBtn.style.display = 'block';
      }
    });
  }

  scrapeBtn.addEventListener('click', async () => {
    if (statusEl) statusEl.textContent = 'Detecting active LLM platform...';
    scrapeBtn.disabled = true;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Multi-Platform DOM Scraper
      const [{ result: pageText }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const url = window.location.href;

          // 1. ChatGPT
          if (url.includes('chatgpt.com') || url.includes('openai.com')) {
            const msgs = Array.from(document.querySelectorAll('[data-message-author-role]'));
            if (msgs.length > 0) {
              return msgs.map(el => {
                const role = el.getAttribute('data-message-author-role') || 'User';
                return `### ${role.toUpperCase()}:\n${el.innerText}`;
              }).join('\n\n---\n\n');
            }
          }

          // 2. Claude
          if (url.includes('claude.ai')) {
            const msgs = Array.from(document.querySelectorAll('.font-claude-message, .font-user-message, [data-testid="user-message"], [data-is-streaming]'));
            if (msgs.length > 0) {
              return msgs.map(el => {
                const isUser = el.matches('.font-user-message, [data-testid="user-message"]');
                return `### ${isUser ? 'USER' : 'CLAUDE'}:\n${el.innerText}`;
              }).join('\n\n---\n\n');
            }
          }

          // 3. Gemini
          if (url.includes('gemini.google.com')) {
            const turns = Array.from(document.querySelectorAll('user-query, model-response, .query-content, .response-container-content'));
            if (turns.length > 0) {
              return turns.map(el => {
                const isUser = el.tagName.toLowerCase().includes('user') || el.className.includes('query');
                return `### ${isUser ? 'USER' : 'GEMINI'}:\n${el.innerText}`;
              }).join('\n\n---\n\n');
            }
          }

          // Fallback
          const mainArea = document.querySelector('main') || document.querySelector('article');
          return mainArea ? mainArea.innerText : document.body.innerText;
        }
      });

      if (!pageText || !pageText.trim()) throw new Error('No readable chat context found.');

      if (statusEl) statusEl.textContent = `Extracted ${pageText.length.toLocaleString()} chars. Cleaning with Gemini...`;

      const res = await fetch('http://127.0.0.1:8005/api/chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pageText, chunkSize: 3000 })
      });

      const data = await res.json();

      if (data.success) {
        const stats = { raw: data.rawLength, clean: data.optimizedLength, total: data.totalChunks };
        const statusMsg = `Ready! ${data.totalChunks} chunks optimized.`;

        chrome.storage.local.set({ chunks: data.chunks, stats: stats, status: statusMsg });

        renderChunks(data.chunks);
        renderStats(stats);
        if (statusEl) statusEl.textContent = statusMsg;
        if (clearBtn) clearBtn.style.display = 'block';
      } else {
        throw new Error('Flask server failed to process request.');
      }

    } catch (err) {
      if (statusEl) statusEl.textContent = `Error: ${err.message}`;
    } finally {
      scrapeBtn.disabled = false;
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      chrome.storage.local.clear();
      if (chunkList) chunkList.innerHTML = '';
      if (statsBar) statsBar.style.display = 'none';
      clearBtn.style.display = 'none';
      if (statusEl) statusEl.textContent = 'Ready to scrape chat';
    });
  }

  function renderStats(stats) {
    if (!stats || !statsBar) return;
    if (rawCharsEl) rawCharsEl.textContent = stats.raw.toLocaleString();
    if (cleanCharsEl) cleanCharsEl.textContent = stats.clean.toLocaleString();
    if (totalChunksEl) totalChunksEl.textContent = stats.total;
    statsBar.style.display = 'flex';
  }

  function renderChunks(chunks) {
    if (!chunkList) return;
    chunkList.innerHTML = '';
    chunks.forEach((c) => {
      const btn = document.createElement('button');
      btn.className = 'chunk-btn';
      btn.textContent = `Copy Part ${c.part} of ${c.totalParts}`;
      btn.onclick = () => {
        navigator.clipboard.writeText(c.prompt);
        btn.textContent = `✓ Part ${c.part} Copied!`;
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = `Copy Part ${c.part} of ${c.totalParts}`;
          btn.classList.remove('copied');
        }, 2000);
      };
      chunkList.appendChild(btn);
    });
  }
});