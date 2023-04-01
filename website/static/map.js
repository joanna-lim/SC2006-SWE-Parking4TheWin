/*
  BEHOLD THE GLORY OF PURE JS WITHOUT MODULES
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

var geojsonData = null;
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

// sort attributes related to sorting of nearby carparks
// this won't be set untill the user searches for something
var sortType = null; // 'vacancy' or 'distance'
var sortOrder = null; // 'asc' or 'desc'
var oldSortOrder = null;

var storedUserLocation = null;
var userMarker = null;

// Jinja passes interested carpark as "None" instead of null
// Ensure that it is null
interestedCarparkNo = interestedCarparkNo === "None" ? null : interestedCarparkNo;

async function findCarparkFromNo(carparkNo) {
  if (!carparkNo) {
    return null;
  }

  await waitTillTargetReady(() => geojsonData, 100);

  for (let carpark of geojsonData.features) {
    if (carpark.properties.car_park_no === carparkNo) {
      return carpark;
    }
  }
  return null;    // this shouldn't happen
}

// For a carpark object, find the distance of the carpark from the given center coordinate
// and add it to the carpark object
function addDistanceToCarpark(coordinates, carpark) {
  const carparkCoordinate = carpark.geometry.coordinates;
  const distanceInKM = turf.distance(turf.point(coordinates),
    turf.point(carparkCoordinate),
    { units: 'kilometers' })
    .toFixed(1);
  carpark.properties.distanceInKM = parseFloat(distanceInKM);
}

// Determines if "carparks-data" and "carparks-layer" are ready
function isCarparksReady() {
  return map && map.getSource('carparks-data') && map.getLayer('carparks-layer');
}

function isMapLoaded() {
  return map && map.loaded();
}

// wait untill some target is ready
async function waitTillTargetReady(isTargetReady, milliseconds) {
  while (!isTargetReady()) {
    // wait 1 second before retrying
    await new Promise(resolve => setTimeout(resolve, milliseconds));
  }
}

// Get directions from one point to another using mapbox directions API
async function getRoute(fromCoordinates, toCoordinates) {
  try {
    var apiUrl = 'https://api.mapbox.com/directions/v5/mapbox/driving/' +
      fromCoordinates[0] + ',' + fromCoordinates[1] + ';' +
      toCoordinates[0] + ',' + toCoordinates[1] +
      '?access_token=' + mapboxgl.accessToken +
      '&geometries=geojson';

    response = await fetch(apiUrl);
    data = await response.json();

    return data.routes[0].geometry.coordinates;
  } catch (error) {
    console.error(error);
  }
}

function updateUserLocationUI() {
  if (userMarker !== null) {
    userMarker.remove();
  }

  userMarker = new mapboxgl.Marker({ color: "blue" })
    .setLngLat(storedUserLocation)
    .setPopup(new mapboxgl.Popup().setHTML('You are here.'))
    .addTo(map);
}

// This will prompt the user for their location and then update the marker
// and routes
async function getUserLocation() {
  // check if geolocation permission is granted
  navigator.permissions.query({ name: 'geolocation' }).then(async function (permissionStatus) {
    if (permissionStatus.state === 'granted' || permissionStatus.state === 'prompt') {
      navigator.geolocation.getCurrentPosition(async function (position) {
        const { latitude, longitude } = position.coords;

        storedUserLocation = [longitude, latitude];
        await updateRouteUI();
        updateUserLocationUI();
        centerMapUI(storedUserLocation);

      }, async function (error) {
        // use the center of map as user location if permission is denied.
        const centerOfMap = map.getCenter();
        storedUserLocation = [centerOfMap.lng, centerOfMap.lat];

        await updateRouteUI();
        updateUserLocationUI();
        centerMapUI(storedUserLocation);
      });
    } else {
      const centerOfMap = map.getCenter();
      storedUserLocation = [centerOfMap.lng, centerOfMap.lat];

      await updateRouteUI();
      updateUserLocationUI();
      centerMapUI(storedUserLocation);
    }
  });
}

async function findNearbyCarparks(coordinates, radiusInKm) {
  // Create a Turf.js circle object around the center point
  const options = { steps: 10, units: 'kilometers' };
  const circle = turf.circle(coordinates, radiusInKm, options);
  var carparks = null;

  await waitTillTargetReady(isCarparksReady, 100);

  /*
   * Note that the method that I used to find nearby carparks (map.querySourceFeatures)
   * has some quirks. I think it depends on the `features` visible on the map.
   * I can't change the way it works because its from mapbox API. 
   */

  // Find carparks in the Turf.js circle object
  // This will not always succeed - sometimes return an empty list and sometimes
  // return duplicate entries.
  carparks = map.querySourceFeatures('carparks-data', {
    sourceLayer: 'carparks-layer',
    filter: ['within', circle],
  });

  // This is a band-aid solution to the empty list problem.
  while (carparks === null || carparks.length === 0) {
    // wait 1 second before retrying
    await new Promise(resolve => setTimeout(resolve, 1000));

    carparks = map.querySourceFeatures('carparks-data', {
      sourceLayer: 'carparks-layer',
      filter: ['within', circle],
    });
  }

  // Remove duplicate entries
  carparks = carparks.filter((value, index, self) =>
    index === self.findIndex((t) => (
      t.properties.car_park_no === value.properties.car_park_no
    ))
  )

  carparks.forEach((carpark) => {
    addDistanceToCarpark(coordinates, carpark);
  })

  return carparks;
}

