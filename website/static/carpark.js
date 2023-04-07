import { waitTillTargetReady, haversine } from "./helper.js";
import { isCarparksReady, updateRouteUI } from "./map.js";
import { Subject } from "./designpatterns.js";
import { updateInterestedCarparkUI, updateIHaveParkedButtonUI } from "./sidebar.js";


export class Carpark extends Subject {
  constructor(coordinates, address, car_park_no, car_park_type,
    free_parking, lots_available, no_of_interested_drivers,
    total_lots, type_of_parking_system, vacancy_percentage, distance_in_km) {

    super();

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

  // Update carpark information by a list of name value pairs
  update(attributeNameValuePairs) {
    let changed = false;

    for (let attributeName of Object.keys(attributeNameValuePairs)) {
      if (!this.hasOwnProperty(attributeName)) {
        console.error(`Object doesn't have the attribute ${attributeName}.`);
        return;
      }

      if (this[attributeName] !== attributeNameValuePairs[attributeName]) {
        changed = true;
        this[attributeName] = attributeNameValuePairs[attributeName];
      }
    }

    if (changed) this.notifyObservers(this, "carpark-update");
  }
}

export default class CarparkData extends Subject {
  constructor(App) {
    super();

    this.App = App;
    this.carparkList = []; // This is used for sorting
    this.carparkDict = {}; // This is intended for fast lookup, key is car_park_no
    this.interestedCarpark = null;
    this.interestedCarparkNo = window.interestedCarparkNo === "None" ? null : window.interestedCarparkNo;
    this.nearbyCarparks = null;
  }

  initializeCarparksFromJson(carparksInJson) {
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
      this.carparkDict[car_park_no] = carpark;
    }
  }

  updateCarparksFromJson(updatedCarparksInJson) {
    for (let carparkInJson of updatedCarparksInJson) {
      this.findCarparkFromNo(carparkInJson.car_park_no).update(carparkInJson);
    }
  }

  findCarparkFromNo(carparkNo) {
    if (!carparkNo) {
      console.error("carparkNo is null. Invalid.");
      return null;
    }

    const carpark = this.carparkDict[carparkNo];

    if (!carpark) {
      console.error("No such carpark of that number exists.");
    }
    return carpark;
  }

  async updateNearbyCarparks(coordinates, radiusInKm) {
    this.nearbyCarparks = await this.findNearbyCarparks(coordinates, radiusInKm);
    this.notifyObservers(this.nearbyCarparks, "nearby-carpark-list-update")
  }

  async findNearbyCarparks(coordinates, radiusInKm) {
    const nearbyCarparks = [];

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

  sortCarparks() {
    const sortProperties = {
      distance: "distance_in_km",
      vacancy: "vacancy_percentage",
    };

    const { sortOrder, sortType } = this.App;

    if (!this.nearbyCarparks || !sortOrder || !sortType) {
      return;
    }

    const propertyToSortBy = sortProperties[sortType];
    if (!propertyToSortBy) {
      console.warn(`Unknown sort type: ${sortType}`);
      return;
    }

    const sortFunction = (a, b) => {
      if (sortOrder === "asc") {
        return a[propertyToSortBy] - b[propertyToSortBy];
      } else {
        return b[propertyToSortBy] - a[propertyToSortBy];
      }
    };
    this.nearbyCarparks.sort(sortFunction);
  }

  // Update database with the user's interested carpark
  async updateInterestedCarpark(App, address, carParkNo) {
    try {
      const response = await fetch('/drivers', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ intent: "update_interested_carpark", carpark_address: address })
      });

      const { success, updatedgeojsondata, op_type } = await response.json();

      if (success) {
        this.updateCarparksFromJson(updatedgeojsondata);

        this.App.map.getSource("carparks-data").setData({
          type: "geojson",
          ...generateGeojsonData(this.carparkList)
        });

        if (op_type == 1) {
          this.interestedCarparkNo = carParkNo;

          var newInterestedCarpark = await App.carparkData.findCarparkFromNo(this.interestedCarparkNo);
          this.interestedCarpark = { ...newInterestedCarpark };
        } else {
          this.interestedCarparkNo = null;
          this.interestedCarpark = null;
        }
      }
      // Update side
      updateInterestedCarparkUI(App);
      updateIHaveParkedButtonUI(App);
      // Update route
      await updateRouteUI(App);

    } catch (error) {
      return console.error(error);
    }
  }
}

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