const { query, getClient } = require('../config/db');

// Generate 10-digit PNR
function generatePNR() {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

// Fare multipliers by class
const classMultipliers = { 'SL': 1, '3A': 1.8, '2A': 2.5, '1A': 3.5 };

// POST /api/bookings — Book tickets (race-condition safe)
const createBooking = async (req, res) => {
  const client = await getClient();
  try {
    const { schedule_id, coach_class, booking_type, passengers, payment_method, transaction_id } = req.body;
    const userId = req.user.id;

    if (!schedule_id || !coach_class || !passengers || passengers.length === 0) {
      return res.status(400).json({ error: 'schedule_id, coach_class, and passengers are required' });
    }

    if (passengers.length > 6) {
      return res.status(400).json({ error: 'Maximum 6 passengers per booking' });
    }

    await client.query('BEGIN');


    await client.query('SELECT pg_advisory_xact_lock($1)', [schedule_id]);

    const scheduleResult = await client.query(
      `SELECT s.*, t.base_fare, t.departure_time, t.name AS train_name, t.train_number
       FROM schedules s
       JOIN trains t ON s.train_id = t.id
       WHERE s.id = $1 AND s.status = 'active'`,
      [schedule_id]
    );

    if (scheduleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Schedule not found or cancelled' });
    }

    const schedule = scheduleResult.rows[0];
    const isTatkal = booking_type === 'tatkal';

    if (isTatkal) {
      const journeyDate = new Date(schedule.journey_date);
      const now = new Date();

      const tatkalOpenDate = new Date(journeyDate);
      tatkalOpenDate.setDate(tatkalOpenDate.getDate() - 1);
      tatkalOpenDate.setHours(10, 0, 0, 0);

      if (now < tatkalOpenDate) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: `Tatkal booking opens at 10:00 AM on ${tatkalOpenDate.toDateString()}` 
        });
      }
    }

    // ─── Find Available Seats ───
    // Get all coaches of the requested class for this train
    const coachesResult = await client.query(
      `SELECT c.id, c.coach_number, c.total_seats FROM coaches c WHERE c.train_id = $1 AND c.class = $2`,
      [schedule.train_id, coach_class]
    );

    if (coachesResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `No ${coach_class} class available on this train` });
    }

    const coachIds = coachesResult.rows.map(c => c.id);

    // Find seats that are NOT already booked for this schedule
    let availableSeatsQuery;
    if (isTatkal) {
      // Tatkal: only tatkal-quota seats
      availableSeatsQuery = await client.query(`
        SELECT s.id, s.seat_number, s.berth_type, s.coach_id
        FROM seats s
        WHERE s.coach_id = ANY($1)
          AND s.is_tatkal_quota = true
          AND s.id NOT IN (
            SELECT bp.seat_id FROM booking_passengers bp
            JOIN bookings b ON bp.booking_id = b.id
            WHERE b.schedule_id = $2 AND b.status != 'cancelled' AND bp.status != 'cancelled' AND bp.seat_id IS NOT NULL
          )
        ORDER BY s.coach_id, s.seat_number
      `, [coachIds, schedule_id]);
    } else {
      // General: non-tatkal seats first, then tatkal seats if general are full
      availableSeatsQuery = await client.query(`
        SELECT s.id, s.seat_number, s.berth_type, s.coach_id
        FROM seats s
        WHERE s.coach_id = ANY($1)
          AND s.is_tatkal_quota = false
          AND s.id NOT IN (
            SELECT bp.seat_id FROM booking_passengers bp
            JOIN bookings b ON bp.booking_id = b.id
            WHERE b.schedule_id = $2 AND b.status != 'cancelled' AND bp.status != 'cancelled' AND bp.seat_id IS NOT NULL
          )
        ORDER BY s.coach_id, s.seat_number
      `, [coachIds, schedule_id]);
    }

    const availableSeats = availableSeatsQuery.rows;

    // Calculate fare
    const baseFare = parseFloat(schedule.base_fare);
    const multiplier = classMultipliers[coach_class] || 1;
    let farePerPassenger = baseFare * multiplier;
    if (isTatkal) {
      farePerPassenger *= 1.3; // 30% Tatkal surcharge
    }
    const totalFare = farePerPassenger * passengers.length;

    // Generate PNR
    let pnr;
    let pnrExists = true;
    while (pnrExists) {
      pnr = generatePNR();
      const check = await client.query('SELECT id FROM bookings WHERE pnr = $1', [pnr]);
      pnrExists = check.rows.length > 0;
    }

    // Determine booking status
    let bookingStatus = 'confirmed';
    const confirmedCount = Math.min(passengers.length, availableSeats.length);
    const waitlistedCount = passengers.length - confirmedCount;

    if (confirmedCount === 0) {
      bookingStatus = 'waitlisted';
    }

    // Get current max waitlist number for this schedule+class
    let maxWaitlist = 0;
    if (waitlistedCount > 0) {
      const wlResult = await client.query(`
        SELECT COALESCE(MAX(bp.waitlist_number), 0) AS max_wl
        FROM booking_passengers bp
        JOIN bookings b ON bp.booking_id = b.id
        WHERE b.schedule_id = $1 AND b.coach_class = $2 AND bp.status = 'waitlisted'
      `, [schedule_id, coach_class]);
      maxWaitlist = wlResult.rows[0].max_wl;
    }

    const txnId = transaction_id || `TXN${Math.floor(10000000 + Math.random() * 90000000)}`;
    const payMethod = payment_method || 'UPI';

    // Create booking record
    const bookingResult = await client.query(
      `INSERT INTO bookings (pnr, user_id, schedule_id, coach_class, booking_type, status, total_fare, payment_method, transaction_id, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'success') RETURNING *`,
      [pnr, userId, schedule_id, coach_class, booking_type || 'general', bookingStatus, totalFare, payMethod, txnId]
    );
    const booking = bookingResult.rows[0];

    // Create passenger records
    const passengerRecords = [];
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      const isConfirmed = i < confirmedCount;
      const seatId = isConfirmed ? availableSeats[i].id : null;
      const status = isConfirmed ? 'confirmed' : 'waitlisted';
      const waitlistNumber = isConfirmed ? null : (++maxWaitlist);

      const pResult = await client.query(
        `INSERT INTO booking_passengers (booking_id, name, age, gender, seat_id, berth_preference, status, waitlist_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [booking.id, p.name, p.age, p.gender, seatId, p.berth_preference || null, status, waitlistNumber]
      );
      passengerRecords.push(pResult.rows[0]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      booking: {
        ...booking,
        train_name: schedule.train_name,
        train_number: schedule.train_number,
        journey_date: schedule.journey_date,
      },
      passengers: passengerRecords,
      fare_breakdown: {
        base_fare: baseFare,
        class_multiplier: multiplier,
        tatkal_surcharge: isTatkal ? '30%' : 'N/A',
        fare_per_passenger: farePerPassenger,
        total_fare: totalFare,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Booking error:', err);
    res.status(500).json({ error: 'Booking failed. Please try again.' });
  } finally {
    client.release();
  }
};

const getMyBookings = async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        b.*, 
        t.name AS train_name, t.train_number, t.departure_time, t.arrival_time,
        s.journey_date,
        ss.code AS source_code, ss.name AS source_name,
        ds.code AS dest_code, ds.name AS dest_name
      FROM bookings b
      JOIN schedules s ON b.schedule_id = s.id
      JOIN trains t ON s.train_id = t.id
      JOIN stations ss ON t.source_station_id = ss.id
      JOIN stations ds ON t.destination_station_id = ds.id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC
    `, [req.user.id]);

    // Fetch passengers for each booking
    const bookings = [];
    for (const booking of result.rows) {
      const passengers = await query(
        `SELECT bp.*, s.seat_number, s.berth_type, c.coach_number
         FROM booking_passengers bp
         LEFT JOIN seats s ON bp.seat_id = s.id
         LEFT JOIN coaches c ON s.coach_id = c.id
         WHERE bp.booking_id = $1`,
        [booking.id]
      );
      bookings.push({ ...booking, passengers: passengers.rows });
    }

    res.json({ bookings });
  } catch (err) {
    console.error('Get bookings error:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
};

// GET /api/bookings/pnr/:pnr — PNR Status (public)
const getPNRStatus = async (req, res) => {
  try {
    const { pnr } = req.params;

    const result = await query(`
      SELECT 
        b.*, 
        t.name AS train_name, t.train_number, t.departure_time, t.arrival_time,
        s.journey_date,
        ss.code AS source_code, ss.name AS source_name,
        ds.code AS dest_code, ds.name AS dest_name,
        u.name AS passenger_name
      FROM bookings b
      JOIN schedules s ON b.schedule_id = s.id
      JOIN trains t ON s.train_id = t.id
      JOIN stations ss ON t.source_station_id = ss.id
      JOIN stations ds ON t.destination_station_id = ds.id
      JOIN users u ON b.user_id = u.id
      WHERE b.pnr = $1
    `, [pnr]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'PNR not found' });
    }

    const booking = result.rows[0];

    const passengers = await query(
      `SELECT bp.*, s.seat_number, s.berth_type, c.coach_number
       FROM booking_passengers bp
       LEFT JOIN seats s ON bp.seat_id = s.id
       LEFT JOIN coaches c ON s.coach_id = c.id
       WHERE bp.booking_id = $1`,
      [booking.id]
    );

    res.json({ booking, passengers: passengers.rows });
  } catch (err) {
    console.error('PNR status error:', err);
    res.status(500).json({ error: 'Failed to fetch PNR status' });
  }
};

