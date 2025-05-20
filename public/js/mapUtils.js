/**
 * Map utility functions for RepRally HeatMap Center
 */

/**
 * Get color based on value within a range
 * @param {number} value - The value to get color for
 * @param {number} min - Minimum value in range
 * @param {number} max - Maximum value in range
 * @returns {string} Hex color string
 */
function getColorForValue(value, min, max) {
    // Define color stops from light to dark green
    const colorStops = [
        '#e5f5e0', // lightest green
        '#c7e9c0',
        '#a1d99b',
        '#74c476',
        '#41ab5d',
        '#238b45',
        '#005a32'  // darkest green
    ];
    
    // Return lightest color if value is at or below min
    if (value <= min) return colorStops[0];
    
    // Return darkest color if value is at or above max
    if (value >= max) return colorStops[colorStops.length - 1];
    
    // Calculate normalized position in range [0, 1]
    const normalizedValue = (value - min) / (max - min);
    
    // Calculate position in color array
    const position = normalizedValue * (colorStops.length - 1);
    const index = Math.floor(position);
    
    // If exact match, return the color
    if (index === position) return colorStops[index];
    
    // Otherwise, interpolate between two colors
    const nextIndex = Math.min(index + 1, colorStops.length - 1);
    const fraction = position - index; // decimal part
    
    return interpolateColor(colorStops[index], colorStops[nextIndex], fraction);
}

/**
 * Interpolate between two colors
 * @param {string} color1 - First color in hex format
 * @param {string} color2 - Second color in hex format
 * @param {number} fraction - Value between 0 and 1
 * @returns {string} Interpolated color
 */
function interpolateColor(color1, color2, fraction) {
    // Convert hex to RGB
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    
    // Interpolate each component
    const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * fraction);
    const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * fraction);
    const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * fraction);
    
    // Convert back to hex
    return rgbToHex(r, g, b);
}

/**
 * Convert hex color to RGB object
 * @param {string} hex - Hex color string
 * @returns {Object} Object with r, g, b properties
 */
function hexToRgb(hex) {
    // Remove # if present
    hex = hex.replace(/^#/, '');
    
    // Parse hex values
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    
    return { r, g, b };
}

/**
 * Convert RGB values to hex color string
 * @param {number} r - Red component (0-255)
 * @param {number} g - Green component (0-255)
 * @param {number} b - Blue component (0-255)
 * @returns {string} Hex color string
 */
function rgbToHex(r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * Calculate marker size based on GMV value
 * @param {number} gmv - Gross Merchandise Value
 * @param {number} minSize - Minimum marker size
 * @param {number} maxSize - Maximum marker size
 * @returns {number} Marker size
 */
function calculateMarkerSize(gmv, minSize = 5, maxSize = 15) {
    if (!gmv || gmv <= 0) return minSize;
    
    // Use logarithmic scale for better visualization
    const size = minSize + Math.log10(Math.max(1, gmv)) * 2;
    
    // Clamp the size between min and max
    return Math.max(minSize, Math.min(maxSize, size));
}

/**
 * Create a custom cross marker for sellers
 * @param {number} size - Size of the cross
 * @param {string} color - Color of the cross
 * @returns {L.DivIcon} Leaflet DivIcon
 */
function createCrossMarker(size, color = '#d73027') {
    return L.divIcon({
        html: `<div class="cross-marker" style="width: ${size}px; height: ${size}px; --marker-color: ${color};"></div>`,
        className: 'seller-marker',
        iconSize: [size, size]
    });
}

// Export map utility functions
window.mapUtils = {
    getColorForValue,
    calculateMarkerSize,
    createCrossMarker
};