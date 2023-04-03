// Mapbox related stuff

export function isMapReady(map) {
  return map && map.loaded();
}


// Determines if "carparks-data" and "carparks-layer" are ready
export function isCarparksReady(map) {
  return map && map.getSource('carparks-data') && map.getLayer('carparks-layer');
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