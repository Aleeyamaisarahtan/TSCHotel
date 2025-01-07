const express = require('express');
const sql = require('mssql');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session'); 
const methodOverride = require('method-override');

const app = express();
const port = 3000; 

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); 
app.use(methodOverride('_method'));

app.use(session({
  secret: '123', 
  resave: false,             
  saveUninitialized: true,   
  cookie: { secure: false }  
}));

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


app.post('/signup', async (req, res) => {
  const { fullName, phoneNumber, email, password } = req.body;

  try {
    const pool = await sql.connect(config);

    
    const result = await pool.request().query('SELECT TOP 1 user_id FROM CW2.[User] ORDER BY user_id DESC');
    const lastUserId = result.recordset[0]?.user_id || 'U000'; 
    
    let numericId = parseInt(lastUserId.replace(/\D/g, ''), 10); 

    if (isNaN(numericId)) {
      numericId = 0; 
    }

    
    const nextIdNumber = numericId + 1;
    
    const userId = `U${nextIdNumber.toString().padStart(3, '0')}`;

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

      res.redirect('/signin.html'); 
  } catch (err) {
    console.error('Error inserting data:', err);
    res.status(500).send({ message: 'Error registering user. Please try again.' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const pool = await sql.connect(config);

    const result = await pool.request()
      .input('email', sql.VARCHAR, email)
      .input('password', sql.VARCHAR, password)
      .query('SELECT * FROM CW2.[User] WHERE email_address = @email AND user_password = @password');

    if (result.recordset.length > 0) {
      req.session.user_id = result.recordset[0].user_id;

      res.redirect('/homepage.html'); 
    } else {

      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).send({ message: 'Error logging in. Please try again.' });
  }
});

app.get('/booking', (req, res) => {
  const user_id = req.session.user_id;

  if (!user_id) {
    return res.redirect('/signin.html'); 
  }

  res.sendFile(path.join(__dirname, 'booking.html'));
});

app.post('/booking', async (req, res) => {
  const { room_id, guestname, guestemail, guestphonenum, checkindate, checkoutdate, bookingAmount } = req.body;
  const user_id = req.session.user_id;

  if (!user_id) {
    return res.status(401).send({ message: 'You must be logged in to make a booking.' });
  }

  try {
    const pool = await sql.connect(config);

    console.log('Booking Input:', { room_id, guestname, guestemail, guestphonenum, checkindate, checkoutdate, bookingAmount });

    const roomResult = await pool.request()
      .input('room_id', sql.VARCHAR, room_id)
      .query('SELECT * FROM CW2.[Room] WHERE room_id = @room_id');

    console.log('Room Query Result:', roomResult.recordset);

    if (roomResult.recordset.length === 0) {
      return res.status(404).send({ message: 'Selected room is not available.' });
    }

    const bookingResult = await pool.request().query('SELECT TOP 1 booking_id FROM CW2.[Booking] ORDER BY booking_id DESC');
    const lastBookingId = bookingResult.recordset[0]?.booking_id || 'B000';

    const numericId = parseInt(lastBookingId.replace(/\D/g, ''), 10) || 0;
    const nextIdNumber = numericId + 1;
    const bookingId = `B${nextIdNumber.toString().padStart(3, '0')}`;

    await pool.request()
      .input('bookingId', sql.VARCHAR, bookingId)
      .input('room_id', sql.VARCHAR, room_id)
      .input('user_id', sql.VARCHAR, user_id)
      .input('guestname', sql.VarChar, guestname)
      .input('guestemail', sql.VARCHAR, guestemail)
      .input('guestphonenum', sql.VARCHAR, guestphonenum)
      .input('checkindate', sql.Date, new Date(checkindate))
      .input('checkoutdate', sql.Date, new Date(checkoutdate))
      .input('bookingAmount', sql.Decimal, bookingAmount)
      .input('bookingDate', sql.Date, new Date())
      .query(
        'INSERT INTO CW2.[Booking] (booking_id, room_id, user_id, guest_name, guest_email, guest_phone_number, check_in_date, check_out_date, booking_amount, booking_date) ' +
        'VALUES (@bookingId, @room_id, @user_id, @guestname, @guestemail, @guestphonenum, @checkindate, @checkoutdate, @bookingAmount, @bookingDate)'
      );

    res.redirect('/viewbooking.html');
  } catch (err) {
    console.error('Error processing booking:', err);
    res.status(500).send({ message: 'Error processing booking. Please try again.', error: err.message });
  }
});

app.get('/rooms', async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query('SELECT room_id, room_price FROM CW2.[Room]'); 
    res.json(result.recordset); 
  } catch (err) {
    console.error('Error fetching rooms:', err);
    res.status(500).send({ message: 'Error fetching rooms from database.' });
  }
});


