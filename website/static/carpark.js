import { waitTillTargetReady } from "./helper.js";


export async function findCarparkFromNo(App, carparkNo) {
    if (!carparkNo) {
      return null;
    }
  
    await waitTillTargetReady(() => App.geojsonData, 100);
  
    for (let carpark of App.geojsonData.features) {
      if (carpark.properties.car_park_no === carparkNo) {
        return carpark;
      }
    }
    return null;    // this shouldn't happen
  }

// For a carpark object, find the distance of the carpark from the given center coordinate
// and add it to the carpark object
export function addDistanceToCarpark(coordinates, carpark) {
  const carparkCoordinate = carpark.geometry.coordinates;
  const distanceInKM = turf.distance(turf.point(coordinates),
    turf.point(carparkCoordinate),
    { units: 'kilometers' })
    .toFixed(1);
  carpark.properties.distanceInKM = parseFloat(distanceInKM);
}

// Determines if "carparks-data" and "carparks-layer" are ready
export function isCarparksReady(App) {
  return App.map && App.map.getSource('carparks-data') && App.map.getLayer('carparks-layer');
}

export async function findNearbyCarparks(App, coordinates, radiusInKm) {
  // Create a Turf.js circle object around the center point
  const options = { steps: 10, units: 'kilometers' };
  const circle = turf.circle(coordinates, radiusInKm, options);
  var carparks = null;

  await waitTillTargetReady(() => isCarparksReady(App), 100);

  /*
   * Note that the method that I used to find nearby carparks (map.querySourceFeatures)
   * has some quirks. I think it depends on the `features` visible on the map.
   * I can't change the way it works because its from mapbox API. 
   */

  // Find carparks in the Turf.js circle object
  // This will not always succeed - sometimes return an empty list and sometimes
  // return duplicate entries.
  carparks = App.map.querySourceFeatures('carparks-data', {
    sourceLayer: 'carparks-layer',
    filter: ['within', circle],
  });

  // This is a band-aid solution to the empty list problem.
  while (carparks === null || carparks.length === 0) {
    // wait 1 second before retrying
    await new Promise(resolve => setTimeout(resolve, 1000));

    carparks = App.map.querySourceFeatures('carparks-data', {
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

// Sort nearby carparks based on sortType and sortOrder
// Note that this must be used in conjunction with updateNearbyCarparksUI
export function sortCarparks(App) {
  if (App.nearbyCarparks === null || App.sortOrder === null || App.sortType === null) return;

  if (App.sortType === "distance") {
    if (App.sortOrder === "asc") {
      App.nearbyCarparks.sort((a, b) => {
        return a.properties.distanceInKM - b.properties.distanceInKM;
      });
    } else {
      App.nearbyCarparks.sort((a, b) => {
        return b.properties.distanceInKM - a.properties.distanceInKM;
      });
    }
  } else {
    if (App.sortOrder === "asc") {
      App.nearbyCarparks.sort((a, b) => {
        return a.properties.vacancy_percentage - b.properties.vacancy_percentage;
      });
    } else {
      App.nearbyCarparks.sort((a, b) => {
        return b.properties.vacancy_percentage - a.properties.vacancy_percentage;
      });
    }
  }
}