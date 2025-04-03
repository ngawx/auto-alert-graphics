const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { generateAlertMap } = require('./generateMap'); // Make sure generateMap exports this
const fs = require('fs');

// Keep track of already-processed alerts
const seenAlerts = new Set();

async function fetchFFCAlerts() {
  const url = 'https://api.weather.gov/alerts/active?area=GA';
  const res = await fetch(url);
  const json = await res.json();

  return json.features.filter(
    (a) =>
      a.properties.senderName.includes('NWS Peachtree City GA') &&
      ['Tornado Warning', 'Severe Thunderstorm Warning'].includes(a.properties.event)
  );
}

async function checkAlerts() {
  const alerts = await fetchFFCAlerts();

  for (const alert of alerts) {
    const id = alert.id;
    if (!seenAlerts.has(id)) {
      console.log(`📢 New Alert: ${alert.properties.event} | ${alert.properties.areaDesc}`);
      seenAlerts.add(id);

      try {
        await generateAlertMap(alert); // pass the full alert object
      } catch (err) {
        console.error('❌ Error generating map:', err);
      }
    }
  }
}

// Run every 1 minute
setInterval(checkAlerts, 60 * 1000);
console.log('🌀 Alert watcher started... checking every 1 minute');