// POST /api/bookings/:id/cancel — Cancel booking
const cancelBooking = async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await client.query('BEGIN');

    // Fetch booking
    const bookingResult = await client.query(
      'SELECT * FROM bookings WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];

    if (booking.status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Booking already cancelled' });
    }

    // Advisory lock to prevent race conditions during cancellation
    await client.query('SELECT pg_advisory_xact_lock($1)', [booking.schedule_id]);

    // Get the seats being freed
    const freedSeats = await client.query(
      `SELECT bp.seat_id FROM booking_passengers bp WHERE bp.booking_id = $1 AND bp.seat_id IS NOT NULL AND bp.status = 'confirmed'`,
      [id]
    );

    // Cancel booking and passengers
    await client.query('UPDATE bookings SET status = $1 WHERE id = $2', ['cancelled', id]);
    await client.query('UPDATE booking_passengers SET status = $1, seat_id = NULL WHERE booking_id = $2', ['cancelled', id]);

    // Calculate refund (no refund for tatkal)
    let refundAmount = 0;
    if (booking.booking_type !== 'tatkal') {
      refundAmount = parseFloat(booking.total_fare) * 0.75; // 75% refund
    }

    // ─── Auto-promote waitlisted passengers ───
    if (freedSeats.rows.length > 0) {
      const freedSeatIds = freedSeats.rows.map(r => r.seat_id);

      // Find waitlisted passengers for same schedule and class, ordered by waitlist number
      const waitlisted = await client.query(`
        SELECT bp.id AS passenger_id, bp.booking_id
        FROM booking_passengers bp
        JOIN bookings b ON bp.booking_id = b.id
        WHERE b.schedule_id = $1 AND b.coach_class = $2 AND bp.status = 'waitlisted'
        ORDER BY bp.waitlist_number ASC
        LIMIT $3
      `, [booking.schedule_id, booking.coach_class, freedSeatIds.length]);

      for (let i = 0; i < waitlisted.rows.length && i < freedSeatIds.length; i++) {
        const wl = waitlisted.rows[i];
        await client.query(
          'UPDATE booking_passengers SET status = $1, seat_id = $2, waitlist_number = NULL WHERE id = $3',
          ['confirmed', freedSeatIds[i], wl.passenger_id]
        );

        // Check if all passengers in the booking are now confirmed
        const remaining = await client.query(
          `SELECT COUNT(*) AS cnt FROM booking_passengers WHERE booking_id = $1 AND status = 'waitlisted'`,
          [wl.booking_id]
        );
        if (parseInt(remaining.rows[0].cnt) === 0) {
          await client.query('UPDATE bookings SET status = $1 WHERE id = $2', ['confirmed', wl.booking_id]);
        }
      }
    }

    await client.query('COMMIT');

    res.json({
      message: 'Booking cancelled successfully',
      refund: {
        amount: refundAmount,
        note: booking.booking_type === 'tatkal' ? 'No refund for Tatkal bookings' : '75% refund will be processed',
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Cancel booking error:', err);
    res.status(500).json({ error: 'Failed to cancel booking' });
  } finally {
    client.release();
  }
};

module.exports = { createBooking, getMyBookings, getPNRStatus, cancelBooking };
