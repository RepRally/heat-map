// Main application state
const appState = {
    currentView: 'national', // 'national' or 'state'
    selectedState: null,
    selectedSeller: null,
    map: null,
    statesData: null,
    statesLayer: null,
    storesLayer: null,
    sellersLayer: null,
    connectionsLayer: null,
    sellerRadiusLayer: null,
    whiteOverlay: null,  // Added for white overlay on state view
    colorScale: null
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    setupEventListeners();
    setupFilterListeners();
    loadNationalData();
    setupSearchFunctionality();
});

// Initialize the Leaflet map
function initMap() {
    // Create map centered on US
    appState.map = L.map('map').setView([37.8, -96], 4);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(appState.map);

    // Create empty layers for later use
    appState.statesLayer = L.layerGroup().addTo(appState.map);
    appState.storesLayer = L.layerGroup();
    appState.sellersLayer = L.layerGroup();
    appState.connectionsLayer = L.layerGroup();
    appState.sellerRadiusLayer = L.layerGroup().addTo(appState.map)


    // Create a white overlay layer for better contrast when zoomed in
    appState.whiteOverlay = L.rectangle([[-90, -180], [90, 180]], {
        color: 'transparent',
        fillColor: '#ffffff',
        fillOpacity: 0.6,
        interactive: false
    });
}

// Initialize filter state
const filterState = {
    all: true,
    store: {
        active: true,
        cooled: true,
        churned: true,
        checkin: true
    },
    seller: {
        active: true,
        churned: true
    }
};

// Setup filter event listeners
function setupFilterListeners() {
    // All filter
    document.getElementById('filter-all').addEventListener('change', (e) => {
        const checked = e.target.checked;
        filterState.all = checked;

        // Update all other checkboxes
        document.querySelectorAll('.filter-option input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = checked;

            // Update filter state based on checkbox ID
            const id = checkbox.id;
            if (id.includes('store-active')) filterState.store.active = checked;
            if (id.includes('store-cooled')) filterState.store.cooled = checked;
            if (id.includes('store-churned')) filterState.store.churned = checked;
            if (id.includes('store-checkin')) filterState.store.checkin = checked;
            if (id.includes('seller-active')) filterState.seller.active = checked;
            if (id.includes('seller-churned')) filterState.seller.churned = checked;
        });

        applyFilters();
    });

    // Store filters
    document.getElementById('filter-store-active').addEventListener('change', (e) => {
        filterState.store.active = e.target.checked;
        updateAllCheckbox();
        applyFilters();
    });

    document.getElementById('filter-store-cooled').addEventListener('change', (e) => {
        filterState.store.cooled = e.target.checked;
        updateAllCheckbox();
        applyFilters();
    });

    document.getElementById('filter-store-churned').addEventListener('change', (e) => {
        filterState.store.churned = e.target.checked;
        updateAllCheckbox();
        applyFilters();
    });

    document.getElementById('filter-store-checkin').addEventListener('change', (e) => {
        filterState.store.checkin = e.target.checked;
        updateAllCheckbox();
        applyFilters();
    });

    // Seller filters
    document.getElementById('filter-seller-active').addEventListener('change', (e) => {
        filterState.seller.active = e.target.checked;
        updateAllCheckbox();
        applyFilters();
    });

    document.getElementById('filter-seller-churned').addEventListener('change', (e) => {
        filterState.seller.churned = e.target.checked;
        updateAllCheckbox();
        applyFilters();
    });
}

// Update the "All" checkbox based on other checkboxes
function updateAllCheckbox() {
    const allChecked =
        filterState.store.active &&
        filterState.store.cooled &&
        filterState.store.churned &&
        filterState.store.checkin &&
        filterState.seller.active &&
        filterState.seller.churned;

    document.getElementById('filter-all').checked = allChecked;
    filterState.all = allChecked;
}

// Apply filters to the map
function applyFilters() {
    // Filter stores
    if (appState.storesLayer) {
        appState.storesLayer.eachLayer(layer => {
            if (!layer.storeStatus) return; // Skip if no status

            const visible =
                (layer.storeStatus === 'Active' && filterState.store.active) ||
                (layer.storeStatus === 'Cooled' && filterState.store.cooled) ||
                (layer.storeStatus === 'Churned' && filterState.store.churned) ||
                (layer.storeStatus === 'CheckInNoSales' && filterState.store.checkin);

            if (visible) {
                if (layer._path) layer._path.style.display = 'block';
            } else {
                if (layer._path) layer._path.style.display = 'none';
            }
        });
    }

    // Filter sellers
    if (appState.sellersLayer) {
        appState.sellersLayer.eachLayer(layer => {
            if (!layer.sellerStatus) return; // Skip if no status

            const visible =
                (layer.sellerStatus === 'Active Seller' && filterState.seller.active) ||
                (layer.sellerStatus === 'Churned Seller' && filterState.seller.churned);

            if (visible) {
                if (layer._icon) layer._icon.style.display = 'block';
            } else {
                if (layer._icon) layer._icon.style.display = 'none';
            }
        });
    }
}

