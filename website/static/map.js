import { getRoute, waitTillTargetReady } from "./helper.js";
import { generateGeojsonData, updateInterestedCarpark } from "./carpark.js";
import { SpinnerButton } from "./ui.js";
import { Observer } from "./designpatterns.js";

function isMapReady(App) {
  return App.map && App.map.loaded();
}

// Determines if "carparks-data" and "carparks-layer" are ready
export function isCarparksReady(App) {
  return App.map && App.map.getSource('carparks-data') && App.map.getLayer('carparks-layer');
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

    const toCoordinates = App.interestedCarpark.coordinates;
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

// load geojson data to the map
export async function loadGeoJSONData(App) {
  try {
    await waitTillTargetReady(() => isMapReady(App), 100);

    App.map.addSource("carparks-data", {
      type: "geojson",
      data: generateGeojsonData(App.carparkData.carparkList),
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

class Popup extends Observer{
  constructor(App, carpark) {
    super();
    
    this.carpark = carpark;

    const { map, interestedCarparkNo, hasVehicle } = App;
    const { coordinates, address, car_park_no, car_park_type, free_parking, lots_available, 
            no_of_interested_drivers, type_of_parking_system, vacancy_percentage } = carpark;

    let desc = Popup.generatePopupHTML(address, car_park_no, car_park_type,
      free_parking, lots_available, no_of_interested_drivers,
      type_of_parking_system, vacancy_percentage);
    
    console.log(car_park_no, interestedCarparkNo);

    let interestedButtonText = car_park_no == interestedCarparkNo ? "I'm no longer interested" : "I'm interested";

    if (hasVehicle) {
      let buttonHTML = `<button type="button"
                                class="btn btn-primary btn-sm w-100"
                                id="mapboxgl-popup-content-button">
                                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" style="display:none;"></span>
                                <span class="disabled-label" style="display: none;">Updating</span>
                                <span class="enabled-label">${interestedButtonText}</span>     
                        </button>`;
      desc = desc + buttonHTML;
    }

    this.popup = new mapboxgl.Popup().setLngLat(coordinates).setHTML(desc).addTo(map);
    new SpinnerButton("mapboxgl-popup-content-button", async () => {
      await updateInterestedCarpark(App, address, car_park_no);
      let interestedButtonText2 = car_park_no == App.interestedCarparkNo ? "I'm no longer interested" : "I'm interested";
      $("#mapboxgl-popup-content-button .enabled-label").text(interestedButtonText2);
    });

    this.carpark.addObserver(this, "carpark-update", (data) => {
      let { address, car_park_no, car_park_type, free_parking, lots_available, 
        no_of_interested_drivers, type_of_parking_system, vacancy_percentage } = data;

      $("#mapboxgl-popup-details")
        .replaceWith(Popup.generatePopupHTML(address, car_park_no, car_park_type, free_parking,
                                              lots_available, no_of_interested_drivers, type_of_parking_system,
                                               vacancy_percentage));
    });

    console.log(this.carpark);
  }

  destroy() {
    // Remove exisiting popup
    this.popup.remove();
    this.carpark.removeObserver(this);
  }

  static generatePopupHTML(address, car_park_no, car_park_type,
    free_parking, lots_available, no_of_interested_drivers,
    type_of_parking_system, vacancy_percentage) {

    var desc = `<div id="mapboxgl-popup-details">
                <div class="row">
                  <div class="col-12">
                    <h6>${address} (${car_park_no})</h6>
                  </div>
                </div>
                <br>
                <div class="row">
                <div class="col-12">
                  <strong>Carpark Type</strong>
                </div>
                <div class="col-12">
                  ${car_park_type}
                </div>
              </div>
              <div class="row">
                <div class="col-12">
                  <strong>Free Parking</strong>
                </div>
                <div class="col-12">
                  ${free_parking}
                </div>
              </div>
              <div class="row">
                <div class="col-12">
                  <strong>Type of Parking</strong>
                </div>
                <div class="col-12">
                  ${type_of_parking_system}
                </div>
              </div>
              <br>
              <div class="row">
                <div class="col-8">
                  <strong>Lots Available</strong>
                </div>
                <div class="col">
                  ${lots_available}
                </div>
              </div>
              <div class="row">
                <div class="col-8">
                  <strong>Vacancy Percentage</strong> 
                </div>
                <div class="col">
                  ${vacancy_percentage}%
                </div>
              </div>
              <div class="row">
                <div class="col-8">
                  <strong>Interested Drivers</strong>
                </div>
                <div class="col">
                  <span>${no_of_interested_drivers}</span>
                </div>
              </div>
              <br>
              </div>
                `

    return desc;
  }
}

// Ensures that only one instance of the popup exists
export class PopupSingletonFactory {
  constructor() {
    this.popup = null;
  }

  createPopup(App, car_park_no) {

    if (this.popup) this.popup.destroy();

    this.popup = new Popup(App, App.carparkData.findCarparkByNo(car_park_no));
  }
}