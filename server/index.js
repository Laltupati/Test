const express = require('express');
const cors = require('cors');
const { useCases, systemHealth, monitoringData, executionStats } = require('./data');

const app = express();
const port = 3000;

app.use(cors());

app.get('/api/use-cases', (req, res) => {
  res.json(useCases);
});

app.get('/api/system-health', (req, res) => {
  res.json({
    overview: systemHealth,
    monitoring: monitoringData,
    executionStats: executionStats
  });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
