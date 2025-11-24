import os
import math
import requests
import networkx as nx
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

midpoint_results = []

# Endpoints da OpenAPI
GEOCODING_URL = "https://geocoding.openapi.it/geocode"
REVERSE_URL = "https://geocoding.openapi.it/reverse"

# Token (definido na variável de ambiente GEOCODING_API_TOKEN)
GEOCODING_API_TOKEN = os.getenv("GEOCODING_API_TOKEN")


# --------------------------------------------------------------
# Helpers para extrair "element" da resposta da API
# --------------------------------------------------------------
def extract_element(data: dict, contexto: str = "") -> dict:
    """
    Tenta pegar o objeto 'element' da resposta da API.
    Suporta:
      { "element": {...}, "success": true, ... }
      { "elements": { "element": {...} }, "success": true, ... }
    """
    if "element" in data:
        return data["element"]

    elements = data.get("elements")
    if isinstance(elements, dict) and "element" in elements:
        return elements["element"]

    raise ValueError(f"Resposta inesperada da API ({contexto}): {data}")


# --------------------------------------------------------------
# 1) Geocoding (address -> lat/lon)
# --------------------------------------------------------------
def geocode_city(address: str):
    """
    Faz UMA chamada para /geocode com:
    { "address": "<texto>" }
    Retorna (lat, lon, element_bruto)
    """
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
# 2) Reverse geocoding (lat/lon -> dados de endereço)
# --------------------------------------------------------------
def reverse_geocode(lat, lon):
    """
    Faz chamada para /reverse com:
    {
      "type": "coordinates",
      "lat": <lat>,
      "long": <lon>
    }
    Retorna o 'element' bruto da API.
    """
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
# 3) Distância Haversine e centróide geográfico
# --------------------------------------------------------------
def haversine(lat1, lon1, lat2, lon2):
    """
    Distância em km entre dois pontos (lat/lon em graus) na superfície da Terra.
    """
    R = 6371.0
    phi1, phi2 = map(math.radians, [lat1, lat2])
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def geographic_centroid(points):
    """
    Calcula o centróide geográfico de N pontos (lat, lon) em graus.
    Exemplo: points = [(latA, lonA), (latB, lonB), (latC, lonC)]
    """
    if not points:
        raise ValueError("Lista de pontos vazia no cálculo de centróide.")

    x_total = y_total = z_total = 0.0

    for lat, lon in points:
        lat_rad = math.radians(lat)
        lon_rad = math.radians(lon)

        x = math.cos(lat_rad) * math.cos(lon_rad)
        y = math.cos(lat_rad) * math.sin(lon_rad)
        z = math.sin(lat_rad)

        x_total += x
        y_total += y
        z_total += z

    n = len(points)
    x_avg = x_total / n
    y_avg = y_total / n
    z_avg = z_total / n

    hyp = math.sqrt(x_avg * x_avg + y_avg * y_avg)
    lon_mid = math.atan2(y_avg, x_avg)
    lat_mid = math.atan2(z_avg, hyp)

    return math.degrees(lat_mid), math.degrees(lon_mid)


# --------------------------------------------------------------
# 4) Rotas Flask
# --------------------------------------------------------------
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/midpoint", methods=["POST"])
def midpoint_api():
    """
    Espera JSON:
    {
      "cityA": "...",
      "cityB": "...",
      "cityC": "..."
    }

    Calcula o ponto médio ideal (centróide geográfico) considerando A, B e C.
    """
    data = request.get_json()

    cityA = data.get("cityA")
    cityB = data.get("cityB")
    cityC = data.get("cityC")

    if not cityA or not cityB or not cityC:
        return jsonify({"error": "Forneça cityA, cityB e cityC"}), 400

    try:
        # Geocoding dos três pontos
        latA, lonA, rawA = geocode_city(cityA)
        latB, lonB, rawB = geocode_city(cityB)
        latC, lonC, rawC = geocode_city(cityC)

        # 🔹 Ponto médio ideal = centróide de A, B e C
        latM, lonM = geographic_centroid([
            (latA, lonA),
            (latB, lonB),
            (latC, lonC),
        ])

        # Reverse geocoding do ponto médio
        mid_raw = reverse_geocode(latM, lonM)

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except requests.RequestException as e:
        return jsonify({"error": f"Erro de rede: {e}"}), 502

    # Distâncias do ponto médio M para cada cidade
    distA_M = haversine(latA, lonA, latM, lonM)
    distB_M = haversine(latB, lonB, latM, lonM)
    distC_M = haversine(latC, lonC, latM, lonM)

    # Grafo com 4 nós: A, B, C, M
    G = nx.Graph()
    G.add_node("A", lat=latA, lon=lonA)
    G.add_node("B", lat=latB, lon=lonB)
    G.add_node("C", lat=latC, lon=lonC)
    G.add_node("M", lat=latM, lon=lonM)

    G.add_edge("A", "M", weight=distA_M)
    G.add_edge("B", "M", weight=distB_M)
    G.add_edge("C", "M", weight=distC_M)

    # Exemplos de caminhos mínimos via ponto médio
    path_A_C = nx.shortest_path(G, "A", "C", weight="weight")
    path_B_C = nx.shortest_path(G, "B", "C", weight="weight")
    path_A_B = nx.shortest_path(G, "A", "B", weight="weight")

    result = {
        "cityA": {
            "input": cityA,
            "lat": latA,
            "lon": lonA,
            "raw": rawA,
        },
        "cityB": {
            "input": cityB,
            "lat": latB,
            "lon": lonB,
            "raw": rawB,
        },
        "cityC": {
            "input": cityC,
            "lat": latC,
            "lon": lonC,
            "raw": rawC,
        },
        "midpoint": {
            "lat": latM,
            "lon": lonM,
            "reverse": mid_raw,
        },
        "distances_km": {
            "A_to_M": distA_M,
            "B_to_M": distB_M,
            "C_to_M": distC_M,
        },
        "graph": {
            "paths": {
                "A_to_B_via_M": path_A_B,
                "A_to_C_via_M": path_A_C,
                "B_to_C_via_M": path_B_C,
            }
        }
    }

    midpoint_results.append(result)

    return jsonify(result)


@app.route("/api/results", methods=["GET"])
def get_results():
    """
    Retorna todos os calculos feitos .
    """

    return midpoint_results


if __name__ == "__main__":
    app.run(debug=True)