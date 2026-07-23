import os
import re
import json
import math
from datetime import datetime
from typing import List
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="LLM Bridge Engine", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatPayload(BaseModel):
    data: str

# CHUNK LIMIT (You can adjust this based on the target LLM's limits)
MAX_CHUNK_CHARS = 10000 

def parse_and_chunk_chat(raw_text: str) -> List[str]:
    """Cleans raw text, formats it, and slices it into upload-safe chunks."""
    # 1. Clean the noise
    noise_patterns = [r"Sources\b", r"ChatGPT can make mistakes\..*", r"VM\d+:\d+\s+.*"]
    cleaned_text = raw_text
    for pattern in noise_patterns:
        cleaned_text = re.sub(pattern, "", cleaned_text, flags=re.IGNORECASE)

    # 2. Break down the full chat into one massive clean string
    # (Since we are injecting this as text into another LLM, a clean string format is better than JSON)
    lines = [line.strip() for line in cleaned_text.split("\n") if line.strip()]
    full_chat_string = "\n".join(lines)

    # 3. Calculate how many chunks we need
    total_chars = len(full_chat_string)
    total_chunks = math.ceil(total_chars / MAX_CHUNK_CHARS)
    
    chunks = []
    
    # 4. Slice it up and add the injection prompts
    for i in range(total_chunks):
        start_idx = i * MAX_CHUNK_CHARS
        end_idx = start_idx + MAX_CHUNK_CHARS
        text_slice = full_chat_string[start_idx:end_idx]
        
        current_part = i + 1
        
        # We attach instructions so the receiving LLM doesn't hallucinate halfway through
        if current_part < total_chunks:
            header = f"--- [PART {current_part} OF {total_chunks}] ---\nInstruction: I am sending you a long chat history in parts. DO NOT reply yet. Just acknowledge receipt by saying 'Ready for next part'.\n\n"
        else:
            header = f"--- [PART {current_part} OF {total_chunks}] ---\nInstruction: This is the final part of the chat history. You may now analyze the entire conversation and reply to my next prompt.\n\n"
            
        chunks.append(header + text_slice)

    return chunks

@app.post("/api/chat")
async def process_for_injection(payload: ChatPayload):
    print("\n🚀 [Chunking Engine] Received chat data...")
    
    # Run the text through our grinder
    chunks = parse_and_chunk_chat(payload.data)
    
    # Save the chunks to a JSON file so the extension can fetch them one by one
    os.makedirs("storage", exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_path = f"storage/injection_payload_{timestamp}.json"
    
    payload_data = {
        "session_id": f"sess_{timestamp}",
        "total_chunks": len(chunks),
        "chunks": chunks
    }
    
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(payload_data, f, indent=4, ensure_ascii=False)
        
    print(f"🔪 [Chunking Engine] Successfully sliced chat into {len(chunks)} upload-safe parts.")
    print(f"📦 Payload ready for injection at: {file_path}\n")
    
    # We send the chunks back to the extension so it can start shooting them!
    return {
        "status": "success", 
        "total_chunks": len(chunks),
        "chunks": chunks 
    }

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001)