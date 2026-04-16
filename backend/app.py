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
                "balance": card.get("balance", 0),
                "currentBalance": card.get("currentBalance", card.get("noInterestPayment", 0))
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
            "bank", "cardName", "balance", "currentBalance"
        ]

        for field in required_fields:
            if field not in data:
                logging.warning(f"Falta el campo requerido: {field}")
                return jsonify({"error": f"Falta el campo: {field}"}), 400

        new_card = {
            "bank": data["bank"],
            "cardName": data["cardName"],
            "balance": data["balance"],
            "currentBalance": data["currentBalance"]
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

def validate_debt_payload(data, partial=False):
    required_fields = ["cardId", "month", "year", "amount"]

    if not partial:
        for field in required_fields:
            if field not in data:
                return f"Falta el campo: {field}", None

    card_id = data.get("cardId")
    month = data.get("month")
    year = data.get("year")
    amount = data.get("amount")

    parsed = {}

    if card_id is not None:
        if not isinstance(card_id, str) or not card_id.strip():
            return "cardId invalido", None
        try:
            mongo_card_id = ObjectId(card_id)
        except InvalidId:
            return "cardId invalido", None
        if cards_collection.count_documents({"_id": mongo_card_id}, limit=1) == 0:
            return "La tarjeta no existe", None
        parsed["cardId"] = card_id

    if month is not None:
        try:
            month = int(month)
        except (ValueError, TypeError):
            return "month invalido", None
        if month < 0 or month > 11:
            return "month invalido", None
        parsed["month"] = month

    if year is not None:
        try:
            year = int(year)
        except (ValueError, TypeError):
            return "year invalido", None
        if year < 2000 or year > 3000:
            return "year invalido", None
        parsed["year"] = year

    if amount is not None:
        try:
            amount = float(amount)
        except (ValueError, TypeError):
            return "amount invalido", None
        if amount <= 0:
            return "amount invalido", None
        parsed["amount"] = amount

    if partial and not parsed:
        return "No hay campos para actualizar", None

    return None, parsed

@app.route("/api/debts", methods=["GET"])
def get_debts():
    try:
        debts = []
        for debt in debts_collection.find().sort([("year", 1), ("month", 1)]):
            debts.append({
                "id": str(debt["_id"]),
                "cardId": debt.get("cardId", ""),
                "month": debt.get("month", 0),
                "year": debt.get("year", 0),
                "amount": debt.get("amount", 0)
            })

        logging.info("Consulta de deudas realizada")
        return jsonify(debts), 200
    except Exception as e:
        logging.error(f"Error al consultar deudas: {str(e)}")
        return jsonify({"error": "No se pudieron obtener las deudas"}), 500

@app.route("/api/debts", methods=["POST"])
def create_debt():
    try:
        data = request.get_json() or {}
        validation_error, parsed_data = validate_debt_payload(data, partial=False)
        if validation_error:
            logging.warning(f"Error de validacion de deuda: {validation_error}")
            return jsonify({"error": validation_error}), 400

        result = debts_collection.insert_one(parsed_data)
        logging.info(f"Deuda registrada para tarjeta: {parsed_data['cardId']}")

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
            mongo_debt_id = ObjectId(debt_id)
        except InvalidId:
            logging.warning(f"ID de deuda invalido para actualizar: {debt_id}")
            return jsonify({"error": "ID de deuda invalido"}), 400

        data = request.get_json() or {}
        validation_error, parsed_data = validate_debt_payload(data, partial=True)
        if validation_error:
            logging.warning(f"Error de validacion de deuda: {validation_error}")
            return jsonify({"error": validation_error}), 400

        result = debts_collection.update_one(
            {"_id": mongo_debt_id},
            {"$set": parsed_data}
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
            mongo_debt_id = ObjectId(debt_id)
        except InvalidId:
            logging.warning(f"ID de deuda invalido para eliminar: {debt_id}")
            return jsonify({"error": "ID de deuda invalido"}), 400

        result = debts_collection.delete_one({"_id": mongo_debt_id})

        if result.deleted_count == 0:
            logging.warning(f"Deuda no encontrada para eliminar: {debt_id}")
            return jsonify({"error": "Deuda no encontrada"}), 404

        logging.info(f"Deuda eliminada: {debt_id}")
        return jsonify({"message": "Deuda eliminada correctamente"}), 200
    except Exception as e:
        logging.error(f"Error al eliminar deuda {debt_id}: {str(e)}")
        return jsonify({"error": "No se pudo eliminar la deuda"}), 500

@app.route("/api/cards/<card_id>", methods=["PUT"])
def update_card(card_id):
    try:
        try:
            mongo_id = ObjectId(card_id)
        except InvalidId:
            logging.warning(f"ID de tarjeta invalido para actualizar: {card_id}")
            return jsonify({"error": "ID de tarjeta invalido"}), 400

        data = request.get_json()
        update_fields = {}

        if "bank" in data:
            update_fields["bank"] = data["bank"]
        if "cardName" in data:
            update_fields["cardName"] = data["cardName"]
        if "balance" in data:
            update_fields["balance"] = data["balance"]
        if "currentBalance" in data:
            update_fields["currentBalance"] = data["currentBalance"]

        if not update_fields:
            return jsonify({"error": "No hay campos para actualizar"}), 400

        result = cards_collection.update_one(
            {"_id": mongo_id},
            {"$set": update_fields}
        )

        if result.matched_count == 0:
            logging.warning(f"Tarjeta no encontrada para actualizar: {card_id}")
            return jsonify({"error": "Tarjeta no encontrada"}), 404

        logging.info(f"Tarjeta actualizada: {card_id}")
        return jsonify({"message": "Tarjeta actualizada correctamente"}), 200
    except Exception as e:
        logging.error(f"Error al actualizar tarjeta {card_id}: {str(e)}")
        return jsonify({"error": "No se pudo actualizar la tarjeta"}), 500

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

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
