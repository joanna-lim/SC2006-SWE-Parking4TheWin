/*
  Structure of file
  ----
  Consts
  Variables
  Helper Functions
    General
    UI Related
  Actual code execution
    Mapbox
    UI Elements
*/

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
var searchMarker = null;    // there can only be one search marker at a time
var storedInterestedCarpark = null; // this is different from window.interestedCarparkNo
var storedNearbyCarparks = null;

function findCarparkFromNo(carparkNo) {
  if (!carparkNo) {
    return null;
  }

  for (let carpark of geojsonData.features) {
    if(carpark.properties.car_park_no === carparkNo) {
      return carpark;
    }
  }
  return null;    // this shouldn't happen
}

// For a carpark object, find the distance of the carpark from the given coordinate first
// and add it to the carpark object
function addDistanceToCarpark(coordinates, carpark) {
  const carparkCoordinate = carpark.geometry.coordinates;
  const distanceInKM = turf.distance(turf.point(coordinates),
                            turf.point(carparkCoordinate),
                            { units: 'kilometers' })
                            .toFixed(1);
  carpark.properties.distanceInKM = distanceInKM;
}

// Determines if "carparks-data" and "carparks-layer" are ready
function isCarparksReady() {
  return map && map.getSource('carparks-data') && map.getLayer('carparks-layer');
}

// Wait untill "carparks-data" and "carparks-layer" are ready
async function waitTillCarparksReady() {
    while (!isCarparksReady()) {
      // wait 1 second before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

async function findNearbyCarparks(coordinates, radiusInKm) {
  // Create a Turf.js circle object around the center point
  const options = { steps: 10, units: 'kilometers' };
  const circle = turf.circle(coordinates, radiusInKm, options);
  var carparks = null;

  await waitTillCarparksReady();

  // Return carparks in the Turf.js circle object
  carparks = map.querySourceFeatures('carparks-data', {
    sourceLayer: 'carparks-layer',
    filter: ['within', circle],
  });

  // map.querySourceFeatures returns an empty list sometimes
  // This is a band-aid solution.
  while (carparks === null || carparks.length === 0) {
    // wait 1 second before retrying
    await new Promise(resolve => setTimeout(resolve, 1000));
    carparks = map.querySourceFeatures('carparks-data', {
      sourceLayer: 'carparks-layer',
      filter: ['within', circle],
    });
  }

  carparks.forEach((carpark) => {
    addDistanceToCarpark(coordinates, carpark);
  })

  return carparks;
}

// Update database with the user's interested carpark
// and then the popup info
async function addCarpark(address, carParkNo) {
  try {
    const response = await fetch('/drivers', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ intent: "update_interested_carpark", carpark_address: address })
    });
    const data = await response.json();

    if (data.success) {
      window.geojsonData = data.updatedgeojsondata;
      map.getSource("carparks-data").setData({
        type: "geojson",
        ...window.geojsonData
      });

      if (data.op_type == 1) { // User Clicked on "I'm interested" button.
        window.interestedCarparkNo = carParkNo;
        $("#mapboxgl-popup-content-button").text("I'm no longer interested.");
        var i = Number($("#mapboxgl-popup-content-interested").text());
        i++;
        $("#mapboxgl-popup-content-interested").text(i);
        updateNearbyCarparksList(null, findCarparkFromNo(window.interestedCarparkNo));
      } else { // User Clicked on "I'm no longer interested" button.
        window.interestedCarparkNo = null;
        storedInterestedCarpark = null;
        $("#mapboxgl-popup-content-button").text("I'm interested.");
        var i = Number($("#mapboxgl-popup-content-interested").text());
        i--;
        $("#mapboxgl-popup-content-interested").text(i);
        updateNearbyCarparksList(null, null);
      }
    }
  } catch (error) {
    return console.error(error);
  }
};

// Search for a location first and then the nearby carparks
// and update the nearby carpark lists
async function search() {
  var location = locationInput.value;
  var geocodingurl =
    "https://api.mapbox.com/geocoding/v5/mapbox.places/" +
    encodeURIComponent(location) +
    ".json?access_token=" +
    mapboxgl.accessToken +
    "&country=sg&proximity=103.8198,1.3521";

  try {
    /* use mapbox geocoding api to turn search term into
    the closest matching physical location */
    const response = await fetch(geocodingurl);
  
    const data = await response.json();
    var coordinates = data.features[0].center;
    const radiusInKm = parseFloat(radiusInput.value);

    placeSearchMarker(coordinates, data.features[0].place_name);
    centerMap(coordinates, radiusInKm);
    var nearbyCarparks = await findNearbyCarparks(coordinates, radiusInKm);
    updateNearbyCarparksList(nearbyCarparks, null);

  } catch (error) {
    return console.error(error);
  }
}

