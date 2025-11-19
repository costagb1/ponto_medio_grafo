# 📍 Ponto Médio entre Cidades (Python + Flask + OpenAPI Geocoding)

Este projeto calcula o **ponto médio geográfico** entre dois endereços**, utilizando:**

- 🛰️ Geocoding e Reverse Geocoding da API **OpenAPI.it**
- 🧠 Grafo com NetworkX para representar as conexões A → M → B
- 🌍 Mapa interativo usando Leaflet.js
- 🐍 Backend Flask
- 🖥️ Frontend HTML + JavaScript

O sistema recebe **duas cidades/endereço completos**, faz duas requisições separadas para obter suas coordenadas, calcula o ponto médio real na superfície da Terra e exibe tudo no mapa.

---

## 🚀 Funcionalidades

- ✔️ Geocoding via `POST /geocode`  
- ✔️ Reverse geocoding via `POST /reverse`  
- ✔️ Cálculo do ponto médio geográfico  
- ✔️ Distância real com fórmula de Haversine  
- ✔️ Construção de grafo com pesos  
- ✔️ Rota mínima entre A → M → B  
- ✔️ Mapa interativo com marcadores  
- ✔️ API própria: `POST /api/midpoint`  

---

## 📦 Tecnologias Utilizadas

### Backend
- Python 3.10+
- Flask
- Requests
- NetworkX

### Frontend
- HTML
- JavaScript
- Leaflet.js

### API Externa
- https://geocoding.openapi.it  
(Geocoding e Reverse Geocoding)

---

## 📁 Estrutura do Projeto

```
ponto_medio_grafo/
│
├── app.py
├── requirements.txt
│
└── templates/
    └── index.html
```

---

## 🔧 Instalação e Execução

### 1. Clonar o repositório

```bash
git clone https://github.com/SEU_USUARIO/ponto_medio_grafo.git
cd ponto_medio_grafo
```

---

### 2. Criar e ativar ambiente virtual (opcional)

Windows:
```bash
python -m venv .venv
.venv\Scripts\activate
```

Linux/macOS:
```bash
python3 -m venv .venv
source .venv/bin/activate
```

---

### 3. Instalar dependências

```bash
pip install -r requirements.txt
```

---

### 4. Definir o token da API como variável de ambiente

#### Windows PowerShell:
```bash
$env:GEOCODING_API_TOKEN="SEU_TOKEN_AQUI"
```

#### macOS / Linux:
```bash
export GEOCODING_API_TOKEN="SEU_TOKEN_AQUI"
```

---

### 5. Executar o servidor

```bash
python app.py
```

Acesse no navegador:

```
http://127.0.0.1:5000
```

---

## 📡 Como Usar

1. Abra o navegador.  
2. Informe dois endereços completos.  
3. Clique em **Calcular**.  
4. O sistema irá mostrar:
   - Coordenadas de cada local  
   - Ponto médio calculado  
   - Reverse geocoding do ponto médio  
   - Distâncias A → M e M → B  
   - Caminho mais curto no grafo  
   - Mapa com os marcadores e linha conectando tudo  

---

## 📌 Exemplo de Requisição

### POST `/api/midpoint`

```json
{
  "cityA": "Av Nossa Senhora de Copacabana, Rio de Janeiro Brazil",
  "cityB": "Aeroporto Santos Dumont, Rio de Janeiro Brazil"
}
```

---

## 🗺️ Visualização no Mapa

O mapa exibe três marcadores:

- 🔵 Cidade A  
- 🟡 Ponto Médio  
- 🔴 Cidade B  

Conectados pela linha A → M → B.

---

## 🧪 Validação

O backend trata automaticamente respostas no formato:

- `"element"`
- `"elements": { "element": ... }"`

Garantindo funcionamento mesmo com respostas diferentes da API.

---

## 🧑‍💻 Autor

**Thiago Pereira**