// Set up event listeners
function setupEventListeners() {
    // Back button
    document.getElementById('backButton').addEventListener('click', handleBackButton);

    // Attach event listener for view connections buttons (event delegation)
    document.addEventListener('click', async (event) => {
        console.log("start click event", new Date().toISOString());
        console.log(event.target.classList)
        if (event.target.classList.contains('view-connections-btn')) {
            showLoading(true);
            const sellerId = event.target.getAttribute('data-seller-id');
            const storeId = event.target.getAttribute('data-store-id')
            // // console.log("start seller connections", new Date().toISOString());
            await loadSellerConnections(sellerId);
            // // console.log("end seller connections", new Date().toISOString());
            await loadStoreConnections(storeId);
            // // console.log("end store connections", new Date().toISOString());
            showLoading(false);
        }
        console.log("end click event", new Date().toISOString());
    });

    // Map click handler to reset store appearances when clicking elsewhere
    appState.map.on('click', async (e) => {
        if (!e.originalEvent.target.classList.contains('square-marker') &&
            !e.originalEvent.target.classList.contains('leaflet-interactive')) {
            console.log('clicked handled', new Date().toISOString());
            showLoading(true);


            // Clean up seller hover effects
            document.querySelectorAll('.seller-hover-highlight').forEach(elem => {
                elem.classList.remove('seller-hover-highlight');
            });

            document.querySelectorAll('.radius-hover').forEach(elem => {
                elem.classList.remove('radius-hover');
            });
            // Check if we have a selected seller
            if (appState.selectedSeller) {
                appState.selectedSeller = null;
                appState.connectionsLayer.clearLayers();
                appState.sellerRadiusLayer.clearLayers();
                restoreStoresAppearance();
                restoreSellersAppearance();
            }

            // Check if we have a selected store
            if (appState.selectedStore) {
                appState.selectedStore = null;
                appState.connectionsLayer.clearLayers();
                appState.sellerRadiusLayer.clearLayers();
                restoreStoresAppearance();
                restoreSellersAppearance();
            }

            //clear radius layer
            if (appState.sellerRadiusLayer) {
                appState.sellerRadiusLayer.clearLayers();
            }
            showLoading(false);
        }
    });
}

// Load national-level data
async function loadNationalData() {
    try {
        showLoading(true);

        // Load US states GeoJSON data
        const usStatesResponse = await fetch('/data/us-states.json');

        if (!usStatesResponse.ok) {
            throw new Error(`Failed to load US states data: ${usStatesResponse.statusText}`);
        }

        const usStatesData = await usStatesResponse.json();
        // console.log('GeoJSON data loaded successfully');

        // Load state GMV data from API
        const stateGmvResponse = await fetch('/api/states/gmv');

        if (!stateGmvResponse.ok) {
            throw new Error(`Failed to load GMV data: ${stateGmvResponse.statusText}`);
        }

        const stateGmvData = await stateGmvResponse.json();

        // Create a map for easy lookup
        const stateDataMap = {};
        stateGmvData.forEach(state => {
            stateDataMap[state.STORE_STATE] = state;
        });

        // Calculate min/max GMV for color scale
        const gmvValues = stateGmvData.map(state => state.TOTAL_GMV_LAST_MONTH);
        const minGmv = Math.min(...gmvValues.filter(val => val > 0)) || 0;
        const maxGmv = Math.max(...gmvValues) || 1;

        // Create color scale function
        appState.colorScale = createColorScale(minGmv, maxGmv);

        // Add the GeoJSON layer with styling
        appState.statesData = L.geoJSON(usStatesData, {
            style: feature => styleState(feature, stateDataMap),
            onEachFeature: (feature, layer) => {
                const stateName = feature.properties.name;
                const stateAbbr = getStateAbbreviation(stateName);
                const stateData = stateDataMap[stateAbbr] || {
                    TOTAL_GMV_LAST_MONTH: 0,
                    TOTAL_GMV_THIS_MONTH: 0,
                    STORE_COUNT: 0
                };

                // Add hover effect
                layer.on({
                    mouseover: (e) => {
                        layer.setStyle({ weight: 3, fillOpacity: 0.8 });
                        showStateInfo(stateName, stateData);
                    },
                    mouseout: (e) => {
                        appState.statesData.resetStyle(layer);
                    },
                    click: (e) => {
                        if (appState.currentView === 'national') {
                            zoomToState(stateName, stateAbbr);
                        }
                    }
                });
            }
        }).addTo(appState.statesLayer);

        // Update UI
        updateViewState('national');
        createLegend();
        showLoading(false);

    } catch (error) {
        console.error('Error loading national data:', error);
        showError('Failed to load map data. Please try again later.');
    }
}

// Style function for states
function styleState(feature, stateDataMap) {
    const stateName = feature.properties.name;
    const stateAbbr = getStateAbbreviation(stateName);
    const stateData = stateDataMap[stateAbbr];

    const gmv = stateData ? stateData.TOTAL_GMV_LAST_MONTH : 0;
    const fillColor = gmv > 0 ? appState.colorScale(gmv) : '#f7f7f7';

    return {
        fillColor: fillColor,
        weight: 1,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.7
    };
}

// Create color scale for the heatmap
function createColorScale(min, max) {
    // Use d3 to create a color scale from light to dark green
    return d3.scaleSequential()
        .domain([min, max])
        .interpolator(d3.interpolate('#e5f5e0', '#005a32'));
}

