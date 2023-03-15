mapboxgl.accessToken = window.MAPBOX_SECRET_KEY;

// initialising of the map
var map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/streets-v12",
  center: [103.8198, 1.3521],
  zoom: 12,
});

// user inputs - location and radius 
var searchForm = document.getElementById("search-form");
var locationInput = document.getElementById("location-input");
var radiusInput = document.getElementById("radius-input");
var searchMarker = null;

// radius input event listener 
radiusInput.addEventListener("input", function () {
  const center = map.getCenter().toArray();
  search(center);
});
// submit button event listener
searchForm.addEventListener("submit", function (event) {
  event.preventDefault();
  search();
});

function getRoute(coordinates) {
  c1 = [coordinates[0], 90-coordinates[1]]
  c2 = [window.interestedCarpark[0], 90-window.interestedCarpark[1]]

  var url =
    "proxy/directions/v5/mapbox/walking/" +
    c1[0]
    "," +
    c1[1]
    ";" +
    c2[0]
    "," +
    c2[1] +
    "?access_token=" +
    mapboxgl.accessToken;

  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      var route = data.routes[0].geometry;
      map.addLayer({
        id: "route",
        type: "line",
        source: {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: route,
          },
        },
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#888",
          "line-width": 8,
        },
      });
    })
    .catch((error) => console.error(error));
}

// search function 
function search(coordinates = null) {
  var location = locationInput.value;
  var radius = radiusInput.value || "2";

  // if coordinates are provided, we use coordinates, else, we use mapbox API to convert loctation and display
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
        
        if (window.interestedCarpark != "None") {
          getRoute(coordinates);
        }
        var placeName = data.features[0].place_name;
        map.setCenter(coordinates);

        // remove user's previously searched destination before placing new marker 
        if (searchMarker !== null) {
          searchMarker.remove();
        }
        // search marker to display user's searched destination
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

// this is the JS code handling carpark data to be displayed 
map.on("load", function () {
  // adding carparks.json as a source
  map.addSource("carparks-data", {
    type: "geojson",
    data: window.geojsonData,
  });

  // adding the source as a layer or colour-coded carparks based on vacancy percentage
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

  // the addcarpark function -> will be executed when user clickes on "I'm interested"
  window.addCarpark=function(address) {
    fetch('/update-interested-carpark', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ carpark_address: address })
    })
    .then(() => {
      window.location.href = '/map';
    })
    .catch((error) => console.error(error));
  };

  // code that handles all carparks as popups 
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
    
    const description = () => {
      let desc = `
      <p><strong>Address:</strong> ${address}</p>
      <p><strong>Lots Available:</strong> ${lotsAvailable}</p>
      <p><strong>Vacancy Percentage:</strong> ${vacancyPercentage}%</p>
      <p><strong> No. of Interested Drivers: </strong> ${noOfInterestedDrivers}</p>
      `
      if (window.hasVehicle) {
        desc = desc + `<button type="button" onClick="addCarpark('${address}')">${interestedButtonText}</button>`;
      }
      return desc
    }

    new mapboxgl.Popup().setLngLat(coordinates).setHTML(description()).addTo(map);
  });

  // code that handles the display of carpark circle layer --> the higher the zoom the clearer the carpark
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

