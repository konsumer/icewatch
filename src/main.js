import L from "leaflet";
import "leaflet/dist/leaflet.css";
import GUN from "gun";
import t from "./lang.js";
import "./style.css";

// localStorage.clear();
const gun = GUN();
let node;
let pos;
let ice = [];
let markers = new Map(); // Keep track of markers to avoid duplicates

const buttonReport = document.getElementById("report");
buttonReport.dataset.tip = t("Report ICE");
buttonReport.addEventListener("click", () => {
  if (node) {
    const reportId = Date.now() + Math.random().toString(36).substr(2, 9);

    // example
    node.get("ice").get(reportId).put({
      note: "ICE Activity Reported",

      latitude: "45.51515107022085",
      longitude: "-122.68108606338502",

      // latitude: pos.lat,
      // longitude: pos.lon,
      timestamp: Date.now(),
      id: reportId,
    });

    console.log("Report added for postcode:", pos.address.postcode);
  }
});

async function getLocation(latitude, longitude) {
  return fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
  ).then((r) => r.json());
}

const map = L.map("map");

map.on("click", (e) => {
  console.log("map click", e);
});

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

function addReportToMap(report, reportKey) {
  // Check if we already have this marker
  if (markers.has(reportKey)) {
    return;
  }

  if (report && report.latitude && report.longitude) {
    // Add to local ice array
    ice.push({ ...report, key: reportKey });

    // Create marker
    const marker = L.marker([report.latitude, report.longitude])
      .bindPopup(
        `
        <div>
          <strong>${report.note || "ICE Activity"}</strong><br/>
          <small>Reported: ${new Date(report.timestamp).toLocaleString()}</small>
        </div>
      `,
      )
      .addTo(map);
    markers.set(reportKey, marker);
    console.log(`Added marker for report ${reportKey}:`, report);
  }
}

if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    async (position) => {
      map.setView([position.coords.latitude, position.coords.longitude], 13);
      pos = await getLocation(
        position.coords.latitude,
        position.coords.longitude,
      );

      console.log("Location:", pos);

      // Clear existing data when location changes
      ice = [];
      markers.forEach((marker) => map.removeLayer(marker));
      markers.clear();

      // Set up Gun node for this postcode
      node = gun.get(`icewatch-${pos.address.postcode}`);

      // Listen for all reports in this postcode
      node
        .get("ice")
        .map()
        .on((report, key) => {
          if (report) {
            addReportToMap(report, key);
          }
        });

      console.log(`Listening for reports in postcode: ${pos.address.postcode}`);
    },
    (error) => {
      console.error("Error getting location:", error);
      alert(
        t(
          "Could not retrieve your location. Please ensure location services are enabled.",
        ),
      );
    },
  );
} else {
  alert(t("Geolocation is not supported by this browser."));
}
