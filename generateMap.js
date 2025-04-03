const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const polyline = require('@mapbox/polyline');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { postToTwitter } = require('./postToTwitter');

const WIDTH = 800;
const HEIGHT = 600;
const PANEL_WIDTH = 250;
const BANNER_HEIGHT = 50;
const MAP_OFFSET_Y = 10;
const mapboxToken = 'pk.eyJ1Ijoibmdhd3hjb21tYW5kIiwiYSI6ImNtNjM0bGh6NzBrNHUyaXE0bWpwYmxveWIifQ.GjaB91HeBsNjwyPYvuvzfg';

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

function parseThreats(description, event) {
  const isTornado = event.includes("Tornado Warning");
  return {
    tornado: isTornado
      ? description.includes("OBSERVED")
        ? "Observed"
        : description.includes("RADAR")
        ? "Radar Indicated"
        : "Possible"
      : null,
    wind: description.match(/winds? (up to|around)?\s?(\d{2,3})\s?mph/i)?.[2] || 'N/A',
    hail: description.match(/([0-9.]+)[\s-]?(inch|in)\s+hail/i)?.[1] || 'N/A',
    motion: description.match(/moving\s+([a-zA-Z]+)\s+at\s+(\d+)\s?mph/i)
  };
}

function getAlertMapCenterAndZoom(coords) {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  coords[0].forEach(([lng, lat]) => {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  });
  return {
    centerLat: (minLat + maxLat) / 2,
    centerLng: (minLng + maxLng) / 2,
    zoom: maxLat - minLat < 1 && maxLng - minLng < 1 ? 8 : 7
  };
}

