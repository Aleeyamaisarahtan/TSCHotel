const express = require('express');
const sql = require('mssql');
const path = require('path');

// Create an Express app
const app = express();
const port = 3000;

// Setup SQL Server connection
const config = {
  user: 'SA',
  password: 'C0mp2001!',  
  server: 'localhost',   
  port:1433 ,     
  database: 'TSCHotelDB',  // Make sure this is set to the correct database
  options: {
    encrypt: true,  // For Azure SQL
    trustServerCertificate: true,  // Set to false if using a valid certificate
  }
};

// API endpoint to fetch data from SQL Server
app.get('/users', async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query('SELECT * FROM CW1.[User]');  // Correct table and schema
    res.json(result.recordset);  // Send data as JSON
  } catch (err) {
    console.error('Error querying SQL:', err);
    res.status(500).send('Error retrieving data');
  }
});

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '../')));  // Serve everything in the root folder

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