// Update database with the user's interested carpark
// and then the popup info
async function updateInterestedCarpark(address, carParkNo) {
  try {
    interestedButton = $("#mapboxgl-popup-content-button");
    interestedContent = $("#mapboxgl-popup-content-interested"); // text containing the # of interested drivers

    interestedButton.prop('disabled', true);
    interestedButton.find(".enabled-label").hide();
    interestedButton.find(".disabled-label").show();
    interestedButton.find(".spinner-border").show();

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

        // Change button to "Update"

        var newInterestedCarpark = await findCarparkFromNo(window.interestedCarparkNo);

        // Update button
        interestedButton.find(".enabled-label").text("I'm no longer interested.");

        // Then update the count - note that this is a lazy update i.e. just +1
        // instead of retrieving live count from server
        var i = Number(interestedContent.text());
        i++;
        interestedContent.text(i);
        storedInterestedCarpark = { ...newInterestedCarpark };
      } else { // User Clicked on "I'm no longer interested" button.
        window.interestedCarparkNo = null;
        storedInterestedCarpark = null;
        interestedButton.find(".enabled-label").text("I'm interested.");
        var i = Number(interestedContent.text());
        i--;
        interestedContent.text(i);
        storedInterestedCarpark = null;
      }
    }
    // Update side
    updateInterestedCarparkUI();
    updateIHaveParkedButtonUI()
    // Update route
    await updateRouteUI();

    interestedButton.find(".spinner-border").hide();
    interestedButton.find(".disabled-label").hide();
    interestedButton.find(".enabled-label").show();
    interestedButton.prop('disabled', false);


  } catch (error) {
    return console.error(error);
  }
};

// Sort stored nearby carparks based on sortType and sortOrder
// Note that this must be used in conjunction with updateNearbyCarparksUI
function sortStoredNearbyCarparks() {
  if (storedNearbyCarparks === null || sortOrder === null || sortType === null) return;

  if (sortType === "distance") {
    if (sortOrder === "asc") {
      storedNearbyCarparks.sort((a, b) => {
        return a.properties.distanceInKM - b.properties.distanceInKM;
      });
    } else {
      storedNearbyCarparks.sort((a, b) => {
        return b.properties.distanceInKM - a.properties.distanceInKM;
      });
    }
  } else {
    if (sortOrder === "asc") {
      storedNearbyCarparks.sort((a, b) => {
        return a.properties.vacancy_percentage - b.properties.vacancy_percentage;
      });
    } else {
      storedNearbyCarparks.sort((a, b) => {
        return b.properties.vacancy_percentage - a.properties.vacancy_percentage;
      });
    }
  }
}

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

    placeSearchMarkerUI(coordinates, data.features[0].place_name);
    centerMapUI(coordinates, radiusInKm);
    const newNearbyCarparks = await findNearbyCarparks(coordinates, radiusInKm);
    storedNearbyCarparks = newNearbyCarparks;

    // if user is searching for the first time
    if (sortType === null) {
      sortType = 'vacancy';
      sortOrder = 'desc';
    }

    sortStoredNearbyCarparks();
    updateNearbyCarparksListUI();
    showSortButtonsUI();
    updateSortButtonsUI();
  } catch (error) {
    return console.error(error);
  }
}

// fetch GeoJSONData from "/carparks" url
async function fetchGeoJSONData() {
  const response = await fetch("/carparks", {
    method: "GET"
  });
  geojsonData = await response.json();
}



