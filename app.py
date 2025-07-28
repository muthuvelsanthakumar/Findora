from flask import Flask, render_template, request, jsonify
import folium
import requests
from geopy.distance import geodesic
import os

app = Flask(__name__)

# Use HTTP instead of HTTPS to avoid SSL errors
OVERPASS_URL = "http://overpass-api.de/api/interpreter"

# Categories for places
PLACE_CATEGORIES = {
    "Medical": {
        "Hospital": 'amenity="hospital"',
        "Clinic": 'amenity="clinic"',
        "Pharmacy": 'amenity="pharmacy"'
    },
    "Security": {
        "Police Station": 'amenity="police"'
    },
    "Grocery": {
        "Grocery Store": 'shop="supermarket"'
    },
    "Restaurants": {
        "Restaurant": 'amenity="restaurant"'
    },
    "Banks and Post Office": {
        "Bank": 'amenity="bank"',
        "Post Office": 'amenity="post_office"'
    },
    "Gas Stations": {
        "Petrol Bunk": 'amenity="fuel"'
    },
    "Education": {
        "School": 'amenity="school"'
    },
    "Temple": {
        "Temple": 'amenity="place_of_worship"'
    }
}

# Icon settings for Folium map markers
ICON_SETTINGS = {
    "Hospital": ("medkit", "blue"),
    "Clinic": ("hospital", "lightred"),
    "Pharmacy": ("plus-square", "lightgreen"),
    "Police Station": ("shield", "darkblue"),
    "Grocery Store": ("shopping-cart", "green"),
    "Restaurant": ("cutlery", "orange"),
    "Bank": ("university", "green"),
    "Post Office": ("envelope", "pink"),
    "Petrol Bunk": ("gas-pump", "purple"),
    "School": ("graduation-cap", "darkgreen"),
    "Temple": ("place-of-worship", "gold")
}

# Function to fetch nearby locations from Overpass API with error handling
def get_nearby_places(lat, lon, place_type, radius=10000, limit=10):
    query = f"""
    [out:json];
    node[{place_type}](around:{radius},{lat},{lon});
    out;
    """
    try:
        response = requests.get(OVERPASS_URL, params={'data': query}, timeout=30)
        response.raise_for_status()
        data = response.json()
        places = []
        for element in data.get("elements", []):
            place_lat = element.get("lat")
            place_lon = element.get("lon")
            name = element.get("tags", {}).get("name", "Unnamed Place")
            distance = geodesic((lat, lon), (place_lat, place_lon)).meters
            places.append({"name": name, "lat": place_lat, "lon": place_lon, "distance": distance})
        return sorted(places, key=lambda x: x["distance"])[:limit]
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data: {e}")
        return []

# Function to create a Folium map
def create_folium_map(lat, lon, places):
    folium_map = folium.Map(location=[lat, lon], zoom_start=14, control_scale=True)
    folium.Marker([lat, lon], popup="Your Location", icon=folium.Icon(color="red", icon="star", prefix="fa")).add_to(folium_map)
    
    for category, places_list in places.items():
        for place in places_list:
            icon_name, color = ICON_SETTINGS.get(category, ("info-sign", "gray"))
            folium.Marker(
                [place["lat"], place["lon"]],
                popup=f"{place['name']} - {place['distance']:.2f} meters away",
                icon=folium.Icon(color=color, icon=icon_name, prefix="fa")
            ).add_to(folium_map)
    
    folium_map.save("templates/map.html")

@app.route("/")
def index():
    return render_template("index.html", categories=PLACE_CATEGORIES.keys())

@app.route("/find", methods=["POST"])
def find_places():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        lat = data.get("latitude")
        lon = data.get("longitude")
        category = data.get("category")

        if not lat or not lon or not category:
            return jsonify({"error": "Missing required parameters"}), 400

        try:
            lat = float(lat)
            lon = float(lon)
        except ValueError:
            return jsonify({"error": "Invalid latitude or longitude"}), 400

        if category not in PLACE_CATEGORIES:
            return jsonify({"error": "Invalid category selected"}), 400

        places = {}
        for place_name, place_tag in PLACE_CATEGORIES[category].items():
            places[place_name] = get_nearby_places(lat, lon, place_tag)

        create_folium_map(lat, lon, places)
        return jsonify({"places": places})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/map")
def show_map():
    return render_template("map.html")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))  # Railway assigns dynamic port
    app.run(debug=False, host="0.0.0.0", port=port)
