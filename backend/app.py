from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

app = Flask(__name__, template_folder="templates", static_folder="static")
CORS(app)

# Load Model
tokenizer = AutoTokenizer.from_pretrained("microsoft/DialoGPT-medium")
model = AutoModelForCausalLM.from_pretrained("microsoft/DialoGPT-medium")

chat_history = None

def chatbot_response(user_input):
    global chat_history

    # Encode user input and add EOS token
    new_input_ids = tokenizer.encode(user_input + tokenizer.eos_token, return_tensors="pt")

    # Append to chat history if available
    if chat_history is not None:
        bot_input_ids = torch.cat([chat_history, new_input_ids], dim=-1)
    else:
        bot_input_ids = new_input_ids

    # Generate response
    chat_history = model.generate(bot_input_ids, max_length=200, pad_token_id=tokenizer.eos_token_id)

    # Decode response
    response = tokenizer.decode(chat_history[:, bot_input_ids.shape[-1]:][0], skip_special_tokens=True)

    return response


@app.route("/")
def home():
    return render_template("index.html")

@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    message = data.get('message', '').strip()

    if not message:
        return jsonify({'error': 'No message provided'}), 400

    bot_reply = chatbot_response(message)
    
    return jsonify({'response': bot_reply})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))  # Render ke provided PORT ko use kare, warna default 5000
    app.run(host="0.0.0.0", port=port)

