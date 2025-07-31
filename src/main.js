import L from "leaflet";
import "leaflet/dist/leaflet.css";
import GUN from "gun";
import t from "./lang.js";
import "./style.css";

// Don't clear localStorage - Gun needs it for persistence!
// localStorage.clear();

// Use multiple reliable Gun relay servers for cross-user sharing
const gun = GUN([
  "https://gun-manhattan.herokuapp.com/gun",
  "https://gunjs.herokuapp.com/gun",
  "wss://gun-manhattan.herokuapp.com/gun",
  "wss://gunjs.herokuapp.com/gun",
]);

// Add debugging to see Gun peer connections
gun.on("hi", (peer) => {
  console.log("Connected to Gun peer:", peer);
});

gun.on("bye", (peer) => {
  console.log("Disconnected from Gun peer:", peer);
});
let node;
let pos;
let ice = [];
let markers = new Map(); // Keep track of markers to avoid duplicates

const buttonReport = document.getElementById("report");
buttonReport.dataset.tip = t("Report ICE");
buttonReport.addEventListener("click", () => {
  if (node) {
    // Create a unique key for each new ice report
    const reportId = Date.now() + Math.random().toString(36).substr(2, 9);

    // Create simple user ID (Gun only accepts primitive data types)
    const userId =
      localStorage.getItem("icewatch-user-id") ||
      (() => {
        const newId = "user-" + Math.random().toString(36).substr(2, 9);
        localStorage.setItem("icewatch-user-id", newId);
        return newId;
      })();

    // Only put simple, serializable data into Gun
    const reportData = {
      note: "ICE Activity Reported",
      // latitude: pos.lat,
      // longitude: pos.lon,
      latitude: 45.51515107022085 + Math.random() / 100,
      longitude: -122.68108606338502 + Math.random() / 100,
      timestamp: Date.now(),
      user: userId,
    };

    // Add the new report to the Gun collection
    node
      .get("ice")
      .get(reportId)
      .put(reportData, (ack) => {
        if (ack.err) {
          console.error("Error saving report:", ack.err);
        } else {
          console.log("Report saved successfully:", reportId, reportData);
          console.log(
            "Should sync to all users in postcode:",
            pos.address.postcode,
          );
        }
      });
  }
});

async function getLocation(latitude, longitude) {
  return fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
  ).then((r) => r.json());
}

const map = L.map("map");

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

function addReportToMap(report, reportKey) {
  // Check if we already have this marker
  if (markers.has(reportKey)) {
    console.log("Skipping duplicate marker:", reportKey);
    return;
  }

  if (report && report.latitude && report.longitude) {
    // Check if this report is already in our ice array (extra safety check)
    const existingIndex = ice.findIndex((item) => item.key === reportKey);
    if (existingIndex === -1) {
      // Add to local ice array
      ice.push({ ...report, key: reportKey });
    }

    // Create marker with user info if available
    const userInfo = report.user
      ? `<br/><small>User: ${report.user.slice(0, 8)}...</small>`
      : "";
    const marker = L.marker([report.latitude, report.longitude])
      .bindPopup(
        `
        <div>
          <strong>${report.note || "ICE Activity"}</strong><br/>
          <small>Reported: ${new Date(report.timestamp).toLocaleString()}</small>
          ${userInfo}
        </div>
      `,
      )
      .addTo(map);

    // Store marker reference
    markers.set(reportKey, marker);

    console.log(
      `✓ Added marker for report ${reportKey} from user ${report.user || "unknown"}`,
    );
    console.log(`Total reports in area: ${ice.length}`);
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
      const postcodeKey = `icewatch-${pos.address.postcode}`;
      node = gun.get(postcodeKey);

      console.log(`Setting up Gun node: ${postcodeKey}`);

      // Listen for all reports in this postcode
      node
        .get("ice")
        .map()
        .on((report, key) => {
          console.log("Received report from Gun network:", key, report);
          if (report) {
            addReportToMap(report, key);
          }
        });

      // Also try to load existing data immediately (Gun sometimes has timing issues)
      setTimeout(() => {
        console.log("Attempting to load existing reports...");
        node.get("ice").once((data) => {
          console.log("Existing data from Gun:", data);
          if (data) {
            Object.keys(data).forEach((key) => {
              if (key !== "_" && data[key]) {
                console.log("Loading existing report:", key, data[key]);
                addReportToMap(data[key], key);
              }
            });
          }
        });
      }, 2000); // Increased timeout for better network sync

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
