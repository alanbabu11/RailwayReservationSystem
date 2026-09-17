const { query } = require('../config/db');

// GET /api/admin/dashboard — Admin dashboard stats
const getDashboardStats = async (req, res) => {
  try {
    const [usersCount, trainsCount, bookingsCount, revenueResult, todayBookings, activeSchedules] = await Promise.all([
      query('SELECT COUNT(*) AS count FROM users WHERE role = $1', ['user']),
      query('SELECT COUNT(*) AS count FROM trains WHERE is_active = true'),
      query('SELECT COUNT(*) AS count FROM bookings WHERE status != $1', ['cancelled']),
      query('SELECT COALESCE(SUM(total_fare), 0) AS total FROM bookings WHERE status != $1', ['cancelled']),
      query('SELECT COUNT(*) AS count FROM bookings WHERE DATE(created_at) = CURRENT_DATE AND status != $1', ['cancelled']),
      query('SELECT COUNT(*) AS count FROM schedules WHERE journey_date >= CURRENT_DATE AND status = $1', ['active']),
    ]);

    // Recent bookings
    const recentBookings = await query(`
      SELECT b.pnr, b.status, b.total_fare, b.created_at, b.coach_class, b.booking_type,
             u.name AS user_name, t.name AS train_name, t.train_number, s.journey_date
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN schedules s ON b.schedule_id = s.id
      JOIN trains t ON s.train_id = t.id
      ORDER BY b.created_at DESC LIMIT 10
    `);

    res.json({
      stats: {
        total_users: parseInt(usersCount.rows[0].count),
        active_trains: parseInt(trainsCount.rows[0].count),
        total_bookings: parseInt(bookingsCount.rows[0].count),
        total_revenue: parseFloat(revenueResult.rows[0].total),
        today_bookings: parseInt(todayBookings.rows[0].count),
        active_schedules: parseInt(activeSchedules.rows[0].count),
      },
      recent_bookings: recentBookings.rows,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
};

// GET /api/admin/bookings — All bookings
const getAllBookings = async (req, res) => {
  try {
    const result = await query(`
      SELECT b.*, u.name AS user_name, u.email AS user_email,
             t.name AS train_name, t.train_number, s.journey_date
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN schedules s ON b.schedule_id = s.id
      JOIN trains t ON s.train_id = t.id
      ORDER BY b.created_at DESC
    `);
    res.json({ bookings: result.rows });
  } catch (err) {
    console.error('Get all bookings error:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
};

// GET /api/admin/users — All users
const getAllUsers = async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, email, phone, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

module.exports = { getDashboardStats, getAllBookings, getAllUsers };