// Zoom to a specific state
async function zoomToState(stateName, stateAbbr) {
    return new Promise(async (resolve, reject) => {
        try {
            showLoading(true);

            // Update app state
            appState.currentView = 'state';
            appState.selectedState = stateAbbr;

            // Clear previous state layers if any
            appState.storesLayer.clearLayers();
            appState.sellersLayer.clearLayers();
            appState.connectionsLayer.clearLayers();

            // Find the state feature and zoom to its bounds
            const stateFeature = appState.statesData.getLayers().find(layer =>
                layer.feature.properties.name === stateName
            );

            if (stateFeature) {
                appState.map.fitBounds(stateFeature.getBounds());
            }

            // Hide the green heatmap layer when zoomed in to a state
            appState.statesLayer.removeFrom(appState.map);

            // Add white semi-transparent overlay for better contrast
            appState.whiteOverlay.addTo(appState.map);

            // Make sure the white overlay is at the bottom
            appState.whiteOverlay.bringToBack();

            // Load state-specific data
            const response = await fetch(`/api/state/${stateAbbr}`);
            const data = await response.json();

            // Add stores as circles
            data.stores.forEach(store => {
                if (store.LATITUDE && store.LONGITUDE) {
                    // Get the appropriate color based on store status
                    const storeStatus = store["Store Status"] || 'Active';
                    const fillColor = CONFIG.styles.colors.storeMarker[storeStatus] || '#1a9850';

                    const marker = L.circleMarker([store.LATITUDE, store.LONGITUDE], {
                        radius: calculateMarkerRadius(store.STORE_LIFETIME_GMV),
                        fillColor: fillColor,
                        color: '#fff',
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.8,
                        className: 'store-marker' // Add a class for easier selection
                    });

                    // Store references for later use
                    marker.storeId = store.STORE_ID;
                    marker.storeStatus = storeStatus;
                    marker.originalColor = fillColor;

                    // Add hover effect
                    marker.on({
                        mouseover: () => {
                            marker.setStyle({ fillOpacity: 1, radius: calculateMarkerRadius(store.STORE_LIFETIME_GMV) + 2 });
                            showStoreInfo(store);
                        },
                        mouseout: () => {
                            marker.setStyle({ fillOpacity: 0.8, radius: calculateMarkerRadius(store.STORE_LIFETIME_GMV) });
                            console.log('mouseout', new Date().toISOString());
                            showStoreInfo(null);
                        },
                        click: () => {
                            loadStoreCoverage(store.STORE_ID);
                            loadStoreConnections(store.STORE_ID);
                        }
                    });

                    marker.addTo(appState.storesLayer);
                }
            });

            // Add sellers as squares
            data.sellers.forEach(seller => {
                if (seller.LATITUDE && seller.LONGITUDE) {

                    // Get seller status and determine color
                    const sellerStatus = seller.SELLER_STATUS || 'Active Seller';
                    const fillColor = CONFIG.styles.colors.sellerMarker[sellerStatus] || '#1e88e5';

                    // Calculate marker size based on GMV
                    const markerSize = calculateMarkerRadius(seller.SELLER_TOTAL_GMV) * 2;

                    // Create custom square icon
                    // Create custom square icon
                    const icon = L.divIcon({
                        html: `<div class="square-marker" style="width: ${markerSize}px; height: ${markerSize}px; background-color: ${fillColor};"></div>`,
                        className: 'seller-marker',
                        iconSize: [markerSize, markerSize]
                    });

                    const marker = L.marker([seller.LATITUDE, seller.LONGITUDE], { icon });
                    marker.seller = seller; // Store the full seller object for searching
                    marker.sellerId = seller.SELLER_ID; // Store seller ID for reference
                    marker.sellerStatus = sellerStatus; // Store seller status for reference
                    marker.originalColor = fillColor;   // Store original color for reference

                    // Add hover and click effects
                    marker.on({
                        mouseover: () => {
                            marker._icon.querySelector('.square-marker').classList.add('seller-hover');
                            showSellerInfo(seller);
                        },
                        mouseout: () => {
                            marker._icon.querySelector('.square-marker').classList.remove('seller-hover');
                        },
                        click: () => {
                            loadSellerConnections(seller.SELLER_ID);
                        }
                    });

                    marker.addTo(appState.sellersLayer);
                }
            });

            // Add layers to map
            appState.storesLayer.addTo(appState.map);
            appState.sellersLayer.addTo(appState.map);

            // Update UI
            updateViewState('state', stateName);
            showLoading(false);

        } catch (error) {
            console.error('Error loading state data:', error);
            showError('Failed to load state data. Please try again later.');
            reject(error)
        }
    })
}

// Setup search functionality
function setupSearchFunctionality() {
    const searchInput = document.getElementById('sellerSearchInput');
    const searchButton = document.getElementById('sellerSearchButton');

    // Search button click event
    searchButton.addEventListener('click', () => {
        performSellerSearch();
    });

    // Enter key press in search input
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSellerSearch();
        }
    });
}

