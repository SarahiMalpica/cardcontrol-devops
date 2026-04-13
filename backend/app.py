from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
import logging
import os

app = Flask(__name__)
CORS(app)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongo:27017/")
client = MongoClient(MONGO_URI)
db = client["cardcontrol_db"]
cards_collection = db["cards"]

LOG_DIR = "/app/logs"
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, "app.log")

logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s'
)

@app.route("/api/health", methods=["GET"])
def health():
    logging.info("Consulta a endpoint de salud")
    return jsonify({"message": "Backend funcionando correctamente"}), 200

@app.route("/api/cards", methods=["GET"])
def get_cards():
    try:
        cards = []
        for card in cards_collection.find():
            cards.append({
                "id": str(card["_id"]),
                "bank": card["bank"],
                "cardName": card["cardName"],
                "lastDigits": card["lastDigits"],
                "cutoffDate": card["cutoffDate"],
                "dueDate": card["dueDate"],
                "balance": card["balance"],
                "minimumPayment": card["minimumPayment"],
                "noInterestPayment": card["noInterestPayment"]
            })

        logging.info("Consulta de tarjetas realizada")
        return jsonify(cards), 200
    except Exception as e:
        logging.error(f"Error al consultar tarjetas: {str(e)}")
        return jsonify({"error": "No se pudieron obtener las tarjetas"}), 500

@app.route("/api/cards", methods=["POST"])
def create_card():
    try:
        data = request.get_json()

        required_fields = [
            "bank", "cardName", "lastDigits", "cutoffDate",
            "dueDate", "balance", "minimumPayment", "noInterestPayment"
        ]

        for field in required_fields:
            if field not in data:
                logging.warning(f"Falta el campo requerido: {field}")
                return jsonify({"error": f"Falta el campo: {field}"}), 400

        new_card = {
            "bank": data["bank"],
            "cardName": data["cardName"],
            "lastDigits": data["lastDigits"],
            "cutoffDate": data["cutoffDate"],
            "dueDate": data["dueDate"],
            "balance": data["balance"],
            "minimumPayment": data["minimumPayment"],
            "noInterestPayment": data["noInterestPayment"]
        }

        result = cards_collection.insert_one(new_card)
        logging.info(f"Tarjeta registrada: {data['cardName']}")

        return jsonify({
            "message": "Tarjeta guardada correctamente",
            "id": str(result.inserted_id)
        }), 201
    except Exception as e:
        logging.error(f"Error al registrar tarjeta: {str(e)}")
        return jsonify({"error": "No se pudo guardar la tarjeta"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)