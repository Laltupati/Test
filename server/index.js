const express = require('express');
const cors = require('cors');
const path = require('path');
const { useCases, systemHealth, monitoringData, executionStats } = require('./data');

const app = express();
// Azure provides the port via process.env.PORT
const port = process.env.PORT || 3000;

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

// Serve frontend in production (Azure)
const clientBuildPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildPath));

// Catch-all route to serve index.html for Single Page Application routing
app.use((req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});