app.get('/viewbooking', async (req, res) => {
  const user_id = req.session.user_id;

  if (!user_id) {
    return res.redirect('/signin.html'); 
  }

  try {
    const pool = await sql.connect(config);

    const result = await pool.request()
      .input('user_id', sql.VARCHAR, user_id)
      .query(`
        SELECT booking_id, room_id, guest_name, guest_email, guest_phone_number, 
               check_in_date, check_out_date, booking_amount, booking_date 
        FROM CW2.[Booking] 
        WHERE user_id = @user_id
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).send({ message: 'Error fetching bookings from the database.' });
  }
});

app.delete('/deletebooking/:booking_id', async (req, res) => {
  const { booking_id } = req.params;
  
  try {
    const pool = await sql.connect(config);
    const transaction = new sql.Transaction(pool);

    await transaction.begin(); 

     await transaction.request()
      .input('booking_id', sql.VARCHAR, booking_id)
      .query('DELETE FROM CW2.[Payment] WHERE booking_id = @booking_id');

    await transaction.request()
      .input('booking_id', sql.VARCHAR, booking_id)
      .query('DELETE FROM CW2.[Booking] WHERE booking_id = @booking_id');

await transaction.commit();
    
    res.status(200).send({ message: 'Booking deleted successfully.' });
  } catch (err) {
    console.error('Error deleting booking:', err);
    res.status(500).send({ message: 'Error deleting booking.' });
  }
});

app.get('/data', async (req, res) => {
  const bookingId = req.query.booking_id; 

  if (!bookingId) {
    return res.status(400).send('Booking ID is required');
  }

  try {
    await sql.connect(config);
    
    const result = await sql.query`SELECT * FROM CW2.Booking WHERE booking_id = ${bookingId}`;
    
    if (result.recordset.length > 0) {
      res.json(result.recordset);
    } else {
      res.status(404).send('Booking not found');
    }
  } catch (err) {
    console.error('Error querying the database:', err);
    res.status(500).send('Error querying the database');
  }
});


app.post('/payment', async (req, res) => {
  const { bookingId, paymentMethod, paymentAmount } = req.body;

  try {
    const pool = await sql.connect(config);
    const existingPaymentResult = await pool.request()
      .input('bookingId', sql.VARCHAR, bookingId)
      .query('SELECT COUNT(*) AS paymentCount FROM CW2.[Payment] WHERE booking_id = @bookingId');
    
    if (existingPaymentResult.recordset[0].paymentCount > 0) {
      return res.status(400).send({ message: 'Payment already made for this booking.' });
    }

    const paymentResult = await pool.request().query('SELECT TOP 1 payment_id FROM CW2.[Payment] ORDER BY payment_id DESC');
    const lastPaymentId = paymentResult.recordset[0]?.payment_id || 'P000';
    const numericId = parseInt(lastPaymentId.replace(/\D/g, ''), 10) || 0;
    const nextIdNumber = numericId + 1;
    const paymentId = `P${nextIdNumber.toString().padStart(3, '0')}`;

    // Process the payment
    await pool.request()
      .input('paymentId', sql.VARCHAR, paymentId)
      .input('bookingId', sql.VARCHAR, bookingId)
      .input('paymentDate', sql.DATE, new Date())
      .input('paymentAmount', sql.Decimal(18, 2), paymentAmount)  
      .input('paymentMethod', sql.VARCHAR, paymentMethod)
      .query(`
        INSERT INTO CW2.[Payment](payment_id, booking_id, payment_date, payment_amount, payment_method)
        VALUES (@paymentId, @bookingId, @paymentDate, @paymentAmount, @paymentMethod);
      `);

     res.send({ message: 'Payment successful!' });
  } catch (err) {
    console.error('Error processing payment:', err);
    res.status(500).send({ message: 'Error processing payment. Please try again.', error: err.message });
  }
});

app.post('/data/update/:booking_id', async (req, res) => {
  const booking_id = req.params.booking_id; 
  console.log("Incoming Request Body:", req.body);

  // Log the fields to pinpoint the issue
  console.log("booking_id:", booking_id);
  console.log("room_id:", req.body.room_id);
  console.log("guestname:", req.body.guestname);
  console.log("guestemail:", req.body.guestemail);
  console.log("guestphonenum:", req.body.guestphonenum);
  console.log("checkindate:", req.body.checkindate);
  console.log("checkoutdate:", req.body.checkoutdate);
  console.log("bookingAmount:", req.body.bookingAmount);

  if (req.body._method === 'PUT') {
    const { room_id, guestname, guestemail, guestphonenum, checkindate, checkoutdate, bookingAmount } = req.body;

    // Check if all required fields are provided
    if (!room_id || !guestname || !guestemail || !guestphonenum || !checkindate || !checkoutdate || !bookingAmount) {
      return res.status(400).send({ message: 'All fields are required. Please fill in all the fields.' });
    }

    try {
      const pool = await sql.connect(config);

      // Check if the room exists in the Room table
      const roomResult = await pool.request()
        .input('room_id', sql.VARCHAR, room_id)
        .query('SELECT * FROM CW2.[Room] WHERE room_id = @room_id');

      if (roomResult.recordset.length === 0) {
        return res.status(400).send({ message: 'Invalid room selected. Please try again.' });
      }

      // Attempt to update the booking
      const updateResult = await pool.request()
        .input('booking_id', sql.VARCHAR, booking_id)  
        .input('room_id', sql.VARCHAR, room_id)
        .input('guestname', sql.VARCHAR, guestname)
        .input('guestemail', sql.VARCHAR, guestemail)
        .input('guestphonenum', sql.VARCHAR, guestphonenum)
        .input('checkindate', sql.DATE, new Date(checkindate))
        .input('checkoutdate', sql.DATE, new Date(checkoutdate))
        .input('bookingAmount', sql.DECIMAL, bookingAmount)
        .query(`
          UPDATE CW2.[Booking]
          SET 
            room_id = @room_id,
            guest_name = @guestname,
            guest_email = @guestemail,
            guest_phone_number = @guestphonenum,
            check_in_date = @checkindate,
            check_out_date = @checkoutdate,
            booking_amount = @bookingAmount
          WHERE booking_id = @booking_id
        `);

      console.log('Rows affected:', updateResult.rowsAffected[0]);

      
      if (updateResult.rowsAffected[0] > 0) {
        res.redirect('/viewbooking.html'); 
      } else {
        res.status(400).send({ message: 'Booking update failed. Please try again.' });
      }

    } catch (err) {
      
      console.error('Error updating booking:', err);
      res.status(500).send({ message: 'Error updating booking. Please try again.' });
    }
  } else {
    
    res.status(400).send({ message: 'Invalid request method. Please use PUT.' });
  }
});

app.get('/viewroom', async (req, res) => {
  try {
    
    const pool = await sql.connect(config);

    
    const result = await pool.request().query('SELECT * FROM CW2.[Room]'); 

    
    res.json(result.recordset);
  } catch (error) {

    console.error('Error fetching rooms:', error);
    res.status(500).send({ message: 'Error fetching room data.' });
  }
});


const staticPath = path.join('C:', 'Users', 'User', 'OneDrive', 'Desktop', 'ASSESSMENT 2', 'TSCHotel');
app.use(express.static(staticPath));


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Serving static files from: ${staticPath}`);
});
