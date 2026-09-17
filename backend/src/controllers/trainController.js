const { query, getClient } = require('../config/db');

// GET /api/trains/search?from=&to=&date=&class=
const searchTrains = async (req, res) => {
  try {
    const { from, to, date } = req.query;
    if (!from || !to || !date) {
      return res.status(400).json({ error: 'from, to, and date are required' });
    }

    const fromCode = from.toUpperCase();
    const toCode = to.toUpperCase();

    // Auto-ensure schedules exist for active trains running between these stations on requested date
    await query(`
      INSERT INTO schedules (train_id, journey_date)
      SELECT t.id, $3::date
      FROM trains t
      JOIN stations ss ON t.source_station_id = ss.id
      JOIN stations ds ON t.destination_station_id = ds.id
      WHERE ss.code = $1 AND ds.code = $2 AND t.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM schedules s2 WHERE s2.train_id = t.id AND s2.journey_date = $3::date
        )
    `, [fromCode, toCode, date]);

    const result = await query(`
      SELECT 
        t.id, t.train_number, t.name, t.train_type, t.departure_time, t.arrival_time, t.base_fare,
        ss.code AS source_code, ss.name AS source_name, ss.city AS source_city,
        ds.code AS dest_code, ds.name AS dest_name, ds.city AS dest_city,
        s.id AS schedule_id, TO_CHAR(s.journey_date, 'YYYY-MM-DD') AS journey_date, s.status AS schedule_status
      FROM trains t
      JOIN stations ss ON t.source_station_id = ss.id
      JOIN stations ds ON t.destination_station_id = ds.id
      JOIN schedules s ON s.train_id = t.id AND s.journey_date = $3::date
      WHERE ss.code = $1 AND ds.code = $2 AND t.is_active = true AND s.status = 'active'
      ORDER BY t.departure_time
    `, [fromCode, toCode, date]);

    // Get seat availability for each train
    const trains = [];
    for (const train of result.rows) {
      const availability = await query(`
        SELECT 
          c.class,
          c.total_seats,
          c.total_seats - COUNT(bp.id) FILTER (WHERE bp.status = 'confirmed') AS available,
          COUNT(bp.id) FILTER (WHERE bp.status = 'waitlisted') AS waitlisted
        FROM coaches c
        LEFT JOIN seats seat ON seat.coach_id = c.id
        LEFT JOIN booking_passengers bp ON bp.seat_id = seat.id 
          AND bp.booking_id IN (
            SELECT b.id FROM bookings b WHERE b.schedule_id = $1 AND b.status != 'cancelled'
          )
        WHERE c.train_id = $2
        GROUP BY c.class, c.total_seats
      `, [train.schedule_id, train.id]);

      // Aggregate by class
      const classAvailability = {};
      availability.rows.forEach(row => {
        if (!classAvailability[row.class]) {
          classAvailability[row.class] = { total: 0, available: 0, waitlisted: 0 };
        }
        classAvailability[row.class].total += parseInt(row.total_seats);
        classAvailability[row.class].available += parseInt(row.available);
        classAvailability[row.class].waitlisted += parseInt(row.waitlisted);
      });

      trains.push({ ...train, availability: classAvailability });
    }

    res.json({ trains });
  } catch (err) {
    console.error('Search trains error:', err);
    res.status(500).json({ error: 'Failed to search trains' });
  }
};

// GET /api/trains/:id
const getTrainDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT 
        t.*, 
        ss.code AS source_code, ss.name AS source_name,
        ds.code AS dest_code, ds.name AS dest_name
      FROM trains t
      JOIN stations ss ON t.source_station_id = ss.id
      JOIN stations ds ON t.destination_station_id = ds.id
      WHERE t.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Train not found' });
    }

    const train = result.rows[0];

    // Get stops
    const stops = await query(`
      SELECT ts.*, s.code, s.name, s.city 
      FROM train_stops ts
      JOIN stations s ON ts.station_id = s.id
      WHERE ts.train_id = $1
      ORDER BY ts.stop_sequence
    `, [id]);

    // Get coaches
    const coaches = await query(`
      SELECT * FROM coaches WHERE train_id = $1 ORDER BY coach_number
    `, [id]);

    res.json({ train, stops: stops.rows, coaches: coaches.rows });
  } catch (err) {
    console.error('Get train error:', err);
    res.status(500).json({ error: 'Failed to get train details' });
  }
};

