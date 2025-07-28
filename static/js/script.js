// Global variables
let map;
let currentLocation = null;
let currentCategory = 'Medical';
let markers = [];
let searchMarker = null;
let servicesData = {};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    setupEventListeners();
    requestGeolocation();
});

// Initialize Leaflet map
function initializeMap() {
    map = L.map('map').setView([40.7128, -74.0060], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Add custom control for centering
    const centerControl = L.control({position: 'topright'});
    centerControl.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
        div.innerHTML = '🎯';
        div.style.backgroundColor = 'white';
        div.style.width = '30px';
        div.style.height = '30px';
        div.style.lineHeight = '30px';
        div.style.textAlign = 'center';
        div.style.cursor = 'pointer';
        div.title = 'Center on search location';
        
        div.onclick = function() {
            if (currentLocation) {
                map.setView([currentLocation.lat, currentLocation.lng], 13);
            }
        };
        
        return div;
    };
    centerControl.addTo(map);
}

// Setup event listeners
function setupEventListeners() {
    // Search button
    document.getElementById('searchBtn').addEventListener('click', handleSearch);
    
    // Geolocation button
    document.getElementById('geolocateBtn').addEventListener('click', requestGeolocation);
    
    // Category tabs
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            setActiveCategory(this.dataset.category);
        });
    });
    
    // Sort selector
    document.getElementById('sortSelect').addEventListener('change', function() {
        sortResults(this.value);
    });
    
    // Center map button
    document.getElementById('centerMapBtn').addEventListener('click', function() {
        if (currentLocation) {
            map.setView([currentLocation.lat, currentLocation.lng], 13);
        }
    });
    
    // Enter key support for search
    document.getElementById('locationInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
    
    document.getElementById('latInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
    
    document.getElementById('lngInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
}

// Handle search functionality
async function handleSearch() {
    const locationInput = document.getElementById('locationInput').value.trim();
    const latInput = document.getElementById('latInput').value.trim();
    const lngInput = document.getElementById('lngInput').value.trim();
    
    let searchLocation = null;
    
    // Priority: coordinates > location name > current location
    if (latInput && lngInput) {
        const lat = parseFloat(latInput);
        const lng = parseFloat(lngInput);
        
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            showToast('Please enter valid coordinates', 'error');
            return;
        }
        
        searchLocation = { lat, lng };
        showToast('Using coordinates for search', 'info');
    } else if (locationInput) {
        // Geocode the location using a geocoding service
        try {
            const geocoded = await geocodeLocation(locationInput);
            if (geocoded) {
                searchLocation = geocoded;
                showToast(`Found location: ${locationInput}`, 'success');
            } else {
                showToast('Location not found. Please try a different search term.', 'error');
                return;
            }
        } catch (error) {
            showToast('Error finding location. Please try again.', 'error');
            return;
        }
    } else if (currentLocation) {
        searchLocation = currentLocation;
        showToast('Using current location', 'info');
    } else {
        showToast('Please enter a location, coordinates, or allow location access', 'warning');
        return;
    }
    
    // Update current location and search for services
    currentLocation = searchLocation;
    updateSearchMarker();
    await searchServices();
}

// Geocode location using Nominatim API
async function geocodeLocation(locationName) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}&limit=1`);
        const data = await response.json();
        
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon)
            };
        }
        return null;
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
}

// Request user's geolocation
function requestGeolocation() {
    if (!navigator.geolocation) {
        showToast('Geolocation is not supported by this browser', 'error');
        return;
    }
    
    showToast('Getting your location...', 'info');
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            currentLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            // Update coordinate inputs
            document.getElementById('latInput').value = currentLocation.lat.toFixed(6);
            document.getElementById('lngInput').value = currentLocation.lng.toFixed(6);
            
            // Center map on current location
            map.setView([currentLocation.lat, currentLocation.lng], 13);
            updateSearchMarker();
            
            showToast('Location found successfully!', 'success');
        },
        function(error) {
            let message = 'Unable to get your location. ';
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    message += 'Location access denied.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    message += 'Location information unavailable.';
                    break;
                case error.TIMEOUT:
                    message += 'Location request timed out.';
                    break;
                default:
                    message += 'Unknown error occurred.';
                    break;
            }
            showToast(message, 'error');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
        }
    );
}

// Update search location marker
function updateSearchMarker() {
    if (searchMarker) {
        map.removeLayer(searchMarker);
    }
    
    if (currentLocation) {
        searchMarker = L.marker([currentLocation.lat, currentLocation.lng], {
            icon: L.divIcon({
                className: 'search-marker',
                html: '<div style="background: #ef4444; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">📍</div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            })
        }).addTo(map);
        
        searchMarker.bindPopup('<div class="popup-title">Search Location</div><div class="popup-address">Your search center</div>').openPopup();
    }
}

// Set active category
function setActiveCategory(category) {
    currentCategory = category;
    
    // Update active tab
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-category="${category}"]`).classList.add('active');
    
    // Re-search if we have a location
    if (currentLocation) {
        searchServices();
    }
}

