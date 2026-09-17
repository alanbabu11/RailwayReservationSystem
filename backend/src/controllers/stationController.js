const { query } = require('../config/db');

// GET /api/stations
const getAllStations = async (req, res) => {
  try {
    const result = await query('SELECT * FROM stations ORDER BY name');
    res.json({ stations: result.rows });
  } catch (err) {
    console.error('Get stations error:', err);
    res.status(500).json({ error: 'Failed to fetch stations' });
  }
};

// POST /api/stations — Admin only
const addStation = async (req, res) => {
  try {
    const { code, name, city } = req.body;
    if (!code || !name || !city) {
      return res.status(400).json({ error: 'Code, name and city are required' });
    }

    const result = await query(
      'INSERT INTO stations (code, name, city) VALUES ($1, $2, $3) RETURNING *',
      [code.toUpperCase(), name, city]
    );
    res.status(201).json({ station: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Station code already exists' });
    }
    console.error('Add station error:', err);
    res.status(500).json({ error: 'Failed to add station' });
  }
};

// DELETE /api/stations/:id — Admin only
const deleteStation = async (req, res) => {
  try {
    const { id } = req.params;
    // Check if station is used in trains
    const usedInTrains = await query(
      'SELECT 1 FROM trains WHERE source_station_id = $1 OR destination_station_id = $1 LIMIT 1',
      [id]
    );

    if (usedInTrains.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete station: trains are configured to use this station.' });
    }

    const result = await query('DELETE FROM stations WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Station not found' });
    }

    res.json({ message: 'Station deleted successfully', station: result.rows[0] });
  } catch (err) {
    console.error('Delete station error:', err);
    res.status(500).json({ error: 'Failed to delete station: ' + err.message });
  }
};

module.exports = { getAllStations, addStation, deleteStation };
