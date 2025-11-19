
import os
import math
import requests
import networkx as nx
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

GEOCODING_URL = "https://geocoding.openapi.it/geocode"
REVERSE_URL = "https://geocoding.openapi.it/reverse"

GEOCODING_API_TOKEN = os.getenv("GEOCODING_API_TOKEN")


# --------------------------------------------------------------
# Helpers pra pegar o "element" de forma segura
# --------------------------------------------------------------
def extract_element(data: dict, contexto: str = "") -> dict:
    """
    Tenta pegar o objeto 'element' da resposta da API.
    Suporta formatos:
      { "element": {...}, "success": true, ... }
      { "elements": { "element": {...} }, "success": true, ... }
    """
    if "element" in data:
        return data["element"]

    elements = data.get("elements")
    if isinstance(elements, dict) and "element" in elements:
        return elements["element"]

    # Se não achar, levanta erro mostrando a resposta
    raise ValueError(f"Resposta inesperada da API ({contexto}): {data}")


# --------------------------------------------------------------
# 1) GEOCODING (address -> lat/lon)
# --------------------------------------------------------------
def geocode_city(address: str):
    if not GEOCODING_API_TOKEN:
        raise ValueError("Defina a variável de ambiente GEOCODING_API_TOKEN")

    headers = {
        "Authorization": f"Bearer {GEOCODING_API_TOKEN}",
        "Content-Type": "application/json"
    }

    payload = {"address": address}

    resp = requests.post(GEOCODING_URL, json=payload, headers=headers, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    if data.get("success") is not True:
        raise ValueError(f"Erro da API de geocoding para '{address}': {data}")

    element = extract_element(data, contexto=f"geocode '{address}'")

    lat = float(element["latitude"])
    lon = float(element["longitude"])

    return lat, lon, element


# --------------------------------------------------------------
# 2) REVERSE (lat/lon -> endereço)
# --------------------------------------------------------------
def reverse_geocode(lat, lon):
    if not GEOCODING_API_TOKEN:
        raise ValueError("Defina a variável de ambiente GEOCODING_API_TOKEN")

    headers = {
        "Authorization": f"Bearer {GEOCODING_API_TOKEN}",
        "Content-Type": "application/json"
    }

    payload = {
        "type": "coordinates",
        "lat": float(lat),
        "long": float(lon)
    }

    resp = requests.post(REVERSE_URL, json=payload, headers=headers, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    if data.get("success") is not True:
        raise ValueError(f"Erro da API de reverse: {data}")

    element = extract_element(data, contexto="reverse")

    return element


# --------------------------------------------------------------
# 3) Distância haversine e ponto médio
# --------------------------------------------------------------
def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    phi1, phi2 = map(math.radians, [lat1, lat2])
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def geographic_midpoint(lat1, lon1, lat2, lon2):
    lat1r, lon1r, lat2r, lon2r = map(math.radians, [lat1, lon1, lat2, lon2])

    x1 = math.cos(lat1r) * math.cos(lon1r)
    y1 = math.cos(lat1r) * math.sin(lon1r)
    z1 = math.sin(lat1r)

    x2 = math.cos(lat2r) * math.cos(lon2r)
    y2 = math.cos(lat2r) * math.sin(lon2r)
    z2 = math.sin(lat2r)

    x = (x1 + x2) / 2
    y = (y1 + y2) / 2
    z = (z1 + z2) / 2

    lon = math.atan2(y, x)
    hyp = math.sqrt(x * x + y * y)
    lat = math.atan2(z, hyp)

    return math.degrees(lat), math.degrees(lon)


# --------------------------------------------------------------
# 4) Rotas Flask
# --------------------------------------------------------------
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/midpoint", methods=["POST"])
def midpoint_api():
    data = request.get_json()

    cityA = data.get("cityA")
    cityB = data.get("cityB")

    if not cityA or not cityB:
        return jsonify({"error": "Forneça cityA e cityB"}), 400

    try:
        # 2 requests separadas
        latA, lonA, rawA = geocode_city(cityA)
        latB, lonB, rawB = geocode_city(cityB)

        # ponto médio
        latM, lonM = geographic_midpoint(latA, lonA, latB, lonB)

        # reverse do ponto médio
        mid_raw = reverse_geocode(latM, lonM)

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except requests.RequestException as e:
        return jsonify({"error": f"Erro de rede: {e}"}), 502

    # distâncias
    distA_M = haversine(latA, lonA, latM, lonM)
    distB_M = haversine(latB, lonB, latM, lonM)

    # grafo
    G = nx.Graph()
    G.add_node("A", lat=latA, lon=lonA)
    G.add_node("M", lat=latM, lon=lonM)
    G.add_node("B", lat=latB, lon=lonB)

    G.add_edge("A", "M", weight=distA_M)
    G.add_edge("M", "B", weight=distB_M)

    path = nx.shortest_path(G, "A", "B", weight="weight")

    return jsonify({
        "cityA": {"input": cityA, "lat": latA, "lon": lonA, "raw": rawA},
        "cityB": {"input": cityB, "lat": latB, "lon": lonB, "raw": rawB},
        "midpoint": {
            "lat": latM,
            "lon": lonM,
            "reverse": mid_raw
        },
        "distances_km": {
            "A_to_M": distA_M,
            "M_to_B": distB_M
        },
        "graph": {
            "shortest_path": path,
            "total_distance_km": distA_M + distB_M
        }
    })


if __name__ == "__main__":
    app.run(debug=True)
