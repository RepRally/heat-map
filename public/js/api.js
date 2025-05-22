/**
 * API utility functions for RepRally HeatMap Center
 */

// API base URL
const API_BASE_URL = '';

/**
 * Fetch state-level GMV data for heatmap
 * @returns {Promise<Array>} Array of state GMV data
 */
async function fetchStatesGmvData() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/states/gmv`);

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching states GMV data:', error);
        throw error;
    }
}

/**
 * Fetch stores and sellers for a specific state
 * @param {string} stateAbbr - State abbreviation (e.g., 'CA', 'NY')
 * @returns {Promise<Object>} Object with stores and sellers arrays
 */
async function fetchStateData(stateAbbr) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/state/${stateAbbr}`);

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Error fetching data for state ${stateAbbr}:`, error);
        throw error;
    }
}

/**
 * Fetch seller-store connections for network visualization
 * @param {number} sellerId - Seller ID
 * @returns {Promise<Array>} Array of connection data
 */
async function fetchSellerConnections(sellerId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/seller/${sellerId}/connections`);

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Error fetching connections for seller ${sellerId}:`, error);
        throw error;
    }
}

// Export API functions
window.api = {
    fetchStatesGmvData,
    fetchStateData,
    fetchSellerConnections
};