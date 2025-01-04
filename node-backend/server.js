const express = require('express');
const sql = require('mssql');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session'); // Import express-session

// Create an Express app
const app = express();
const port = 3000; // Ensure port is consistently 3000

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Set the 'views' folder for EJS templates

// Middleware for parsing form data (application/x-www-form-urlencoded)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // To handle JSON data if needed

// Session middleware configuration
app.use(session({
  secret: '123', // A secret key to sign the session ID cookie
  resave: false,             // Whether to save the session on every request
  saveUninitialized: true,   // Whether to save an uninitialized session (new sessions)
  cookie: { secure: false }  // Set to true if using HTTPS (for production)
}));

// Setup SQL Server connection
const config = {
  user: 'SA',
  password: 'C0mp2001!',
  server: 'localhost',
  port: 1433,
  database: 'TSCHotelDB',
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

// API endpoint to fetch data from SQL Server
app.get('/users', async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query('SELECT * FROM CW2.[User]');
    res.json(result.recordset);
  } catch (err) {
    console.error('Error querying SQL:', err);
    res.status(500).send({ message: 'Error retrieving data from database.' });
  }
});

// API endpoint to insert data into SQL Server
app.post('/signup', async (req, res) => {
  const { fullName, phoneNumber, email, password } = req.body;

  try {
    const pool = await sql.connect(config);

    // Fetch the last user ID (order by user_id descending and take the first record)
    const result = await pool.request().query('SELECT TOP 1 user_id FROM CW2.[User] ORDER BY user_id DESC');
    const lastUserId = result.recordset[0]?.user_id || 'U000'; // Default to 'U000' if no records are found

    // Extract numeric part from the last user ID (e.g., 'U001' becomes '001')
    let numericId = parseInt(lastUserId.replace(/\D/g, ''), 10); // Remove non-numeric characters and convert to number
    if (isNaN(numericId)) {
      numericId = 0; // Fallback if parseInt fails (e.g., if no users exist yet)
    }

    // Increment the last numeric user ID
    const nextIdNumber = numericId + 1;
    // Format the user ID to ensure it's always in the format 'U001', 'U002', etc.
    const userId = `U${nextIdNumber.toString().padStart(3, '0')}`;

    // Insert the new user into the database
    await pool.request()
      .input('userId', sql.VARCHAR, userId)
      .input('fullName', sql.NVarChar, fullName)
      .input('phoneNumber', sql.VARCHAR, phoneNumber)
      .input('email', sql.VARCHAR, email)
      .input('password', sql.VARCHAR, password)
      .query(
        'INSERT INTO CW2.[User] (user_id, full_name, phone_num, email_address, user_password) ' +
        'VALUES (@userId, @fullName, @phoneNumber, @email, @password)'
      );

      res.redirect('/signin'); // Update to use route instead of HTML file
  } catch (err) {
    console.error('Error inserting data:', err);
    res.status(500).send({ message: 'Error registering user. Please try again.' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const pool = await sql.connect(config);

    // Query the database to find the user with matching email and password
    const result = await pool.request()
      .input('email', sql.VARCHAR, email)
      .input('password', sql.VARCHAR, password)
      .query('SELECT * FROM CW2.[User] WHERE email_address = @email AND user_password = @password');

    if (result.recordset.length > 0) {
      // If user found, store the user_id in the session
      req.session.user_id = result.recordset[0].user_id;

      // Redirect to booking page (with user_id in session)
      res.redirect('/booking'); // Updated route without the .html extension
    } else {
      // If login fails, return error
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).send({ message: 'Error logging in. Please try again.' });
  }
});

// Render booking page using EJS
app.get('/booking', (req, res) => {
  const user_id = req.session.user_id;

  if (!user_id) {
    return res.redirect('/signin'); // Redirect to login if not logged in
  }

  // Render booking page with user_id as a dynamic value
  res.render('booking', { user_id: user_id });
});

app.post('/booking', async (req, res) => {
  const { room_id, guestname, guestemail, guestphonenum, checkindate, checkoutdate, bookingAmount } = req.body;
  const user_id = req.session.user_id; // Get the user_id from the session

  if (!user_id) {
    return res.status(401).send({ message: 'You must be logged in to make a booking.' });
  }

  try {
    const pool = await sql.connect(config);

    // Get the last booking ID to generate a new one
    const result = await pool.request().query('SELECT TOP 1 booking_id FROM CW1.[Booking] ORDER BY booking_id DESC');
    const lastBookingId = result.recordset[0]?.booking_id || 'B000';

    let numericId = parseInt(lastBookingId.replace(/\D/g, ''), 10); // Extract the numeric part of the last booking ID
    if (isNaN(numericId)) {
      numericId = 0;
    }

    const nextIdNumber = numericId + 1;
    const bookingId = `B${nextIdNumber.toString().padStart(3, '0')}`; // Format the new booking ID

    // Insert the new booking into the database
    await pool.request()
      .input('bookingId', sql.VARCHAR, bookingId)
      .input('room_id', sql.VARCHAR, room_id)
      .input('user_id', sql.VARCHAR, user_id) // user_id from session (logged-in user)
      .input('guestname', sql.VarChar, guestname)
      .input('guestemail', sql.VARCHAR, guestemail)
      .input('guestphonenum', sql.VARCHAR, guestphonenum)
      .input('checkindate', sql.Date, new Date(checkindate))
      .input('checkoutdate', sql.Date, new Date(checkoutdate))
      .input('booking_amount', sql.Decimal, bookingAmount)
      .input('booking_date', sql.Date, new Date()) // Current date as booking_date
      .query(
        'INSERT INTO CW2.[Booking] (booking_id, room_id, user_id, guest_name, guest_email, guest_phone_number, check_in_date, check_out_date, booking_amount, booking_date) ' +
        'VALUES (@bookingId, @room_id, @user_id, @guestname, @guestemail, @guestphonenum, @checkindate, @checkoutdate, @booking_amount, @booking_date)'
      );

    // After successful insertion, redirect the user to the view booking page
    res.redirect('/viewbooking'); // Updated route without the .html extension
  } catch (err) {
    console.error('Error inserting data:', err);
    res.status(500).send({ message: 'Error processing booking. Please try again.' });
  }
});

// Serve static files from the TSCHotel folder
const staticPath = path.join('C:', 'Users', 'User', 'OneDrive', 'Desktop', 'ASSESSMENT 2', 'TSCHotel');
app.use(express.static(staticPath));

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Serving static files from: ${staticPath}`);
});
