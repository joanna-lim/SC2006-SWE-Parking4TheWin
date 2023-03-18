const mapboxgl.accessToken = window.MAPBOX_SECRET_KEY;

var map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/streets-v12",
  center: [103.8198, 1.3521],
  zoom: 12,
});
var searchForm = document.getElementById("search-form");
var locationInput = document.getElementById("location-input");
var radiusInput = document.getElementById("radius-input");
var searchMarker = null;

// helper function
window.addCarpark=function(address, carParkNo) {
  console.log("whatsup")
  fetch('/update-interested-carpark', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ carpark_address: address })
  })
  .then((response) => response.json())
  .then((data) => {
    if (data.success) {
      window.geojsonData = data.updatedgeojsondata;
      map.getSource("carparks-data").setData({
        type: "geojson",
        ...window.geojsonData
      });
      
      if (data.op_type == 1) { // User Clicked on "I'm interested" button.
        window.interestedCarpark = carParkNo;
        $("#mapboxgl-popup-content-button").text("I'm no longer interested.");
        var i = Number($("#mapboxgl-popup-content-interested").text());
        i++;
        $("#mapboxgl-popup-content-interested").text(i);
      } else { // User Clicked on "I'm no longer interested" button.
        window.interestedCarpark = null;
        $("#mapboxgl-popup-content-button").text("I'm interested.");
        var i = Number($("#mapboxgl-popup-content-interested").text());
        i--;
        $("#mapboxgl-popup-content-interested").text(i);
      }
    }
  })
  .catch((error) => console.error(error));
};

searchForm.addEventListener("submit", function (event) {
  event.preventDefault();
  search();
});

function search(coordinates = null) {
  var location = locationInput.value;
  var radius = radiusInput.value || "2";

  // use provided coordinates if available
  if (coordinates !== null) {
    map.setCenter(coordinates);
  } else {
    var url =
      "https://api.mapbox.com/geocoding/v5/mapbox.places/" +
      encodeURIComponent(location) +
      ".json?access_token=" +
      mapboxgl.accessToken +
      "&country=sg&proximity=103.8198,1.3521";
    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        var coordinates = data.features[0].center;
        var placeName = data.features[0].place_name;
        map.setCenter(coordinates);

        if (searchMarker !== null) {
          searchMarker.remove();
        }

        searchMarker = new mapboxgl.Marker()
          .setLngLat(coordinates)
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(
              "<p><strong>Your Search: </strong>" + placeName + "</p>"
            )
          )
          .addTo(map);
      })
      .catch((error) => console.error(error));
  }

  const radiusInKm = parseFloat(radius);
  const radiusInDegrees = radiusInKm / 111.32;

  const bounds = new mapboxgl.LngLatBounds()
    .extend([
      coordinates[0] + radiusInDegrees,
      coordinates[1] + radiusInDegrees,
    ])
    .extend([
      coordinates[0] - radiusInDegrees,
      coordinates[1] - radiusInDegrees,
    ]);
  map.fitBounds(bounds);
}

radiusInput.addEventListener("input", function () {
  const center = map.getCenter().toArray();
  search(center);
});

map.on("load", () => {
  map.addSource("carparks-data", {
    type: "geojson",
    data: window.geojsonData,
  });

  // Add a layer containing pins using "carparks-data" source
  map.addLayer({
    id: "carparks-layer",
    type: "circle",
    source: "carparks-data",
    paint: {
      "circle-radius": 12,
      "circle-color": [
        "interpolate",
        ["linear"],
        ["get", "vacancy_percentage"],
        0,
        "red",
        50,
        "yellow",
        100,
        "green",
      ],
      "circle-opacity": 0.6,
    },
  });
});

// Display popup containing carpark information when clicking on a pin
map.on("click", "carparks-layer", (e) => {
  const coordinates = e.features[0].geometry.coordinates.slice();
  const properties = e.features[0].properties;
  const address = properties.address;
  const lotsAvailable = properties.lots_available;
  const vacancyPercentage = properties.vacancy_percentage;
  const carParkNo = properties.car_park_no;
  const noOfInterestedDrivers = properties.no_of_interested_drivers;
  const interestedCarpark = window.interestedCarpark;

  var interestedButtonText = "I'm interested";
  if (carParkNo == interestedCarpark) {
    interestedButtonText = "I'm no longer interested";
  }

  while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
    coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
  }
  
  var desc = `<p><strong>Address:</strong> ${address}</p>
                <p><strong>Lots Available:</strong> ${lotsAvailable}</p>
                <p><strong>Vacancy Percentage:</strong> ${vacancyPercentage}%</p>
                <p><strong> No. of Interested Drivers: </strong> <span id="mapboxgl-popup-content-interested">${noOfInterestedDrivers}</span></p>
                `
  if (window.hasVehicle) {
    desc = desc + `<button type="button" onClick="addCarpark('${address}','${carParkNo}')" id="mapboxgl-popup-content-button">${interestedButtonText}</button>`;
  }

  new mapboxgl.Popup().setLngLat(coordinates).setHTML(desc).addTo(map);
});

// Increase opacity of pins when zooming in and
// decrease opacity of pins when zooming out
map.on("zoom", function () {
  const zoom = map.getZoom();

  map.setPaintProperty("carparks-layer", "circle-opacity", [
    "interpolate",
    ["linear"],
    ["zoom"],
    10,
    0,
    14,
    0.6,
    18,
    1,
  ]);
});

// Change cursor style from "grab" to "select" when hovering on a pin
map.on('mouseenter', 'carparks-layer', function () {
  map.getCanvas().style.cursor = 'pointer';
});

// Change cursor style from "select" to "grab" when hovering off a pin
map.on('mouseleave', 'carparks-layer', function () {
  map.getCanvas().style.cursor = '';
});