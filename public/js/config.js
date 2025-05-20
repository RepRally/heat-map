/**
 * Configuration settings for RepRally HeatMap Center
 */

const CONFIG = {
    // Map configuration
    map: {
        initialView: {
            center: [37.8, -96],  // Center of US
            zoom: 4
        },
        stateView: {
            zoom: 6
        },
        tileLayer: {
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }
    },
    
    // Styling
    styles: {
        colors: {
            primary: '#005a32',
            secondary: '#1a9850',
            accent: '#fd8d3c',
            storeMarker: {
                Active: '#1a9850',        // Dark green for active stores
                Cooled: '#fd8d3c',        // Orange for cooled stores
                Churned: '#e31a1c',       // Red for churned stores
                CheckInNoSales: '#ff69b4' // Hot pink for check-in no sales
            },
            sellerMarker: {
                'Active Seller': '#1e88e5',  // Blue for active sellers
                'Churned Seller': '#614200'  // Brown for churned sellers
            },
            inactiveStore: '#808080',     // Gray for inactive stores
            connection: '#fd8d3c'
        },
        heatmap: {
            // Color range for heatmap from light to dark green
            range: ['#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#005a32']
        },
        markers: {
            store: {
                minRadius: 5,
                maxRadius: 15,
                color: '#1a9850',
                weight: 1,
                fillOpacity: 0.8
            },
            seller: {
                minSize: 10,
                maxSize: 20,
                color: '#d73027'
            },
            connection: {
                color: '#fd8d3c',
                weight: 2,
                opacity: 0.7,
                dashArray: '5, 10'
            }
        }
    },
    
    // Data display format
    format: {
        currency: {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        },
        number: {
            style: 'decimal',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }
    }
};

// Makes config accessible globally
window.CONFIG = CONFIG;