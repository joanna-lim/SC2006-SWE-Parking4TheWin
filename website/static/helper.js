import { updateRouteUI, updateUserLocationUI, centerMapUI } from "./map.js";

// wait untill some target is ready
export async function waitTillTargetReady(isTargetReady, milliseconds) {
  while (!isTargetReady()) {
    // wait specified amount of time before retrying
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

// Returns distance between 2 coordinate points in KM
export function haversine(coord1, coord2) {
  const R = 6371; // radius of the Earth in kilometers
  const dLat = toRadians(coord2[0] - coord1[0]);
  const dLon = toRadians(coord2[1] - coord1[1]);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1[0])) * Math.cos(toRadians(coord2[0])) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.abs(distance);
}

function toRadians(degrees) {
  return degrees * Math.PI / 180;
}