mapboxgl.accessToken = window.MAPBOX_SECRET_KEY;

function displayValue() {
  var radius = document.getElementById("radius-input").value;
  document.getElementById("radius-value").innerHTML = radius;
}
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

map.on("load", function () {
  map.addSource("carparks-data", {
    type: "geojson",
    data: window.geojsonData,
  });

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


  const addCarpark=(address)=> {
    console.log("whatsup")
    fetch('/update-interested-carpark', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ carpark_address: address })
    })
    .then(() => {
      // window.location.href = '/map';
    })
    .catch((error) => console.error(error));
  };

  map.on("click", "carparks-layer", (e) => {
    const coordinates = e.features[0].geometry.coordinates.slice();
    const properties = e.features[0].properties;
    const address = properties.address;
    const lotsAvailable = properties.lots_available;
    const vacancyPercentage = properties.vacancy_percentage;
    const userId = window.userId; 
    const interestedButtonText = "I'm Interested";

    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
      coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }
    
    const description = () => {
      let desc = `
      <p><strong>Address:</strong> ${address}</p>
      <p><strong>Lots Available:</strong> ${lotsAvailable}</p>
      <p><strong>Vacancy Percentage:</strong> ${vacancyPercentage}%</p>
      `
      if (window.hasVehicle) {
        desc = desc + `<button type="button" onClick=${addCarpark(address)}>${interestedButtonText}</button>`
      }
      return desc
    }


  const popup = new mapboxgl.Popup().setLngLat(coordinates).setHTML(description()).addTo(map);
});

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
});