// Search for services
async function searchServices() {
    if (!currentLocation) {
        showToast('Please set a location first', 'warning');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch('/find', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                latitude: currentLocation.lat,
                longitude: currentLocation.lng,
                category: currentCategory
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        servicesData = data.places || {};
        
        updateMap();
        updateResults();
        
        const totalResults = Object.values(servicesData).reduce((sum, places) => sum + places.length, 0);
        showToast(`Found ${totalResults} ${currentCategory} services`, 'success');
        
    } catch (error) {
        console.error('Search error:', error);
        showToast(`Error searching for services: ${error.message}`, 'error');
        servicesData = {};
        updateResults();
    }
    
    showLoading(false);
}

// Update map with service markers
function updateMap() {
    // Clear existing markers (except search marker)
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    // Add service markers
    Object.entries(servicesData).forEach(([serviceType, places]) => {
        places.forEach((place, index) => {
            // Create custom icon based on service type
            const icon = getCategoryIcon(serviceType);
            
            const marker = L.marker([place.lat, place.lon], {
                icon: L.divIcon({
                    className: 'service-marker',
                    html: `<div style="background: #2563eb; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); border: 2px solid white;">${icon}</div>`,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                })
            }).addTo(map);
            
            // Create popup content
            const popupContent = `
                <div class="popup-title">${place.name || 'Unknown'}</div>
                <div class="popup-address">${serviceType}</div>
                <div class="popup-distance">${place.distance ? (place.distance / 1000).toFixed(2) + ' km away' : ''}</div>
            `;
            
            marker.bindPopup(popupContent);
            
            // Add click event to highlight corresponding result card
            marker.on('click', function() {
                highlightResultCard(serviceType, index);
                scrollToResultCard(serviceType, index);
            });
            
            markers.push(marker);
        });
    });
    
    // Fit map to show all markers if we have results
    if (markers.length > 0) {
        const group = new L.featureGroup([searchMarker, ...markers]);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// Get category icon
function getCategoryIcon(serviceType) {
    const icons = {
        'Hospital': '🏥',
        'Clinic': '🏥',
        'Pharmacy': '💊',
        'Police Station': '👮',
        'Grocery Store': '🛒',
        'Restaurant': '🍽️',
        'Bank': '🏦',
        'Post Office': '📮',
        'Petrol Bunk': '⛽',
        'School': '🎓',
        'Temple': '🛕'
    };
    return icons[serviceType] || '📍';
}

// Update results display
function updateResults() {
    const container = document.getElementById('resultsContainer');
    const countElement = document.getElementById('resultsCount');
    
    const totalResults = Object.values(servicesData).reduce((sum, places) => sum + places.length, 0);
    countElement.textContent = `${totalResults} results`;
    
    if (totalResults === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">😔</div>
                <h3>No Services Found</h3>
                <p>Try searching in a different location or selecting another service category.</p>
            </div>
        `;
        return;
    }
    
    // Sort results by distance initially
    sortResults('distance');
}

// Sort results
function sortResults(sortBy) {
    let allPlaces = [];
    
    // Flatten all places with their service type
    Object.entries(servicesData).forEach(([serviceType, places]) => {
        places.forEach((place, index) => {
            allPlaces.push({
                ...place,
                serviceType: serviceType,
                originalIndex: index
            });
        });
    });
    
    switch (sortBy) {
        case 'distance':
            allPlaces.sort((a, b) => (a.distance || 0) - (b.distance || 0));
            break;
        case 'name':
            allPlaces.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            break;
    }
    
    renderResults(allPlaces);
}

// Render results
function renderResults(places) {
    const container = document.getElementById('resultsContainer');
    
    container.innerHTML = places.map((place, index) => {
        const distance = place.distance ? (place.distance / 1000).toFixed(2) + ' km' : 'Distance unknown';
        const icon = getCategoryIcon(place.serviceType);
        
        return `
            <div class="service-card" data-service-type="${place.serviceType}" data-index="${place.originalIndex}" onclick="focusOnMarker('${place.serviceType}', ${place.originalIndex})">
                <div class="service-header">
                    <div>
                        <div class="service-name">${place.name || 'Unknown Service'}</div>
                        <div class="service-address">${place.serviceType}</div>
                    </div>
                    <div class="service-category">${icon} ${place.serviceType}</div>
                </div>
                <div class="service-footer">
                    <div class="service-distance">${distance}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Focus on marker when result card is clicked
function focusOnMarker(serviceType, originalIndex) {
    const places = servicesData[serviceType];
    if (places && places[originalIndex]) {
        const place = places[originalIndex];
        map.setView([place.lat, place.lon], 16);
        
        // Find and open the corresponding marker popup
        markers.forEach(marker => {
            const markerLatLng = marker.getLatLng();
            if (Math.abs(markerLatLng.lat - place.lat) < 0.0001 && Math.abs(markerLatLng.lng - place.lon) < 0.0001) {
                marker.openPopup();
            }
        });
    }
}

// Highlight result card
function highlightResultCard(serviceType, index) {
    // Remove existing highlights
    document.querySelectorAll('.service-card').forEach(card => {
        card.style.borderColor = '#e5e7eb';
        card.style.transform = '';
    });
    
    // Highlight selected card
    const card = document.querySelector(`[data-service-type="${serviceType}"][data-index="${index}"]`);
    if (card) {
        card.style.borderColor = '#2563eb';
        card.style.transform = 'translateY(-2px)';
    }
}

// Scroll to result card
function scrollToResultCard(serviceType, index) {
    const card = document.querySelector(`[data-service-type="${serviceType}"][data-index="${index}"]`);
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Show/hide loading indicator
function showLoading(show) {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (show) {
        loadingIndicator.classList.remove('hidden');
    } else {
        loadingIndicator.classList.add('hidden');
    }
}

// Toast notification system
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 300);
    }, 4000);
}

// Utility function to calculate distance between two points
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
}