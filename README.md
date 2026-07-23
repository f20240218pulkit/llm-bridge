# LLM Bridge 🚀

> A browser extension and Python microservice engineered to automatically chunk, format, and structure large datasets for seamless input into LLM context windows.

---

## 📌 Problem & Solution

Large language models often struggle or truncate output when pasted with massive walls of unstructured text. **LLM Bridge** solves this by:
1. Extracting text content directly from the active tab.
2. Slicing long context payloads into token-safe, sequential chunks via a Python Flask microservice.
3. Wrapping each chunk in dynamic multi-part prompts (e.g., *Part X of Y*) so the target LLM automatically waits for the complete context before responding.

---

## 🛠️ Tech Stack

* **Frontend:** JavaScript (ES6+), HTML5, CSS3, Chrome Extension API (Manifest v3)
* **Backend:** Python 3, Flask, Flask-CORS
* **Storage:** Chrome Storage API (`chrome.storage.local`)

---

## ⚡ Quick Start & Installation

### 1. Run the Python Backend
```bash
# Clone the repository
git clone [https://github.com/YOUR_USERNAME/llm-bridge.git](https://github.com/YOUR_USERNAME/llm-bridge.git)
cd llm-bridge

# Install backend dependencies
pip install flask flask-cors

# Start the local microservice
python server.py
```
*The backend server will start listening at `http://127.0.0.1:8005`.*

### 2. Load the Chrome Extension
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the `llm-bridge` directory.
4. Click **Scrape and Optimize** on any chat page!
   