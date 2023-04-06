import { isCarparksReady, displayMessageOnMap, updateRouteUI, centerMapUI, placeSearchMarkerUI, updateUserLocationUI, loadGeoJSONData, PopupSingletonFactory } from "./map.js";
import { updateIHaveParkedButtonUI, showSortButtonsUI, updateSortButtonsUI, updateInterestedCarparkUI, updateNearbyCarparksListUI } from "./sidebar.js";
import CarparkData, { updateInterestedCarpark } from "./carpark.js";
import { waitTillTargetReady, getUserLocation } from "./helper.js";
import { SpinnerButton } from "./ui.js";

mapboxgl.accessToken = window.MAPBOX_SECRET_KEY;

var searchForm = document.getElementById("search-form");
var locationInput = document.getElementById("location-input");
var radiusInput = document.getElementById("radius-input");

var App = {};

App.carparkData = new CarparkData(App);
App.map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/streets-v12",
  center: [103.8198, 1.3521],
  zoom: 12,
});

App.searchMarker = null;    // there can only be one search marker at a time
App.interestedCarpark = null; // this is different from window.interestedCarparkNo
App.nearbyCarparks = null;

App.popupSingletonFactory = new PopupSingletonFactory();

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
App.interestedCarparkNo = window.interestedCarparkNo === "None" ? null : window.interestedCarparkNo;

App.hasVehicle = window.hasVehicle;

App.isColorBlindModeOn = false;

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
    const newNearbyCarparks = await App.carparkData.findNearbyCarparks(coordinates, radiusInKm);
    App.nearbyCarparks = newNearbyCarparks;

    // if user is searching for the first time
    if (App.sortType === null) {
      App.sortType = 'vacancy';
      App.sortOrder = 'desc';
    }

    App.carparkData.sortCarparks();
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
  const response = await fetch("/carparks", {
    method: "GET"
  });
  const data = await response.json();

  await App.carparkData.initializeFromJson(data);

  loadGeoJSONData(App);

  const newInterestedCarpark = await App.carparkData.findCarparkByNo(App.interestedCarparkNo);
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

new SpinnerButton("search-form-submit-button", search);

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
  App.carparkData.sortCarparks();
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
  App.carparkData.sortCarparks();
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
  const { car_park_no } = e.features[0].properties;

  App.popupSingletonFactory.createPopup(App, car_park_no);

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