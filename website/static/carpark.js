import { waitTillTargetReady } from "./helper.js";


export async function findCarparkFromNo(carparkNo, geojsonData) {
    if (!carparkNo) {
      return null;
    }
  
    await waitTillTargetReady(() => geojsonData, 100);
  
    for (let carpark of geojsonData.features) {
      if (carpark.properties.car_park_no === carparkNo) {
        return carpark;
      }
    }
    return null;    // this shouldn't happen
  }