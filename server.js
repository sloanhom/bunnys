// server.js
const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 7000;

// === CONFIGURATION ===
// URL of the JSON data source. Can be a GitHub raw URL or local file path.
const DATA_URL = 'https://raw.githubusercontent.com/sloanhom/bunnys/main/data.json';
// If you want to use a local file instead, set DATA_URL to a local path e.g. './data.json'

// === Load Data Function ===
let dataCache = null;

async function loadData() {
  if (DATA_URL.startsWith('http')) {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }
    dataCache = await response.json();
  } else {
    // Local file
    const filePath = path.resolve(__dirname, DATA_URL);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    dataCache = JSON.parse(fileContent);
  }
  return dataCache;
}

// === Helper Functions ===
function findItems(searchTerm) {
  if (!dataCache) {
    throw new Error('Data not loaded');
  }
  if (!searchTerm) return dataCache;

  const lowerSearch = searchTerm.toLowerCase();
  return dataCache.filter(item => item.name.toLowerCase().includes(lowerSearch));
}

function getItemById(id) {
  if (!dataCache) {
    throw new Error('Data not loaded');
  }
  return dataCache.find(item => item.id === id);
}

// === Endpoints ===

// 1. Manifest
app.get('/manifest.json', (req, res) => {
  const manifest = {
    "id": "com.example.localaddon",
    "version": "1.0.0",
    "name": "Local JSON Media Addon",
    "resources": ["stream", "catalog"],
    "types": ["movie", "show"],
    "catalogs": [
      {
        "type": "movie",
        "id": "movies",
        "name": "Movies"
      },
      {
        "type": "show",
        "id": "shows",
        "name": "Shows"
      }
    ],
    "logo": "https://via.placeholder.com/200x200?text=Addon",
    "description": "A lightweight local media addon using a JSON data source"
  };
  res.json(manifest);
});

// 2. Catalog Endpoint
app.get('/catalog', async (req, res) => {
  try {
    await loadData();

    const search = req.query.search || '';
    const items = findItems(search);

    // Filter by resource type
    const resourceType = req.query.type || null; // optional filter
    const filteredItems = items.filter(item => (resourceType ? item.type === resourceType : true));

    // Format response
    const catalogItems = filteredItems.map(item => ({
      type: item.type,
      id: item.id,
      name: item.name,
      poster: item.poster,
      description: item.description,
    }));

    res.json({ metas: catalogItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Stream Endpoint
app.get('/stream', async (req, res) => {
  try {
    await loadData();

    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ error: 'Missing id parameter' });
    }

    const item = getItemById(id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Return streams
    const streams = item.streams || [];
    // Format streams for Stremio
    const streamsResponse = streams.map(s => ({
      title: s.title,
      url: s.url
    }));
    res.json({ streams: streamsResponse });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Addon server running at http://localhost:${PORT}`);
  console.log(`Open in Stremio: http://localhost:${PORT}/manifest.json`);
});