function createCarparksListItem(carpark, interested) {
  const carparkCoordinate = carpark.geometry.coordinates;
  const properties = carpark.properties;
  const address = properties.address;
  const vacancyPercentage = properties.vacancy_percentage;
  const distanceInKM = properties.distanceInKM;

  const button = $("<button/>", {
    type: "button",
    class: "list-group-item list-group-item-action",
    html: `${address}<br>
              <span class="badge badge-secondary badge-pill">${vacancyPercentage}% Vacant</span>`
  });

  if (typeof distanceInKM !== 'undefined' && distanceInKM !== null) {
    button.append(`<span class="badge badge-info badge-pill">${distanceInKM}km</span>`);
  }
  if (interested) {
    button.addClass("active");
    button.append(`<span class="badge badge-success badge-pill">Interested</span>`);
  }

  // When the button is clicked, the respective carpark popup will show up
  button.click(function () {
    // center map on selected carpark
    // radius 2.5 is the best because if you zoom in too much, then it will be disorienting
    // for the user, if you zoom out too much, then the click event might trigger on the wrong carpark
    centerMap(carparkCoordinate, 2.5);

    /* Trigger the click event at the specified latitude and longitude
    this will create a Carpark popup. This introduces some visual artifacts
    on the pins - not that bad. If the map is too zoomed out, might click on
    the wrong pin.*/
    map.fire("click", { lngLat: carparkCoordinate, point: map.project(carparkCoordinate), originalEvent: {} });
  });

  return button;
}

// Update the nearby carparks list on the sidebar
// coordinates is the center of the search parameter/circle
// THIS FUNCTION IS WRITTEN HORRIBLY
// If you want to update the list with a new nearbycarpark: uNCL(newcarpark, null)
// If you want to update the list with a new interestedcarpark: uNCL(null, interestedcarpark)
// If you want to delete interestedcarpark: set storedInterestedCarpark = null and run uNCL(null, null);
function updateNearbyCarparksList(nearbyCarparks, interestedCarpark) {
  const nearbyCarparksList = $("#nearby-carparks-list");

  nearbyCarparksList.empty();

  // Update interested carpark
  if (interestedCarpark !== null) {
    storedInterestedCarpark = {...interestedCarpark};
  }

  if (storedInterestedCarpark !== null) {
    nearbyCarparksList.append(createCarparksListItem(storedInterestedCarpark, true))
  }

  // Update nearby carpark
  if (nearbyCarparks !== null) {
    storedNearbyCarparks = nearbyCarparks;
  }

  if (storedNearbyCarparks !== null) {
    storedNearbyCarparks.forEach((carpark) => {
      
      const coordinates = carpark.geometry.coordinates;
      const properties = carpark.properties;
  
      // Skip the interested carpark
      if (properties.car_park_no === window.interestedCarparkNo) {
        return;
      }
      
      const address = properties.address;
      const vacancyPercentage = properties.vacancy_percentage;
      const distanceInKM = properties.distanceInKM;
  
      nearbyCarparksList.append(createCarparksListItem(carpark, false));
    });
  }  
}

function placeSearchMarker(coordinates, placeName) {
  // remove search marker if it exists already.
  if (searchMarker !== null) {
    searchMarker.remove();
  } 

  // place a new search marker
  searchMarker = new mapboxgl.Marker()
                      .setLngLat(coordinates)
                      .setPopup(
                        new mapboxgl.Popup({ offset: 25 }).setHTML(
                          "<p><strong>Your Search: </strong>" + placeName + "</p>"
                        )
                      )
                      .addTo(map);
}

