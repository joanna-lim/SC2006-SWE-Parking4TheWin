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
import { displayMessageOnMap, updateRouteUI, centerMapUI, placeSearchMarkerUI, updateUserLocationUI, loadGeoJSONData } from "./map.js";
import { updateIHaveParkedButtonUI, showSortButtonsUI, updateSortButtonsUI, updateInterestedCarparkUI, updateNearbyCarparksListUI } from "./sidebar.js";
import { findCarparkFromNo, findNearbyCarparks, isCarparksReady, sortCarparks } from "./carpark.js";
import { waitTillTargetReady, getUserLocation } from "./helper.js";

mapboxgl.accessToken = window.MAPBOX_SECRET_KEY;

var searchForm = document.getElementById("search-form");
var locationInput = document.getElementById("location-input");
var radiusInput = document.getElementById("radius-input");

var App = {};
App.geojsonData = null;
App.map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/streets-v12",
  center: [103.8198, 1.3521],
  zoom: 12,
});

App.searchMarker = null;    // there can only be one search marker at a time
App.interestedCarpark = null; // this is different from window.interestedCarparkNo
App.nearbyCarparks = null;

// sort attributes related to sorting of nearby carparks
// this won't be set untill the user searches for something
App.sortType = null; // 'vacancy' or 'distance'
App.sortOrder = null; // 'asc' or 'desc'
App.oldSortOrder = null;

// Set default user location to the middle of Singapore
App.userLocation = [103.8198, 1.3521];
App.userMarker = null;

// Jinja passes interested carpark as "None" instead of null
// Ensure that it is null
App.interestedCarparkNo = interestedCarparkNo === "None" ? null : interestedCarparkNo;

App.isColorBlindModeOn = false;

// Update database with the user's interested carpark
// and then the popup info
async function updateInterestedCarpark(address, carParkNo) {
  try {
    const interestedButton = $("#mapboxgl-popup-content-button");
    const interestedContent = $("#mapboxgl-popup-content-interested"); // text containing the # of interested drivers

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
      App.geojsonData = data.updatedgeojsondata;
      App.map.getSource("carparks-data").setData({
        type: "geojson",
        ...App.geojsonData
      });

      if (data.op_type == 1) { // User Clicked on "I'm interested" button.
        window.interestedCarparkNo = carParkNo;

        // Change button to "Update"
        var newInterestedCarpark = await findCarparkFromNo(App, window.interestedCarparkNo);

        // Update button
        interestedButton.find(".enabled-label").text("I'm no longer interested.");

        // Then update the count - note that this is a lazy update i.e. just +1
        // instead of retrieving live count from server
        var i = Number(interestedContent.text());
        i++;
        interestedContent.text(i);
        App.interestedCarpark = { ...newInterestedCarpark };
      } else { // User Clicked on "I'm no longer interested" button.
        window.interestedCarparkNo = null;
        App.interestedCarpark = null;
        interestedButton.find(".enabled-label").text("I'm interested.");
        var i = Number(interestedContent.text());
        i--;
        interestedContent.text(i);
        App.interestedCarpark = null;
      }
    }
    // Update side
    updateInterestedCarparkUI(App);
    updateIHaveParkedButtonUI(App);
    // Update route
    await updateRouteUI(App);

    interestedButton.find(".spinner-border").hide();
    interestedButton.find(".disabled-label").hide();
    interestedButton.find(".enabled-label").show();
    interestedButton.prop('disabled', false);


  } catch (error) {
    return console.error(error);
  }
};

// Search for a location first and then the nearby carparks
// and update the nearby carpark lists
async function search() {
  var location = locationInput.value;

  if (locationInput.value.trim() === "") {
    displayMessageOnMap("You must enter a valid search location.", "warning", 2000);
    return null;
  }

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

    if (data.features.length === 0) {
      displayMessageOnMap("You have entered an invalid location or we were unable to find your location. Please try again.", "warning", 2000);
      return null;
    }

    var coordinates = data.features[0].center;
    const radiusInKm = parseFloat(radiusInput.value);

    placeSearchMarkerUI(App, coordinates, data.features[0].place_name);
    centerMapUI(App, coordinates, radiusInKm);
    const newNearbyCarparks = await findNearbyCarparks(App, coordinates, radiusInKm);
    App.nearbyCarparks = newNearbyCarparks;

    // if user is searching for the first time
    if (App.sortType === null) {
      App.sortType = 'vacancy';
      App.sortOrder = 'desc';
    }

    sortCarparks(App);
    updateNearbyCarparksListUI(App);
    showSortButtonsUI();
    updateSortButtonsUI(App);
  } catch (error) {
    return console.error(error);
  }
}

