from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
from bson.errors import InvalidId
import logging
import os

app = Flask(__name__)
CORS(app)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongo:27017/")
client = MongoClient(MONGO_URI)
db = client["cardcontrol_db"]
cards_collection = db["cards"]
debts_collection = db["debts"]

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
                "bank": card.get("bank", ""),
                "cardName": card.get("cardName", ""),
                "balance": card.get("balance", 0)
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
            "bank", "cardName", "balance"
        ]

        for field in required_fields:
            if field not in data:
                logging.warning(f"Falta el campo requerido: {field}")
                return jsonify({"error": f"Falta el campo: {field}"}), 400

        new_card = {
            "bank": data["bank"],
            "cardName": data["cardName"],
            "balance": data["balance"]
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

@app.route("/api/cards/<card_id>", methods=["DELETE"])
def delete_card(card_id):
    try:
        try:
            mongo_id = ObjectId(card_id)
        except InvalidId:
            logging.warning(f"ID de tarjeta invalido para eliminar: {card_id}")
            return jsonify({"error": "ID de tarjeta invalido"}), 400

        result = cards_collection.delete_one({"_id": mongo_id})

        if result.deleted_count == 0:
            logging.warning(f"Tarjeta no encontrada para eliminar: {card_id}")
            return jsonify({"error": "Tarjeta no encontrada"}), 404

        debts_collection.delete_many({"cardId": card_id})
        logging.info(f"Tarjeta eliminada: {card_id}")
        return jsonify({"message": "Tarjeta eliminada correctamente"}), 200
    except Exception as e:
        logging.error(f"Error al eliminar tarjeta {card_id}: {str(e)}")
        return jsonify({"error": "No se pudo eliminar la tarjeta"}), 500

@app.route("/api/debts", methods=["GET"])
def get_debts():
    try:
        debts = []
        for debt in debts_collection.find():
            debts.append({
                "id": str(debt["_id"]),
                "cardId": debt.get("cardId", ""),
                "month": int(debt.get("month", 0)),
                "year": int(debt.get("year", 0)),
                "amount": float(debt.get("amount", 0))
            })

        logging.info("Consulta de deudas realizada")
        return jsonify(debts), 200
    except Exception as e:
        logging.error(f"Error al consultar deudas: {str(e)}")
        return jsonify({"error": "No se pudieron obtener las deudas"}), 500

@app.route("/api/debts", methods=["POST"])
def create_debt():
    try:
        data = request.get_json()
        required_fields = ["cardId", "month", "year", "amount"]

        for field in required_fields:
            if field not in data:
                logging.warning(f"Falta el campo requerido en deuda: {field}")
                return jsonify({"error": f"Falta el campo: {field}"}), 400

        new_debt = {
            "cardId": str(data["cardId"]),
            "month": int(data["month"]),
            "year": int(data["year"]),
            "amount": float(data["amount"])
        }

        result = debts_collection.insert_one(new_debt)
        logging.info(f"Deuda registrada para tarjeta: {new_debt['cardId']}")

        return jsonify({
            "message": "Deuda guardada correctamente",
            "id": str(result.inserted_id)
        }), 201
    except Exception as e:
        logging.error(f"Error al registrar deuda: {str(e)}")
        return jsonify({"error": "No se pudo guardar la deuda"}), 500

@app.route("/api/debts/<debt_id>", methods=["PUT"])
def update_debt(debt_id):
    try:
        try:
            mongo_id = ObjectId(debt_id)
        except InvalidId:
            logging.warning(f"ID de deuda invalido para actualizar: {debt_id}")
            return jsonify({"error": "ID de deuda invalido"}), 400

        data = request.get_json()
        update_fields = {
            "cardId": str(data.get("cardId", "")),
            "month": int(data.get("month", 0)),
            "year": int(data.get("year", 0)),
            "amount": float(data.get("amount", 0))
        }

        result = debts_collection.update_one(
            {"_id": mongo_id},
            {"$set": update_fields}
        )

        if result.matched_count == 0:
            logging.warning(f"Deuda no encontrada para actualizar: {debt_id}")
            return jsonify({"error": "Deuda no encontrada"}), 404

        logging.info(f"Deuda actualizada: {debt_id}")
        return jsonify({"message": "Deuda actualizada correctamente"}), 200
    except Exception as e:
        logging.error(f"Error al actualizar deuda {debt_id}: {str(e)}")
        return jsonify({"error": "No se pudo actualizar la deuda"}), 500

@app.route("/api/debts/<debt_id>", methods=["DELETE"])
def delete_debt(debt_id):
    try:
        try:
            mongo_id = ObjectId(debt_id)
        except InvalidId:
            logging.warning(f"ID de deuda invalido para eliminar: {debt_id}")
            return jsonify({"error": "ID de deuda invalido"}), 400

        result = debts_collection.delete_one({"_id": mongo_id})

        if result.deleted_count == 0:
            logging.warning(f"Deuda no encontrada para eliminar: {debt_id}")
            return jsonify({"error": "Deuda no encontrada"}), 404

        logging.info(f"Deuda eliminada: {debt_id}")
        return jsonify({"message": "Deuda eliminada correctamente"}), 200
    except Exception as e:
        logging.error(f"Error al eliminar deuda {debt_id}: {str(e)}")
        return jsonify({"error": "No se pudo eliminar la deuda"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