// Perform the seller search
async function performSellerSearch() {
    const searchInput = document.getElementById('sellerSearchInput');
    const searchTerm = searchInput.value.trim();

    if (!searchTerm) {
        showError('Please enter a seller name to search');
        return;
    }

    try {
        showLoading(true);

        // Get sellers matching the search term from the server
        const response = await fetch(`/api/sellers/search?name=${encodeURIComponent(searchTerm)}`);

        if (!response.ok) {
            throw new Error('Failed to search for sellers');
        }

        const sellers = await response.json();

        if (sellers.length === 0) {
            showError('No sellers found with that name');
            showLoading(false);
            return;
        }

        // Use the first matching seller
        const seller = sellers[0];
        const sellerState = seller.SELLER_STATE;

        // If we're in national view, we need to zoom to the state first
        if (appState.currentView === 'national') {
            // Find the state feature
            const stateFeature = appState.statesData.getLayers().find(layer => {
                const stateName = layer.feature.properties.name;
                const stateAbbr = getStateAbbreviation(stateName);
                return stateAbbr === sellerState;
            });

            if (!stateFeature) {
                showError(`Could not find state: ${sellerState}`);
                showLoading(false);
                return;
            }

            // Zoom to the state
            await zoomToState(stateFeature.feature.properties.name, sellerState);

            // Wait a bit for the state data to load
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Find the seller marker
        let sellerMarker = null;
        appState.sellersLayer.eachLayer(layer => {
            if (layer.sellerId === seller.SELLER_ID) {
                sellerMarker = layer;
            }
        });

        if (!sellerMarker) {
            showError('Seller found but could not locate on map');
            showLoading(false);
            return;
        }

        // Center map on seller
        appState.map.setView(sellerMarker.getLatLng(), appState.map.getZoom() + 1);

        // Highlight the seller
        if (sellerMarker._icon) {
            const markerElement = sellerMarker._icon.querySelector('.square-marker');
            if (markerElement) {
                // Remove highlight from any previously highlighted sellers
                appState.sellersLayer.eachLayer(l => {
                    if (l._icon && l._icon.querySelector('.square-marker')) {
                        l._icon.querySelector('.square-marker').classList.remove('search-highlight');
                    }
                });

                // Add highlight to found seller
                markerElement.classList.add('search-highlight');

                // Trigger the seller's click event to show connections
                loadSellerConnections(seller.SELLER_ID);
            }
        }

        showLoading(false);

    } catch (error) {
        console.error('Search error:', error);
        showError('Error searching for sellers');
        showLoading(false);
    }
}

// Load store-seller connections
async function loadStoreConnections(storeId) {
    try {
        // console.log('Loading Connections for store:', storeId)
        showLoading(true);

        // if(!appState.connectionsLayer){
        //     appState.connectionsLayer=L.featureGroup()
        // }

        // Clear previous connections
        appState.connectionsLayer.clearLayers();

        // Reset previous selection if any
        if (appState.selectedSeller) {
            appState.selectedSeller = null;
            restoreSellersAppearance();
            restoreStoresAppearance();
        }

        // Load connection data
        const response = await fetch(`/api/store/${storeId}/connections`);
        const connections = await response.json();

        // console.log('Connection data:', connections);

        if (connections.length === 0) {
            // console.log('No connections found for store ID:', storeId);
            showError('No seller connections found for this store.');
            showLoading(false);
            return;
        }

        if (connections.length === 0) {
            showError('No seller connections found for this store.');
            showLoading(false);
            return;
        }

        // Find store and seller locations
        const storeLat = connections[0].STORE_LATITUDE;
        const storeLng = connections[0].STORE_LONGITUDE;
        const sellerLat = connections[0].SELLER_LATITUDE;
        const sellerLng = connections[0].SELLER_LONGITUDE;
        const sellerId = connections[0].SELLER_ID;

        // Make all other stores semi-transparent
        appState.storesLayer.eachLayer(layer => {
            if (layer.storeId !== storeId) {
                // Grey out other stores
                layer.setStyle({
                    fillColor: '#808080',
                    fillOpacity: 0.5
                });
                layer._path.classList.add('store-inactive');
            }
        });

        // Highlight the connected seller
        appState.sellersLayer.eachLayer(layer => {
            if (layer.sellerId === sellerId) {
                // Highlight the connected seller
                if (layer._icon) {
                    const markerElement = layer._icon.querySelector('.square-marker');
                    if (markerElement) {
                        markerElement.classList.add('seller-highlight');
                    }
                }
            } else {
                // Make other sellers semi-transparent
                if (layer._icon) {
                    const markerElement = layer._icon.querySelector('.square-marker');
                    if (markerElement) {
                        markerElement.classList.add('seller-inactive');
                    }
                }
            }
        });

        // Draw connection as dotted line
        const line = L.polyline([
            [storeLat, storeLng],
            [sellerLat, sellerLng]
        ], {
            color: '#fd8d3c',
            weight: 2,
            opacity: 1.0,
            dashArray: '5, 10'
        });

        line.addTo(appState.connectionsLayer);

        // Add connections layer to map
        appState.connectionsLayer.addTo(appState.map);

        // Update UI
        appState.selectedStore = storeId;
        showLoading(false);

    } catch (error) {
        console.error('Error loading store connections:', error);
        showError('Failed to load store connections. Please try again later.');
    }
}

// Add this function to calculate the 75th percentile of distances
function calculatePercentileDistance(connections, percentile = 0.75) {
    if (!connections || connections.length === 0) return 1000; // Default radius if no connections

    // Calculate distances between seller and all stores
    const distances = connections.map(conn => {
        const sellerLatLng = L.latLng(conn.SELLER_LATITUDE, conn.SELLER_LONGITUDE);
        const storeLatLng = L.latLng(conn.STORE_LATITUDE, conn.STORE_LONGITUDE);
        return sellerLatLng.distanceTo(storeLatLng);
    });

    // Sort distances
    distances.sort((a, b) => a - b);

    // Calculate index for percentile
    const index = Math.ceil(distances.length * percentile) - 1;
    return distances[index] || 1000; // Return the value at the percentile index
}

// Load seller connections for network visualization
async function loadSellerConnections(sellerId) {
    try {
        showLoading(true);

        // Clear previous connections
        appState.connectionsLayer.clearLayers();
        appState.sellerRadiusLayer.clearLayers()

        // Load connection data
        const response = await fetch(`/api/seller/${sellerId}/connections`);
        const connections = await response.json();

        if (connections.length === 0) {
            showError('No connections found for this seller.');
            showLoading(false);
            return;
        }

        // Find seller location (should be the same for all connections)
        const sellerLat = connections[0].SELLER_LATITUDE;
        const sellerLng = connections[0].SELLER_LONGITUDE;

        //Get the seller's status from the layer data
        let sellerStatus = 'Active Seller'
        appState.sellersLayer.eachLayer(layer => {
            if (layer.sellerId === sellerId && layer.sellerStatus) {
                sellerStatus = layer.sellerStatus
            }
        })

        const isChurned = sellerStatus === 'Churned Seller'
        const radiusColor = isChurned ? '#614200' : '#1e88e5'; // Brown for churned, green for active

        //calculate 75percentile distance
        const radiusDistance = calculatePercentileDistance(connections)

        // Clear any existing radius circles
        appState.sellerRadiusLayer.clearLayers();

        // Add the circle
        const circleOptions = {
            color: radiusColor,
            fillColor: radiusColor,
            fillOpacity: 0.2,
            weight: 1,
            opacity: 0.4,
            interactive: false
        };

        const circle = L.circle([sellerLat, sellerLng], {
            radius: radiusDistance,
            ...circleOptions
        });

        circle.addTo(appState.sellerRadiusLayer);

        // Create a set of connected store IDs for quick lookup
        const connectedStoreIds = new Set(connections.map(conn => conn.STORE_ID));

        // Make all stores inactive (grey and semi-transparent)
        appState.storesLayer.eachLayer(layer => {
            if (!connectedStoreIds.has(layer.storeId)) {
                // Grey out stores not connected to this seller
                layer.setStyle({
                    fillColor: '#808080',
                    fillOpacity: 0.5
                });
                layer._path.classList.add('store-inactive');
            }
        });

        // Make all other sellers semi-transparent
        appState.sellersLayer.eachLayer(layer => {
            if (layer.sellerId !== sellerId && layer._icon) {
                const markerElement = layer._icon.querySelector('.square-marker');
                if (markerElement) {
                    markerElement.classList.add('seller-inactive');
                }
            }
        });

        // Draw connections as dotted lines
        connections.forEach(conn => {
            if (conn.STORE_LATITUDE && conn.STORE_LONGITUDE) {
                const line = L.polyline([
                    [sellerLat, sellerLng],
                    [conn.STORE_LATITUDE, conn.STORE_LONGITUDE]
                ], {
                    color: '#fd8d3c',
                    weight: 2,
                    opacity: 0.7,
                    dashArray: '5, 10'
                });

                line.addTo(appState.connectionsLayer);
            }
        });

        // Add connections layer to map
        appState.connectionsLayer.addTo(appState.map);

        // Update UI
        appState.selectedSeller = sellerId;
        showLoading(false);

    } catch (error) {
        console.error('Error loading seller connections:', error);
        showError('Failed to load seller connections. Please try again later.');
    }
}


// Restore all stores to their original appearance
function restoreStoresAppearance() {
    appState.storesLayer.eachLayer(layer => {
        // Restore the original color based on store status
        layer.setStyle({
            fillColor: layer.originalColor || '#1a9850',
            fillOpacity: 0.8
        });
        if (layer._path) {
            layer._path.classList.remove('store-inactive');
            layer._path.classList.remove('store-highlight');
        }
    });
}

// Restore all sellers to their original appearance
function restoreSellersAppearance() {
    appState.sellersLayer.eachLayer(layer => {
        if (layer._icon) {
            const markerElement = layer._icon.querySelector('.square-marker');
            if (markerElement) {
                markerElement.classList.remove('seller-inactive');
                markerElement.classList.remove('seller-highlight');
                markerElement.classList.remove('search-highlight');
                markerElement.classList.remove('coverage-highlight');

                // Restore original color if stored
                if (layer.originalColor) {
                    markerElement.style.backgroundColor = layer.originalColor;
                }
            }
        }
    });
}

// Handle back button click
function handleBackButton() {
    if (appState.selectedSeller) {
        // If showing connections, go back to state view
        appState.selectedSeller = null;
        appState.connectionsLayer.clearLayers();

        // In the handleBackButton function, when handling seller selection:
        appState.sellerRadiusLayer.clearLayers();

        // Restore all stores to their original appearance
        restoreStoresAppearance();

        // Restore all sellers to their original appearance
        restoreSellersAppearance();
    } else if (appState.selectedStore) {
        // If showing store connections, go back to state view
        appState.selectedStore = null;
        appState.connectionsLayer.clearLayers();
        appState.sellerRadiusLayer.clearLayers();
        // Restore all stores to their original appearance
        restoreStoresAppearance();

        // Restore all sellers to their original appearance
        restoreSellersAppearance();
    }
    else if (appState.currentView === 'state') {
        // If showing state view, go back to national view
        appState.currentView = 'national';
        appState.selectedState = null;

        // Clear state-specific layers
        appState.storesLayer.clearLayers().removeFrom(appState.map);
        appState.sellersLayer.clearLayers().removeFrom(appState.map);
        appState.connectionsLayer.clearLayers().removeFrom(appState.map);

        // Remove the white overlay
        appState.whiteOverlay.removeFrom(appState.map);

        // Reset map view
        appState.map.setView([37.8, -96], 4);

        // Add back the heatmap layer when returning to national view
        appState.statesLayer.addTo(appState.map);

        // Update UI
        updateViewState('national');
    }
}

// Update view state and UI elements
function updateViewState(view, stateName = '') {
    appState.currentView = view;

    // Toggle back button visibility
    const backButton = document.getElementById('backButton');
    if (view === 'national') {
        backButton.classList.add('hidden');
        document.getElementById('infoTitle').textContent = 'US States Overview';
        document.getElementById('stateInfo').classList.remove('hidden');
        document.getElementById('entityInfo').classList.add('hidden');
    } else {
        backButton.classList.remove('hidden');
        document.getElementById('infoTitle').textContent = `${stateName} Details`;
        document.getElementById('stateInfo').classList.add('hidden');
        document.getElementById('entityInfo').classList.remove('hidden');
    }
}

// Display state information in the info panel
function showStateInfo(stateName, stateData) {
    const infoPanel = document.getElementById('stateInfo');
    const template = document.getElementById('stateInfoTemplate');

    if (!template) return;

    const content = template.innerHTML
        .replace('{{stateName}}', stateName)
        .replace('{{storeCount}}', formatNumber(stateData.STORE_COUNT || 0))
        .replace('{{gmvLastMonth}}', formatCurrency(stateData.TOTAL_GMV_LAST_MONTH || 0))
        .replace('{{gmvThisMonth}}', formatCurrency(stateData.TOTAL_GMV_THIS_MONTH || 0));

    infoPanel.innerHTML = content;
}

// Display store information in the info panel
function showStoreInfo(store) {
    const infoPanel = document.getElementById('entityDetails');
    const entityName = document.getElementById('entityName');

    if (!store) {
        infoPanel.innerHTML = '';
        entityName.innerHTML = '';
        return;
    }


    const template = document.getElementById('storeInfoTemplate');

    if (!template) return;

    entityName.textContent = store.STORE_LOCATION_NAME || 'Store';

    const sellerName = store.SELLER_FIRST_NAME && store.SELLER_LAST_NAME
        ? `${store.SELLER_FIRST_NAME} ${store.SELLER_LAST_NAME}`
        : 'N/A';

    const storeStatus = store["Store Status"] || 'Active';
    const statusClass = storeStatus.toLowerCase().replace(/\s+/g, '-');

    const content = template.innerHTML
        .replace('{{storeId}}', store.STORE_ID || 'N/A')
        .replace('{{storeName}}', store.STORE_LOCATION_NAME || 'N/A')
        .replace('{{address}}', store.STORE_ADDRESS || 'N/A')
        .replace('{{city}}', store.STORE_CITY || 'N/A')
        .replace('{{status}}', storeStatus)
        .replace('{{statusClass}}', statusClass)
        .replace('{{lifetimeGmv}}', formatCurrency(store.STORE_LIFETIME_GMV || 0))
        .replace('{{gmvLastMonth}}', formatCurrency(store.GMV_LAST_MONTH || 0))
        .replace('{{gmvThisMonth}}', formatCurrency(store.GMV_CURRENT_MONTH || 0))
        .replace('{{sellerName}}', sellerName);

    infoPanel.innerHTML = content;

    // Add event listener for the view connections button
    const connectionsBtn = infoPanel.querySelector('.view-connections-btn');
    if (connectionsBtn) {
        connectionsBtn.addEventListener('click', () => {
            loadStoreConnections(store.STORE_ID);
        });
    }
}

// Display seller information in the info panel
function showSellerInfo(seller) {
    const infoPanel = document.getElementById('entityDetails');
    const entityName = document.getElementById('entityName');
    const template = document.getElementById('sellerInfoTemplate');

    if (!template) return;

    const fullName = `${seller.SELLER_FIRST_NAME || ''} ${seller.SELLER_LAST_NAME || ''}`.trim() || 'Unnamed Seller';
    entityName.textContent = fullName;

    // Helper function to get property regardless of case
    function getPropertyCaseInsensitive(obj, propertyName) {
        // First try the exact property name
        if (obj[propertyName] !== undefined) {
            return obj[propertyName];
        }

        // Then try case-insensitive search
        const lowerPropertyName = propertyName.toLowerCase();
        for (const key in obj) {
            if (key.toLowerCase() === lowerPropertyName) {
                return obj[key];
            }
        }

        return undefined;
    }

    const sellerStatus = getPropertyCaseInsensitive(seller, 'SELLER_STATUS') || 'Active Seller';
    const statusClass = sellerStatus.toLowerCase().replace(/\s+/g, '-');
    const daysSinceLastOrder = getPropertyCaseInsensitive(seller, 'DAYS_SINCE_LAST_ORDER') || 'N/A';
    const lastOrderDate = getPropertyCaseInsensitive(seller, 'LAST_ORDER_AT') || 'N/A';

    const content = template.innerHTML
        .replace('{{fullName}}', fullName)
        .replace('{{status}}', sellerStatus)
        .replace('{{statusClass}}', statusClass)
        .replace('{{lastOrder}}', lastOrderDate)
        .replace('{{daysSinceLastOrder}}', daysSinceLastOrder)
        .replace('{{lifetimeGmv}}', formatCurrency(seller.SELLER_TOTAL_GMV || 0))
        .replace('{{gmvLastMonth}}', formatCurrency(seller.GMV_LAST_MONTH || 0))
        .replace('{{gmvThisMonth}}', formatCurrency(seller.GMV_MTD || 0))
        .replace('{{storesLastMonth}}', formatNumber(seller.STORES_LAST_MONTH || 0))
        .replace('{{storesMtd}}', formatNumber(seller.STORES_MTD || 0))
        .replace('{{sellerId}}', seller.SELLER_ID);

    infoPanel.innerHTML = content;
}

// Calculate marker radius based on GMV
function calculateMarkerRadius(gmv) {
    if (!gmv || gmv <= 0) return 5;
    // Logarithmic scale for better visualization
    return Math.max(5, Math.min(15, 5 + Math.log10(gmv / 1000) * 2));
}

// Function to remove previous hover events from markers
function removeHoverEvents(layer) {
    if (layer._events) {
        if (layer._events.mouseover) {
            layer._events.mouseover = layer._events.mouseover.filter(
                event => !event.name || event.name !== 'sellerHover'
            );
        }
        if (layer._events.mouseout) {
            layer._events.mouseout = layer._events.mouseout.filter(
                event => !event.name || event.name !== 'sellerHover'
            );
        }
    }
}

// Function to load nearby sellers and show coverage for a store
async function loadStoreCoverage(storeId) {
    try {
        showLoading(true);

        // Clear previous connections and radius circles
        appState.connectionsLayer.clearLayers();
        appState.sellerRadiusLayer.clearLayers();

        // Reset any previous seller selection
        if (appState.selectedSeller) {
            appState.selectedSeller = null;
            restoreSellersAppearance();
        }

        // Load nearby sellers data
        const response = await fetch(`/api/store/${storeId}/nearby-sellers?maxDistance=200`);
        if (!response.ok) {
            throw new Error(`Failed to load coverage data: ${response.statusText}`);
        }

        const data = await response.json();
        const { store, sellers } = data;

        // Log the entire response for validation
        // console.log('Complete store coverage data:', data);

        // Log sellers who cover the store
        const coveringSellers = sellers.filter(seller => seller.isInRadius);
        // console.log(`Sellers covering store ${storeId} (${coveringSellers.length} total):`);
        coveringSellers.forEach(seller => {
            // console.log(`  Seller ID: ${seller.SELLER_ID}`);
            // console.log(`  Name: ${seller.SELLER_FIRST_NAME} ${seller.SELLER_LAST_NAME}`);
            // console.log(`  Status: ${seller.SELLER_STATUS}`);
            // console.log(`  Distance: ${seller.DISTANCE_MILES.toFixed(2)} miles`);
            // console.log(`  Radius: ${(seller.radius / 1609.34).toFixed(2)} miles`);
        });

        if (sellers.length === 0) {
            showError('No sellers found within 200 miles of this store');
            showLoading(false);
            return;
        }

        // Highlight the store
        let storeMarker = null;
        appState.storesLayer.eachLayer(layer => {
            if (layer.storeId === parseInt(storeId)) {
                storeMarker = layer;
                // Highlight this store
                layer.setStyle({
                    fillOpacity: 1,
                    weight: 3,
                    radius: layer.options.radius * 1.2
                });
            } else {
                // Make other stores semi-transparent
                layer.setStyle({
                    fillColor: '#808080',
                    fillOpacity: 0.3
                });
            }
        });

        // Create a counter for sellers covering this store
        let coveringSellerCount = 0;

        // First, make all sellers semi-transparent
        appState.sellersLayer.eachLayer(layer => {
            if (layer._icon) {
                const markerElement = layer._icon.querySelector('.square-marker');
                if (markerElement) {
                    markerElement.classList.add('seller-inactive');
                }
            }
        });

        const sellerCircleMap = new Map();// To store references to each seller's radius circle

        // Draw seller radius circles and highlight sellers who cover the store
        sellers.forEach(seller => {
            const isInRadius = seller.isInRadius;
            const radius = seller.radius;

            if (isInRadius) {
                coveringSellerCount++;
            }

            // Calculate distance client-side for consistency with visual representation
            const clientDistance = L.latLng(seller.LATITUDE, seller.LONGITUDE)
                .distanceTo(L.latLng(store.LATITUDE, store.LONGITUDE));

            // Calculate the ratio between server and client distances
            const ratio = (seller.DISTANCE_MILES * 1609.34) / clientDistance;

            // Override the server's decision if it's close
            if (Math.abs(seller.DISTANCE_MILES * 1609.34 - clientDistance) > 1000) {
                // console.log(`Distance calculation discrepancy for seller ${seller.SELLER_ID}:`);
                // console.log(`  Server: ${seller.DISTANCE_MILES.toFixed(2)} miles`);
                // console.log(`  Client: ${(clientDistance / 1609.34).toFixed(2)} miles`);

                // If client-side calculation puts it within radius but server doesn't, override
                if (clientDistance <= seller.radius && !seller.isInRadius) {
                    // console.log(`  Overriding server decision: store IS within radius`);
                    seller.isInRadius = true;
                }
            }

            // Find the seller marker
            appState.sellersLayer.eachLayer(layer => {
                if (layer.sellerId === seller.SELLER_ID) {
                    if (isInRadius) {
                        // Highlight this seller
                        if (layer._icon) {
                            const markerElement = layer._icon.querySelector('.square-marker');
                            if (markerElement) {
                                markerElement.classList.remove('seller-inactive');
                                markerElement.classList.add('coverage-highlight');
                            }
                        }

                        // Draw a connection to the store
                        const line = L.polyline([
                            [seller.LATITUDE, seller.LONGITUDE],
                            [store.LATITUDE, store.LONGITUDE]
                        ], {
                            color: '#1a9850', // Green
                            weight: 2,
                            opacity: 0.3,
                            dashArray: '5, 10'
                        });

                        line.addTo(appState.connectionsLayer);
                    }
                }
            });

            // Draw the seller's radius circle
            const circleOptions = {
                color: isInRadius ? '#1a9850' : '#cccccc', // Green for covering sellers, gray for others
                fillColor: isInRadius ? '#1a9850' : '#cccccc',
                fillOpacity: isInRadius ? 0.2 : 0.1,
                weight: isInRadius ? 1 : 0.5,
                opacity: isInRadius ? 0.7 : 0.3,
                interactive: false
            };

            const circle = L.circle([seller.LATITUDE, seller.LONGITUDE], {
                radius: radius,
                ...circleOptions
            });


            circle.addTo(appState.sellerRadiusLayer);
        });


        // Now add hover events to the seller markers that cover the store
        sellers.filter(seller => seller.isInRadius).forEach(seller => {
            // Find the seller marker
            appState.sellersLayer.eachLayer(layer => {
                if (layer.sellerId == seller.SELLER_ID) { // Use loose equality to handle string/number discrepancies

                    //remove preivous hover event
                    removeHoverEvents(layer)
                    // Get the circle reference
                    const circle = sellerCircleMap.get(seller.SELLER_ID.toString());

                    if (!circle) return;

                    // Add hover events
                    layer.on({
                        mouseover: () => {
                            // Highlight the seller marker
                            if (layer._icon) {
                                const markerElement = layer._icon.querySelector('.square-marker');
                                if (markerElement) {
                                    markerElement.classList.add('seller-hover-highlight');
                                }
                            }

                            // Highlight the radius circle
                            if (circle._path) {
                                circle._path.classList.add('radius-hover');
                            }
                        },
                        mouseout: () => {
                            // Remove highlight from seller marker
                            if (layer._icon) {
                                const markerElement = layer._icon.querySelector('.square-marker');
                                if (markerElement) {
                                    markerElement.classList.remove('seller-hover-highlight');
                                }
                            }

                            // Remove highlight from radius circle
                            if (circle._path) {
                                circle._path.classList.remove('radius-hover');
                            }
                        }
                    });
                }
            });
        });

        // Add connections and radius layers to map
        appState.connectionsLayer.addTo(appState.map);
        appState.sellerRadiusLayer.addTo(appState.map);

        // Correct way to bring layer group's layers to back
        appState.sellerRadiusLayer.eachLayer(layer => {
            if (layer.bringToBack) {
                layer.bringToBack();
            }
        });

        // Update UI to show coverage info
        if (coveringSellerCount > 0) {
            //showing seller found

        } else {
            showInfo('This store is not covered by any nearby sellers');
        }

        // Set the selected store
        appState.selectedStore = storeId;

        showLoading(false);
    } catch (error) {
        console.error('Error loading store coverage:', error);
        showError('Failed to load store coverage. Please try again later.');
        showLoading(false);
    }
}

// Add a function to show info messages (not errors)
function showInfo(message) {
    // Create or update info message element
    let infoElement = document.getElementById('info-message');

    if (!infoElement) {
        infoElement = document.createElement('div');
        infoElement.id = 'info-message';
        infoElement.className = 'info-message';
        document.body.appendChild(infoElement);
    }

    infoElement.textContent = message;
    infoElement.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
        infoElement.style.display = 'none';
    }, 5000);
}

