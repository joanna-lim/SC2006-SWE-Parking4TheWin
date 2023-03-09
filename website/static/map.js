mapboxgl.accessToken = window.MAPBOX_SECRET_KEY;
        var map = new mapboxgl.Map({
          container: "map",
          style: "mapbox://styles/mapbox/streets-v12",
          center: [103.8198, 1.3521],
          zoom: 12,
        });

        map.on("load", function () {
          map.addSource("carparks-data", {
            type: "geojson",
            data: window.geojsonData
          });

          map.addLayer({
            id: "carparks-layer",
            type: "circle",
            source: "carparks-data",
            paint: {
              "circle-radius": 10,
              "circle-color": [
                "interpolate",
                ["linear"],
                ["get", "vacancy_percentage"],
                0, "red", 
                50, "yellow", 
                100, "green" 
              ],
              "circle-opacity": 0.8
            },
          });

          map.on("click", "carparks-layer", (e) => {
            const coordinates = e.features[0].geometry.coordinates.slice();
            const properties = e.features[0].properties;
            const address = properties.address;
            const lotsAvailable = properties.lots_available;
            const vacancyPercentage = properties.vacancy_percentage;
            while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
              coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
            }

            const description = `
            <p><strong>Address:</strong> ${address}</p>
            <p><strong>Lots Available:</strong> ${lotsAvailable}</p>
            <p><strong>Vacancy Percentage:</strong> ${vacancyPercentage}%</p>
          `;


          new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(description)
            .addTo(map);
        });
        });