async function generateAlertMap(alert) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const eventText = alert.properties.event.toUpperCase();
  const { centerLat, centerLng, zoom } = getAlertMapCenterAndZoom(alert.geometry.coordinates);

  const encodedPath = polyline.encode(alert.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]));
  const pathOverlay = `path-5+ff0000-0.8(${encodedPath})`;
  const mapURL = `https://api.mapbox.com/styles/v1/mapbox/light-v10/static/${pathOverlay}/${centerLng},${centerLat},${zoom}/${WIDTH - PANEL_WIDTH}x${HEIGHT - BANNER_HEIGHT - MAP_OFFSET_Y}?access_token=${mapboxToken}`;
  const response = await fetch(mapURL);
  const buffer = Buffer.from(await response.arrayBuffer());
  const mapImage = await loadImage(buffer);

  // Top Gradient Banner
  const bannerGradient = ctx.createLinearGradient(0, 0, WIDTH, BANNER_HEIGHT);
  bannerGradient.addColorStop(0, "#D32F2F");
  bannerGradient.addColorStop(1, "#880E4F");
  ctx.fillStyle = bannerGradient;
  ctx.fillRect(0, 0, WIDTH, BANNER_HEIGHT);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 22px 'Segoe UI', sans-serif";
  ctx.fillText(eventText, (WIDTH - ctx.measureText(eventText).width) / 2, 33);

  ctx.drawImage(mapImage, 0, BANNER_HEIGHT + MAP_OFFSET_Y, WIDTH - PANEL_WIDTH, HEIGHT - BANNER_HEIGHT - MAP_OFFSET_Y);

  const countyGradient = ctx.createLinearGradient(0, HEIGHT - 40, WIDTH - PANEL_WIDTH, HEIGHT);
  countyGradient.addColorStop(0, "#37474F");
  countyGradient.addColorStop(1, "#263238");
  ctx.fillStyle = countyGradient;
  ctx.fillRect(0, HEIGHT - 40, WIDTH - PANEL_WIDTH, 40);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 14px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`Counties: ${alert.properties.areaDesc}`, (WIDTH - PANEL_WIDTH) / 2, HEIGHT - 15);
  ctx.textAlign = "start";

  ctx.fillStyle = "#1C1C1C";
  ctx.fillRect(WIDTH - PANEL_WIDTH, BANNER_HEIGHT, PANEL_WIDTH, HEIGHT - BANNER_HEIGHT);

  const infoX = WIDTH - PANEL_WIDTH + 10;
  let infoY = BANNER_HEIGHT + 20;
  ctx.font = "600 13px 'Segoe UI', sans-serif";
  ctx.fillStyle = "#ffffff";
  wrapText(ctx, alert.properties.senderName.toUpperCase(), infoX, infoY, PANEL_WIDTH - 20, 16);
  infoY += 30;

  const badgeWidth = PANEL_WIDTH - 20, badgeHeight = 40;
  const drawTimeBadge = (label, time, gradientStart, gradientEnd) => {
    const gradient = ctx.createLinearGradient(infoX, infoY, infoX + badgeWidth, infoY + badgeHeight);
    gradient.addColorStop(0, gradientStart);
    gradient.addColorStop(1, gradientEnd);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(infoX + 10, infoY);
    ctx.lineTo(infoX + badgeWidth - 10, infoY);
    ctx.quadraticCurveTo(infoX + badgeWidth, infoY, infoX + badgeWidth, infoY + 10);
    ctx.lineTo(infoX + badgeWidth, infoY + badgeHeight - 10);
    ctx.quadraticCurveTo(infoX + badgeWidth, infoY + badgeHeight, infoX + badgeWidth - 10, infoY + badgeHeight);
    ctx.lineTo(infoX + 10, infoY + badgeHeight);
    ctx.quadraticCurveTo(infoX, infoY + badgeHeight, infoX, infoY + badgeHeight - 10);
    ctx.lineTo(infoX, infoY + 10);
    ctx.quadraticCurveTo(infoX, infoY, infoX + 10, infoY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "600 13px 'Segoe UI', sans-serif";
    ctx.fillText(label, infoX + badgeWidth / 2, infoY + 15);
    ctx.font = "500 12px 'Segoe UI', sans-serif";
    ctx.fillText(new Date(time).toLocaleString("en-US", { timeZone: "America/New_York" }).toUpperCase(), infoX + badgeWidth / 2, infoY + 30);
    ctx.textAlign = "start";
    infoY += badgeHeight;
  };

  drawTimeBadge("IN EFFECT:", alert.properties.effective, "#00695C", "#004D40");
  drawTimeBadge("EXPIRES:", alert.properties.expires, "#E65100", "#BF360C");

  ctx.font = "400 13px 'Segoe UI', sans-serif";
  wrapText(ctx, alert.properties.description, infoX, infoY + 20, PANEL_WIDTH - 20, 18);
  infoY += 120;

  const threats = parseThreats(alert.properties.description, eventText);
  const isTornadoOrSevere = eventText.includes("TORNADO WARNING") || eventText.includes("SEVERE THUNDERSTORM WARNING");

  if (isTornadoOrSevere) {
    const drawGradientBadge = (ctx, x, y, size, c1, c2, label, value) => {
      const radius = 10;
      const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
      gradient.addColorStop(0, c1);
      gradient.addColorStop(1, c2);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + size - radius, y);
      ctx.quadraticCurveTo(x + size, y, x + size, y + radius);
      ctx.lineTo(x + size, y + size - radius);
      ctx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
      ctx.lineTo(x + radius, y + size);
      ctx.quadraticCurveTo(x, y + size, x, y + size - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "600 14px 'Segoe UI', sans-serif";
      ctx.fillText(label, x + size / 2, y + size / 2 - 5);
      ctx.font = "500 13px 'Segoe UI', sans-serif";
      ctx.fillText(value, x + size / 2, y + size / 2 + 15);
      ctx.textAlign = "start";
    };

    const startX = infoX;
    const startY = infoY + 30;
    const boxSize = 100;
    const spacing = 8;
    const c1 = eventText.includes("TORNADO") ? "#D32F2F" : "#FBC02D";
    const c2 = eventText.includes("TORNADO") ? "#880E4F" : "#F57F17";

    drawGradientBadge(ctx, startX, startY, boxSize, c1, c2, "TORNADO", threats.tornado || "None");
    drawGradientBadge(ctx, startX + boxSize + spacing, startY, boxSize, c1, c2, "WIND", threats.wind !== 'N/A' ? `${threats.wind} mph` : "N/A");
    drawGradientBadge(ctx, startX, startY + boxSize + spacing, boxSize, c1, c2, "HAIL", threats.hail !== 'N/A' ? `${threats.hail} in"` : "N/A");
    const motion = threats.motion ? `${threats.motion[1]} ${threats.motion[2]} mph` : "N/A";
    drawGradientBadge(ctx, startX + boxSize + spacing, startY + boxSize + spacing, boxSize, c1, c2, "MOTION", motion);
  }

  const logo = await loadImage('./logo.png');
  const logoWidth = 64;
  const logoHeight = (logo.height / logo.width) * logoWidth;
  ctx.drawImage(logo, 10, HEIGHT - 40 + (40 - logoHeight) / 2 + 2, logoWidth, logoHeight);

const fileName = `alert_${Date.now()}.png`;
const out = fs.createWriteStream(fileName);
const stream = canvas.createPNGStream();
stream.pipe(out);

out.on('finish', async () => {
  console.log(`✅ Map image created: ${fileName}`);
  
  const caption = `${alert.properties.event} for ${alert.properties.areaDesc}\nExpires: ${new Date(alert.properties.expires).toLocaleTimeString('en-US', { timeZone: 'America/New_York' })}`;

  try {
    await postToTwitter(fileName, caption);
    await postToFacebook(fileName, caption);
  } catch (err) {
    console.error('❌ Error posting to social media:', err);
  }
});

}

// WATCHER LOGIC
const seenAlerts = new Set();

async function fetchLiveFFCAlerts() {
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
  const alerts = await fetchLiveFFCAlerts();
  for (const alert of alerts) {
    const id = alert.id;
    if (!seenAlerts.has(id)) {
      console.log(`📢 New Alert: ${alert.properties.event} | ${alert.properties.areaDesc}`);
      seenAlerts.add(id);
      try {
        await generateAlertMap(alert);
      } catch (err) {
        console.error('❌ Error generating image:', err);
      }
    }
  }
}

setInterval(checkAlerts, 60 * 1000);
console.log('🌀 Alert watcher running every 1 minute...');
