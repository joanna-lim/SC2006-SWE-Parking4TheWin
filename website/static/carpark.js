import { waitTillTargetReady, haversine } from "./helper.js";
import { isCarparksReady } from "./map.js";


export class Carpark {
  constructor(coordinates, address, car_park_no, car_park_type,
    free_parking, lots_available, no_of_interested_drivers,
    total_lots, type_of_parking_system, vacancy_percentage, distance_in_km) {
    this.coordinates = coordinates;
    this.address = address;
    this.car_park_no = car_park_no;
    this.car_park_type = car_park_type;
    this.free_parking = free_parking;
    this.lots_available = lots_available;
    this.no_of_interested_drivers = no_of_interested_drivers;
    this.total_lots = total_lots;
    this.type_of_parking_system = type_of_parking_system;
    this.vacancy_percentage = vacancy_percentage;
    this.distance_in_km = null;
  }
}

export default class CarparkData {
  constructor(App) {
    this.App = App;
    this.carparkList = [];
    this.interestedCarpark = null;
    this.nearbyCarparks = null;
  }

  async addCarparks(carparksInJson) {
    for (let carparkInJson of carparksInJson) {
      const { coordinates, address, car_park_no, car_park_type,
        free_parking, lots_available, no_of_interested_drivers,
        total_lots, type_of_parking_system, vacancy_percentage,
      } = carparkInJson;

      const carpark = new Carpark(coordinates, address, car_park_no,
        car_park_type, free_parking, lots_available,
        no_of_interested_drivers, total_lots, type_of_parking_system,
        vacancy_percentage, null);

      this.carparkList.push(carpark);
    }
  }

  async updateCarparkByNo(carparkNo) {

  }

  async findCarparkByNo(carparkNo) {
    if (!carparkNo) {
      return null;
    }

    for (let carpark of this.carparkList) {
      if (carpark.car_park_no === carparkNo) {
        return carpark;
      }
    }

    return null;    // this shouldn't happen
  }

  async findNearbyCarparks(coordinates, radiusInKm) {
    // Create a Turf.js circle object around the center point
    // const options = { steps: 10, units: 'kilometers' };
    // const circle = turf.circle(coordinates, radiusInKm, options);
    var nearbyCarparks = [];

    await waitTillTargetReady(() => isCarparksReady(this.App), 100);

    for (let carpark of this.carparkList) {
      const distance = haversine(coordinates, carpark.coordinates).toFixed(1);
      if (distance <= radiusInKm) {
        carpark.distance_in_km = distance;
        nearbyCarparks.push(carpark);
      }
    }

    return nearbyCarparks;
  }

  // Sort nearby carparks based on sortType and sortOrder
  // Note that this must be used in conjunction with updateNearbyCarparksUI
  sortCarparks() {
    if (this.App.nearbyCarparks === null || this.App.sortOrder === null || this.App.sortType === null) return;

    if (this.App.sortType === "distance") {
      if (this.App.sortOrder === "asc") {
        this.App.nearbyCarparks.sort((a, b) => {
          return a.distance_in_km - b.distance_in_km;
        });
      } else {
        this.App.nearbyCarparks.sort((a, b) => {
          return b.distance_in_km - a.distance_in_km;
        });
      }
    } else {
      if (this.App.sortOrder === "asc") {
        this.App.nearbyCarparks.sort((a, b) => {
          return a.vacancy_percentage - b.vacancy_percentage;
        });
      } else {
        this.App.nearbyCarparks.sort((a, b) => {
          return b.vacancy_percentage - a.vacancy_percentage;
        });
      }
    }
  }
}


// // For a carpark object, find the distance of the carpark from the given center coordinate
// // and add it to the carpark object
// function addDistanceToCarpark(coordinates, carpark) {
//   const carparkCoordinate = carpark.coordinates;
//   const distance_in_km = turf.distance(turf.point(coordinates),
//     turf.point(carparkCoordinate),
//     { units: 'kilometers' })
//     .toFixed(1);
//   carpark.distance_in_km = parseFloat(distance_in_km);
// }

export function generateGeojsonData(carparkList) {
  let features = [];

  for (let carpark of carparkList) {
    const { coordinates, address, car_park_no, car_park_type,
      free_parking, lots_available, no_of_interested_drivers,
      total_lots, type_of_parking_system, vacancy_percentage,
    } = carpark;

    const feature = {
      'type': "Feature",
      'geometry': {
        'type': 'Point',
        'coordinates': coordinates
      },
      'properties': {
        'address': address,
        'car_park_no': car_park_no,
        'car_park_type': car_park_type,
        'free_parking': free_parking,
        'lots_available': lots_available,
        'no_of_interested_drivers': no_of_interested_drivers,
        'total_lots': total_lots,
        'type_of_parking_system': type_of_parking_system,
        'vacancy_percentage': vacancy_percentage
      }
    }
    features.push(feature);
  }

  const geojsonData = {
    'type': 'FeatureCollection',
    'features': features
  };

  return geojsonData;
}