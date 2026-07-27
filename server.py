import os
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

CHUNK_SIZE = 3800 

# 1. FIXED: Changed route to match frontend fetch ('/api/chunk')
@app.route('/api/chunk', methods=['POST'])
def process_chat():
    req_data = request.get_json() or {}
    
    # 2. FIXED: Frontend sends data as {"text": "..."}
    raw_text = req_data.get("text", "")
    
    if not raw_text:
        return jsonify({"success": False, "error": "No text provided", "chunks": []})

    raw_chunks = []
    text_pool = raw_text.strip()
    original_length = len(text_pool)
    
    while len(text_pool) > 0:
        if len(text_pool) <= CHUNK_SIZE:
            raw_chunks.append(text_pool)
            break
            
        slice_zone = text_pool[:CHUNK_SIZE]
        split_index = slice_zone.rfind('\n')
        
        if split_index <= 0:
            split_index = CHUNK_SIZE
            
        current_segment = text_pool[:split_index].strip()
        if current_segment:
            raw_chunks.append(current_segment)
            
        next_pool = text_pool[split_index:].strip()
        if len(next_pool) >= len(text_pool):
            raw_chunks.append(text_pool)
            break
        text_pool = next_pool

    total_parts = len(raw_chunks)
    formatted_chunks = []

    for idx, chunk in enumerate(raw_chunks):
        part_num = idx + 1
        if total_parts == 1:
            wrapped_prompt = f"[SYSTEM: Single-part data transfer active.]\n--- START DATA PAYLOAD ---\n\n{chunk}\n\n--- END DATA PAYLOAD ---"
        elif part_num < total_parts:
            wrapped_prompt = f"[SYSTEM: This is Part {part_num} of {total_parts} of a multi-part data transfer...]\n\n--- START DATA PAYLOAD ---\n\n{chunk}\n\n--- END DATA PAYLOAD ---"
        else:
            wrapped_prompt = f"[SYSTEM: This is Part {part_num} of {total_parts} (FINAL PART)...]\n\n--- START FINAL DATA PAYLOAD ---\n\n{chunk}\n\n--- END FINAL DATA PAYLOAD ---"
        
        # 3. FIXED: Structured to match frontend button rendering
        formatted_chunks.append({
            'id': part_num,
            'part': part_num,
            'totalParts': total_parts,
            'prompt': wrapped_prompt
        })
        
    print(f"Successfully processed {total_parts} sequential components.")
    
    # 4. FIXED: Added stats so the frontend stats bar works
    return jsonify({
        "success": True,
        "totalChunks": total_parts,
        "rawLength": original_length,
        "optimizedLength": original_length,
        "chunks": formatted_chunks
    })

if __name__ == '__main__':
    print("🚀 Python Flask server running on http://127.0.0.1:8005")
    app.run(host='0.0.0.0', port=8005, debug=False)