// Create a legend for the map
function createLegend() {
    const legendColors = document.querySelector('.legend-color-scale');
    const colorSteps = 5;

    // Get domain from color scale
    const domain = appState.colorScale.domain();
    const min = domain[0];
    const max = domain[1];
    const step = (max - min) / (colorSteps - 1);

    // Create color blocks
    let legendHTML = '';
    for (let i = 0; i < colorSteps; i++) {
        const value = min + step * i;
        const color = appState.colorScale(value);
        legendHTML += `<div class="legend-color" style="background-color: ${color};" 
                      title="$${formatCurrency(value)}"></div>`;
    }

    legendColors.innerHTML = legendHTML;
}

// Helper functions
function showLoading(isLoading) {
    // Implement loading indicator logic
    const loadingIndicators = document.querySelectorAll('.loading-indicator');
    loadingIndicators.forEach(indicator => {
        indicator.style.display = isLoading ? 'block' : 'none';
    });

    const searchButton = document.getElementById('sellerSearchButton');
    if (searchButton) {
        searchButton.disabled = isLoading;
        searchButton.textContent = isLoading ? 'Searching...' : 'Search';
    };
}

function showError(message) {
    console.error(message);

    // Create or update error message element
    let errorElement = document.getElementById('error-message');

    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.id = 'error-message';
        errorElement.className = 'error-message';
        document.body.appendChild(errorElement);
    }

    errorElement.textContent = message;
    errorElement.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

