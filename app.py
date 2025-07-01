import os
from flask import Flask, render_template, request, jsonify, send_from_directory
from datetime import datetime
from flask_cors import CORS
from werkzeug.utils import secure_filename

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'mp3', 'wav'}

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
CORS(app)

messages = []
signals = []

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/send', methods=['POST'])
def send_message():
    data = request.form
    user = data.get('user')
    text = data.get('text', '')
    file = request.files.get('file')

    if not user:
        return jsonify({'error':'Missing user'}), 400

    media_url = None
    if file and allowed_file(file.filename):
        filename = secure_filename(f"{datetime.now().timestamp()}_{file.filename}")
        path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(path)
        media_url = f"/uploads/{filename}"

    timestamp = datetime.now().strftime('%H:%M')
    msg = {'user': user, 'text': text, 'time': timestamp, 'media': media_url}
    messages.append(msg)
    return jsonify(msg), 201

@app.route('/messages', methods=['GET'])
def get_messages():
    return jsonify(messages)

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/signal', methods=['POST'])
def signal():
    data = request.json
    signals.append(data)
    return jsonify({'status': 'ok'})

@app.route('/signal', methods=['GET'])
def get_signal():
    return jsonify(signals)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)