import os
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

CHUNK_SIZE = 3800 

@app.route('/api/chat', methods=['POST'])
def process_chat():
    req_data = request.get_json() or {}
    raw_chunks_input = req_data.get("segments", [])
    
    if not raw_chunks_input and req_data.get("data"):
        raw_chunks_input = [req_data.get("data")]
        
    if not raw_chunks_input:
        return jsonify({"chunks": []})

    raw_chunks = []
    for source_text in raw_chunks_input:
        if not isinstance(source_text, str):
            continue
        text_pool = source_text.strip()
        
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
    packaged_chunks = []

    for idx, chunk in enumerate(raw_chunks):
        part_num = idx + 1
        if total_parts == 1:
            wrapped_prompt = f"[SYSTEM: Single-part data transfer active.]\n--- START DATA PAYLOAD ---\n\n{chunk}\n\n--- END DATA PAYLOAD ---"
        elif part_num < total_parts:
            wrapped_prompt = f"[SYSTEM: This is Part {part_num} of {total_parts} of a multi-part data transfer...]\n\n--- START DATA PAYLOAD ---\n\n{chunk}\n\n--- END DATA PAYLOAD ---"
        else:
            wrapped_prompt = f"[SYSTEM: This is Part {part_num} of {total_parts} (FINAL PART)...]\n\n--- START FINAL DATA PAYLOAD ---\n\n{chunk}\n\n--- END FINAL DATA PAYLOAD ---"
        packaged_chunks.append(wrapped_prompt)
        
    print(f"Successfully processed {len(packaged_chunks)} sequential components.")
    return jsonify({"chunks": packaged_chunks})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8005, debug=False)