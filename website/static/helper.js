import { updateRouteUI, updateUserLocationUI, centerMapUI } from "./map.js";

// wait untill some target is ready
export async function waitTillTargetReady(isTargetReady, milliseconds) {
  while (!isTargetReady()) {
    // wait 1 second before retrying
    await new Promise(resolve => setTimeout(resolve, milliseconds));
  }
}

// Get directions from one point to another using mapbox directions API
export async function getRoute(fromCoordinates, toCoordinates) {
  try {
    var apiUrl = 'https://api.mapbox.com/directions/v5/mapbox/driving/' +
      fromCoordinates[0] + ',' + fromCoordinates[1] + ';' +
      toCoordinates[0] + ',' + toCoordinates[1] +
      '?access_token=' + mapboxgl.accessToken +
      '&geometries=geojson&overview=full';

    const response = await fetch(apiUrl);
    const data = await response.json();

    return data.routes[0].geometry.coordinates;
  } catch (error) {
    console.error(error);
  }
}

// This will prompt the user for their location and then update the marker
// and routes
export async function getUserLocation(App) {
  // check if geolocation permission is granted
  navigator.permissions.query({ name: 'geolocation' }).then(async function (permissionStatus) {
    if (permissionStatus.state === 'granted' || permissionStatus.state === 'prompt') {
      navigator.geolocation.getCurrentPosition(async function (position) {
        const { latitude, longitude } = position.coords;

        App.userLocation = [longitude, latitude];
        await updateRouteUI(App);
        updateUserLocationUI(App);
        centerMapUI(App, App.userLocation);

      }, async function (error) {
        // use the center of map as user location if permission is denied.
        const centerOfMap = App.map.getCenter();
        App.userLocation = [centerOfMap.lng, centerOfMap.lat];

        await updateRouteUI(App);
        updateUserLocationUI(App);
        centerMapUI(App, App.userLocation);
      });
    } else {
      const centerOfMap = App.map.getCenter();
      App.userLocation = [centerOfMap.lng, centerOfMap.lat];

      await updateRouteUI(App);
      updateUserLocationUI(App);
      centerMapUI(App, App.userLocation);
    }
  });
}