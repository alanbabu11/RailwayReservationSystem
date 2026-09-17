const { query, getClient } = require('./db');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // ─── Create Tables ───
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        phone VARCHAR(15),
        password VARCHAR(255) NOT NULL,
        role VARCHAR(10) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS stations (
        id SERIAL PRIMARY KEY,
        code VARCHAR(10) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        city VARCHAR(100) NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS trains (
        id SERIAL PRIMARY KEY,
        train_number VARCHAR(10) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        train_type VARCHAR(20) DEFAULT 'Express' CHECK (train_type IN ('Express', 'Superfast', 'Rajdhani', 'Shatabdi', 'Duronto')),
        source_station_id INTEGER REFERENCES stations(id),
        destination_station_id INTEGER REFERENCES stations(id),
        departure_time TIME NOT NULL,
        arrival_time TIME NOT NULL,
        base_fare DECIMAL(10,2) DEFAULT 500.00,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS train_stops (
        id SERIAL PRIMARY KEY,
        train_id INTEGER REFERENCES trains(id) ON DELETE CASCADE,
        station_id INTEGER REFERENCES stations(id),
        stop_sequence INTEGER NOT NULL,
        arrival_time TIME,
        departure_time TIME,
        UNIQUE(train_id, stop_sequence)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS coaches (
        id SERIAL PRIMARY KEY,
        train_id INTEGER REFERENCES trains(id) ON DELETE CASCADE,
        coach_number VARCHAR(10) NOT NULL,
        class VARCHAR(5) NOT NULL CHECK (class IN ('SL', '3A', '2A', '1A')),
        total_seats INTEGER NOT NULL,
        UNIQUE(train_id, coach_number)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS seats (
        id SERIAL PRIMARY KEY,
        coach_id INTEGER REFERENCES coaches(id) ON DELETE CASCADE,
        seat_number INTEGER NOT NULL,
        berth_type VARCHAR(15) CHECK (berth_type IN ('lower', 'middle', 'upper', 'side-lower', 'side-upper')),
        is_tatkal_quota BOOLEAN DEFAULT false,
        UNIQUE(coach_id, seat_number)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schedules (
        id SERIAL PRIMARY KEY,
        train_id INTEGER REFERENCES trains(id) ON DELETE CASCADE,
        journey_date DATE NOT NULL,
        status VARCHAR(15) DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
        UNIQUE(train_id, journey_date)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        pnr VARCHAR(10) UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id),
        schedule_id INTEGER REFERENCES schedules(id),
        coach_class VARCHAR(5) NOT NULL,
        booking_type VARCHAR(10) DEFAULT 'general' CHECK (booking_type IN ('general', 'tatkal')),
        status VARCHAR(15) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'waitlisted', 'cancelled')),
        total_fare DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(30) DEFAULT 'UPI',
        transaction_id VARCHAR(50),
        payment_status VARCHAR(20) DEFAULT 'success',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30) DEFAULT 'UPI';
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(50);
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'success';
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS booking_passengers (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        age INTEGER NOT NULL,
        gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
        seat_id INTEGER REFERENCES seats(id),
        berth_preference VARCHAR(15),
        status VARCHAR(15) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'waitlisted', 'RAC', 'cancelled')),
        waitlist_number INTEGER
      );
    `);

    // Create indexes for performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_schedules_train_date ON schedules(train_id, journey_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_bookings_pnr ON bookings(pnr);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_bookings_schedule ON bookings(schedule_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_booking_passengers_booking ON booking_passengers(booking_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_seats_coach ON seats(coach_id);`);

    // ─── Seed Admin User ───
    const hashedPassword = await bcrypt.hash('Admin@123', 10);
    await client.query(
      `INSERT INTO users (name, email, phone, password, role) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET password = $4, role = $5`,
      ['Railway Admin', 'admin@railway.com', '9999999999', hashedPassword, 'admin']
    );
    console.log('✅ Admin user seeded (admin@railway.com / Admin@123)');

    // ─── Seed Stations ───
    const stationsData = [
      ['NDLS', 'New Delhi', 'Delhi'],
      ['CSMT', 'Chhatrapati Shivaji Maharaj Terminus', 'Mumbai'],
      ['MAS', 'Chennai Central', 'Chennai'],
      ['HWH', 'Howrah Junction', 'Kolkata'],
      ['SBC', 'Krantivira Sangolli Rayanna', 'Bangalore'],
      ['JP', 'Jaipur Junction', 'Jaipur'],
      ['LKO', 'Lucknow Charbagh', 'Lucknow'],
      ['ADI', 'Ahmedabad Junction', 'Ahmedabad'],
    ];

    for (const [code, name, city] of stationsData) {
      await client.query(
        `INSERT INTO stations (code, name, city) VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET name = $2, city = $3`,
        [code, name, city]
      );
    }
    console.log('✅ Stations seeded');

    // Fetch station map
    const stationRows = await client.query(`SELECT id, code, city FROM stations`);
    const stationMap = {};
    const stationList = stationRows.rows;
    stationList.forEach(s => { stationMap[s.code] = s; });

    // ─── Ensure At Least 4 Trains For Every Source -> Destination Pair ───
    const trainTypes = [
      { nameSuffix: 'Express', type: 'Express', dep: '06:00', arr: '14:30', fare: 550 },
      { nameSuffix: 'SF Express', type: 'Superfast', dep: '10:45', arr: '19:15', fare: 780 },
      { nameSuffix: 'Rajdhani', type: 'Rajdhani', dep: '16:30', arr: '06:45', fare: 1450 },
      { nameSuffix: 'Vande Bharat', type: 'Shatabdi', dep: '21:15', arr: '05:30', fare: 1200 },
    ];

    // Collect all trains to create
    const trainsToCreate = [];
    let trainNumberCounter = 12001;

    // Check existing trains
    const existingTrainsRes = await client.query(`SELECT source_station_id, destination_station_id, COUNT(*)::int AS count FROM trains WHERE is_active = true GROUP BY source_station_id, destination_station_id`);
    const existingPairsMap = {};
    existingTrainsRes.rows.forEach(r => {
      existingPairsMap[`${r.source_station_id}_${r.destination_station_id}`] = r.count;
    });

    for (let i = 0; i < stationList.length; i++) {
      for (let j = 0; j < stationList.length; j++) {
        if (i === j) continue;

        const src = stationList[i];
        const dest = stationList[j];
        const existingCount = existingPairsMap[`${src.id}_${dest.id}`] || 0;
        const needed = Math.max(0, 4 - existingCount);

        for (let k = 0; k < needed; k++) {
          const trainNumStr = String(trainNumberCounter++);
          const tMeta = trainTypes[k % trainTypes.length];
          const trainName = `${src.city} - ${dest.city} ${tMeta.nameSuffix}`;
          trainsToCreate.push({
            number: trainNumStr,
            name: trainName,
            type: tMeta.type,
            source_id: src.id,
            dest_id: dest.id,
            dep: tMeta.dep,
            arr: tMeta.arr,
            fare: tMeta.fare,
          });
        }
      }
    }

    if (trainsToCreate.length > 0) {
      console.log(`Seeding ${trainsToCreate.length} new trains...`);
      // Bulk insert trains
      const trainValues = [];
      const trainParams = [];
      trainsToCreate.forEach((t) => {
        const offset = trainParams.length;
        trainValues.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`);
        trainParams.push(t.number, t.name, t.type, t.source_id, t.dest_id, t.dep, t.arr, t.fare);
      });

      const insertedTrainsRes = await client.query(
        `INSERT INTO trains (train_number, name, train_type, source_station_id, destination_station_id, departure_time, arrival_time, base_fare)
         VALUES ${trainValues.join(', ')}
         ON CONFLICT (train_number) DO NOTHING
         RETURNING id`,
        trainParams
      );

      const insertedTrainIds = insertedTrainsRes.rows.map(r => r.id);

      if (insertedTrainIds.length > 0) {
        // Bulk insert coaches
        const coachConfigs = [
          { number: 'S1', class: 'SL', seats: 72 },
          { number: 'S2', class: 'SL', seats: 72 },
          { number: 'A1', class: '3A', seats: 64 },
          { number: 'B1', class: '2A', seats: 46 },
          { number: 'H1', class: '1A', seats: 24 },
        ];

        const coachValues = [];
        const coachParams = [];
        const coachMeta = []; // save info to create seats

        insertedTrainIds.forEach(tId => {
          coachConfigs.forEach(c => {
            const offset = coachParams.length;
            coachValues.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
            coachParams.push(tId, c.number, c.class, c.seats);
            coachMeta.push({ seats: c.seats });
          });
        });

        const insertedCoachesRes = await client.query(
          `INSERT INTO coaches (train_id, coach_number, class, total_seats)
           VALUES ${coachValues.join(', ')}
           RETURNING id`,
          coachParams
        );

        // Bulk insert seats in chunks of 5000 to avoid query parameter limits
        const berths = ['lower', 'middle', 'upper', 'side-lower', 'side-upper'];
        let seatValues = [];
        let seatParams = [];

        for (let cIdx = 0; cIdx < insertedCoachesRes.rows.length; cIdx++) {
          const coachId = insertedCoachesRes.rows[cIdx].id;
          const totalSeats = coachMeta[cIdx].seats;
          const tatkalCount = Math.ceil(totalSeats * 0.1);

          for (let s = 1; s <= totalSeats; s++) {
            const berthType = berths[(s - 1) % berths.length];
            const isTatkal = s > (totalSeats - tatkalCount);
            const offset = seatParams.length;
            seatValues.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
            seatParams.push(coachId, s, berthType, isTatkal);

            if (seatValues.length >= 1000) {
              await client.query(
                `INSERT INTO seats (coach_id, seat_number, berth_type, is_tatkal_quota) VALUES ${seatValues.join(', ')}`,
                seatParams
              );
              seatValues = [];
              seatParams = [];
            }
          }
        }
        if (seatValues.length > 0) {
          await client.query(
            `INSERT INTO seats (coach_id, seat_number, berth_type, is_tatkal_quota) VALUES ${seatValues.join(', ')}`,
            seatParams
          );
        }
      }
    }
    console.log('✅ Guaranteed at least 4 trains for every source -> destination pair!');

    // ─── Bulk Seed 90-Day Schedules For All Active Trains ───
    await client.query(`
      INSERT INTO schedules (train_id, journey_date)
      SELECT t.id, (CURRENT_DATE + (i || ' day')::interval)::date
      FROM trains t, generate_series(0, 89) i
      WHERE t.is_active = true
      ON CONFLICT (train_id, journey_date) DO NOTHING
    `);
    console.log('✅ Bulk 90-day schedules generated for all trains!');

    await client.query('COMMIT');
    console.log('✅ Database seed complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = seed;

