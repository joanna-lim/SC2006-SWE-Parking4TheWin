import { centerMapUI } from "./map.js";

export function updateIHaveParkedButtonUI(App) {
  if (App.interestedCarpark) {
    $('#i-have-parked-btn').show();
  } else {
    $('#i-have-parked-btn').hide();
  }
}

export function showSortButtonsUI() {
  $("#distance-sort-button").show();
  $("#vacancy-sort-button").show();
}

// yes, the code is very repetitive
export function updateSortButtonsUI(App) {
  if (App.sortType === "distance") {
    $("#vacancy-sort-button").addClass("sort-unfocused");
    $("#distance-sort-button").removeClass("sort-unfocused");
    if (App.sortOrder === "asc") {
      $("#distance-sort-button").find(".sort-up").show();
      $("#distance-sort-button").find(".sort-down").hide();
    } else {
      $("#distance-sort-button").find(".sort-down").show();
      $("#distance-sort-button").find(".sort-up").hide();
    }
  } else {
    $("#distance-sort-button").addClass("sort-unfocused");
    $("#vacancy-sort-button").removeClass("sort-unfocused");
    if (App.sortOrder === "asc") {
      $("#vacancy-sort-button").find(".sort-up").show();
      $("#vacancy-sort-button").find(".sort-down").hide();
    } else {
      $("#vacancy-sort-button").find(".sort-down").show();
      $("#vacancy-sort-button").find(".sort-up").hide();
    }
  }
}

// Creates and returns a carparks list item UI (button)
// If `interested` is true, then the list item will be styled differently
// Moreover, tag the list item UI with `item_id` to make it easier
// to change with jquery
function createCarparksListItemUI(App, carpark, interested, item_id) {
  const carparkCoordinate = carpark.coordinates;
  const address = carpark.address;
  const vacancyPercentage = carpark.vacancy_percentage;
  const distane_in_km = carpark.distance_in_km;

  const button = $("<button/>", {
    type: "button",
    id: item_id,
    class: "list-group-item list-group-item-action",
    html: `${address}<br>
              <span class="badge badge-secondary badge-pill mr-1">${vacancyPercentage}% Vacant</span>`
  });

  if (typeof distane_in_km !== 'undefined' && distane_in_km !== null) {
    button.append(`<span class="badge badge-info badge-pill">${distane_in_km}km</span>`);
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
    centerMapUI(App, carparkCoordinate, 2.5);

    /* Trigger the click event at the specified latitude and longitude
    this will create a Carpark popup. This introduces some visual artifacts
    on the pins - not that bad. If the map is too zoomed out, might click on
    the wrong pin.*/
    App.map.fire("click", { lngLat: carparkCoordinate, point: App.map.project(carparkCoordinate), originalEvent: {} });
  });

  return button;
}


// Update nearby carparks list UI with value in storedNearbyCarparks
export function updateNearbyCarparksListUI(App) {
  const nearbyCarparksList = $("#nearby-carparks-list");

  if (App.nearbyCarparks === null) return;

  nearbyCarparksList.empty();
  updateInterestedCarparkUI(App);

  App.nearbyCarparks.forEach((carpark) => {

    const coordinates = carpark.coordinates;

    // Skip the interested carpark
    if (carpark.car_park_no === window.interestedCarparkNo) {
      return;
    }

    nearbyCarparksList.append(createCarparksListItemUI(App, carpark, false, "nearby-carpark-list-item-" + carpark.car_park_no));
  });
}

// Update interested carpark UI with value in storedInterestedCarpark
export function updateInterestedCarparkUI(App) {
  const nearbyCarparksList = $("#nearby-carparks-list");

  if (App.interestedCarpark === null) {
    $('#interested-carpark-list-item').remove();
    return;
  }

  const newInterestCarparkItem = createCarparksListItemUI(App, App.interestedCarpark, true, "interested-carpark-list-item");

  if ($('#interested-carpark-list-item').length) { // this tests if interested carpark list item exists
    $('#interested-carpark-list-item').replaceWith(newInterestCarparkItem);
  } else {
    nearbyCarparksList.prepend(newInterestCarparkItem);
  }
}