// fetch GeoJSON and load it to the map as a layer if ready
async function loadGeoJSONData() {
  try {
    await fetchGeoJSONData();
    await waitTillTargetReady(isMapLoaded, 100);

    map.addSource("carparks-data", {
      type: "geojson",
      data: window.geojsonData,
    });

    const colorBlindColours = {
      colour1: "#f69322",
      colour2: "#0072b2",
      colour3: "#4c4c4c",
    };

    const defaultColours = {
      colour1: "red",
      colour2: "yellow",
      colour3: "green",
    }; 

    const shades = isColorBlindModeOn ? colorBlindColours : defaultColours;

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
          shades.colour1,
          50,
          shades.colour2,
          100,
          shades.colour3,
        ],
        "circle-opacity": 0.6,
      },
    });
  } catch (error) {
    console.error(error);
  }
}


// Creates and returns a carparks list item UI (button)
// If `interested` is true, then the list item will be styled differently
// Moreover, tag the list item UI with `item_id` to make it easier
// to change with jquery
function createCarparksListItemUI(carpark, interested, item_id) {
  const carparkCoordinate = carpark.geometry.coordinates;
  const properties = carpark.properties;
  const address = properties.address;
  const vacancyPercentage = properties.vacancy_percentage;
  const distanceInKM = properties.distanceInKM;

  const button = $("<button/>", {
    type: "button",
    id: item_id,
    class: "list-group-item list-group-item-action",
    html: `${address}<br>
              <span class="badge badge-secondary badge-pill mr-1">${vacancyPercentage}% Vacant</span>`
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
    centerMapUI(carparkCoordinate, 2.5);

    /* Trigger the click event at the specified latitude and longitude
    this will create a Carpark popup. This introduces some visual artifacts
    on the pins - not that bad. If the map is too zoomed out, might click on
    the wrong pin.*/
    map.fire("click", { lngLat: carparkCoordinate, point: map.project(carparkCoordinate), originalEvent: {} });
  });

  return button;
}

// Update nearby carparks list UI with value in storedNearbyCarparks
function updateNearbyCarparksListUI() {
  const nearbyCarparksList = $("#nearby-carparks-list");

  if (storedNearbyCarparks === null) return;

  nearbyCarparksList.empty();
  updateInterestedCarparkUI();

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

    nearbyCarparksList.append(createCarparksListItemUI(carpark, false, "nearby-carpark-list-item-" + properties.car_park_no));
  });
}

// Update interested carpark UI with value in storedInterestedCarpark
function updateInterestedCarparkUI() {
  const nearbyCarparksList = $("#nearby-carparks-list");

  if (storedInterestedCarpark === null) {
    $('#interested-carpark-list-item').remove();
    return;
  }

  newInterestCarparkItem = createCarparksListItemUI(storedInterestedCarpark, true, "interested-carpark-list-item");

  if ($('#interested-carpark-list-item').length) { // this tests if interested carpark list item exists
    $('#interested-carpark-list-item').replaceWith(newInterestCarparkItem);
  } else {
    nearbyCarparksList.prepend(newInterestCarparkItem);
  }
}

function showSortButtonsUI() {
  $("#distance-sort-button").show();
  $("#vacancy-sort-button").show();
}

// yes, the code is very repetitive
function updateSortButtonsUI() {
  if (sortType === "distance") {
    $("#vacancy-sort-button").addClass("sort-unfocused");
    $("#distance-sort-button").removeClass("sort-unfocused");
    if (sortOrder === "asc") {
      $("#distance-sort-button").find(".sort-up").show();
      $("#distance-sort-button").find(".sort-down").hide();
    } else {
      $("#distance-sort-button").find(".sort-down").show();
      $("#distance-sort-button").find(".sort-up").hide();
    }
  } else {
    $("#distance-sort-button").addClass("sort-unfocused");
    $("#vacancy-sort-button").removeClass("sort-unfocused");
    if (sortOrder === "asc") {
      $("#vacancy-sort-button").find(".sort-up").show();
      $("#vacancy-sort-button").find(".sort-down").hide();
    } else {
      $("#vacancy-sort-button").find(".sort-down").show();
      $("#vacancy-sort-button").find(".sort-up").hide();
    }
  }
}

function updateIHaveParkedButtonUI() {
  if (storedInterestedCarpark === null) {
    $('#i-have-parked-btn').hide();
  } else {
    $('#i-have-parked-btn').show();
  }
}

