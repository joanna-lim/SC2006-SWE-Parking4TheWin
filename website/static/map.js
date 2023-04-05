import { getRoute, waitTillTargetReady } from "./helper.js";
import { isCarparksReady } from "./carpark.js";

// Mapbox related stuff

export function isMapReady(App) {
  return App.map && App.map.loaded();
}

// Display message on map which will timeout after a certain time
// messageType is `X` where `alert-X` is a boostrap class for alerts.
export function displayMessageOnMap(message, messageType, timeout) {
  // Generate random number which will be used to uniquely identify the message
  const min = 1;
  const max = 100;
  const tag = Math.floor(Math.random() * (max - min + 1)) + min;

  const alertMessage = $(`
    <div class="alert alert-${messageType} alert-dismissable fade show ml-5 mr-5" role="alert" 
         style="z-index: 3;"
         id="map-message-${messageType}-${tag}">
      ${message}
    </div>`
  );

  $("#map").append(alertMessage);

  setTimeout(() => {
    $(`#map-message-${messageType}-${tag}`).remove();
  }, timeout);
}

// Display the route from one point to another on the map 
async function displayRouteUI(App, fromCoordinates, toCoordinates) {
  try {
    const routeCoordinates = await getRoute(fromCoordinates, toCoordinates);

    // Wait untill map is loaded and carparks are ready
    await waitTillTargetReady(() => {
      return isMapReady(App) && isCarparksReady(App);
    }, 100);

    // remove old route
    await removeRouteUI(App);

    App.map.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: routeCoordinates
        }
      }
    });

    App.map.addLayer({
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

export async function updateRouteUI(App) {
  try {
    if (App.interestedCarpark === null) {
      await removeRouteUI(App);
      return;
    }

    const toCoordinates = App.interestedCarpark.geometry.coordinates;
    await displayRouteUI(App, App.userLocation, toCoordinates);
  } catch (error) {
    console.error(error);
  }
}

// Ensure that the route is removed, if there is any
async function removeRouteUI(App) {
  if (App.map.getLayer("route")) {
    App.map.removeLayer("route");
  }

  if (App.map.getSource("route")) {
    App.map.removeSource("route");
  }
}

// Center map on the given coordinate and radius (in km)
export function centerMapUI(App, coordinates = null, radius = null) {
  // Use the current map center if coordinate is not given
  if (coordinates === null) {
    coordinates = App.map.getCenter().toArray();
  }

  // don't zoom in if radius is not given
  if (radius === null) {
    App.map.setCenter(coordinates);
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

  App.map.fitBounds(bounds);
}

// Place a search marker at the coordinate on the map
// A search marker is different from a Pop Up
export function placeSearchMarkerUI(App, coordinates, placeName) {
  // remove search marker if it exists already.
  if (App.searchMarker !== null) {
    App.searchMarker.remove();
  }

  // place a new search marker
  App.searchMarker = new mapboxgl.Marker()
    .setLngLat(coordinates)
    .setPopup(
      new mapboxgl.Popup({ offset: 25 }).setHTML(
        "<p><strong>Your Search: </strong>" + placeName + "</p>"
      )
    )
    .addTo(App.map);
}

export function updateUserLocationUI(App) {
  if (App.userMarker) {
    App.userMarker.remove();
  }

  App.userMarker = new mapboxgl.Marker({ color: "blue" })
    .setLngLat(App.userLocation)
    .setPopup(new mapboxgl.Popup().setHTML('You are here.'))
    .addTo(App.map);
}

// fetch GeoJSON and load it to the map as a layer if ready
export async function loadGeoJSONData(App) {
  try {
    const response = await fetch("/carparks", {
      method: "GET"
    });
    App.geojsonData = await response.json();
    await waitTillTargetReady(() => isMapReady(App), 100);

    App.map.addSource("carparks-data", {
      type: "geojson",
      data: App.geojsonData,
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

    const shades = App.isColorBlindModeOn ? colorBlindColours : defaultColours;

    // Add a layer containing pins using "carparks-data" source
    App.map.addLayer({
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