///////////////////////////////////////////////////////////////////////////////
////////////////                                      ////////////////////////
/////////////////////////////////////////////////////////////////////////////

// 
async function initialSetupUI() {
  loadGeoJSONData(App);
  
  await waitTillTargetReady(() => App.geojsonData, 100);

  const newInterestedCarpark = await findCarparkFromNo(App, window.interestedCarparkNo);
  if (newInterestedCarpark !== null) {
    App.interestedCarpark = { ...newInterestedCarpark };
  }
  
  updateInterestedCarparkUI(App);
  updateIHaveParkedButtonUI(App);

  updateUserLocationUI(App);
  updateRouteUI(App);
}

initialSetupUI();


// The radius input also controls the map zoom level
radiusInput.addEventListener("input", function () {
  $("#radius-label").text(`${radiusInput.value} km`);
  centerMapUI(App, null, parseFloat(radiusInput.value))
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
  if (App.sortType !== "distance") {
    let temp = App.sortOrder;
    App.sortType = "distance";
    App.sortOrder = App.oldSortOrder === null ? "asc" : App.oldSortOrder;
    App.oldSortOrder = temp;
  } else {
    // toggle
    App.sortOrder = App.sortOrder === "asc" ? "desc" : "asc";
  }
  sortCarparks(App);
  updateNearbyCarparksListUI(App);
  updateSortButtonsUI(App);
});

document.getElementById("vacancy-sort-button").addEventListener("click", () => {
  if (App.sortType !== "vacancy") {
    let temp = App.sortOrder;
    App.sortType = "vacancy";
    App.sortOrder = App.oldSortOrder === null ? "asc" : App.oldSortOrder;
    App.oldSortOrder = temp;
  } else {
    // toggle
    App.sortOrder = App.sortOrder === "asc" ? "desc" : "asc";
  }
  sortCarparks(App);
  updateNearbyCarparksListUI(App);
  updateSortButtonsUI(App);
});

document.getElementById("sidebar-toggle-button").addEventListener("click", () => {
  let sidebar = $('#custom-sidebar');
  let sidebarToggleButton = $('#sidebar-toggle-button');
  let sidebarToggleButtonExpanIcon = sidebarToggleButton.find(".sidebar-expand-icon");
  let sidebarToggleButtonCollapseIcon = sidebarToggleButton.find(".sidebar-collapse-icon");

  if (sidebar.is(':visible')) {
    sidebar.hide();
    sidebarToggleButton.removeClass('sidebar-toggle-button-expanded');
    sidebarToggleButtonCollapseIcon.hide();
    sidebarToggleButtonExpanIcon.show();
    App.map.resize();
  } else {
    sidebarToggleButtonExpanIcon.hide();
    sidebarToggleButtonCollapseIcon.show();
    sidebarToggleButton.addClass('sidebar-toggle-button-expanded');
    sidebar.show();
    App.map.resize();
  }
});

document.getElementById("get-user-location-btn").addEventListener("click", () => getUserLocation(App));

colorBlindModeBtn.addEventListener("click", function () {
    App.isColorBlindModeOn = !App.isColorBlindModeOn;
    App.map.removeLayer("carparks-layer");
    App.map.removeSource("carparks-data");
    loadGeoJSONData(App);
  });

// Display popup containing carpark information when clicking on a pin
App.map.on("click", "carparks-layer", (e) => {
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
                               class="btn btn-primary btn-sm w-100"
                               id="mapboxgl-popup-content-button">
                               <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" style="display:none;"></span>
                               <span class="disabled-label" style="display: none;">Updating</span>
                               <span class="enabled-label">${interestedButtonText}</span>
                               
                      </button>`;
    desc = desc + buttonHTML;
  }

  new mapboxgl.Popup().setLngLat(coordinates).setHTML(desc).addTo(App.map);
  $("#mapboxgl-popup-content-button").click(() => updateInterestedCarpark(address, carParkNo));
});

// Increase opacity of pins when zooming in and
// decrease opacity of pins when zooming out
App.map.on("zoom", function () {
  // Don't do anything if carparks not ready
  if (!isCarparksReady(App)) {
    return;
  }

  const zoom = App.map.getZoom();

  App.map.setPaintProperty("carparks-layer", "circle-opacity", [
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
App.map.on('mouseenter', 'carparks-layer', function () {
  App.map.getCanvas().style.cursor = 'pointer';
});

// Change cursor style from "select" to "grab" when hovering off a pin
App.map.on('mouseleave', 'carparks-layer', function () {
  App.map.getCanvas().style.cursor = '';
});