// Center map on the given coordinate and radius (in km)
function centerMap(coordinates = null, radius = null) {
  // Use the current map center if coordinate is not given
  if (coordinates === null) {
    coordinates = map.getCenter().toArray();
  }

  // don't zoom in if radius is not given
  if (radius === null) {
    map.setCenter(coordinates);
    return;
  }

  const radiusInDegrees = radius / 111.32;
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


// The radius input also controls the map zoom level
radiusInput.addEventListener("input", function () {
  $("#radius-label").text(`${radiusInput.value} km`);
  centerMap(null, parseFloat(radiusInput.value))
});


searchForm.addEventListener("submit", async function(event) {
  event.preventDefault();
  
  const submitButton = searchForm.querySelector("button");
  const enabledLabel = submitButton.querySelector(".enabled-label");
  const disabledLabel = submitButton.querySelector(".disabled-label");
  const disabledSpinner = submitButton.querySelector(".spinner-border");

  // Show buffering icon
  submitButton.disabled = true;
  enabledLabel.style.display = "none";
  disabledSpinner.style.display = "";
  disabledLabel.style.display = "";

  await search();

  // Remove buffering icon
  disabledLabel.style.display = "none";
  disabledSpinner.style.display = "none";
  enabledLabel.style.display = "";
  submitButton.disabled = false;
});

// Set initial value of radius label (without jquery)
document.getElementById("radius-label").textContent = radiusInput.value + "km";

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

  // Format interestedCarpark, Jinja passes it as "None" instead of null or None
  if (window.interestedCarparkNo === "None") {
    window.interestedCarparkNo = null;    
  }
  updateNearbyCarparksList(null, findCarparkFromNo(window.interestedCarparkNo));
});

// Display popup containing carpark information when clicking on a pin
map.on("click", "carparks-layer", (e) => {
  // Remove any exisiting popups
  $(".mapboxgl-popup-content").remove();
  $(".mapboxgl-popup-tip").remove();

  const coordinates = e.features[0].geometry.coordinates.slice();
  const properties = e.features[0].properties;

  const address = properties.address;
  const carParkNo = properties.car_park_no;
  const carparkType = properties.car_park_type;
  const freeParking = properties.free_parking;
  const lotsAvailable = properties.lots_available;
  const noOfInterestedDrivers = properties.no_of_interested_drivers;
  const typeOfParkingSystem = properties.type_of_parking_system;
  const vacancyPercentage = properties.vacancy_percentage;


  const interestedCarpark = window.interestedCarparkNo;

  var interestedButtonText = "I'm interested";
  if (carParkNo == interestedCarpark) {
    interestedButtonText = "I'm no longer interested";
  }

  while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
    coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
  }

  var desc = `<div class="row">
                <div class="col-12">
                  <h6>${address} (${carParkNo})</h6>
                </div>
              </div>
              <br>
              <div class="row">
              <div class="col-12">
                <strong>Carpark Type</strong>
              </div>
              <div class="col-12">
                ${carparkType}
              </div>
            </div>
            <div class="row">
              <div class="col-12">
                <strong>Free Parking</strong>
              </div>
              <div class="col-12">
                ${freeParking}
              </div>
            </div>
            <div class="row">
              <div class="col-12">
                <strong>Type of Parking</strong>
              </div>
              <div class="col-12">
                ${typeOfParkingSystem}
              </div>
            </div>
            <br>
            <div class="row">
              <div class="col-8">
                <strong>Lots Available</strong>
              </div>
              <div class="col">
                ${lotsAvailable}
              </div>
            </div>
            <div class="row">
              <div class="col-8">
                <strong>Vacancy Percentage</strong> 
              </div>
              <div class="col">
                ${vacancyPercentage}%
              </div>
            </div>
            <div class="row">
              <div class="col-8">
                <strong>Interested Drivers</strong>
              </div>
              <div class="col">
                <span id="mapboxgl-popup-content-interested">${noOfInterestedDrivers}</span>
              </div>
            </div>
            <br>
              `

  if (window.hasVehicle) {
    let buttonHTML = `<button type="button"
                               onClick="addCarpark('${address}','${carParkNo}')"
                               class="btn btn-primary btn-sm"
                               id="mapboxgl-popup-content-button">
                               ${interestedButtonText}
                      </button>`;
    desc = desc + buttonHTML;
  }

  new mapboxgl.Popup().setLngLat(coordinates).setHTML(desc).addTo(map);
});

// Increase opacity of pins when zooming in and
// decrease opacity of pins when zooming out
map.on("zoom", function () {
  // Don't do anything if carparks not ready
  if (!isCarparksReady()) {
    return;
  }

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