// Place a search marker at the coordinate on the map
// A search marker is different from a Pop Up
function placeSearchMarkerUI(coordinates, placeName) {
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
function centerMapUI(coordinates = null, radius = null) {
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

// Ensure that the route is removed, if there is any
async function removeRouteUI() {
  if (map.getLayer("route")) {
    map.removeLayer("route");
  }

  if (map.getSource("route")) {
    map.removeSource("route");
  }
}

// Display the route from one point to another on the map 
async function displayRouteUI(fromCoordinates, toCoordinates) {
  try {
    const routeCoordinates = await getRoute(fromCoordinates, toCoordinates);

    // Wait untill map is loaded and carparks are ready
    await waitTillTargetReady(() => {
      return isMapLoaded() && isCarparksReady();
    }, 100);

    // remove old route
    await removeRouteUI();

    map.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: routeCoordinates
        }
      }
    });

    map.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#0069D9',
        'line-width': 6
      }
    });

  } catch (error) {
    console.error(error);
  }
}

async function updateRouteUI() {
  try {
    if (storedInterestedCarpark === null) {
      await removeRouteUI();
      return;
    }

    toCoordinates = storedInterestedCarpark.geometry.coordinates;
    await displayRouteUI(storedUserLocation, toCoordinates);
  } catch (error) {
    console.error(error);
  }
}

///////////////////////////////////////////////////////////////////////////////
////////////////                                      ////////////////////////
/////////////////////////////////////////////////////////////////////////////

// 
async function initialSetupUI() {
  loadGeoJSONData();
  const newInterestedCarpark = await findCarparkFromNo(window.interestedCarparkNo);
  if (newInterestedCarpark !== null) {
    storedInterestedCarpark = { ...newInterestedCarpark };
  }
  updateInterestedCarparkUI();
  updateIHaveParkedButtonUI();

  // Set default user location to the middle of Singapore
  storedUserLocation = [103.8198, 1.3521];
  updateUserLocationUI();

  updateRouteUI();
}

initialSetupUI();


// The radius input also controls the map zoom level
radiusInput.addEventListener("input", function () {
  $("#radius-label").text(`${radiusInput.value} km`);
  centerMapUI(null, parseFloat(radiusInput.value))
});


searchForm.addEventListener("submit", async function (event) {
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

document.getElementById("distance-sort-button").addEventListener("click", () => {
  if (sortType !== "distance") {
    let temp = sortOrder;
    sortType = "distance";
    sortOrder = oldSortOrder === null ? "asc" : oldSortOrder;
    oldSortOrder = temp;
  } else {
    // toggle
    sortOrder = sortOrder === "asc" ? "desc" : "asc";
  }
  sortStoredNearbyCarparks();
  updateNearbyCarparksListUI();
  updateSortButtonsUI();
});

document.getElementById("vacancy-sort-button").addEventListener("click", () => {
  if (sortType !== "vacancy") {
    let temp = sortOrder;
    sortType = "vacancy";
    sortOrder = oldSortOrder === null ? "asc" : oldSortOrder;
    oldSortOrder = temp;
  } else {
    // toggle
    sortOrder = sortOrder === "asc" ? "desc" : "asc";
  }
  sortStoredNearbyCarparks();
  updateNearbyCarparksListUI();
  updateSortButtonsUI();
});

document.getElementById("sidebar-toggle-button").addEventListener("click", () => {
  sidebar = $('#custom-sidebar');
  sidebarToggleButton = $('#sidebar-toggle-button');
  sidebarToggleButtonExpanIcon = sidebarToggleButton.find(".sidebar-expand-icon");
  sidebarToggleButtonCollapseIcon = sidebarToggleButton.find(".sidebar-collapse-icon");

  if (sidebar.is(':visible')) {
    sidebar.hide();
    sidebarToggleButton.removeClass('sidebar-toggle-button-expanded');
    sidebarToggleButtonCollapseIcon.hide();
    sidebarToggleButtonExpanIcon.show();
    map.resize();
  } else {
    sidebarToggleButtonExpanIcon.hide();
    sidebarToggleButtonCollapseIcon.show();
    sidebarToggleButton.addClass('sidebar-toggle-button-expanded');
    sidebar.show();
    map.resize();
  }
});

document.getElementById("get-user-location-btn").addEventListener("click", getUserLocation);

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
                               onClick="updateInterestedCarpark('${address}','${carParkNo}')"
                               class="btn btn-primary btn-sm w-100"
                               id="mapboxgl-popup-content-button">
                               <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" style="display:none;"></span>
                               <span class="disabled-label" style="display: none;">Updating</span>
                               <span class="enabled-label">${interestedButtonText}</span>
                               
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