function formatNumber(num) {
    return new Intl.NumberFormat().format(num);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

// Convert state name to abbreviation
function getStateAbbreviation(stateName) {
    const stateMap = {
        'Alabama': 'AL',
        'Alaska': 'AK',
        'Arizona': 'AZ',
        'Arkansas': 'AR',
        'California': 'CA',
        'Colorado': 'CO',
        'Connecticut': 'CT',
        'Delaware': 'DE',
        'Florida': 'FL',
        'Georgia': 'GA',
        'Hawaii': 'HI',
        'Idaho': 'ID',
        'Illinois': 'IL',
        'Indiana': 'IN',
        'Iowa': 'IA',
        'Kansas': 'KS',
        'Kentucky': 'KY',
        'Louisiana': 'LA',
        'Maine': 'ME',
        'Maryland': 'MD',
        'Massachusetts': 'MA',
        'Michigan': 'MI',
        'Minnesota': 'MN',
        'Mississippi': 'MS',
        'Missouri': 'MO',
        'Montana': 'MT',
        'Nebraska': 'NE',
        'Nevada': 'NV',
        'New Hampshire': 'NH',
        'New Jersey': 'NJ',
        'New Mexico': 'NM',
        'New York': 'NY',
        'North Carolina': 'NC',
        'North Dakota': 'ND',
        'Ohio': 'OH',
        'Oklahoma': 'OK',
        'Oregon': 'OR',
        'Pennsylvania': 'PA',
        'Rhode Island': 'RI',
        'South Carolina': 'SC',
        'South Dakota': 'SD',
        'Tennessee': 'TN',
        'Texas': 'TX',
        'Utah': 'UT',
        'Vermont': 'VT',
        'Virginia': 'VA',
        'Washington': 'WA',
        'West Virginia': 'WV',
        'Wisconsin': 'WI',
        'Wyoming': 'WY',
        'District of Columbia': 'DC'
    };

    return stateMap[stateName] || stateName;
}