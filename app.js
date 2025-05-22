import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import snowflake from 'snowflake-sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Snowflake connection
const snowflakeConnection = snowflake.createConnection({
  account: process.env.SNOWFLAKE_ACCOUNT,
  username: process.env.SNOWFLAKE_USER,
  password: process.env.SNOWFLAKE_PASSWORD,
  warehouse: process.env.SNOWFLAKE_WAREHOUSE,
  database: process.env.SNOWFLAKE_DATABASE,
  schema: process.env.SNOWFLAKE_SCHEMA,
  role: process.env.SNOWFLAKE_ROLE
});

// Connect to Snowflake
snowflakeConnection.connect((err) => {
  if (err) {
    console.error('Error connecting to Snowflake:', err);
  } else {
    // console.log('Successfully connected to Snowflake!');
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Create a specific route for the US states GeoJSON file
app.get('/data/us-states.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'data', 'us-states.json'));
});

// API endpoint to get state-level GMV data for heatmap
app.get('/api/states/gmv', (req, res) => {
  const query = `
    SELECT 
      STORE_STATE,
      SUM(GMV_LAST_MONTH) as TOTAL_GMV_LAST_MONTH,
      SUM(GMV_CURRENT_MONTH) as TOTAL_GMV_THIS_MONTH,
      COUNT(*) as STORE_COUNT
    FROM 
      STORES
    WHERE 
      STORE_STATE IS NOT NULL
    GROUP BY 
      STORE_STATE
    ORDER BY 
      TOTAL_GMV_LAST_MONTH DESC
  `;

  snowflakeConnection.execute({
    sqlText: query,
    complete: (err, stmt, rows) => {
      if (err) {
        console.error('Error executing query:', err);
        return res.status(500).json({ error: 'Failed to fetch data from Snowflake' });
      }
      
      res.json(rows);
    }
  });
});

// API endpoint to get stores and sellers for a specific state
app.get('/api/state/:state', (req, res) => {
  const state = req.params.state;
  
  const storesQuery = `
     SELECT 
      STORE_ID,
      STORE_LOCATION_NAME,
      LATITUDE,
      LONGITUDE,
      STORE_LIFETIME_GMV,
      GMV_LAST_MONTH,
      GMV_CURRENT_MONTH,
      SELLER_FIRST_NAME,
      SELLER_LAST_NAME,
      STORE_CITY,
      STORE_ADDRESS,
      CASE 
          WHEN STORE_FUNNEL_STATUS = 'visited and ordered past 30 days (active)' THEN 'Active'
          WHEN STORE_FUNNEL_STATUS = 'visited but no orders' THEN 'CheckInNoSales'
          WHEN STORE_FUNNEL_STATUS = 'visited and have orders (churned)' AND GMV_LAST_MONTH IS NOT NULL AND GMV_CURRENT_MONTH IS NULL THEN 'Cooled'
          WHEN STORE_FUNNEL_STATUS = 'visited and have orders (churned)' THEN 'Churned'
      END AS "Store Status"
  FROM 
      STORES
  WHERE 
      LATITUDE IS NOT NULL
      AND LONGITUDE IS NOT NULL
      AND SELLER_ID IS NOT NULL
      AND STORE_FUNNEL_STATUS != 'not visited'
      AND STORE_STATE = '${state}'
  `;
  
  const sellersQuery = `
   SELECT 
      s.SELLER_ID,
      s.LATITUDE,
      s.LONGITUDE,
      s.SELLER_TOTAL_GMV,
      s.SELLER_FIRST_NAME,
      s.SELLER_LAST_NAME,
      s.STORES_LAST_MONTH,
      s.STORES_MTD,
      s.GMV_LAST_MONTH,
      s.GMV_MTD,
      TO_VARCHAR(s.LAST_ORDER_AT, 'YYYY-MM-DD') AS LAST_ORDER_AT,
      DATEDIFF(DAY, s.LAST_ORDER_AT, CURRENT_DATE) AS DAYS_SINCE_LAST_ORDER,
      CASE 
        WHEN s.LAST_ORDER_AT >= CURRENT_DATE - INTERVAL '2 months' THEN 'Active Seller'
        ELSE 'Churned Seller'
      END AS SELLER_STATUS
    FROM 
      SELLERS s
    WHERE 
      s.SELLER_STATE = '${state}'
      AND s.LATITUDE IS NOT NULL
      AND s.LONGITUDE IS NOT NULL
      AND s.IS_ACCOUNT_ACTIVE = TRUE
  `;
  
  // Execute both queries
  snowflakeConnection.execute({
    sqlText: storesQuery,
    complete: (err, stmt, storeRows) => {
      if (err) {
        console.error('Error executing stores query:', err);
        return res.status(500).json({ error: 'Failed to fetch store data' });
      }
      
      snowflakeConnection.execute({
        sqlText: sellersQuery,
        complete: (err, stmt, sellerRows) => {
          if (err) {
            console.error('Error executing sellers query:', err);
            return res.status(500).json({ error: 'Failed to fetch seller data' });
          }
          
          res.json({
            stores: storeRows,
            sellers: sellerRows
          });
        }
      });
    }
  });
});

// API endpoint to get seller-store connections for network visualization
app.get('/api/seller/:sellerId/connections', async (req, res) => {
  const sellerId = req.params.sellerId;
  
  const query = `
    SELECT 
      s.SELLER_ID,
      s.LATITUDE AS SELLER_LATITUDE,
      s.LONGITUDE AS SELLER_LONGITUDE,
      st.STORE_ID,
      st.LATITUDE AS STORE_LATITUDE,
      st.LONGITUDE AS STORE_LONGITUDE,
      st.STORE_LIFETIME_GMV,
      st.STORE_CITY,
      st.STORE_ADDRESS
    FROM 
      SELLERS s
    JOIN 
      STORES st 
        ON s.SELLER_ID = st.SELLER_ID
    WHERE 
      s.SELLER_ID = ${sellerId}
      AND st.LATITUDE IS NOT NULL
      AND st.LONGITUDE IS NOT NULL
      AND s.LATITUDE IS NOT NULL
      AND s.LONGITUDE IS NOT NULL
      AND st.SELLER_ID IS NOT NULL
      AND st.STORE_FUNNEL_STATUS != 'not visited'

  `;
  
  // console.log("start time", new Date().toISOString());
  snowflakeConnection.execute({
    sqlText: query,
    complete: (err, stmt, rows) => {
      if (err) {
        console.error('Error executing query:', err);
        return res.status(500).json({ error: 'Failed to fetch connection data' });
      }
      
      // console.log("end time", new Date().toISOString());
      res.json(rows);
    }
  })
});

// API endpoint to get store-seller connections
app.get('/api/store/:storeId/connections', (req, res) => {
  const storeId = req.params.storeId;
  
  const query = `
    SELECT 
      st.STORE_ID,
      st.LATITUDE as STORE_LATITUDE,
      st.LONGITUDE as STORE_LONGITUDE,
      s.SELLER_ID,
      s.LATITUDE as SELLER_LATITUDE,
      s.LONGITUDE as SELLER_LONGITUDE,
      s.SELLER_FIRST_NAME,
      s.SELLER_LAST_NAME,
      st.STORE_LIFETIME_GMV
    FROM 
      STORES st
    JOIN 
      SELLERS s ON st.SELLER_ID = s.SELLER_ID
    WHERE 
      st.STORE_ID = ${storeId}
      AND st.LATITUDE IS NOT NULL
      AND st.LONGITUDE IS NOT NULL
      AND s.LATITUDE IS NOT NULL
      AND s.LONGITUDE IS NOT NULL
  `;
  
  snowflakeConnection.execute({
    sqlText: query,
    complete: (err, stmt, rows) => {
      if (err) {
        console.error('Error executing query:', err);
        return res.status(500).json({ error: 'Failed to fetch connection data' });
      }
      
      res.json(rows);
    }
  });
});

// API endpoint to search for sellers by name across all states
app.get('/api/sellers/search', (req, res) => {
  const searchTerm = req.query.name || '';
  
  if (!searchTerm.trim()) {
    return res.status(400).json({ error: 'Search term is required' });
  }
  
  const query = `
    SELECT 
      s.SELLER_ID,
      s.LATITUDE,
      s.LONGITUDE,
      s.SELLER_STATE,
      s.SELLER_TOTAL_GMV,
      s.SELLER_FIRST_NAME,
      s.SELLER_LAST_NAME,
      s.STORES_LAST_MONTH,
      s.STORES_MTD,
      s.GMV_LAST_MONTH,
      s.GMV_MTD,
      TO_VARCHAR(s.LAST_ORDER_AT, 'YYYY-MM-DD') AS LAST_ORDER_AT,
      DATEDIFF(DAY, s.LAST_ORDER_AT, CURRENT_DATE) AS DAYS_SINCE_LAST_ORDER,
      CASE 
        WHEN s.LAST_ORDER_AT >= CURRENT_DATE - INTERVAL '2 months' THEN 'Active Seller'
        ELSE 'Churned Seller'
      END AS SELLER_STATUS
    FROM 
      SELLERS s
    WHERE 
      (LOWER(s.SELLER_FIRST_NAME) LIKE LOWER('%${searchTerm}%') OR 
       LOWER(s.SELLER_LAST_NAME) LIKE LOWER('%${searchTerm}%') OR
       LOWER(CONCAT(s.SELLER_FIRST_NAME, ' ', s.SELLER_LAST_NAME)) LIKE LOWER('%${searchTerm}%'))
      AND s.LATITUDE IS NOT NULL
      AND s.LONGITUDE IS NOT NULL
      AND s.IS_ACCOUNT_ACTIVE = TRUE
    LIMIT 10
  `;
  
  snowflakeConnection.execute({
    sqlText: query,
    complete: (err, stmt, rows) => {
      if (err) {
        console.error('Error executing search query:', err);
        return res.status(500).json({ error: 'Failed to search sellers' });
      }
      
      res.json(rows);
    }
  });
});

// API endpoint to find sellers within a specified range of a store
app.get('/api/store/:storeId/nearby-sellers', (req, res) => {
  const storeId = req.params.storeId;
  const maxDistance = req.query.maxDistance || 200; // Default to 200 miles
  
  // console.log(`\n===== STARTING SELLER COVERAGE SEARCH =====`);
  // console.log(`Looking for sellers near store ID: ${storeId} within ${maxDistance} miles`);
  
  // First get the store location
  const storeQuery = `
    SELECT 
      STORE_ID,
      LATITUDE,
      LONGITUDE
    FROM 
      STORES
    WHERE 
      STORE_ID = ${storeId}
      AND LATITUDE IS NOT NULL
      AND LONGITUDE IS NOT NULL
  `;
  
  snowflakeConnection.execute({
    sqlText: storeQuery,
    complete: (err, stmt, storeRows) => {
      if (err) {
        console.error('Error executing store query:', err);
        return res.status(500).json({ error: 'Failed to fetch store data' });
      }
      
      if (storeRows.length === 0) {
        // console.log(`No store found with ID: ${storeId}`);
        return res.status(404).json({ error: 'Store not found' });
      }
      
      const store = storeRows[0];
      // console.log(`Found store at location: ${store.LATITUDE}, ${store.LONGITUDE}`);
      
      // Then find sellers within the specified distance
      const sellersQuery = `
        SELECT 
          s.SELLER_ID,
          s.LATITUDE,
          s.LONGITUDE,
          s.SELLER_TOTAL_GMV,
          s.SELLER_FIRST_NAME,
          s.SELLER_LAST_NAME,
          s.STORES_LAST_MONTH,
          s.STORES_MTD,
          s.GMV_LAST_MONTH,
          s.GMV_MTD,
          TO_VARCHAR(s.LAST_ORDER_AT, 'YYYY-MM-DD') AS LAST_ORDER_AT,
          DATEDIFF(DAY, s.LAST_ORDER_AT, CURRENT_DATE) AS DAYS_SINCE_LAST_ORDER,
          CASE 
            WHEN s.LAST_ORDER_AT >= CURRENT_DATE - INTERVAL '2 months' THEN 'Active Seller'
            ELSE 'Churned Seller'
          END AS SELLER_STATUS,
          HAVERSINE(s.LATITUDE, s.LONGITUDE, ${store.LATITUDE}, ${store.LONGITUDE}) AS DISTANCE_MILES
        FROM 
          SELLERS s
        WHERE 
          s.LATITUDE IS NOT NULL
          AND s.LONGITUDE IS NOT NULL
          AND s.IS_ACCOUNT_ACTIVE = TRUE
          AND s.LAST_ORDER_AT >= CURRENT_DATE - INTERVAL '2 months' -- Only active sellers
          AND HAVERSINE(s.LATITUDE, s.LONGITUDE, ${store.LATITUDE}, ${store.LONGITUDE}) <= ${maxDistance}
        ORDER BY 
          DISTANCE_MILES ASC
      `;
      
      snowflakeConnection.execute({
        sqlText: sellersQuery,
        complete: (err, stmt, sellerRows) => {
          if (err) {
            console.error('Error executing sellers query:', err);
            return res.status(500).json({ error: 'Failed to fetch seller data' });
          }
          
          // console.log(`Found ${sellerRows.length} sellers within ${maxDistance} miles of store ${storeId}`);
          
          // Process each seller to calculate their radius and check if store is within it
          const processAllSellers = async () => {
            const processedSellers = [];
            
            for (const seller of sellerRows) {
              // Fetch seller's connected stores to calculate their typical radius
              const connectionsQuery = `
                SELECT 
                  s.SELLER_ID,
                  s.LATITUDE as SELLER_LATITUDE,
                  s.LONGITUDE as SELLER_LONGITUDE,
                  st.STORE_ID,
                  st.LATITUDE as STORE_LATITUDE,
                  st.LONGITUDE as STORE_LONGITUDE
                FROM 
                  SELLERS s
                JOIN 
                  STORES st ON s.SELLER_ID = st.SELLER_ID
                WHERE 
                  s.SELLER_ID = ${seller.SELLER_ID}
                  AND st.LATITUDE IS NOT NULL
                  AND st.LONGITUDE IS NOT NULL
                  AND s.LATITUDE IS NOT NULL
                  AND s.LONGITUDE IS NOT NULL
              `;
              
              const connections = await new Promise((resolve) => {
                snowflakeConnection.execute({
                  sqlText: connectionsQuery,
                  complete: (err, stmt, rows) => {
                    if (err) {
                      console.error(`Error fetching connections for seller ${seller.SELLER_ID}:`, err);
                      resolve([]);
                    } else {
                      resolve(rows);
                    }
                  }
                });
              });
              
              // console.log(`Seller ${seller.SELLER_ID} has ${connections.length} connected stores`);
              
              // Calculate the 75th percentile distance if connections exist
              let radius = 50000; // Default radius in meters (about 30 miles)
              
              if (connections.length > 0) {
                const distances = connections.map(conn => {
                  // Simple distance calculation in meters (approximate)
                  const lat1 = conn.SELLER_LATITUDE * Math.PI / 180;
                  const lon1 = conn.SELLER_LONGITUDE * Math.PI / 180;
                  const lat2 = conn.STORE_LATITUDE * Math.PI / 180;
                  const lon2 = conn.STORE_LONGITUDE * Math.PI / 180;
                  
                  // Haversine formula
                  const dlon = lon2 - lon1;
                  const dlat = lat2 - lat1;
                  const a = Math.sin(dlat/2)**2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon/2)**2;
                  const c = 2 * Math.asin(Math.sqrt(a));
                  return 6371000 * c; // Earth radius in meters * c
                });
                
                // Sort distances
                distances.sort((a, b) => a - b);
                
                // Calculate 75th percentile
                const idx = Math.ceil(distances.length * 0.75) - 1;
                radius = distances[idx] || 50000;
              }
              
              // Check if the store is within this radius
              // Update the isInRadius check to include a small buffer (e.g., 2%)
              const distanceInMeters = seller.DISTANCE_MILES * 1609.34; // Convert miles to meters
              const bufferFactor = 1.05; // 2% buffer
              const isInRadius = distanceInMeters <= (radius * bufferFactor);

              // console.log(`  Distance to store: ${seller.DISTANCE_MILES.toFixed(2)} miles (${distanceInMeters.toFixed(2)} meters)`);
              // console.log(`  Calculated radius: ${(radius / 1609.34).toFixed(2)} miles (${radius.toFixed(2)} meters)`);
              // console.log(`  With buffer: ${((radius * bufferFactor) / 1609.34).toFixed(2)} miles`);
              // console.log(`  Store is ${isInRadius ? 'WITHIN' : 'OUTSIDE'} buffered radius`);
              // console.log(`Seller ${seller.SELLER_ID} (${seller.SELLER_FIRST_NAME} ${seller.SELLER_LAST_NAME}):`);
              // console.log(`  Distance to store: ${seller.DISTANCE_MILES.toFixed(2)} miles`);
              // console.log(`  Calculated radius: ${(radius / 1609.34).toFixed(2)} miles`);
              // console.log(`  Store is ${isInRadius ? 'WITHIN' : 'OUTSIDE'} radius`);
              
              // Add seller with radius info
              processedSellers.push({
                ...seller,
                radius,
                isInRadius
              });
            }
            
            return processedSellers;
          };
          
          processAllSellers().then(processedSellers => {
            // Log the final validation summary
            const coveringSellers = processedSellers.filter(s => s.isInRadius);
            
            // console.log('\n===== SELLER COVERAGE VALIDATION SUMMARY =====');
            // console.log(`Store ID: ${storeId}`);
            // console.log(`Total nearby sellers found: ${processedSellers.length}`);
            // console.log(`Sellers covering this store: ${coveringSellers.length}`);
            
            if (coveringSellers.length > 0) {
              // console.log('\nSellers covering this store:');
              coveringSellers.forEach(seller => {
                // console.log(`  - ${seller.SELLER_FIRST_NAME} ${seller.SELLER_LAST_NAME} (ID: ${seller.SELLER_ID})`);
                // console.log(`    Status: ${seller.SELLER_STATUS}`);
                // console.log(`    Distance: ${seller.DISTANCE_MILES.toFixed(2)} miles`);
                // console.log(`    Radius: ${(seller.radius / 1609.34).toFixed(2)} miles`);
              });
            } else {
              // console.log('No sellers cover this store.');
            }
            
            // Send the response
            res.json({
              store,
              sellers: processedSellers
            });
          }).catch(error => {
            console.error('Error processing sellers:', error);
            res.status(500).json({ error: 'Error processing sellers' });
          });
        }
      });
    }
  });
});

// Helper function for Snowflake to calculate Haversine distance in miles
snowflakeConnection.execute({
  sqlText: `
    CREATE OR REPLACE FUNCTION HAVERSINE(lat1 FLOAT, lon1 FLOAT, lat2 FLOAT, lon2 FLOAT)
    RETURNS FLOAT
    AS
    $$
      DECLARE
        radius FLOAT := 3959; -- Earth radius in miles
        dlat FLOAT;
        dlon FLOAT;
        a FLOAT;
        c FLOAT;
      BEGIN
        dlat := RADIANS(lat2 - lat1);
        dlon := RADIANS(lon2 - lon1);
        a := POWER(SIN(dlat/2), 2) + COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * POWER(SIN(dlon/2), 2);
        c := 2 * ASIN(SQRT(a));
        RETURN radius * c;
      END;
    $$;
  `,
  complete: (err, stmt) => {
    if (err) {
      console.error('Error creating Haversine function:', err);
    } else {
      // console.log('Haversine function created successfully');
    }
  }
});

// Handle SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  // console.log(`Server is running on port ${PORT}`);
});

// Handle process termination
process.on('exit', () => {
  if (snowflakeConnection) {
    snowflakeConnection.destroy();
    // console.log('Snowflake connection closed');
  }
});