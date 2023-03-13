mapboxgl.accessToken = window.MAPBOX_SECRET_KEY;

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

  map.on("click", "carparks-layer", (e) => {
    const coordinates = e.features[0].geometry.coordinates.slice();
    const properties = e.features[0].properties;
    const address = properties.address;
    const lotsAvailable = properties.lots_available;
    const vacancyPercentage = properties.vacancy_percentage;
    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
      coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }

    const description = `
      <p><strong>Address:</strong> ${address}</p>
      <p><strong>Lots Available:</strong> ${lotsAvailable}</p>
      <p><strong>Vacancy Percentage:</strong> ${vacancyPercentage}%</p>
      ${window.hasVehicle ? `<button id="interested-button">I'm Interested</button>` : ''}
    `;

    new mapboxgl.Popup().setLngLat(coordinates).setHTML(description).addTo(map);
  });
  // map.on("click", "carparks-layer", (e) => {
  //   const coordinates = e.features[0].geometry.coordinates.slice();
  //   const properties = e.features[0].properties;
  //   const address = properties.address;
  //   const lotsAvailable = properties.lots_available;
  //   const vacancyPercentage = properties.vacancy_percentage;
  //   while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
  //     coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
  //   }
  //   const interestedDrivers = properties.interested_drivers || [];
  //   const isInterested = interestedDrivers.includes(userId);

  //   const button = document.createElement('button');
  //   button.onclick = () => {
  //     if (isInterested) {
  //       const index = interestedDrivers.indexOf(userId);
  //       if (index > -1) {
  //         interestedDrivers.splice(index, 1);
  //       }
  //     } else {
  //       interestedDrivers.push(userId);
  //     }
  //   };

  //   button.innerText = isInterested ? `I'm no longer interested (${interestedDrivers.length})` : `I'm interested (${interestedDrivers.length})`;
  //   button.onclick = () => {
  //     if (isInterested) {
  //       const index = interestedDrivers.indexOf(userId);
  //       if (index > -1) {
  //         interestedDrivers.splice(index, 1);
  //       }
  //     } else {
  //       interestedDrivers.push(userId);
  //     }
  //     button.innerText = isInterested ? `I'm interested (${interestedDrivers.length})` : `I'm no longer interested (${interestedDrivers.length})`
  //     map.getSource('carparks').setData({
  //       type: 'FeatureCollection',
  //       features: [{
  //         ...feature,
  //         properties: {
  //           ...feature.properties,
  //           interested_drivers: interestedDrivers,
  //         },
  //       }],
  //     });
  //     console.log(interestedDrivers);
  //   };

  //   const description = `
  //     <p><strong>Address:</strong> ${address}</p>
  //     <p><strong>Lots Available:</strong> ${lotsAvailable}</p>
  //     <p><strong>Vacancy Percentage:</strong> ${vacancyPercentage}%</p>
  //     ${window.hasVehicle ? button.outerHTML : ''}
  //   `;


  //   new mapboxgl.Popup().setLngLat(coordinates).setHTML(description).addTo(map);
  // });

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