// GET /api/trains — List all trains (for admin)
const getAllTrains = async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        t.*, 
        ss.code AS source_code, ss.name AS source_name,
        ds.code AS dest_code, ds.name AS dest_name
      FROM trains t
      JOIN stations ss ON t.source_station_id = ss.id
      JOIN stations ds ON t.destination_station_id = ds.id
      ORDER BY t.train_number
    `);
    res.json({ trains: result.rows });
  } catch (err) {
    console.error('Get all trains error:', err);
    res.status(500).json({ error: 'Failed to fetch trains' });
  }
};

// POST /api/admin/trains — Admin: Add train
const addTrain = async (req, res) => {
  const client = await getClient();
  try {
    const {
      train_number,
      number,
      name,
      train_type,
      source_station_code,
      source_station_id,
      destination_station_code,
      destination_station_id,
      departure_time,
      arrival_time,
      base_fare
    } = req.body;

    const tNumber = train_number || number;
    if (!tNumber || !name || (!source_station_code && !source_station_id) || (!destination_station_code && !destination_station_id) || !departure_time || !arrival_time) {
      return res.status(400).json({ error: 'All train fields are required (train number, name, source, destination, timings)' });
    }

    await client.query('BEGIN');

    // Get source station ID
    let srcId = source_station_id;
    if (!srcId && source_station_code) {
      const srcRes = await client.query('SELECT id FROM stations WHERE code = $1', [source_station_code.toUpperCase()]);
      if (srcRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Source station '${source_station_code}' not found` });
      }
      srcId = srcRes.rows[0].id;
    }

    // Get destination station ID
    let destId = destination_station_id;
    if (!destId && destination_station_code) {
      const destRes = await client.query('SELECT id FROM stations WHERE code = $1', [destination_station_code.toUpperCase()]);
      if (destRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Destination station '${destination_station_code}' not found` });
      }
      destId = destRes.rows[0].id;
    }

    const validTypes = ['Express', 'Superfast', 'Rajdhani', 'Shatabdi', 'Duronto', 'Vande Bharat', 'Garib Rath'];
    const tType = validTypes.includes(train_type) ? train_type : 'Express';

    // Drop old constraint if restricted
    try {
      await client.query(`ALTER TABLE trains DROP CONSTRAINT IF EXISTS trains_train_type_check;`);
    } catch (_) {}

    const result = await client.query(
      `INSERT INTO trains (train_number, name, train_type, source_station_id, destination_station_id, departure_time, arrival_time, base_fare, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING *`,
      [tNumber, name, tType, srcId, destId, departure_time, arrival_time, base_fare || 500]
    );
    const trainId = result.rows[0].id;

    // Create default coaches & bulk insert seats
    const coachConfigs = [
      { number: 'S1', class: 'SL', seats: 72 },
      { number: 'S2', class: 'SL', seats: 72 },
      { number: 'A1', class: '3A', seats: 64 },
      { number: 'B1', class: '2A', seats: 46 },
      { number: 'H1', class: '1A', seats: 24 },
    ];

    const berths = ['lower', 'middle', 'upper', 'side-lower', 'side-upper'];

    for (const coach of coachConfigs) {
      const coachResult = await client.query(
        `INSERT INTO coaches (train_id, coach_number, class, total_seats) VALUES ($1, $2, $3, $4) RETURNING id`,
        [trainId, coach.number, coach.class, coach.seats]
      );
      const coachId = coachResult.rows[0].id;

      const tatkalCount = Math.ceil(coach.seats * 0.1);
      const seatValues = [];
      const seatParams = [];

      for (let s = 1; s <= coach.seats; s++) {
        const berthType = berths[(s - 1) % berths.length];
        const isTatkal = s > (coach.seats - tatkalCount);
        const offset = seatParams.length;
        seatValues.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
        seatParams.push(coachId, s, berthType, isTatkal);
      }

      await client.query(
        `INSERT INTO seats (coach_id, seat_number, berth_type, is_tatkal_quota) VALUES ${seatValues.join(', ')}`,
        seatParams
      );
    }

    // Create 30-day schedules in bulk
    await client.query(
      `INSERT INTO schedules (train_id, journey_date)
       SELECT $1, (CURRENT_DATE + (i || ' day')::interval)::date
       FROM generate_series(0, 29) i
       ON CONFLICT (train_id, journey_date) DO NOTHING`,
      [trainId]
    );

    await client.query('COMMIT');

    // Fetch the full train with station info
    const fullTrain = await query(`
      SELECT t.*, ss.code AS source_code, ss.name AS source_name, ds.code AS dest_code, ds.name AS dest_name
      FROM trains t
      JOIN stations ss ON t.source_station_id = ss.id
      JOIN stations ds ON t.destination_station_id = ds.id
      WHERE t.id = $1
    `, [trainId]);

    res.status(201).json({ train: fullTrain.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Train number already exists' });
    }
    console.error('Add train error:', err);
    res.status(500).json({ error: 'Failed to add train: ' + err.message });
  } finally {
    client.release();
  }
};

// PUT /api/admin/trains/:id — Admin: Update train
const updateTrain = async (req, res) => {
  try {
    const { id } = req.params;
    const { train_number, number, name, train_type, departure_time, arrival_time, base_fare, is_active } = req.body;

    const tNumber = train_number || number;

    const result = await query(
      `UPDATE trains SET 
        train_number = COALESCE($1, train_number),
        name = COALESCE($2, name),
        train_type = COALESCE($3, train_type),
        departure_time = COALESCE($4, departure_time),
        arrival_time = COALESCE($5, arrival_time),
        base_fare = COALESCE($6, base_fare),
        is_active = COALESCE($7, is_active)
      WHERE id = $8 RETURNING *`,
      [tNumber, name, train_type, departure_time, arrival_time, base_fare, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Train not found' });
    }

    res.json({ train: result.rows[0] });
  } catch (err) {
    console.error('Update train error:', err);
    res.status(500).json({ error: 'Failed to update train: ' + err.message });
  }
};

// DELETE /api/admin/trains/:id — Admin: Delete or deactivate train
const deleteTrain = async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    await client.query('BEGIN');

    // Check if bookings exist for this train
    const hasBookings = await client.query(
      `SELECT 1 FROM bookings b JOIN schedules s ON b.schedule_id = s.id WHERE s.train_id = $1 LIMIT 1`,
      [id]
    );

    if (hasBookings.rows.length === 0) {
      // Hard delete
      await client.query(`DELETE FROM seats WHERE coach_id IN (SELECT id FROM coaches WHERE train_id = $1)`, [id]);
      await client.query(`DELETE FROM coaches WHERE train_id = $1`, [id]);
      await client.query(`DELETE FROM train_stops WHERE train_id = $1`, [id]);
      await client.query(`DELETE FROM schedules WHERE train_id = $1`, [id]);
      await client.query(`DELETE FROM trains WHERE id = $1`, [id]);
      await client.query('COMMIT');
      return res.json({ message: 'Train permanently deleted' });
    } else {
      // Soft delete / deactivate
      await client.query(`UPDATE trains SET is_active = false WHERE id = $1`, [id]);
      await client.query(`UPDATE schedules SET status = 'cancelled' WHERE train_id = $1 AND journey_date >= CURRENT_DATE`, [id]);
      await client.query('COMMIT');
      return res.json({ message: 'Train deactivated due to existing bookings' });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete train error:', err);
    res.status(500).json({ error: 'Failed to delete train: ' + err.message });
  } finally {
    client.release();
  }
};

module.exports = { searchTrains, getTrainDetails, getAllTrains, addTrain, updateTrain, deleteTrain };
